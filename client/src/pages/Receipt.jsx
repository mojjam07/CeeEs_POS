import { money } from '../api.js';
export default function Receipt({ sale, settings: st }) {
  const c = st.currency, f = n => money(n, c);
  return (
    <div className="receipt">
      <b className="big">{st.store_name}</b>
      {st.address && <div>{st.address}</div>}{st.phone && <div>{st.phone}</div>}
      <hr />
      <div>Receipt #{sale.id}{sale.status === 'void' ? ' (VOID)' : ''}</div>
      <div>{new Date(sale.created_at).toLocaleString('en-NG')}</div>
      <div>Served by {sale.cashier_name}{sale.tab_label ? ` · ${st.tab_noun} ${sale.tab_label}` : ''}</div>
      <hr />
      {sale.items.map((i, k) => <div className="r2" key={k}><span>{i.qty} × {i.name}</span><span>{f(i.price * i.qty)}</span></div>)}
      <hr />
      <div className="r2"><span>Subtotal</span><span>{f(sale.subtotal)}</span></div>
      {sale.discount > 0 && <div className="r2"><span>Discount</span><span>−{f(sale.discount)}</span></div>}
      {sale.vat > 0 && <div className="r2"><span>VAT</span><span>{f(sale.vat)}</span></div>}
      <div className="r2"><b>TOTAL</b><b>{f(sale.total)}</b></div>
      <hr />
      {sale.payments.map((p, k) => <div className="r2" key={k}><span>{p.method === 'Card' ? 'Card (Paystack)' : p.method}</span><span>{f(p.amount)}</span></div>)}
      {sale.change_given > 0 && <div className="r2"><span>Change</span><span>{f(sale.change_given)}</span></div>}
      <hr />
      <div>{st.receipt_footer}</div>
    </div>
  );
}
