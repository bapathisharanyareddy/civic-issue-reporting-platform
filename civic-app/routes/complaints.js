const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = [
  'Road & Infrastructure', 'Water Supply', 'Electricity',
  'Waste Management', 'Public Safety', 'Other Civic Issues'
];
const VALID_STATUSES = ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// Category → Department mapping for auto-assignment
const CATEGORY_DEPT_MAP = {
  'Road & Infrastructure': 'Road & Infrastructure',
  'Water Supply':          'Water Supply',
  'Electricity':           'Electricity',
  'Waste Management':      'Waste Management',
  'Public Safety':         'Public Safety',
  'Other Civic Issues':    null   // will try any available official
};

// Auto-determine priority from category and description keywords
function autoPriority(category, title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const emergencyWords = ['emergency', 'collapse', 'accident', 'flood', 'fire', 'danger', 'explosion', 'electrocution', 'death'];
  const urgentWords    = ['urgent', 'serious', 'broken', 'dangerous', 'hazard', 'injury', 'injured', 'bleeding'];
  if (emergencyWords.some(w => text.includes(w))) return 'Critical';
  if (category === 'Public Safety') return 'High';
  if (urgentWords.some(w => text.includes(w))) return 'High';
  if (category === 'Electricity') return 'High';
  if (category === 'Water Supply') return 'Medium';
  return 'Medium';
}

