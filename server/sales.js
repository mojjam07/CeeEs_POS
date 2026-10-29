import { Router } from 'express';
import { pool, q } from './db.js';
import { auth, admin, bad, h } from './auth.js';

const r = Router();
const r2 = n => Math.round(n * 100) / 100;
const METHODS = ['Cash', 'Transfer', 'POS', 'Card'];

/* ---- create a sale (prices, stock and Paystack payments are all verified here) ---- */
r.post('/sales', auth, h(async (req, res) => {
  const { items, discount = 0, payments = [], tab_id = null } = req.body;
  if (!Array.isArray(items) || !items.length) throw bad('The cart is empty');
  const want = new Map();
  for (const i of items) want.set(+i.product_id, (want.get(+i.product_id) || 0) + Math.floor(+i.qty));
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: ps } = await c.query('SELECT * FROM products WHERE id=ANY($1) AND active FOR UPDATE', [[...want.keys()]]);
    const { rows: [st] } = await c.query('SELECT * FROM settings WHERE id=1');
    const lines = [...want].map(([id, qty]) => {
      const p = ps.find(p => p.id === id);
      if (!p || !(qty >= 1)) throw bad('An item in the cart is no longer available');
      if (p.track_stock && p.stock < qty) throw bad(`Only ${p.stock} of ${p.name} left`);
      return { product_id: p.id, name: p.name, price: p.price, cost: p.cost, qty, track: p.track_stock };
    });
    const subtotal = r2(lines.reduce((a, l) => a + l.price * l.qty, 0));
    const disc = r2(Math.min(Math.max(+discount || 0, 0), subtotal));
    const vat = st.vat_on ? r2((subtotal - disc) * st.vat_rate / 100) : 0;
    const total = r2(subtotal - disc + vat);

    if (!Array.isArray(payments) || !payments.length) throw bad('Add a payment');
    const pays = [];
    for (const p of payments) {
      const amount = r2(+p.amount);
      if (!METHODS.includes(p.method) || !(amount > 0)) throw bad('Invalid payment');
      if (p.method === 'Card') {
        const { rows: [t] } = await c.query('SELECT * FROM paystack_txns WHERE reference=$1 FOR UPDATE', [p.reference]);
        if (!t || t.status !== 'success' || t.used_in_sale || t.amount !== amount) throw bad('Card payment could not be confirmed');
        pays.push({ method: 'Card', amount, reference: t.reference });
      } else pays.push({ method: p.method, amount });
    }
    const paid = r2(pays.reduce((a, p) => a + p.amount, 0));
    if (paid < total) throw bad('Payments do not cover the total');
    const change = r2(paid - total), cash = pays.filter(p => p.method === 'Cash').reduce((a, p) => a + p.amount, 0);
    if (change > cash) throw bad('Only cash can be paid over the total (to give change)');

    let tabLabel = null;
    if (tab_id) { const { rows: [t] } = await c.query("UPDATE tabs SET status='closed' WHERE id=$1 AND status='open' RETURNING label", [tab_id]); tabLabel = t?.label || null; }
    const { rows: [sale] } = await c.query(`INSERT INTO sales (user_id,cashier_name,tab_label,items,subtotal,discount,vat,total,payments,change_given)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, req.user.name, tabLabel, JSON.stringify(lines.map(({ track, ...l }) => l)), subtotal, disc, vat, total, JSON.stringify(pays), change]);
    for (const l of lines) if (l.track) await c.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [l.qty, l.product_id]);
    for (const p of pays) if (p.reference) await c.query('UPDATE paystack_txns SET used_in_sale=$1 WHERE reference=$2', [sale.id, p.reference]);
    await c.query('COMMIT');
    res.json(sale);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}));

/* ---- history ---- */
async function since(days) {
  if (!+days) return new Date(0);
  const [{ s }] = await q(`SELECT ((date_trunc('day', now() AT TIME ZONE tz) - make_interval(days => $1)) AT TIME ZONE tz) AS s
    FROM (SELECT timezone AS tz FROM settings WHERE id=1) x`, [+days - 1]);
  return s;
}
r.get('/sales', auth, h(async (req, res) => {
  const from = await since(req.query.days ?? 1), own = req.user.role === 'cashier';
  res.json(await q(`SELECT * FROM sales WHERE created_at>=$1 ${own ? 'AND user_id=$2' : ''} ORDER BY id DESC LIMIT 500`, own ? [from, req.user.id] : [from]));
}));
r.post('/sales/:id/void', auth, admin, h(async (req, res) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [s] } = await c.query("UPDATE sales SET status='void' WHERE id=$1 AND status='completed' RETURNING *", [req.params.id]);
    if (!s) throw bad('That sale is already void or does not exist');
    for (const i of s.items) await c.query('UPDATE products SET stock=stock+$1 WHERE id=$2 AND track_stock', [i.qty, i.product_id]);
    await c.query('COMMIT'); res.json(s);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}));

/* ---- reports ---- */
r.get('/reports', auth, admin, h(async (req, res) => {
  const days = +req.query.days || 0, from = await since(days);
  const [st] = await q('SELECT timezone FROM settings WHERE id=1');
  const sales = await q("SELECT * FROM sales WHERE status='completed' AND created_at>=$1", [from]);
  const sum = (a, f) => r2(a.reduce((x, s) => x + f(s), 0));
  const revenue = sum(sales, s => s.total);
  const profit = sum(sales, s => s.items.reduce((a, i) => a + (i.price - i.cost) * i.qty, 0) - s.discount);
  const top = {}, methods = {}, cashiers = {}, daily = {};
  for (const s of sales) {
    for (const i of s.items) { const t = top[i.name] ||= { name: i.name, qty: 0, revenue: 0 }; t.qty += i.qty; t.revenue += i.price * i.qty; }
    let chg = s.change_given;
    for (const p of s.payments) { let a = p.amount; if (p.method === 'Cash' && chg > 0) { const d = Math.min(chg, a); a -= d; chg -= d; } methods[p.method] = (methods[p.method] || 0) + a; }
    cashiers[s.cashier_name] = (cashiers[s.cashier_name] || 0) + s.total;
    const d = new Date(s.created_at).toLocaleDateString('en-CA', { timeZone: st.timezone }); daily[d] = (daily[d] || 0) + s.total;
  }
  const series = [];
  for (let k = Math.min(days || 14, 14) - 1; k >= 0; k--) { const d = new Date(Date.now() - k * 864e5).toLocaleDateString('en-CA', { timeZone: st.timezone }); series.push({ day: d, total: r2(daily[d] || 0) }); }
  res.json({ revenue, profit, count: sales.length, avg: sales.length ? r2(revenue / sales.length) : 0,
    units: sales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.qty, 0), 0),
    top: Object.values(top).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    methods: Object.entries(methods).map(([name, total]) => ({ name, total: r2(total) })),
    cashiers: Object.entries(cashiers).map(([name, total]) => ({ name, total: r2(total) })), series,
    low: await q('SELECT id,name,stock,reorder FROM products WHERE active AND track_stock AND stock<=reorder ORDER BY stock') });
}));

/* ---- Paystack ---- */
const PS = 'https://api.paystack.co';
const psFetch = async (path, init) => {
  if (!process.env.PAYSTACK_SECRET_KEY) throw bad('Card payments are not set up yet', 503);
  const res = await fetch(PS + path, { ...init, headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json' } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.status) throw bad(j.message || 'Paystack error', 502);
  return j.data;
};
r.post('/paystack/init', auth, h(async (req, res) => {
  const amount = r2(+req.body.amount), email = (req.body.email || '').trim();
  if (!(amount >= 100) || !/^\S+@\S+\.\S+$/.test(email)) throw bad('Enter a valid email and an amount of at least 100');
  const reference = `ceees_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const d = await psFetch('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email, amount: Math.round(amount * 100), reference, currency: 'NGN', channels: ['card'] }) });
  await q('INSERT INTO paystack_txns (reference,amount,email) VALUES ($1,$2,$3)', [reference, amount, email]);
  res.json({ access_code: d.access_code, reference });
}));
r.post('/paystack/verify/:ref', auth, h(async (req, res) => {
  const [t] = await q('SELECT * FROM paystack_txns WHERE reference=$1', [req.params.ref]);
  if (!t) throw bad('Unknown payment', 404);
  const d = await psFetch('/transaction/verify/' + encodeURIComponent(t.reference));
  if (d.status !== 'success' || d.amount !== Math.round(t.amount * 100)) throw bad('Payment was not completed');
  await q("UPDATE paystack_txns SET status='success' WHERE reference=$1", [t.reference]);
  res.json({ reference: t.reference, amount: t.amount });
}));
export default r;
