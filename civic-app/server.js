const express = require('express');
const path = require('path');
const cors = require('cors');
const { initializeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/admin', require('./routes/admin'));

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
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