function generateComplaintId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CMP-${ts}-${rand}`;
}

// ──────────────────────────────────────────────────────────────
// POST /api/complaints — Submit a complaint (citizen)
// ──────────────────────────────────────────────────────────────
router.post('/', authenticateToken, requireRole('citizen'), async (req, res) => {
  try {
    const { title, description, category, location, image_url, latitude, longitude } = req.body;

    if (!title || !description || !category || !location)
      return res.status(400).json({ error: 'Title, description, category, and location are required' });
    if (!image_url)
      return res.status(400).json({ error: 'Photo evidence is required' });

    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: 'Invalid category' });

    // ── Duplicate Detection (title + category, no lat/lng) ────
    const titleKey = title.trim().toLowerCase().substring(0, 25);
    const duplicate = await dbGet(
      `SELECT complaint_id, complaint_count FROM complaints
       WHERE category = ?
         AND status NOT IN ('Resolved', 'Rejected')
         AND LOWER(SUBSTR(title,1,25)) = ?
         AND location = ?
       LIMIT 1`,
      [category, titleKey, location.trim()]
    );
    if (duplicate) {
      await dbRun(
        `UPDATE complaints SET complaint_count = complaint_count + 1,
           updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
        [duplicate.complaint_id]
      );
      return res.status(200).json({
        isDuplicate: true,
        complaintId: duplicate.complaint_id,
        complaint_count: (duplicate.complaint_count || 1) + 1,
        message: 'This issue has already been reported in your area. Your report has been added to the existing complaint.'
      });
    }

    const priority    = autoPriority(category, title.trim(), description.trim());
    const complaintId = generateComplaintId();

    await dbRun(
      `INSERT INTO complaints
         (complaint_id, title, description, category, location, latitude, longitude, priority, image_url, citizen_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [complaintId, title.trim(), description.trim(), category,
       location.trim(),
       (latitude != null && isFinite(latitude))  ? latitude  : null,
       (longitude != null && isFinite(longitude)) ? longitude : null,
       priority, image_url || null, req.user.id]
    );

    await dbRun(
      `INSERT INTO complaint_updates (complaint_id, status, remark, updated_by) VALUES (?,?,?,?)`,
      [complaintId, 'Submitted', 'Complaint submitted successfully.', req.user.id]
    );

    // ── Auto-assignment ────────────────────────────────────────
    const targetDept = CATEGORY_DEPT_MAP[category];
    const official = await dbGet(
      `SELECT u.id, u.name, u.department
       FROM users u
       WHERE u.role = 'official'
         ${targetDept ? "AND u.department = ?" : ""}
       ORDER BY (
         SELECT COUNT(*) FROM complaints c
         WHERE c.assigned_to = u.id AND c.status NOT IN ('Resolved','Rejected')
       ) ASC
       LIMIT 1`,
      targetDept ? [targetDept] : []
    );

    if (official) {
      await dbRun(
        `UPDATE complaints SET assigned_to = ?, department = ?, status = 'Assigned',
           updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
        [official.id, official.department, complaintId]
      );
      await dbRun(
        `INSERT INTO complaint_updates (complaint_id, status, remark, updated_by) VALUES (?,?,?,?)`,
        [complaintId, 'Assigned',
         `Auto-assigned to ${official.name} (${official.department}).`,
         req.user.id]
      );
    }

    res.status(201).json({
      isDuplicate: false,
      message: 'Complaint submitted successfully',
      complaintId,
      autoAssigned: !!official,
      assignedTo: official ? official.name : null,
      priority
    });
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
         ORDER BY CASE c.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
                  c.created_at DESC`,
        [req.user.id]
      );
    } else {
      // admin — all complaints, sorted by priority then count
      complaints = await dbAll(
        `SELECT c.*, u.name as citizen_name, o.name as assigned_officer
         FROM complaints c
         JOIN users u ON c.citizen_id = u.id
         LEFT JOIN users o ON c.assigned_to = o.id
         ORDER BY CASE c.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
                  c.complaint_count DESC, c.created_at DESC`,
        []
      );
    }

    const now = new Date();
    res.json(complaints.map(c => ({
      ...c,
      isOverdue: !!(c.deadline_date && new Date(c.deadline_date) < now
                   && c.status !== 'Resolved' && c.status !== 'Rejected')
    })));
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

    let isOverdue = false;
    if (complaint.deadline_date && complaint.status !== 'Resolved') {
      isOverdue = new Date(complaint.deadline_date) < new Date();
    }

    res.json({ ...complaint, updates, feedback: feedback || null, isOverdue });
  } catch (err) {
    console.error('Get complaint detail error:', err);
    res.status(500).json({ error: 'Failed to fetch complaint details' });
  }
});

// PUT /api/complaints/:id/status — Update status (official or admin)
router.put('/:id/status', authenticateToken, requireRole('official', 'admin'), async (req, res) => {
  try {
    const { status, remark, expected_days } = req.body;

    const officialStatuses = ['Under Review', 'In Progress', 'Resolved'];
    if (!status || !officialStatuses.includes(status))
      return res.status(400).json({ error: 'Invalid status. Allowed: Under Review, In Progress, Resolved' });

    const complaint = await dbGet('SELECT * FROM complaints WHERE complaint_id = ?', [req.params.id]);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    if (complaint.status === 'Rejected')
      return res.status(400).json({ error: 'Cannot update a rejected complaint' });

    if (req.user.role === 'official' && complaint.assigned_to !== req.user.id)
      return res.status(403).json({ error: 'You can only update complaints assigned to you' });

    // Handle optional expected resolution days → set/update deadline
    const days = (expected_days && status !== 'Resolved') ? parseInt(expected_days, 10) : null;
    let deadlineDateStr = null;
    if (days && days >= 1 && days <= 365) {
      const dd = new Date();
      dd.setDate(dd.getDate() + days);
      deadlineDateStr = dd.toISOString().split('T')[0];
      await dbRun(
        `UPDATE complaints SET status = ?, deadline_days = ?, deadline_date = ?,
           updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
        [status, days, deadlineDateStr, req.params.id]
      );
    } else {
      await dbRun(
        `UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
        [status, req.params.id]
      );
    }

    const remarkParts = [];
    if (remark && remark.trim()) remarkParts.push(remark.trim());
    if (deadlineDateStr) remarkParts.push(`Expected resolution by ${deadlineDateStr} (${days} day${days !== 1 ? 's' : ''}).`);

    await dbRun(
      `INSERT INTO complaint_updates (complaint_id, status, remark, updated_by) VALUES (?,?,?,?)`,
      [req.params.id, status, remarkParts.length ? remarkParts.join(' ') : null, req.user.id]
    );

    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PUT /api/complaints/:id/reject — Reject a complaint (admin only)
router.put('/:id/reject', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim())
      return res.status(400).json({ error: 'A rejection reason is required' });

    const complaint = await dbGet('SELECT * FROM complaints WHERE complaint_id = ?', [req.params.id]);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    if (complaint.status === 'Resolved')
      return res.status(400).json({ error: 'Cannot reject an already resolved complaint' });
    if (complaint.status === 'Rejected')
      return res.status(400).json({ error: 'Complaint is already rejected' });

    await dbRun(
      `UPDATE complaints SET status = 'Rejected', rejection_reason = ?,
         updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
      [reason.trim(), req.params.id]
    );
    await dbRun(
      `INSERT INTO complaint_updates (complaint_id, status, remark, updated_by) VALUES (?,?,?,?)`,
      [req.params.id, 'Rejected', `Rejected: ${reason.trim()}`, req.user.id]
    );

    res.json({ message: 'Complaint rejected successfully' });
  } catch (err) {
    console.error('Reject complaint error:', err);
    res.status(500).json({ error: 'Failed to reject complaint' });
  }
});

