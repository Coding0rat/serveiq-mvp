import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, CheckCircle2, ChefHat, Clock3, Coffee, Flame, Maximize2, PackageCheck, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { StaffLayout } from '../components/StaffLayout';
import { Button, Pill } from '../components/UI';
import { calcBill, formatINR, isSupabaseMode, updateOrder, useDemoState } from '../lib/demoStore';

const stages = [
  {id:'placed',label:'New orders',caption:'Needs acceptance',tone:'blue',icon:BellRing},
  {id:'accepted',label:'Accepted',caption:'Queued to cook',tone:'yellow',icon:Clock3},
  {id:'preparing',label:'Preparing',caption:'On the pass',tone:'red',icon:Flame},
  {id:'ready',label:'Ready to serve',caption:'Waiting for pickup',tone:'green',icon:PackageCheck},
];
const statusLabel = {placed:'Placed',accepted:'Accepted',preparing:'Preparing',ready:'Ready',served:'Served'};
const nextStage = {placed:'accepted',accepted:'preparing',preparing:'ready',ready:'served'};
const formatTime = date => new Date(date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

export default function KitchenPage() {
  const state = useDemoState();
  const activeOrders = useMemo(()=>state.orders.filter(o=>o.status!=='served').sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)),[state.orders]);
  const [showServed,setShowServed] = useState(false);
  const [newOrderIds,setNewOrderIds] = useState([]);
  const [soundOn,setSoundOn] = useState(true);
  const [lastAlert,setLastAlert] = useState(null);
  const knownIds = useRef(null);
  useEffect(()=>{
    const ids = new Set(activeOrders.map(o=>o.id));
    if (knownIds.current === null) { knownIds.current = ids; return; }
    const incoming = activeOrders.filter(o=>!knownIds.current.has(o.id) && o.status==='placed');
    knownIds.current = ids;
    if (incoming.length) {
      const newest = incoming[incoming.length-1];
      setNewOrderIds(old=>[...new Set([...old,...incoming.map(o=>o.id)])]);
      setLastAlert(newest);
      if (soundOn) playAlert();
    }
  },[activeOrders,soundOn]);
  const totalToday = state.orders.filter(o=>new Date(o.created_at).toDateString()===new Date().toDateString());
  const markNext = order => { const next = nextStage[order.status]; if (next) updateOrder(order.id,{status:next,status_updated_at:new Date().toISOString()}); setNewOrderIds(old=>old.filter(id=>id!==order.id)); if (lastAlert?.id===order.id) setLastAlert(null); };
  const currentOrders = state.orders.filter(o=>o.status!=='served');
  return <StaffLayout active="kitchen"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-brand"><ChefHat size={15}/> Kitchen operations</div><h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">The pass, at a glance.</h1><p className="mt-2 text-sm text-muted">Live tickets from every table. Keep the flow moving.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>setSoundOn(v=>!v)}>{soundOn?<Volume2 size={16}/>:<VolumeX size={16}/>} Alerts {soundOn?'on':'muted'}</Button><Button variant="secondary" onClick={()=>setShowServed(v=>!v)}>{showServed?'Hide served':'View served'} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{state.orders.filter(o=>o.status==='served').length}</span></Button></div></div>
    {lastAlert&&<div className="alert-pulse mt-6 flex flex-col gap-3 rounded-2xl border border-[#d8ec8b] bg-[#f5fbe4] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d9f37a] text-ink"><BellRing size={19}/></div><div><p className="text-sm font-extrabold">New order · Table {state.tables.find(t=>t.id===lastAlert.table_id)?.number||lastAlert.table_id}</p><p className="mt-1 text-xs text-slate-600">Order #{lastAlert.id.slice(0,8).toUpperCase()} just arrived. Open the ticket and accept it.</p></div></div><button className="self-start rounded-lg px-3 py-2 text-xs font-bold text-brand hover:bg-white/60 sm:self-auto" onClick={()=>{setLastAlert(null);setNewOrderIds([])}}>Dismiss</button></div>}
    <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">{[{label:'Open orders',value:currentOrders.length,icon:Coffee,tone:'bg-[#edf5e7] text-brand'},{label:'Placed today',value:totalToday.length,icon:BellRing,tone:'bg-blue-50 text-blue-700'},{label:'Cooking now',value:state.orders.filter(o=>o.status==='preparing').length,icon:Flame,tone:'bg-rose-50 text-rose-700'},{label:'Ready to serve',value:state.orders.filter(o=>o.status==='ready').length,icon:PackageCheck,tone:'bg-emerald-50 text-emerald-700'}].map(s=><div key={s.label} className="card flex items-center gap-3 p-4 md:p-5"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.tone}`}><s.icon size={19}/></div><div><p className="text-[11px] font-bold text-muted">{s.label}</p><p className="mt-0.5 font-display text-2xl font-extrabold">{s.value}</p></div></div>)}</div>
    <div className="mt-7 flex items-center justify-between"><div><h2 className="font-display text-xl font-extrabold">Live order board</h2><p className="mt-1 text-xs text-muted">Oldest ticket first in each stage.</p></div><div className="flex items-center gap-1.5 text-xs font-bold text-muted"><span className="h-2 w-2 rounded-full bg-emerald-500"/> Auto-updating</div></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-4">{stages.map(stage=>{const StageIcon=stage.icon;const tickets=activeOrders.filter(o=>o.status===stage.id);return <section key={stage.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-[#eef1ec]/70"><header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5"><div className="flex items-center gap-2.5"><span className={`grid h-8 w-8 place-items-center rounded-lg ${stage.tone==='blue'?'bg-blue-50 text-blue-700':stage.tone==='yellow'?'bg-amber-50 text-amber-700':stage.tone==='red'?'bg-rose-50 text-rose-700':'bg-emerald-50 text-emerald-700'}`}><StageIcon size={16}/></span><div><h3 className="text-xs font-extrabold">{stage.label}</h3><p className="mt-0.5 text-[10px] text-muted">{stage.caption}</p></div></div><span className="grid h-6 min-w-6 place-items-center rounded-full bg-slate-100 px-1 text-[11px] font-extrabold">{tickets.length}</span></header><div className="min-h-[230px] space-y-3 p-3">{tickets.length===0?<div className="grid min-h-[185px] place-items-center rounded-xl border border-dashed border-slate-300/80 px-4 text-center"><div><div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-300"><StageIcon size={18}/></div><p className="mt-2 text-xs font-bold text-slate-400">All clear</p><p className="mt-1 text-[10px] text-slate-400">New tickets appear here</p></div></div>:tickets.map(order=><Ticket key={order.id} order={order} state={state} isNew={newOrderIds.includes(order.id)} onAdvance={()=>markNext(order)}/>)}</div></section>})}</div>
    {showServed&&<section className="card mt-7 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-display font-extrabold">Recently served</h2><p className="mt-1 text-xs text-muted">Completed orders remain available for reference.</p></div><Button variant="secondary" onClick={()=>setShowServed(false)}>Hide</Button></div>{state.orders.filter(o=>o.status==='served').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,12).map(o=><div key={o.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-extrabold">Table {state.tables.find(t=>t.id===o.table_id)?.number||o.table_id} <span className="ml-2 text-xs font-medium text-muted">#{o.id.slice(0,8).toUpperCase()}</span></p><p className="mt-1 text-xs text-muted">{o.items.map(r=>`${state.menuItems.find(m=>m.id===r.menu_item_id)?.name||'Item'} ×${r.quantity}`).join(' · ')}</p></div><div className="flex items-center gap-3"><span className="text-xs text-muted">{formatTime(o.created_at)}</span><span className="text-sm font-extrabold">{formatINR(calcBill(o).total)}</span><Pill tone="green">Served</Pill></div></div>)}{!state.orders.some(o=>o.status==='served')&&<p className="p-6 text-sm text-muted">No completed tickets yet.</p>}</section>}
    <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-slate-400"><RefreshCw size={12}/> {isSupabaseMode?'This board receives order updates through Supabase Realtime.':'This board reacts to local demo-store changes; separate devices do not sync in demo mode.'}</div>
  </StaffLayout>;
}

function Ticket({order,state,isNew,onAdvance}) {
  const table=state.tables.find(t=>t.id===order.table_id);
  const current=stages.find(s=>s.id===order.status);
  const nextLabel=({accepted:'Start preparing',preparing:'Mark ready',ready:'Mark served',placed:'Accept order'})[order.status];
  return <article className={`overflow-hidden rounded-xl border bg-white shadow-sm ${isNew?'border-[#b4d44a] ring-2 ring-[#eaf6bc]':'border-slate-200'}`}><div className="flex items-start justify-between gap-2 border-b border-slate-100 p-3"><div><div className="flex items-center gap-2"><span className="font-display text-xl font-extrabold">T{table?.number||order.table_id}</span>{isNew&&<span className="rounded-full bg-lime-100 px-2 py-0.5 text-[9px] font-extrabold text-brand">NEW</span>}</div><p className="mt-0.5 text-[10px] text-muted">#{order.id.slice(0,7).toUpperCase()} · {formatTime(order.created_at)}</p></div><div className="text-right"><p className="font-display text-sm font-extrabold">{formatINR(calcBill(order).total)}</p><p className="mt-1 text-[10px] text-muted">{order.items.reduce((n,r)=>n+r.quantity,0)} items</p></div></div><div className="space-y-3 p-3">{order.items.map(row=>{const item=state.menuItems.find(m=>m.id===row.menu_item_id);return <div key={row.id} className="flex gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-extrabold">{row.quantity}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold leading-5">{item?.name||'Menu item'}</p>{row.notes&&<p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold leading-4 text-amber-800">Note: {row.notes}</p>}</div></div>})}</div><footer className="border-t border-slate-100 bg-slate-50/70 p-3"><Button onClick={onAdvance} className="w-full !justify-between !py-2.5">{nextLabel}<span aria-hidden>→</span></Button><p className="mt-2 text-center text-[10px] text-muted">Current: {statusLabel[order.status]}</p></footer></article>;
}
function playAlert() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    [0,0.19,0.38].forEach((delay,i)=>{const oscillator=ctx.createOscillator();const gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=i===1?880:660;gain.gain.setValueAtTime(0.001,ctx.currentTime+delay);gain.gain.exponentialRampToValueAtTime(0.11,ctx.currentTime+delay+0.015);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+0.13);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(ctx.currentTime+delay);oscillator.stop(ctx.currentTime+delay+0.14);});setTimeout(()=>ctx.close(),700);
  } catch {/* Audio may be blocked until user interaction; visual alert still works. */}
}
