import { Router } from 'express';
import { q } from './db.js';
import { auth, admin, bad, h } from './auth.js';

const r = Router();
const num = v => Number.isFinite(+v) ? +v : NaN;

/* ---- settings ---- */
r.get('/settings', auth, h(async (req, res) => {
  const [s] = await q('SELECT * FROM settings WHERE id=1');
  res.json({ ...s, paystack_ready: !!(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_PUBLIC_KEY) });
}));
r.put('/settings', auth, admin, h(async (req, res) => {
  const b = req.body, [s] = await q(`UPDATE settings SET store_name=$1,store_type=$2,address=$3,phone=$4,currency=$5,timezone=$6,
    vat_on=$7,vat_rate=$8,tabs_on=$9,tab_noun=$10,receipt_footer=$11 WHERE id=1 RETURNING *`,
    [b.store_name || 'My Store', b.store_type || 'retail', b.address || '', b.phone || '', b.currency || '₦', b.timezone || 'Africa/Lagos',
     !!b.vat_on, num(b.vat_rate) || 0, !!b.tabs_on, b.tab_noun || 'Tab', b.receipt_footer || '']);
  res.json(s);
}));

/* ---- products ---- */
r.get('/products', auth, h(async (req, res) => res.json(await q('SELECT * FROM products WHERE active ORDER BY category, name'))));
const pv = b => {
  const d = { name: (b.name || '').trim(), sku: (b.sku || '').trim() || String(Date.now()).slice(-9), category: (b.category || '').trim() || 'General',
    price: num(b.price), cost: num(b.cost || 0), stock: Math.floor(num(b.stock || 0)), reorder: Math.floor(num(b.reorder || 0)), track_stock: b.track_stock !== false };
  if (!d.name || !(d.price >= 0) || !(d.cost >= 0) || !(d.stock >= 0)) throw bad('Name and a valid price are required');
  return d;
};
const dup = e => { throw e.code === '23505' ? bad('That barcode/SKU is already used') : e; };
r.post('/products', auth, admin, h(async (req, res) => {
  const d = pv(req.body);
  const [p] = await q('INSERT INTO products (name,sku,category,price,cost,stock,reorder,track_stock) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [d.name, d.sku, d.category, d.price, d.cost, d.stock, d.reorder, d.track_stock]).catch(dup);
  res.json(p);
}));
r.put('/products/:id', auth, admin, h(async (req, res) => {
  const d = pv(req.body);
  const [p] = await q('UPDATE products SET name=$1,sku=$2,category=$3,price=$4,cost=$5,stock=$6,reorder=$7,track_stock=$8 WHERE id=$9 RETURNING *',
    [d.name, d.sku, d.category, d.price, d.cost, d.stock, d.reorder, d.track_stock, req.params.id]).catch(dup);
  res.json(p);
}));
r.delete('/products/:id', auth, admin, h(async (req, res) => { // soft delete keeps old receipts intact
  await q("UPDATE products SET active=false, sku=sku||'~'||id WHERE id=$1", [req.params.id]); res.json({ ok: true });
}));

/* ---- tabs / tables ---- */
r.get('/tabs', auth, h(async (req, res) => res.json(await q("SELECT id,label,items,updated_at FROM tabs WHERE status='open' ORDER BY created_at"))));
r.post('/tabs', auth, h(async (req, res) => {
  const label = (req.body.label || '').trim();
  if (!label) throw bad('Give it a name or number');
  const [t] = await q('INSERT INTO tabs (label,opened_by) VALUES ($1,$2) RETURNING id,label,items,updated_at', [label, req.user.id])
    .catch(e => { throw e.code === '23505' ? bad(`"${label}" is already open`) : e; });
  res.json(t);
}));
r.put('/tabs/:id', auth, h(async (req, res) => {
  const items = (req.body.items || []).map(i => ({ product_id: +i.product_id, qty: Math.max(1, Math.floor(+i.qty || 1)) }));
  const [t] = await q("UPDATE tabs SET items=$1, updated_at=now() WHERE id=$2 AND status='open' RETURNING id,label,items,updated_at", [JSON.stringify(items), req.params.id]);
  res.json(t || null);
}));
r.delete('/tabs/:id', auth, h(async (req, res) => {
  await q("UPDATE tabs SET status='cancelled' WHERE id=$1 AND status='open'", [req.params.id]); res.json({ ok: true });
}));
export default r;
