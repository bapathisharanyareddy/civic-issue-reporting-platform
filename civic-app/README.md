# CivicConnect — Civic Grievance Management System

A full-stack web application for citizens to report civic issues and for government officials to manage and resolve them.

---

## Features

### Citizens
- Register / Login securely
- Submit complaints with title, description, category, location, and optional image URL
- Track complaint status with a full activity timeline
- Provide star ratings and feedback after resolution

### Government Officials
- View complaints assigned to them
- Update complaint status with remarks
- Track their resolution history

### Administrators
- View system-wide analytics and category breakdowns
- Assign complaints to officials
- Create new official accounts
- Manage all users

---

## Tech Stack

| Layer    | Technology                   |
|----------|------------------------------|
| Backend  | Node.js + Express.js         |
| Database | SQLite3 (file-based, zero setup) |
| Auth     | JWT (JSON Web Tokens) + bcryptjs |
| Frontend | Vanilla HTML / CSS / JavaScript (SPA) |

---

## Project Structure

```
civic-app/
├── server.js              # Express app entry point
├── db.js                  # SQLite database + helpers
├── package.json
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   ├── auth.js            # Register / Login
│   ├── complaints.js      # Complaint CRUD + assign + feedback
│   └── admin.js           # Admin stats / user management
└── public/                # Static frontend files (SPA)
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Setup & Running

### Prerequisites
- **Node.js v16+** — Download from https://nodejs.org

### Steps

```bash
# 1. Open a terminal and go to the project folder
cd civic-app

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

The server will start at **http://localhost:3000**

---

## Default Accounts

| Role     | Email               | Password     |
|----------|---------------------|--------------|
| Admin    | admin@civic.gov     | admin123     |
| Official | road@civic.gov      | official123  |
| Citizen  | *(register a new account)* | — |

---

## API Endpoints

### Auth
| Method | Endpoint           | Description        |
|--------|--------------------|--------------------|
| POST   | /api/auth/register | Register citizen   |
| POST   | /api/auth/login    | Login              |

### Complaints
| Method | Endpoint                         | Access              |
|--------|----------------------------------|---------------------|
| POST   | /api/complaints                  | Citizen             |
| GET    | /api/complaints                  | All (role-filtered) |
| GET    | /api/complaints/:id              | All (role-filtered) |
| PUT    | /api/complaints/:id/status       | Official / Admin    |
| PUT    | /api/complaints/:id/assign       | Admin               |
| POST   | /api/complaints/:id/feedback     | Citizen             |

### Admin
| Method | Endpoint              | Access |
|--------|-----------------------|--------|
| GET    | /api/admin/stats      | Admin  |
| GET    | /api/admin/users      | Admin  |
| GET    | /api/admin/officials  | Admin  |
| POST   | /api/admin/officials  | Admin  |

---

## Complaint Status Flow

```
Submitted → Under Review → Assigned → In Progress → Resolved
```

---

## Complaint Categories
- Road & Infrastructure
- Water Supply
- Electricity
- Waste Management
- Public Safety
- Other Civic Issues
