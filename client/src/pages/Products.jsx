import { useEffect, useState } from 'react';
import { api, money } from '../api.js';
import { useApp } from '../App.jsx';

const blank = { name: '', sku: '', category: '', price: '', cost: '', stock: '', reorder: 5, track_stock: true };

export default function Products() {
  const { cur, flash } = useApp();
  const [list, setList] = useState([]), [edit, setEdit] = useState(null), [q, setQ] = useState('');
  const load = () => api('/products').then(setList).catch(e => flash(e.message));
  useEffect(() => { load(); }, []);
  const set = (k, v) => setEdit(e => ({ ...e, [k]: v }));
  const save = async e => {
    e.preventDefault();
    try { await api(edit.id ? '/products/' + edit.id : '/products', { method: edit.id ? 'PUT' : 'POST', body: edit }); setEdit(null); load(); }
    catch (x) { flash(x.message); }
  };
  const del = async () => { await api('/products/' + edit.id, { method: 'DELETE' }); setEdit(null); load(); };
  const shown = list.filter(p => !q || (p.name + p.sku + p.category).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="row head"><h2 className="grow">Products</h2><input style={{ width: 220 }} placeholder="Search" value={q} onChange={e => setQ(e.target.value)} /><button className="btn" onClick={() => setEdit(blank)}>Add product</button></div>
      <div className="card wrap"><table>
        <thead><tr><th>Name</th><th>Barcode / SKU</th><th>Category</th><th className="r">Cost</th><th className="r">Price</th><th className="r">Stock</th><th /></tr></thead>
        <tbody>{shown.map(p => (
          <tr key={p.id}><td><b>{p.name}</b></td><td>{p.sku}</td><td>{p.category}</td><td className="r">{money(p.cost, cur)}</td><td className="r">{money(p.price, cur)}</td>
            <td className={'r ' + (p.track_stock && p.stock <= p.reorder ? 'low' : '')}>{p.track_stock ? <><b>{p.stock}</b>{p.stock <= p.reorder && <span className="tag">low</span>}</> : <span className="mut">not tracked</span>}</td>
            <td className="r"><button className="btn alt sm" onClick={() => setEdit(p)}>Edit</button></td></tr>
        ))}{!shown.length && <tr><td colSpan="7" className="empty">No products yet. Add your first one.</td></tr>}</tbody>
      </table></div>
      {edit && (
        <div className="modal" onClick={e => e.target === e.currentTarget && setEdit(null)}>
          <form className="mbox" onSubmit={save}>
            <h3>{edit.id ? 'Edit' : 'New'} product</h3>
            <label>Name<input value={edit.name} onChange={e => set('name', e.target.value)} required autoFocus /></label>
            <div className="two-col">
              <label>Barcode / SKU<input value={edit.sku} onChange={e => set('sku', e.target.value)} placeholder="Auto if empty" /></label>
              <label>Category<input value={edit.category} onChange={e => set('category', e.target.value)} list="cats" placeholder="General" /></label>
              <label>Selling price ({cur})<input type="number" min="0" step="any" value={edit.price} onChange={e => set('price', e.target.value)} required /></label>
              <label>Cost price ({cur})<input type="number" min="0" step="any" value={edit.cost} onChange={e => set('cost', e.target.value)} /></label>
              <label>Stock on hand<input type="number" min="0" value={edit.stock} onChange={e => set('stock', e.target.value)} disabled={!edit.track_stock} /></label>
              <label>Low-stock alert at<input type="number" min="0" value={edit.reorder} onChange={e => set('reorder', e.target.value)} disabled={!edit.track_stock} /></label>
            </div>
            <datalist id="cats">{[...new Set(list.map(p => p.category))].map(c => <option key={c} value={c} />)}</datalist>
            <label className="check"><input type="checkbox" checked={edit.track_stock} onChange={e => set('track_stock', e.target.checked)} /> Track stock (turn off for meals, services and made-to-order items)</label>
            <div className="row">{edit.id && <button type="button" className="btn bad" onClick={del}>Delete</button>}<span className="grow" /><button type="button" className="btn alt" onClick={() => setEdit(null)}>Cancel</button><button className="btn">Save product</button></div>
          </form>
        </div>
      )}
    </>
  );
}
