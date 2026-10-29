import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { useApp } from '../App.jsx';

const r2 = n => Math.round(n * 100) / 100;
const loadPaystack = () => new Promise((ok, no) => {
  if (window.PaystackPop) return ok();
  const s = document.createElement('script');
  s.src = 'https://js.paystack.co/v2/inline.js'; s.onload = ok; s.onerror = () => no(new Error('Could not load Paystack'));
  document.head.appendChild(s);
});

export default function Checkout({ total, onClose, onPay }) {
  const { settings: st, cur, flash } = useApp();
  const methods = ['Cash', 'Transfer', 'POS', ...(st.paystack_ready ? ['Card'] : [])];
  const [pays, setPays] = useState([]), [method, setMethod] = useState('Cash'), [amount, setAmount] = useState(''), [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const paid = r2(pays.reduce((a, p) => a + p.amount, 0));
  const remaining = r2(total - paid), change = r2(Math.max(0, paid - total));
  useEffect(() => { setAmount(remaining > 0 ? String(remaining) : ''); }, [pays.length]);

  const addPay = async (m = method, amt = +amount) => {
    setErr('');
    if (!(amt > 0)) return setErr('Enter an amount');
    if (m !== 'Cash' && amt > remaining) return setErr('Only cash can be more than the amount left');
    if (m !== 'Card') return setPays(p => [...p, { method: m, amount: r2(amt) }]);
    setBusy(true);
    try {
      await loadPaystack();
      const { access_code } = await api('/paystack/init', { method: 'POST', body: { amount: amt, email } });
      await new Promise((ok, no) => new window.PaystackPop().resumeTransaction(access_code, {
        onSuccess: async t => {
          try { const v = await api('/paystack/verify/' + t.reference, { method: 'POST' }); setPays(p => [...p, { method: 'Card', amount: v.amount, reference: v.reference }]); ok(); }
          catch (e) { no(e); }
        },
        onCancel: () => no(new Error('Card payment cancelled')),
      }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const finish = async () => {
    setBusy(true); setErr('');
    try { await onPay(pays); } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="modal" onClick={e => e.target === e.currentTarget && !busy && onClose()}>
      <div className="mbox">
        <h3>Take payment</h3>
        <div className="tr big"><span>Total</span><span>{money(total, cur)}</span></div>
        {pays.map((p, i) => (
          <div className="tr" key={i}><span>{p.method}</span><span>{money(p.amount, cur)} <button className="link" onClick={() => setPays(x => x.filter((_, k) => k !== i))} disabled={!!p.reference} title={p.reference ? 'Card payments cannot be removed' : ''}>remove</button></span></div>
        ))}
        {remaining > 0
          ? <div className="tr"><b>Left to pay</b><b className="low">{money(remaining, cur)}</b></div>
          : <div className="tr"><b>Change to give</b><b>{money(change, cur)}</b></div>}
        {remaining > 0 && <>
          <div className="pays">{methods.map(m => <button key={m} className={'chip ' + (m === method ? 'on' : '')} onClick={() => setMethod(m)}>{m === 'Card' ? 'Card (Paystack)' : m}</button>)}</div>
          <label>Amount ({cur})<input type="number" min="0" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
          {method === 'Card' && <label>Customer email (for the Paystack receipt)<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
          <div className="row">
            <button className="btn alt grow" disabled={busy} onClick={() => addPay('Cash', remaining)}>Exact cash</button>
            <button className="btn grow" disabled={busy} onClick={() => addPay()}>{busy ? 'Working…' : method === 'Card' ? 'Pay by card' : 'Add payment'}</button>
          </div>
          <p className="mut small">Splitting? Add one payment per method until nothing is left to pay.</p>
        </>}
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn alt" disabled={busy} onClick={onClose}>Back</button>
          <button className="btn grow" disabled={busy || remaining > 0} onClick={finish}>Complete sale</button>
        </div>
      </div>
    </div>
  );
}
