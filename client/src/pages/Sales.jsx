import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { useApp } from '../App.jsx';
import Receipt from './Receipt.jsx';

export const Period = ({ value, onChange }) => (
  <select style={{ width: 'auto' }} value={value} onChange={e => onChange(e.target.value)}>
    <option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="0">All time</option>
  </select>
);

export default function Sales() {
  const { settings: st, user, cur, flash } = useApp();
  const [days, setDays] = useState('1'), [list, setList] = useState([]), [view, setView] = useState(null), [confirm, setConfirm] = useState(null);
  const load = () => api('/sales?days=' + days).then(setList).catch(e => flash(e.message));
  useEffect(() => { load(); }, [days]);
  const doVoid = async () => { try { await api(`/sales/${confirm.id}/void`, { method: 'POST' }); setConfirm(null); load(); } catch (e) { flash(e.message); } };
  return (
    <>
      <div className="row head"><h2 className="grow">Sales</h2><Period value={days} onChange={setDays} /></div>
      <div className="card wrap"><table>
        <thead><tr><th>Receipt</th><th>Time</th><th>Cashier</th><th>Payment</th><th className="r">Total</th><th /></tr></thead>
        <tbody>{list.map(s => (
          <tr key={s.id} style={{ opacity: s.status === 'void' ? .5 : 1 }}>
            <td>#{s.id} {s.status === 'void' && <span className="tag">void</span>}{s.tab_label && <span className="tag">{st.tab_noun} {s.tab_label}</span>}</td>
            <td>{new Date(s.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</td>
            <td>{s.cashier_name}</td><td>{[...new Set(s.payments.map(p => p.method))].join(' + ')}</td>
            <td className="r"><b>{money(s.total, cur)}</b></td>
            <td className="r"><button className="btn alt sm" onClick={() => setView(s)}>Receipt</button>{user.role === 'admin' && s.status !== 'void' && <> <button className="btn bad sm" onClick={() => setConfirm(s)}>Void</button></>}</td>
          </tr>
        ))}{!list.length && <tr><td colSpan="6" className="empty">No sales in this period.</td></tr>}</tbody>
      </table></div>
      {view && <div className="modal" onClick={e => e.target === e.currentTarget && setView(null)}><div className="mbox"><Receipt sale={view} settings={st} />
        <div className="row" style={{ marginTop: 12 }}><button className="btn alt grow" onClick={() => setView(null)}>Close</button><button className="btn grow" onClick={() => window.print()}>Print</button></div></div></div>}
      {confirm && <div className="modal"><div className="mbox"><h3>Void receipt #{confirm.id}?</h3><p>The {money(confirm.total, cur)} sale is removed from reports and its items go back into stock. Card payments must be refunded in your Paystack dashboard.</p>
        <div className="row"><button className="btn alt grow" onClick={() => setConfirm(null)}>Keep sale</button><button className="btn bad grow" onClick={doVoid}>Void sale</button></div></div></div>}
    </>
  );
}
