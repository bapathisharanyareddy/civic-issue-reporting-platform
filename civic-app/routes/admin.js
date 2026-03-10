const express = require('express');
const bcrypt = require('bcryptjs');
const { dbRun, dbGet, dbAll } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/admin/stats
router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [total, submitted, inProgress, resolved, citizens, officials, categoryStats, avgRating] =
      await Promise.all([
        dbGet('SELECT COUNT(*) as n FROM complaints', []),
        dbGet(`SELECT COUNT(*) as n FROM complaints WHERE status = 'Submitted'`, []),
        dbGet(`SELECT COUNT(*) as n FROM complaints WHERE status IN ('Under Review','Assigned','In Progress')`, []),
        dbGet(`SELECT COUNT(*) as n FROM complaints WHERE status = 'Resolved'`, []),
        dbGet(`SELECT COUNT(*) as n FROM users WHERE role = 'citizen'`, []),
        dbGet(`SELECT COUNT(*) as n FROM users WHERE role = 'official'`, []),
        dbAll('SELECT category, COUNT(*) as count FROM complaints GROUP BY category ORDER BY count DESC', []),
        dbGet('SELECT ROUND(AVG(rating),1) as avg FROM feedback', [])
      ]);

    res.json({
      total: total.n,
      submitted: submitted.n,
      inProgress: inProgress.n,
      resolved: resolved.n,
      citizens: citizens.n,
      officials: officials.n,
      categoryStats,
      avgRating: avgRating.avg || null
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/admin/users
router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await dbAll(
      `SELECT id, name, email, phone, role, department, created_at FROM users ORDER BY role, name`,
      []
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/officials  (for assignment dropdown)
router.get('/officials', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const officials = await dbAll(
      `SELECT u.id, u.name, u.email, u.department,
         COUNT(CASE WHEN c.status != 'Resolved' THEN 1 END) as active_count
       FROM users u
       LEFT JOIN complaints c ON c.assigned_to = u.id
       WHERE u.role = 'official'
       GROUP BY u.id
       ORDER BY u.name`,
      []
    );
    res.json(officials);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch officials' });
  }
});

// POST /api/admin/officials  (create official account)
router.post('/officials', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, phone, password, department } = req.body;

    if (!name || !email || !password || !department)
      return res.status(400).json({ error: 'Name, email, password, and department are required' });

    if (!EMAIL_RE.test(email))
      return res.status(400).json({ error: 'Invalid email format' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    await dbRun(
      `INSERT INTO users (name, email, phone, password_hash, role, department) VALUES (?,?,?,?,?,?)`,
      [name.trim(), email.toLowerCase().trim(), phone ? phone.trim() : null, passwordHash, 'official', department]
    );

    res.status(201).json({ message: 'Official account created successfully' });
  } catch (err) {
    console.error('Create official error:', err);
    res.status(500).json({ error: 'Failed to create official' });
  }
});

// GET /api/admin/analytics — Full analytics for admin dashboard
router.get('/analytics', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [
      statusDist,
      categoryStats,
      priorityStats,
      areaStats,
      topByCount,
      overdue,
      resolvedRate
    ] = await Promise.all([
      dbAll(`SELECT status, COUNT(*) as count FROM complaints GROUP BY status ORDER BY count DESC`, []),
      dbAll(`SELECT category, COUNT(*) as count, SUM(complaint_count) as total_reports
             FROM complaints GROUP BY category ORDER BY count DESC`, []),
      dbAll(`SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority
             ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END`, []),
      dbAll(`SELECT location,
               COUNT(*) as complaint_count,
               SUM(complaint_count) as total_reports,
               GROUP_CONCAT(DISTINCT category) as categories
             FROM complaints
             GROUP BY location
             ORDER BY total_reports DESC
             LIMIT 15`, []),
      dbAll(`SELECT complaint_id, title, category, location, status, priority, complaint_count, created_at
             FROM complaints
             ORDER BY complaint_count DESC
             LIMIT 10`, []),
      dbAll(`SELECT complaint_id, title, category, location, status, priority,
               deadline_date, deadline_days,
               CAST(JULIANDAY('now') - JULIANDAY(deadline_date) AS INTEGER) as days_overdue
             FROM complaints
             WHERE deadline_date IS NOT NULL
               AND deadline_date < DATE('now')
               AND status != 'Resolved'
             ORDER BY days_overdue DESC`, []),
      dbGet(`SELECT
               ROUND(100.0 * SUM(CASE WHEN status='Resolved' THEN 1 ELSE 0 END) / COUNT(*), 1) as rate
             FROM complaints`, [])
    ]);

    res.json({
      statusDist,
      categoryStats,
      priorityStats,
      areaStats,
      topByCount,
      overdue,
      resolvedRate: resolvedRate ? resolvedRate.rate : 0
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/overdue — Complaints past their deadline
router.get('/overdue', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const overdue = await dbAll(
      `SELECT c.complaint_id, c.title, c.category, c.location, c.status, c.priority,
              c.deadline_date, c.deadline_days,
              CAST(JULIANDAY('now') - JULIANDAY(c.deadline_date) AS INTEGER) as days_overdue,
              u.name as citizen_name, o.name as assigned_officer
       FROM complaints c
       JOIN users u ON c.citizen_id = u.id
       LEFT JOIN users o ON c.assigned_to = o.id
       WHERE c.deadline_date IS NOT NULL
         AND c.deadline_date < DATE('now')
         AND c.status != 'Resolved'
       ORDER BY days_overdue DESC`,
      []
    );
    res.json(overdue);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch overdue complaints' });
  }
});

module.exports = router;