// PUT /api/complaints/:id/priority — Change priority (admin)
router.put('/:id/priority', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { priority } = req.body;
    if (!VALID_PRIORITIES.includes(priority))
      return res.status(400).json({ error: 'Invalid priority. Use: Low, Medium, High, Critical' });
    const c = await dbGet('SELECT id FROM complaints WHERE complaint_id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Complaint not found' });
    await dbRun(
      `UPDATE complaints SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
      [priority, req.params.id]
    );
    res.json({ message: 'Priority updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

// PUT /api/complaints/:id/deadline — Set deadline (admin)
router.put('/:id/deadline', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const days = parseInt(req.body.deadline_days, 10);
    if (!days || days < 1 || days > 365)
      return res.status(400).json({ error: 'deadline_days must be between 1 and 365' });
    const c = await dbGet('SELECT id FROM complaints WHERE complaint_id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Complaint not found' });
    const dd = new Date();
    dd.setDate(dd.getDate() + days);
    const deadlineDateStr = dd.toISOString().split('T')[0];
    await dbRun(
      `UPDATE complaints SET deadline_days = ?, deadline_date = ?,
         updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
      [days, deadlineDateStr, req.params.id]
    );
    res.json({ message: 'Deadline set successfully', deadline_date: deadlineDateStr });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set deadline' });
  }
});

// PUT /api/complaints/:id/assign — Assign complaint (admin only)
router.put('/:id/assign', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { official_id, deadline_days } = req.body;

    if (!official_id)
      return res.status(400).json({ error: 'Official ID is required' });

    const official = await dbGet(
      `SELECT id, name, department FROM users WHERE id = ? AND role = 'official'`,
      [official_id]
    );
    if (!official) return res.status(404).json({ error: 'Official not found' });

    const complaint = await dbGet('SELECT * FROM complaints WHERE complaint_id = ?', [req.params.id]);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const days = deadline_days ? parseInt(deadline_days, 10) : null;
    let deadlineDateStr = null;
    if (days && days > 0 && days <= 365) {
      const dd = new Date();
      dd.setDate(dd.getDate() + days);
      deadlineDateStr = dd.toISOString().split('T')[0];
    }

    await dbRun(
      `UPDATE complaints SET assigned_to = ?, department = ?, status = 'Assigned',
         deadline_days = COALESCE(?, deadline_days),
         deadline_date = COALESCE(?, deadline_date),
         updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?`,
      [official_id, official.department, days || null, deadlineDateStr || null, req.params.id]
    );

    await dbRun(
      `INSERT INTO complaint_updates (complaint_id, status, remark, updated_by) VALUES (?,?,?,?)`,
      [req.params.id, 'Assigned',
       `Assigned to ${official.name} (${official.department})${deadlineDateStr ? '. Deadline: ' + deadlineDateStr : ''}`,
       req.user.id]
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
