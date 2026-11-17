import { ArrowDownRight, ArrowRight, ChefHat, CircleDollarSign, Clock3, QrCode, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isSupabaseMode, useDemoState } from '../lib/demoStore';

export default function Home() {
  const state = useDemoState();
  const primaryTable = state.tables.find(table => table.is_active);
  const guestMenuPath = primaryTable ? `/t/${primaryTable.id}` : '/';
  const guestMenuLabel = primaryTable ? `Start at Table ${primaryTable.number}` : isSupabaseMode && !state.isLoaded ? 'Loading menu…' : 'No active table';
  const preventUnavailableMenu = event => { if (!primaryTable) event.preventDefault(); };
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark">S</div>
          <div><div className="font-display text-xl font-extrabold">ServeIQ</div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-muted">Restaurant OS</div></div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/staff-login" className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-white">Staff login</Link>
          <Link to={guestMenuPath} onClick={preventUnavailableMenu} aria-disabled={!primaryTable} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#105541] aria-disabled:cursor-not-allowed aria-disabled:opacity-50">Try menu <ArrowRight size={15} className="ml-1 inline" /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-4 md:px-8 md:pt-12">
        <section className="grid gap-9 lg:grid-cols-[1.04fr_.96fr] lg:items-center">
          <div className="py-6 md:py-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d7e2d2] bg-white px-3 py-1.5 text-xs font-bold text-brand"><span className="h-2 w-2 rounded-full bg-lime-500" /> A calmer way to run service</div>
            <h1 className="font-display max-w-2xl text-5xl font-extrabold leading-[1.06] tracking-[-.05em] text-ink md:text-7xl">Good service.<br /><span className="text-brand">Less busywork.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-500 md:text-lg">One connected flow from table QR to kitchen ticket to a clean, accurate bill. Built for the people who make every meal feel effortless.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link to={guestMenuPath} onClick={preventUnavailableMenu} aria-disabled={!primaryTable} className="rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/15 hover:bg-[#105541] aria-disabled:cursor-not-allowed aria-disabled:opacity-50">Explore the guest menu <ArrowRight size={16} className="ml-2 inline" /></Link><Link to="/staff-login" className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-ink hover:bg-slate-50">Open staff demo</Link></div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-brand" /> Role-based staff access</span><span className="flex items-center gap-2"><Clock3 size={16} className="text-brand" /> Live order status</span><span className="flex items-center gap-2"><CircleDollarSign size={16} className="text-brand" /> Transparent billing</span></div>
          </div>
          <div className="relative">
            <div className="absolute -inset-5 rounded-[36px] bg-[#d9f37a]/25 blur-xl" />
            <div className="relative overflow-hidden rounded-[28px] bg-[#e7eee3] p-4 md:p-6">
              <div className="grid grid-cols-[1fr_.75fr] gap-3">
                <div className="overflow-hidden rounded-2xl bg-white p-3 shadow-soft">
                  <img className="h-40 w-full rounded-xl object-cover md:h-52" src="https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=900&q=85" alt="Fresh restaurant dish" />
                  <div className="mt-3 flex items-start justify-between gap-2"><div><p className="font-display text-sm font-extrabold">Seasonal pasta</p><p className="mt-1 text-xs text-muted">Chef's pick · Veg</p></div><span className="text-sm font-extrabold">₹449</span></div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-[#eff5e9] p-3"><span className="text-xs font-bold text-brand">Added to your order</span><span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-xs text-white">✓</span></div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl bg-brand p-4 text-white shadow-soft"><div className="mb-5 flex items-center justify-between"><QrCode size={21} /><ArrowDownRight size={18} className="text-lime-200" /></div><p className="text-xs text-emerald-100">Table 04</p><p className="mt-1 font-display text-lg font-extrabold">Scan. Order. Enjoy.</p><p className="mt-3 text-xs leading-relaxed text-emerald-100">Skip the wait and order at your own pace.</p></div>
                  <div className="flex-1 rounded-2xl bg-white p-4 shadow-soft"><div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-700"><ChefHat size={18} /></span><span className="text-xs font-extrabold">Kitchen queue</span></div><div className="space-y-3">{[['T04','Preparing','w-3/4'],['T02','New order','w-1/2'],['T01','Ready','w-full']].map(([table,status,width])=><div key={table}><div className="flex justify-between text-[10px]"><span className="font-bold">{table}</span><span className="text-muted">{status}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-lime-500 ${width}`} /></div></div>)}</div></div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">{[[UtensilsCrossed,'Digital menu'],[Clock3,'Live tracking'],[CircleDollarSign,'One clear bill']].map(([Icon,label])=><div key={label} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/80 px-2 py-3 text-[10px] font-bold text-slate-600 md:text-xs"><Icon size={14} className="text-brand" />{label}</div>)}</div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 px-5 py-6 text-center text-xs text-slate-400">ServeIQ · Local MVP prototype · No AI/ML features</footer>
    </div>
  );
}
