import { useEffect, useMemo, useRef, useState } from 'react';
import { api, money } from '../api.js';
import { useApp } from '../App.jsx';
import Checkout from './Checkout.jsx';
import Receipt from './Receipt.jsx';

export default function Sell() {
  const { settings: st, flash, cur } = useApp();
  const [products, setProducts] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [cart, setCart] = useState([]); // [{product_id, qty}]
  const [tabId, setTabId] = useState(null);
  const [q, setQ] = useState(''), [cat, setCat] = useState('All'), [discount, setDiscount] = useState('');
  const [newLabel, setNewLabel] = useState(null);
  const [paying, setPaying] = useState(false), [receipt, setReceipt] = useState(null);
  const searchRef = useRef();

  const load = async () => {
    const [p, t] = await Promise.all([api('/products'), st.tabs_on ? api('/tabs') : []]);
    setProducts(p); setTabs(t);
  };
  useEffect(() => { load().catch(e => flash(e.message)); }, []);

  // keep an open tab in sync with the server while the cart changes
  useEffect(() => {
    if (!tabId) return;
    const t = setTimeout(() => api('/tabs/' + tabId, { method: 'PUT', body: { items: cart } }).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, [cart, tabId]);

  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const lines = cart.map(c => ({ ...c, p: byId.get(c.product_id) })).filter(l => l.p);
  const sub = lines.reduce((a, l) => a + l.p.price * l.qty, 0);
  const disc = Math.min(Math.max(+discount || 0, 0), sub);
  const vat = st.vat_on ? Math.round((sub - disc) * st.vat_rate) / 100 : 0;
  const total = Math.round((sub - disc + vat) * 100) / 100;
  const cats = ['All', ...new Set(products.map(p => p.category))];
  const shown = products.filter(p => (cat === 'All' || p.category === cat) && (!q || (p.name + ' ' + p.sku).toLowerCase().includes(q.toLowerCase())));

  const add = p => setCart(c => {
    const l = c.find(x => x.product_id === p.id);
    if (p.track_stock && (l ? l.qty : 0) >= p.stock) { flash(`Only ${p.stock} of ${p.name} in stock`); return c; }
    return l ? c.map(x => x === l ? { ...x, qty: x.qty + 1 } : x) : [...c, { product_id: p.id, qty: 1 }];
  });
  const bump = (p, d) => setCart(c => c.flatMap(x => {
    if (x.product_id !== p.id) return [x];
    const qty = x.qty + d;
    if (d > 0 && p.track_stock && qty > p.stock) { flash(`Only ${p.stock} in stock`); return [x]; }
    return qty > 0 ? [{ ...x, qty }] : [];
  }));
  const scan = e => {
    if (e.key !== 'Enter') return;
    const t = q.trim().toLowerCase();
    const hit = products.find(p => p.sku.toLowerCase() === t) || (shown.length === 1 ? shown[0] : null);
    if (hit) { add(hit); setQ(''); } else flash('No single product matches that code');
  };

  const pickTab = t => { setTabId(t.id); setCart(t.items.map(i => ({ product_id: i.product_id, qty: i.qty }))); setDiscount(''); };
  const quick = () => { setTabId(null); setCart([]); setDiscount(''); load(); };
  const openTab = async e => {
    e.preventDefault();
    try { const t = await api('/tabs', { method: 'POST', body: { label: newLabel } }); setTabs(x => [...x, t]); setTabId(t.id); setNewLabel(null); }
    catch (x) { flash(x.message); }
  };
  const cancelTab = async () => {
    await api('/tabs/' + tabId, { method: 'DELETE' }); setTabs(t => t.filter(x => x.id !== tabId)); quick();
  };
  const pay = async payments => {
    const sale = await api('/sales', { method: 'POST', body: { items: cart, discount: disc, payments, tab_id: tabId } });
    setPaying(false); setReceipt(sale); setCart([]); setDiscount('');
    if (tabId) setTabs(t => t.filter(x => x.id !== tabId));
    setTabId(null); load();
  };
  const tab = tabs.find(t => t.id === tabId);

  return (
    <>
      {st.tabs_on && (
        <div className="tabbar">
          <button className={'chip ' + (!tabId ? 'on' : '')} onClick={quick}>Quick sale</button>
          {tabs.map(t => <button key={t.id} className={'chip ' + (t.id === tabId ? 'on' : '')} onClick={() => pickTab(t)}>{st.tab_noun} {t.label}</button>)}
          {newLabel === null
            ? <button className="chip dash" onClick={() => setNewLabel('')}>+ New {st.tab_noun.toLowerCase()}</button>
            : <form onSubmit={openTab} className="inline"><input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={`${st.tab_noun} name or number`} /><button className="btn sm">Open</button><button type="button" className="btn alt sm" onClick={() => setNewLabel(null)}>Cancel</button></form>}
        </div>
      )}
      <div className="sell">
        <section>
          <input ref={searchRef} placeholder="Search products, or scan a barcode and press Enter" value={q} onChange={e => setQ(e.target.value)} onKeyDown={scan} autoFocus />
          <div className="chips">{cats.map(c => <button key={c} className={'chip ' + (c === cat ? 'on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="grid">
            {shown.map(p => {
              const out = p.track_stock && p.stock <= 0;
              return (
                <button key={p.id} className="tile" disabled={out} onClick={() => add(p)}>
                  <b>{p.name}</b>
                  <small className={p.track_stock && p.stock <= p.reorder ? 'low' : ''}>{!p.track_stock ? p.category : out ? 'Out of stock' : p.stock + ' in stock'}</small>
                  <span className="num">{money(p.price, cur)}</span>
                </button>
              );
            })}
            {!shown.length && <div className="empty">No products match.</div>}
          </div>
        </section>
        <aside className="card cartp">
          <h3>{tab ? `${st.tab_noun} ${tab.label}` : 'Current sale'}</h3>
          {lines.length ? lines.map(({ p, qty }) => (
            <div className="line" key={p.id}>
              <div><b>{p.name}</b><br /><small>{money(p.price, cur)} each</small></div>
              <div className="qty"><button onClick={() => bump(p, -1)} aria-label="Less">−</button><span>{qty}</span><button onClick={() => bump(p, 1)} aria-label="More">+</button></div>
              <b>{money(p.price * qty, cur)}</b>
            </div>
          )) : <div className="empty">Tap a product to start.</div>}
          <label style={{ marginTop: 10 }}>Discount ({cur})<input type="number" min="0" inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} /></label>
          <div className="tr"><span>Subtotal</span><span>{money(sub, cur)}</span></div>
          {disc > 0 && <div className="tr"><span>Discount</span><span>−{money(disc, cur)}</span></div>}
          {vat > 0 && <div className="tr"><span>VAT {st.vat_rate}%</span><span>{money(vat, cur)}</span></div>}
          <div className="tr big"><span>Total</span><span>{money(total, cur)}</span></div>
          <div className="row" style={{ marginTop: 12 }}>
            {tabId ? <button className="btn bad" onClick={cancelTab}>Cancel {st.tab_noun.toLowerCase()}</button> : <button className="btn alt" onClick={() => setCart([])}>Clear</button>}
            <button className="btn grow" disabled={!lines.length} onClick={() => setPaying(true)}>Charge {money(total, cur)}</button>
          </div>
        </aside>
      </div>
      {paying && <Checkout total={total} onClose={() => setPaying(false)} onPay={pay} />}
      {receipt && (
        <div className="modal" onClick={e => e.target === e.currentTarget && setReceipt(null)}>
          <div className="mbox"><Receipt sale={receipt} settings={st} />
            <div className="row" style={{ marginTop: 12 }}><button className="btn alt grow" onClick={() => setReceipt(null)}>New sale</button><button className="btn grow" onClick={() => window.print()}>Print receipt</button></div>
          </div>
        </div>
      )}
    </>
  );
}
