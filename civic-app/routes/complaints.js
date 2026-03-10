const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = [
  'Road & Infrastructure', 'Water Supply', 'Electricity',
  'Waste Management', 'Public Safety', 'Other Civic Issues'
];
const VALID_STATUSES = ['Under Review', 'Assigned', 'In Progress', 'Resolved'];

function generateComplaintId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CMP-${ts}-${rand}`;
}

// POST /api/complaints — Submit a complaint (citizen)
router.post('/', authenticateToken, requireRole('citizen'), async (req, res) => {
  try {
    const { title, description, category, location, image_url } = req.body;

    if (!title || !description || !category || !location)
      return res.status(400).json({ error: 'Title, description, category, and location are required' });

    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: 'Invalid category' });

    const complaintId = generateComplaintId();

    await dbRun(
      `INSERT INTO complaints (complaint_id, title, description, category, location, image_url, citizen_id)
       VALUES (?,?,?,?,?,?,?)`,
      [complaintId, title.trim(), description.trim(), category, location.trim(), image_url || null, req.user.id]
    );

    await dbRun(
      `INSERT INTO complaint_updates (complaint_id, status, remark, updated_by) VALUES (?,?,?,?)`,
      [complaintId, 'Submitted', 'Complaint submitted successfully.', req.user.id]
    );

    res.status(201).json({ message: 'Complaint submitted successfully', complaintId });
  } catch (err) {
    console.error('Submit complaint error:', err);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

// GET /api/complaints — List complaints (role-filtered)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let complaints;

    if (req.user.role === 'citizen') {
      complaints = await dbAll(
        `SELECT c.*,
           (SELECT rating FROM feedback WHERE complaint_id = c.complaint_id) as feedback_rating
         FROM complaints c
         WHERE c.citizen_id = ?
         ORDER BY c.created_at DESC`,
        [req.user.id]
      );
    } else if (req.user.role === 'official') {
      complaints = await dbAll(
        `SELECT c.*, u.name as citizen_name
         FROM complaints c
         JOIN users u ON c.citizen_id = u.id
         WHERE c.assigned_to = ?
         ORDER BY c.created_at DESC`,
        [req.user.id]
      );
    } else {
      // admin — all complaints
      complaints = await dbAll(
        `SELECT c.*, u.name as citizen_name, o.name as assigned_officer
         FROM complaints c
         JOIN users u ON c.citizen_id = u.id
         LEFT JOIN users o ON c.assigned_to = o.id
         ORDER BY c.created_at DESC`,
        []
      );
    }

    res.json(complaints);
  } catch (err) {
    console.error('Get complaints error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// GET /api/complaints/:id — Get complaint detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const complaint = await dbGet(
      `SELECT c.*, u.name as citizen_name, u.email as citizen_email, u.phone as citizen_phone,
         o.name as assigned_officer, o.department as officer_department
       FROM complaints c
       JOIN users u ON c.citizen_id = u.id
       LEFT JOIN users o ON c.assigned_to = o.id
       WHERE c.complaint_id = ?`,
      [req.params.id]
    );

    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    // Citizens can only view their own complaints
    if (req.user.role === 'citizen' && complaint.citizen_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    const updates = await dbAll(
      `SELECT cu.*, u.name as updated_by_name, u.role as updated_by_role
       FROM complaint_updates cu
       JOIN users u ON cu.updated_by = u.id
       WHERE cu.complaint_id = ?
       ORDER BY cu.created_at ASC`,
      [req.params.id]
    );

    const feedback = await dbGet('SELECT * FROM feedback WHERE complaint_id = ?', [req.params.id]);

    res.json({ ...complaint, updates, feedback: feedback || null });
  } catch (err) {
    console.error('Get complaint detail error:', err);
    res.status(500).json({ error: 'Failed to fetch complaint details' });
  }
});

// PUT /api/complaints/:id/status — Update status (official or admin)
router.put('/:id/status', authenticateToken, requireRole('official', 'admin'), async (req, res) => {
  try {
    const { status, remark } = req.body;

    if (!status || !VALID_STATUSES.includes(status))
      return res.status(400).json({ error: 'Invalid status value' });

    const complaint = await dbGet('SELECT * FROM complaints WHERE complaint_id = ?', [req.params.id]);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    if (req.user.role === 'official' && complaint.assigned_to !== req.user.id)
      return res.status(403).json({ error: 'You can only update complaints assigned to you' });

    await dbRun(
      `UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
      [status, req.params.id]
    );

    await dbRun(
      `INSERT INTO complaint_updates (complaint_id, status, remark, updated_by) VALUES (?,?,?,?)`,
      [req.params.id, status, remark ? remark.trim() : null, req.user.id]
    );

    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PUT /api/complaints/:id/assign — Assign complaint (admin only)
router.put('/:id/assign', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { official_id } = req.body;

    if (!official_id)
      return res.status(400).json({ error: 'Official ID is required' });

    const official = await dbGet(
      `SELECT id, name, department FROM users WHERE id = ? AND role = 'official'`,
      [official_id]
    );
    if (!official) return res.status(404).json({ error: 'Official not found' });

    const complaint = await dbGet('SELECT * FROM complaints WHERE complaint_id = ?', [req.params.id]);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    await dbRun(
      `UPDATE complaints SET assigned_to = ?, department = ?, status = 'Assigned',
         updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
      [official_id, official.department, req.params.id]
    );

    await dbRun(
      `INSERT INTO complaint_updates (complaint_id, status, remark, updated_by) VALUES (?,?,?,?)`,
      [req.params.id, 'Assigned', `Assigned to ${official.name} (${official.department})`, req.user.id]
    );

    res.json({ message: 'Complaint assigned successfully' });
  } catch (err) {
    console.error('Assign complaint error:', err);
    res.status(500).json({ error: 'Failed to assign complaint' });
  }
});

// POST /api/complaints/:id/feedback — Submit feedback (citizen, resolved complaints only)
router.post('/:id/feedback', authenticateToken, requireRole('citizen'), async (req, res) => {
  try {
    const { rating, feedback_text } = req.body;

    const ratingNum = parseInt(rating, 10);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5)
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });

    const complaint = await dbGet(
      `SELECT * FROM complaints WHERE complaint_id = ? AND citizen_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    if (complaint.status !== 'Resolved')
      return res.status(400).json({ error: 'Feedback can only be submitted for resolved complaints' });

    const existing = await dbGet('SELECT id FROM feedback WHERE complaint_id = ?', [req.params.id]);
    if (existing) return res.status(409).json({ error: 'Feedback already submitted' });

    await dbRun(
      `INSERT INTO feedback (complaint_id, rating, feedback_text, citizen_id) VALUES (?,?,?,?)`,
      [req.params.id, ratingNum, feedback_text ? feedback_text.trim() : null, req.user.id]
    );

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Submit feedback error:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

module.exports = router;
