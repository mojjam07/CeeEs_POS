import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { useApp } from '../App.jsx';
import { Period } from './Sales.jsx';

const Bars = ({ rows, cur }) => { const max = Math.max(1, ...rows.map(r => r.value)); return rows.map(r => (
  <div key={r.label}><div className="tr"><span>{r.label}{r.sub && <small className="mut"> {r.sub}</small>}</span><b>{money(r.value, cur)}</b></div><div className="hb"><i style={{ width: r.value / max * 100 + '%' }} /></div></div>
)); };

export default function Reports() {
  const { cur, flash } = useApp();
  const [days, setDays] = useState('7'), [d, setD] = useState(null);
  useEffect(() => { api('/reports?days=' + days).then(setD).catch(e => flash(e.message)); }, [days]);
  if (!d) return <div className="empty">Loading…</div>;
  const max = Math.max(1, ...d.series.map(s => s.total));
  return (
    <>
      <div className="row head"><h2 className="grow">Reports</h2><Period value={days} onChange={setDays} /></div>
      <div className="kpis">{[['Revenue', money(d.revenue, cur)], ['Gross profit', money(d.profit, cur)], ['Sales', d.count], ['Average sale', money(d.avg, cur)], ['Units sold', d.units]].map(([l, v]) => <div className="card kpi" key={l}><span className="mut">{l}</span><div className="num">{v}</div></div>)}</div>
      <div className="cols">
        <div className="card"><h3>Daily sales</h3><div className="bars">{d.series.map(s => <div className="bar" key={s.day} title={money(s.total, cur)}><i style={{ height: s.total / max * 100 + '%' }} />{s.day.slice(5)}</div>)}</div></div>
        <div className="card"><h3>Top products</h3>{d.top.length ? <Bars cur={cur} rows={d.top.map(t => ({ label: t.name, sub: '×' + t.qty, value: t.revenue }))} /> : <div className="empty">No sales yet.</div>}</div>
        <div className="card"><h3>Payment methods</h3>{d.methods.length ? <Bars cur={cur} rows={d.methods.map(m => ({ label: m.name, value: m.total }))} /> : <div className="empty">No sales yet.</div>}</div>
        <div className="card"><h3>Sales by cashier</h3>{d.cashiers.length ? <Bars cur={cur} rows={d.cashiers.map(m => ({ label: m.name, value: m.total }))} /> : <div className="empty">No sales yet.</div>}</div>
        <div className="card"><h3>Needs restocking</h3>{d.low.length ? d.low.map(p => <div className="tr" key={p.id}><span>{p.name}</span><b className="low">{p.stock} left</b></div>) : <div className="empty">Every product is above its alert level.</div>}</div>
      </div>
    </>
  );
}
