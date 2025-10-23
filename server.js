import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import multer from 'multer';
import dotenv from 'dotenv';
import { Low } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import { nanoid } from 'nanoid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const file = './db.json';
const adapter = new JSONFileSync(file);
const db = new Low(adapter, { posts: [], staff: [] });
db.read();
db.data ||= { posts: [], staff: [] };

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'betteh-secret',
  resave: false,
  saveUninitialized: true
}));

// Routes
app.get('/', (req, res) => res.render('index', { posts: db.data.posts }));
app.get('/gallery', (req, res) => res.render('gallery', { posts: db.data.posts }));
app.get('/industry', (req, res) => res.render('industry'));
app.get('/staff', (req, res) => res.render('staff', { staff: db.data.staff }));

// Admin Login
app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'Betteh music' && password === 'Betteh@') {
    req.session.user = username;
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('dashboard', { posts: db.data.posts, staff: db.data.staff });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
