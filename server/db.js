import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

pg.types.setTypeParser(1700, parseFloat); // numeric -> number
pg.types.setTypeParser(20, parseInt);     // bigint  -> number

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
export const q = (text, params) => pool.query(text, params).then(r => r.rows);

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','cashier')),
      active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      store_name TEXT NOT NULL DEFAULT 'My Store', store_type TEXT NOT NULL DEFAULT 'retail',
      address TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT '₦', timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
      vat_on BOOLEAN NOT NULL DEFAULT FALSE, vat_rate NUMERIC(5,2) NOT NULL DEFAULT 7.5,
      tabs_on BOOLEAN NOT NULL DEFAULT TRUE, tab_noun TEXT NOT NULL DEFAULT 'Tab',
      receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping with us!');
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL DEFAULT 'General', price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
      cost NUMERIC(12,2) NOT NULL DEFAULT 0, stock INT NOT NULL DEFAULT 0,
      reorder INT NOT NULL DEFAULT 5, track_stock BOOLEAN NOT NULL DEFAULT TRUE,
      active BOOLEAN NOT NULL DEFAULT TRUE);
    CREATE TABLE IF NOT EXISTS tabs (
      id SERIAL PRIMARY KEY, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      items JSONB NOT NULL DEFAULT '[]', opened_by INT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX IF NOT EXISTS tabs_open_label ON tabs (lower(label)) WHERE status = 'open';
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), cashier_name TEXT NOT NULL,
      tab_label TEXT, items JSONB NOT NULL, subtotal NUMERIC(12,2) NOT NULL,
      discount NUMERIC(12,2) NOT NULL DEFAULT 0, vat NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL, payments JSONB NOT NULL, change_given NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS sales_created ON sales (created_at);
    CREATE TABLE IF NOT EXISTS paystack_txns (
      reference TEXT PRIMARY KEY, amount NUMERIC(12,2) NOT NULL, email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', used_in_sale INT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
  `);

  const [{ n }] = await q('SELECT count(*)::int AS n FROM users');
  if (n === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@store.local').toLowerCase();
    let pw = process.env.ADMIN_PASSWORD;
    if (!pw) { pw = crypto.randomBytes(9).toString('base64url'); console.log(`\n  First admin created.\n  Email: ${email}\n  Password: ${pw}  (change it under Team)\n`); }
    await q('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Admin', email, await bcrypt.hash(pw, 10), 'admin']);
  }
  const [{ c }] = await q('SELECT count(*)::int AS c FROM products');
  if (c === 0) {
    const demo = [['Bottled Water 75cl','Drinks',200,120,150],['Soft Drink 50cl','Drinks',400,300,96],['Bread (large)','Food',1500,1200,25],['Rice 5kg','Food',9500,8400,18],['Detergent 500g','Household',700,520,35],['Toilet Roll (4 pack)','Household',1600,1250,4]];
    for (const [i, d] of demo.entries())
      await q('INSERT INTO products (name,sku,category,price,cost,stock) VALUES ($1,$2,$3,$4,$5,$6)', [d[0], '1000' + i, d[1], d[2], d[3], d[4]]);
  }
}
