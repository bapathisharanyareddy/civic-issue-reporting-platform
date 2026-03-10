const express = require('express');
const path = require('path');
const cors = require('cors');
const { initializeDatabase, dbRun, dbGet, dbAll } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

// ─────────────────────────────────────────────────────────────
// OVERDUE COMPLAINT CHECKER
// Runs at startup + every hour. Creates one in-app notification
// per day per overdue complaint for the assigned official.
// ─────────────────────────────────────────────────────────────
async function checkOverdueComplaints() {
  try {
    const overdue = await dbAll(
      `SELECT c.complaint_id, c.title, c.deadline_date, c.assigned_to,
              CAST(JULIANDAY('now') - JULIANDAY(c.deadline_date) AS INTEGER) as days_overdue
       FROM complaints c
       WHERE c.deadline_date IS NOT NULL
         AND c.deadline_date < DATE('now')
         AND c.status NOT IN ('Resolved', 'Rejected')
         AND c.assigned_to IS NOT NULL`,
      []
    );
    const today = new Date().toISOString().split('T')[0];
    for (const c of overdue) {
      const existing = await dbGet(
        `SELECT id FROM notifications WHERE complaint_id = ? AND official_id = ? AND DATE(created_at) = ?`,
        [c.complaint_id, c.assigned_to, today]
      );
      if (!existing) {
        const d = c.days_overdue || 1;
        const msg = `⚠️ Deadline passed ${d} day${d !== 1 ? 's' : ''} ago for complaint "${c.title}" (${c.complaint_id}). Please resolve it immediately.`;
        await dbRun(
          `INSERT INTO notifications (complaint_id, official_id, message) VALUES (?,?,?)`,
          [c.complaint_id, c.assigned_to, msg]
        );
      }
    }
    if (overdue.length > 0)
      console.log(`[Overdue Check] ${overdue.length} overdue complaint(s) — notifications created where needed.`);
  } catch (err) {
    console.error('[Overdue Check] Error:', err.message);
  }
}

// Serve SPA for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\nCivicConnect server running at http://localhost:${PORT}`);
      console.log('\nDefault accounts:');
      console.log('  Admin:    admin@civic.gov    / admin123');
      console.log('  Official: road@civic.gov     / official123');
      console.log('  (Register a new account to log in as a citizen)\n');
    });
    checkOverdueComplaints();                            // run immediately on boot
    setInterval(checkOverdueComplaints, 60 * 60 * 1000); // then every hour
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
