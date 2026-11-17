import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, Clock3, Download, FileText, Printer, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { calcBill, fetchPublicOrderSnapshot, formatINR, isSupabaseMode, subscribeToPublicOrder, updateOrder, useDemoState } from '../lib/demoStore';
import { isRazorpayEnabled, payWithRazorpay } from '../lib/razorpay';
import { Button, Notice, Pill } from '../components/UI';

const steps = [
  {id:'placed',label:'Placed',detail:'Your order is with us',icon:CheckCircle2},
  {id:'accepted',label:'Accepted',detail:'Kitchen confirmed',icon:Check},
  {id:'preparing',label:'Preparing',detail:'Made fresh for you',icon:Clock3},
  {id:'ready',label:'Ready',detail:'Coming your way',icon:ReceiptText},
  {id:'served',label:'Served',detail:'Enjoy your meal',icon:ShieldCheck},
];
const statusIndex = status => Math.max(0, steps.findIndex(s=>s.id===status));

function downloadBill(order, state) {
  const bill = calcBill(order);
  const doc = new jsPDF();
  doc.setFillColor(23,107,84); doc.rect(0,0,210,38,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.text('ServeIQ',15,17);
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text('ORDER BILL / TAX SUMMARY',15,27);
  doc.setTextColor(21,35,31); doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.text(`Order #${order.id.slice(0,8).toUpperCase()}`,15,50);
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(`Table ${state.tables.find(t=>t.id===order.table_id)?.number || order.table_id}`,15,58);
  doc.text(new Date(order.created_at).toLocaleString('en-IN'),15,65);
  let y=84; doc.setFont('helvetica','bold'); doc.text('ITEM',15,y); doc.text('QTY',130,y,{align:'right'}); doc.text('PRICE',195,y,{align:'right'}); y+=5; doc.setDrawColor(220,226,220); doc.line(15,y,195,y); y+=8;
  doc.setFont('helvetica','normal');
  for (const row of order.items || []) {
    const name = state.menuItems.find(m=>m.id===row.menu_item_id)?.name || 'Menu item';
    const wrapped = doc.splitTextToSize(name,100); doc.text(wrapped,15,y); doc.text(String(row.quantity),130,y,{align:'right'}); doc.text(formatINR(row.price*row.quantity),195,y,{align:'right'}); y += Math.max(7,wrapped.length*5)+4;
    if (row.notes) { doc.setTextColor(105,119,111); doc.setFontSize(8); doc.text(`Note: ${row.notes}`,18,y-1); doc.setTextColor(21,35,31); doc.setFontSize(10); y+=4; }
    if (y>250) { doc.addPage(); y=20; }
  }
  y+=5; doc.line(105,y,195,y); y+=9; doc.text('Subtotal',135,y,{align:'right'}); doc.text(formatINR(bill.subtotal),195,y,{align:'right'}); y+=8; doc.text('GST (5%)',135,y,{align:'right'}); doc.text(formatINR(bill.gst),195,y,{align:'right'}); y+=10; doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text('TOTAL',135,y,{align:'right'}); doc.text(formatINR(bill.total),195,y,{align:'right'}); y+=14; doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(`Payment status: ${order.payment_status.toUpperCase().replace('_',' ')}`,15,y); doc.text('Thank you for dining with us.',15,285);
  doc.save(`ServeIQ-bill-${order.id.slice(0,8)}.pdf`);
}

export default function OrderPage() {
  const { orderId } = useParams();
  const state = useDemoState();
  const order = state.orders.find(o=>o.id===orderId);
  const [paymentMessage,setPaymentMessage] = useState('');
  const [paymentProcessing,setPaymentProcessing] = useState(false);
  const [snapshotLoaded,setSnapshotLoaded] = useState(!isSupabaseMode);
  const [snapshotError,setSnapshotError] = useState('');
  useEffect(()=>{ if(!isSupabaseMode) return undefined; let active=true; fetchPublicOrderSnapshot(orderId).then(()=>{if(active)setSnapshotLoaded(true);}).catch(error=>{if(active){setSnapshotError(error.message||'Could not load this order.');setSnapshotLoaded(true);}}); const unsubscribe=subscribeToPublicOrder(orderId,()=>{}); return ()=>{active=false;unsubscribe();}; },[orderId]);
  if (!order && !snapshotLoaded) return <div className="grid min-h-screen place-items-center bg-canvas p-5"><div className="card p-8 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand"/><p className="mt-3 text-sm text-muted">Loading your live order…</p></div></div>;
  if (!order) return <div className="grid min-h-screen place-items-center bg-canvas p-5"><div className="card max-w-md p-8 text-center"><h1 className="font-display text-2xl font-extrabold">Order not found</h1><p className="mt-2 text-sm text-muted">{snapshotError || 'This order may have been cleared from the local demo data.'}</p><Link to="/" className="mt-5 inline-block text-sm font-bold text-brand">Back to ServeIQ</Link></div></div>;
  const table = state.tables.find(t=>t.id===order.table_id);
  const bill = calcBill(order);
  const current = statusIndex(order.status);
  const terminal = order.status==='served';
  const isOnline = order.payment_method==='pay_online';
  const simulatePayment = async (success) => {
    if (isSupabaseMode) {
      if (success) return payOnline();
      setPaymentMessage('Use the Razorpay checkout to test a failed payment. Razorpay will report the final status securely.');
      return;
    }
    setPaymentMessage('Processing simulated outcome…');
    try { await updateOrder(order.id,{payment_status:success?'paid':'failed',paid_at:success?new Date().toISOString():null}); setPaymentMessage(success?'Demo payment succeeded. The bill is marked paid.':'Demo payment failed. No money was charged; you can retry below.'); }
    catch (error) { setPaymentMessage(error.message || 'Could not update mock payment status.'); }
  };
  const payOnline = async () => {
    if (!isRazorpayEnabled) {
      setPaymentMessage('Razorpay test mode is not configured yet. Ask the restaurant to enable online payments or pay at reception.');
      return;
    }
    setPaymentProcessing(true);
    setPaymentMessage('Opening secure Razorpay checkout…');
    try {
      const result = await payWithRazorpay(order);
      await fetchPublicOrderSnapshot(order.id);
      setPaymentMessage(result.paid ? 'Payment verified. Your bill is marked paid.' : 'Payment received. We are waiting for gateway confirmation.');
    } catch (error) {
      setPaymentMessage(error.message || 'Could not complete the online payment.');
    } finally {
      setPaymentProcessing(false);
    }
  };
  return <div className="min-h-screen bg-canvas px-4 py-6 md:px-8 md:py-10"><div className="mx-auto max-w-4xl"><Link to={`/t/${order.table_id}`} className="no-print inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-brand"><ArrowLeft size={16}/> Back to menu</Link><div className="mt-5 grid gap-5 md:grid-cols-[1.1fr_.9fr] md:items-start"><section className="space-y-5"><div className="customer-heading overflow-hidden rounded-[24px] p-6 text-white md:p-8"><div className="flex items-start justify-between gap-4"><div><Pill tone="green">Order received</Pill><p className="mt-4 text-xs font-bold uppercase tracking-[.15em] text-emerald-100">Order number</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">#{order.id.slice(0,8).toUpperCase()}</h1><p className="mt-2 text-sm text-emerald-50/80">Table {table?.number ?? order.table_id} · {new Date(order.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p></div><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10"><Clock3 size={24} className="text-[#d9f37a]"/></div></div><div className="mt-7 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#d9f37a] transition-all" style={{width:`${(current+1)/steps.length*100}%`}}/></div><span className="text-xs font-bold text-[#e6f6bb]">{current+1} of {steps.length}</span></div><p className="mt-3 text-sm font-bold">{steps[current]?.detail}</p></div>
      <div className="card p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-extrabold">Order progress</h2><p className="mt-1 text-xs text-muted">Updates live as the kitchen works.</p></div><Pill tone={terminal?'green':order.status==='ready'?'yellow':'blue'}>{steps[current]?.label}</Pill></div><div className="relative mt-7 space-y-0">{steps.map((step,index)=>{const Icon=step.icon;const done=index<=current;const active=index===current;return <div key={step.id} className="relative flex gap-4 pb-7 last:pb-0"><div className="relative flex w-8 shrink-0 justify-center"><div className={`z-10 grid h-8 w-8 place-items-center rounded-full border-2 ${done?'border-brand bg-brand text-white':'border-slate-200 bg-white text-slate-300'} ${active?'ring-4 ring-[#e6f1dc]':''}`}><Icon size={15}/></div>{index<steps.length-1&&<div className={`absolute top-8 h-[calc(100%-6px)] w-px ${index<current?'bg-brand':'bg-slate-200'}`}/>}</div><div className="flex-1 pt-0.5"><p className={`text-sm font-extrabold ${done?'text-ink':'text-slate-400'}`}>{step.label}</p><p className={`mt-1 text-xs ${done?'text-muted':'text-slate-400'}`}>{step.detail}</p></div>{active&&<span className="mt-1 h-2 w-2 rounded-full bg-brand"/>}</div>})}</div></div></section>
      <aside className="space-y-5"><div className="card p-5"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-extrabold">Your bill</h2><FileText size={18} className="text-brand"/></div><p className="mt-1 text-xs text-muted">An itemised summary for this order.</p><div className="mt-5 space-y-4">{order.items.map(row=>{const item=state.menuItems.find(m=>m.id===row.menu_item_id);return <div key={row.id} className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold">{item?.name||'Menu item'}</p><p className="mt-1 text-xs text-muted">Qty {row.quantity} × {formatINR(row.price)}</p>{row.notes&&<p className="mt-1 text-[11px] italic text-slate-400">Note: {row.notes}</p>}</div><span className="text-sm font-bold">{formatINR(row.price*row.quantity)}</span></div>})}</div><div className="my-5 border-t border-dashed border-slate-200"/><div className="space-y-2.5 text-sm"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatINR(bill.subtotal)}</span></div><div className="flex justify-between text-slate-500"><span>GST · 5%</span><span>{formatINR(bill.gst)}</span></div><div className="flex justify-between border-t border-slate-100 pt-3 font-display text-xl font-extrabold"><span>Total</span><span>{formatINR(bill.total)}</span></div></div><div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-xs font-bold text-slate-500">Payment status</span><Pill tone={order.payment_status==='paid'?'green':order.payment_status==='failed'?'red':'yellow'}>{order.payment_status==='paid'?'Paid':order.payment_status==='failed'?'Failed':'Pending'}</Pill></div><div className="no-print mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={()=>window.print()}><Printer size={15}/> Print bill</Button><Button onClick={()=>downloadBill(order,state)}><Download size={15}/> Download PDF</Button></div></div>
      {isOnline&&order.payment_status!=='paid'&&<div className="card p-5"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><WalletCards size={18}/></span><div><h3 className="font-display font-extrabold">{isSupabaseMode?'Razorpay test payment':'Mock online payment'}</h3><p className="mt-0.5 text-xs text-muted">{isSupabaseMode?'Secure test checkout. No production money should be used.':'No real gateway or charge.'}</p></div></div>{isSupabaseMode?<><p className="mt-3 text-xs leading-5 text-slate-500">Pay through Razorpay test mode. The bill is marked paid only after its server-side signature and payment status are verified.</p>{paymentMessage&&<div className="mt-3"><Notice type={paymentMessage.includes('verified')?'success':'error'}>{paymentMessage}</Notice></div>}<Button className="mt-4 w-full" loading={paymentProcessing} onClick={payOnline}><WalletCards size={16}/> Pay securely with Razorpay</Button></>:<><p className="mt-3 text-xs leading-5 text-slate-500">Choose a simulated outcome to test both success and failure handling.</p>{paymentMessage&&<div className="mt-3"><Notice type={order.payment_status==='paid'?'success':'error'}>{paymentMessage}</Notice></div>}<div className="mt-4 space-y-2"><Button className="w-full" onClick={()=>simulatePayment(true)}><CheckCircle2 size={16}/> Simulate successful payment</Button><Button variant="secondary" className="w-full" onClick={()=>simulatePayment(false)}>Simulate failed payment</Button></div></>}</div>}
      {!isOnline&&<div className="card p-5"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><WalletCards size={18}/></span><div><h3 className="font-display font-extrabold">Pay at reception</h3><p className="mt-0.5 text-xs text-muted">Settle this bill with the cashier.</p></div></div><p className="mt-3 text-xs leading-5 text-slate-500">Your order is confirmed. The cashier will mark the bill as paid once you complete payment.</p></div>}
      {order.payment_status==='paid'&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 size={19}/> Payment confirmed</div><p className="mt-1 text-xs text-emerald-700">Your demo bill has been marked as paid.</p></div>}</aside></div><p className="no-print mt-8 text-center text-xs text-slate-400">ServeIQ · Thank you for dining with us.</p></div></div>;
}
