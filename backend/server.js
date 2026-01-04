process.on('request', () => {
  console.log('🔥 RAW NODE REQUEST RECEIVED');
});


console.log('🔥 RUNNING FILE:', __filename);

console.log('🔥 EXPRESS VERSION:', require('express/package.json').version);


//(require('dotenv').config())
require('dotenv').config();

const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const session = require('express-session')
const bcrypt = require('bcrypt')

console.log('SERVER FILE LOADED')

const app = express()
const api = express.Router();

const PORT = 4000

/* ================= MIDDLEWARE ================= */

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(session({
  name: 'petcare_sid',
  secret: 'petcare_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}))

/* ================= DATABASE ================= */

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
})

/* ================= FILE PATHS ================= */

const PUBLIC_DIR = path.join(__dirname, 'public')
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads')
const ADOPT_FILE = path.join(__dirname, 'adoptions.json')
const ORDERS_FILE = path.join(__dirname, 'orders.json')

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

/* ================= UPLOAD ================= */

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
})
const upload = multer({ storage })

/* ================= AUTH ================= */

function requireAdmin(req, res, next) {
  if (req.session.admin) return next()
  res.status(401).json({ error: 'Unauthorized' })
}





/* ================= PRODUCTS ================= */

app.get('/api/products', async (_, res) => {
  const [rows] = await pool.query('SELECT * FROM products')
  res.json(rows)
})

app.post('/api/products', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, type, category, description } = req.body
  const price = Number(req.body.price || 0)
  const qty = Number(req.body.qty || 0)
  //const img = req.file ? `/uploads/${req.file.filename}` : null
  const img = req.file ? `/public/uploads/${req.file.filename}` : null

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT img FROM products WHERE id=?',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Not found' });
    }

    // delete image file if exists
    if (rows[0].img) {
      const filePath = path.join(PUBLIC_DIR, rows[0].img.replace('/public/', ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM products WHERE id=?', [id]);
    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});


  const [r] = await pool.query(
    'INSERT INTO products (name,type,category,description,price,qty,img) VALUES (?,?,?,?,?,?,?)',
    [name, type, category, description, price, qty, img]
  )

  res.json({ ok: true, id: r.insertId })
})

/* ================= ADMIN LOGIN ================= */

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body
  const [rows] = await pool.query('SELECT * FROM admins WHERE username=?', [username])
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, rows[0].password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  req.session.admin = { id: rows[0].id, username }
  res.json({ ok: true })
})

/* ================= ADOPTIONS ================= */

app.post('/api/adopt', (req, res) => {
  const { name, email, phone, message } = req.body
  if (!name || !phone) return res.status(400).json({ error: 'Invalid data' })

  const data = fs.existsSync(ADOPT_FILE)
    ? JSON.parse(fs.readFileSync(ADOPT_FILE, 'utf8'))
    : []

  data.push({ name, email, phone, message, created_at: new Date().toISOString() })
  fs.writeFileSync(ADOPT_FILE, JSON.stringify(data, null, 2))
  res.json({ ok: true })
})

app.get('/api/adoptions', (_, res) => {
  if (!fs.existsSync(ADOPT_FILE)) return res.json([])
  res.json(JSON.parse(fs.readFileSync(ADOPT_FILE, 'utf8')))
})


/* ================= ORDERS (EXPRESS 5 SAFE) ================= */

/* ================= ORDERS ================= */

// ================= ORDERS =================

app.post('/api/orders', (req, res) => {
  console.log('🔥 POST /api/orders HIT');

  const { customer_name, customer_phone, cart, total } = req.body;

  if (!customer_name || !customer_phone || !Array.isArray(cart)) {
    return res.status(400).json({ error: 'Invalid order data' });
  }

  const orders = fs.existsSync(ORDERS_FILE)
    ? JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'))
    : [];

  const orderId = orders.length + 1;

  const order = {
    id: orderId,
    order_no: 'ORD' + orderId,
    customer_name,
    customer_phone,
    cart,
    total,
    status: 'pending',
    paid: 0,
    created_at: new Date().toISOString()
  };

  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

  return res.json({
    ok: true,
    orderId,
    orderNo: order.order_no,
    status: order.status
  });
});

app.get('/api/orders', (req, res) => {
  if (!fs.existsSync(ORDERS_FILE)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')));
}); 

/* ================= STATIC ================= */
//app.use(express.static(PUBLIC_DIR));
app.use('/public', express.static(PUBLIC_DIR));


/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
