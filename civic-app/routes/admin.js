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

module.exports = router;
