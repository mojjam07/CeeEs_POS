# CeeEs — Point of Sale for any store

```
ceees/
  server/   Node + Express API (own package.json and dependencies)
  client/   Vite + React app   (own package.json and dependencies)
  render.yaml
```

**Features:** admin and cashier logins, products with barcode/SKU, cost, stock and low-stock alerts, open tabs/tables
(rename to "Table", "Client", etc.), split payments (Cash, Transfer, POS, Paystack card), change calculation, receipts,
void with restock, reports (revenue, profit, daily, top products, payment methods, cashiers) and optional VAT.

## Run locally
1. Create a Postgres database, then `cp server/.env.example server/.env` and fill it in.
2. `npm run install:all` (or `npm install` inside `server/` and `client/` separately)
3. Terminal 1: `npm run dev:server` (API on :3000). Terminal 2: `npm run dev:client` (app on http://localhost:5173).

The first admin is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when the users table is empty.
Server dev mode needs Node 20.6 or newer (it reads `server/.env`).

## Deploy on Render
1. Push this folder to a GitHub repo.
2. In Render choose **New > Blueprint** and pick the repo. `render.yaml` creates the web service and a Postgres database.
3. When prompted, set `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Add `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` for card payments (start with the `sk_test_` / `pk_test_` keys).
4. Open the service URL, sign in, then set up your store under **Team & settings** and add products.

Notes: Render's free Postgres expires after 30 days and the free web service sleeps when idle, so use paid plans for a live shop.
To use Supabase or another host instead, set `DATABASE_URL` yourself and `PGSSL=true`.

## Paystack
Cards are paid in the Paystack popup. The server initialises the transaction, verifies it with Paystack, and only then accepts
it as a payment, once per sale and for the exact amount. Voiding a sale does not refund cards; refund in the Paystack dashboard.
