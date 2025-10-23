require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// lowdb setup
import { low } from 'lowdb'
import { JSONFilesync } from 'lowdb/node'
  
const file ='.db.json'
const adapter = new JSONFilesync(file);
const db = new Low(adapter, { posts: [], staff: []})

// Initialize DB and create initial admin from .env if none exists
async function initDB(){
  await db.read();
  db.data = db.data || { admins: [], posts: [], gallery: [], staff: [], social: {} };
  if ((!db.data.admins || db.data.admins.length === 0) && process.env.ADMIN_USER && process.env.ADMIN_PASS) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASS, 10);
    db.data.admins = [{ id: nanoid(), username: process.env.ADMIN_USER, passwordHash: hash }];
    await db.write();
    console.log('Initial admin created from .env (username:', process.env.ADMIN_USER, ')');
  } else {
    await db.write();
  }
}
initDB();

// Multer uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + nanoid(6) + ext);
  }
});
const upload = multer({ storage });

// Express setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));

// Auth middleware
async function ensureAdmin(req, res, next){
  if (req.session && req.session.user) {
    await db.read();
    const admin = db.data.admins.find(a => a.username === req.session.user);
    if (admin) return next();
  }
  res.redirect('/login');
}

// Public routes
app.get('/', async (req, res) => {
  await db.read();
  const recent = [...db.data.posts].reverse().slice(0,6);
  res.render('index', { posts: recent, social: db.data.social || {}, user: req.session.user, brand: 'Betteh Music' });
});

app.get('/industry', async (req, res) => {
  await db.read();
  res.render('industry', { posts: db.data.posts, social: db.data.social || {}, user: req.session.user, brand: 'Betteh Music' });
});

app.get('/gallery', async (req, res) => {
  await db.read();
  res.render('gallery', { images: db.data.gallery, social: db.data.social || {}, user: req.session.user, brand: 'Betteh Music' });
});

app.get('/staff', async (req, res) => {
  await db.read();
  res.render('staff', { staff: db.data.staff, social: db.data.social || {}, user: req.session.user, brand: 'Betteh Music' });
});

// Login / logout
app.get('/login', (req, res) => {
  res.render('login', { error: null, brand: 'Betteh Music' });
});

app.post('/login', async (req,res) => {
  const { username, password } = req.body;
  await db.read();
  const admin = db.data.admins.find(a => a.username === username);
  if (!admin) return res.render('login', { error: 'Invalid credentials', brand: 'Betteh Music' });
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (ok) {
    req.session.user = username;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid credentials', brand: 'Betteh Music' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(()=>res.redirect('/'));
});

// Admin routes
app.get('/admin', ensureAdmin, async (req, res) => {
  await db.read();
  res.render('admin/dashboard', { db: db.data, social: db.data.social || {}, user: req.session.user, brand: 'Betteh Music' });
});

// Gallery: upload, edit caption, delete
app.post('/admin/gallery/upload', ensureAdmin, upload.single('image'), async (req, res) => {
  await db.read();
  if (!req.file) return res.redirect('/admin');
  db.data.gallery.push({ id: nanoid(), filename: req.file.filename, caption: req.body.caption || '' });
  await db.write();
  res.redirect('/admin');
});
app.post('/admin/gallery/edit/:id', ensureAdmin, async (req, res) => {
  await db.read();
  const g = db.data.gallery.find(x=>x.id===req.params.id);
  if (g) {
    g.caption = req.body.caption || g.caption;
    await db.write();
  }
  res.redirect('/admin');
});
app.post('/admin/gallery/delete/:id', ensureAdmin, async (req, res) => {
  await db.read();
  const item = db.data.gallery.find(i=>i.id===req.params.id);
  if (item) {
    const p = path.join(uploadsDir, item.filename);
    try { fs.unlinkSync(p); } catch(e){}
    db.data.gallery = db.data.gallery.filter(i=>i.id!==req.params.id);
    await db.write();
  }
  res.redirect('/admin');
});

// Posts: add, edit, delete
app.post('/admin/posts/add', ensureAdmin, upload.single('image'), async (req, res) => {
  await db.read();
  const post = {
    id: nanoid(),
    title: req.body.title || 'Untitled',
    description: req.body.description || '',
    image: req.file ? req.file.filename : '',
    createdAt: new Date().toISOString()
  };
  db.data.posts.push(post);
  await db.write();
  res.redirect('/admin');
});
app.post('/admin/posts/edit/:id', ensureAdmin, upload.single('image'), async (req, res) => {
  await db.read();
  const p = db.data.posts.find(x=>x.id===req.params.id);
  if (p) {
    p.title = req.body.title || p.title;
    p.description = req.body.description || p.description;
    if (req.file) {
      if (p.image) { try { fs.unlinkSync(path.join(uploadsDir, p.image)); } catch(e){} }
      p.image = req.file.filename;
    }
    await db.write();
  }
  res.redirect('/admin');
});
app.post('/admin/posts/delete/:id', ensureAdmin, async (req, res) => {
  await db.read();
  const p = db.data.posts.find(x=>x.id===req.params.id);
  if (p && p.image) {
    try { fs.unlinkSync(path.join(uploadsDir, p.image)); } catch(e){}
  }
  db.data.posts = db.data.posts.filter(x=>x.id!==req.params.id);
  await db.write();
  res.redirect('/admin');
});

// Staff: add, edit, delete
app.post('/admin/staff/add', ensureAdmin, upload.single('photo'), async (req, res) => {
  await db.read();
  db.data.staff.push({
    id: nanoid(),
    name: req.body.name || 'No name',
    title: req.body.title || '',
    bio: req.body.bio || '',
    photo: req.file ? req.file.filename : ''
  });
  await db.write();
  res.redirect('/admin');
});
app.post('/admin/staff/edit/:id', ensureAdmin, upload.single('photo'), async (req, res) => {
  await db.read();
  const s = db.data.staff.find(x=>x.id===req.params.id);
  if (s) {
    s.name = req.body.name || s.name;
    s.title = req.body.title || s.title;
    s.bio = req.body.bio || s.bio;
    if (req.file) { if (s.photo) { try { fs.unlinkSync(path.join(uploadsDir,s.photo)) } catch(e){} } s.photo = req.file.filename; }
    await db.write();
  }
  res.redirect('/admin');
});
app.post('/admin/staff/delete/:id', ensureAdmin, async (req, res) => {
  await db.read();
  const s = db.data.staff.find(x=>x.id===req.params.id);
  if (s && s.photo) {
    try { fs.unlinkSync(path.join(uploadsDir, s.photo)); } catch(e){}
  }
  db.data.staff = db.data.staff.filter(x=>x.id!==req.params.id);
  await db.write();
  res.redirect('/admin');
});

// Social links (save)
app.post('/admin/social', ensureAdmin, async (req, res) => {
  await db.read();
  db.data.social = {
    facebook: req.body.facebook || '',
    instagram: req.body.instagram || '',
    tiktok: req.body.tiktok || '',
    youtube: req.body.youtube || ''
  };
  await db.write();
  res.redirect('/admin');
});

// Admin management: add admin (only accessible to existing admin)
app.post('/admin/admins/add', ensureAdmin, async (req, res) => {
  await db.read();
  const { username, password } = req.body;
  if (!username || !password) return res.redirect('/admin');
  const hash = await bcrypt.hash(password, 10);
  db.data.admins.push({ id: nanoid(), username, passwordHash: hash });
  await db.write();
  res.redirect('/admin');
});

app.listen(PORT, ()=>console.log(`Server listening on http://localhost:${PORT}`));
