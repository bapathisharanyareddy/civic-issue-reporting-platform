const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');
let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH);
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');
  }
  return db;
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDb();

    database.serialize(() => {
      database.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'citizen' CHECK(role IN ('citizen','official','admin')),
        department TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      database.run(`CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        location TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'Submitted',
        citizen_id INTEGER NOT NULL,
        assigned_to INTEGER,
        department TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (citizen_id) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`);

      database.run(`CREATE TABLE IF NOT EXISTS complaint_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT NOT NULL,
        status TEXT NOT NULL,
        remark TEXT,
        updated_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )`);

      database.run(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT UNIQUE NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        feedback_text TEXT,
        citizen_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id),
        FOREIGN KEY (citizen_id) REFERENCES users(id)
      )`);

      // Seed default admin and sample official using synchronous bcrypt
      const adminHash = bcrypt.hashSync('admin123', 12);
      const officialHash = bcrypt.hashSync('official123', 12);

      database.run(
        `INSERT OR IGNORE INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)`,
        ['Administrator', 'admin@civic.gov', '9999999999', adminHash, 'admin']
      );

      database.run(
        `INSERT OR IGNORE INTO users (name, email, phone, password_hash, role, department) VALUES (?,?,?,?,?,?)`,
        ['Road Dept. Officer', 'road@civic.gov', '8888888888', officialHash, 'official', 'Road & Infrastructure'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
}

module.exports = { initializeDatabase, dbRun, dbGet, dbAll };
