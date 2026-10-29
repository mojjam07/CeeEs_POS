import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { q } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-only-secret';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') console.warn('WARNING: set JWT_SECRET');

export const bad = (m, status = 400) => Object.assign(new Error(m), { status });
export const h = f => (req, res, next) => f(req, res, next).catch(next);

export const auth = h(async (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  let p; try { p = jwt.verify(t, SECRET); } catch { throw bad('Please sign in', 401); }
  const [u] = await q('SELECT id,name,email,role,active FROM users WHERE id=$1', [p.id]);
  if (!u || !u.active) throw bad('Account disabled', 401);
  req.user = u; next();
});
export const admin = (req, res, next) => req.user.role === 'admin' ? next() : next(bad('Admins only', 403));

const r = Router();
r.post('/auth/login', rateLimit({ windowMs: 15 * 60e3, limit: 30 }), h(async (req, res) => {
  const { email = '', password = '' } = req.body;
  const [u] = await q('SELECT * FROM users WHERE email=$1', [email.trim().toLowerCase()]);
  if (!u || !u.active || !(await bcrypt.compare(password, u.password_hash))) throw bad('Wrong email or password', 401);
  const token = jwt.sign({ id: u.id }, SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}));
r.get('/auth/me', auth, (req, res) => res.json(req.user));

r.get('/users', auth, admin, h(async (req, res) => res.json(await q('SELECT id,name,email,role,active FROM users ORDER BY id'))));
r.post('/users', auth, admin, h(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 6) throw bad('Name, email and a password of 6+ characters are required');
  if (!['admin', 'cashier'].includes(role)) throw bad('Choose a role');
  try {
    const [u] = await q('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role,active',
      [name.trim(), email.trim().toLowerCase(), await bcrypt.hash(password, 10), role]);
    res.json(u);
  } catch (e) { throw e.code === '23505' ? bad('That email is already in use') : e; }
}));
r.put('/users/:id', auth, admin, h(async (req, res) => {
  const id = +req.params.id, { name, role, active, password } = req.body;
  if (id === req.user.id && (role !== 'admin' || active === false)) throw bad('You cannot remove your own admin access');
  if (password) { if (password.length < 6) throw bad('Password needs 6+ characters'); await q('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(password, 10), id]); }
  const [u] = await q('UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role), active=COALESCE($3,active) WHERE id=$4 RETURNING id,name,email,role,active', [name, role, active, id]);
  res.json(u);
}));
export default r;
