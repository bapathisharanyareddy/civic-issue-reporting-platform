const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — unread overdue reminders for the current official
router.get('/', authenticateToken, requireRole('official'), async (req, res) => {
  try {
    const notifications = await dbAll(
      `SELECT n.*, c.title as complaint_title, c.deadline_date
       FROM notifications n
       JOIN complaints c ON n.complaint_id = c.complaint_id
       WHERE n.official_id = ? AND n.is_read = 0
       ORDER BY n.created_at DESC`,
      [req.user.id]
    );
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/read-all — mark all as read for current official
router.put('/read-all', authenticateToken, requireRole('official'), async (req, res) => {
  try {
    await dbRun(
      `UPDATE notifications SET is_read = 1 WHERE official_id = ?`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss notifications' });
  }
});

// PUT /api/notifications/:id/read — mark a single notification as read
router.put('/:id/read', authenticateToken, requireRole('official'), async (req, res) => {
  try {
    await dbRun(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND official_id = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

module.exports = router;
