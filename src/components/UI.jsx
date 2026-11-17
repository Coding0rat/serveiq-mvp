import { LoaderCircle, AlertCircle, X } from 'lucide-react';

export function Button({ children, variant='primary', className='', loading=false, disabled=false, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-45 disabled:cursor-not-allowed';
  const styles = {
    primary:'bg-brand text-white hover:bg-[#105541] shadow-sm',
    secondary:'bg-white text-ink border border-slate-200 hover:bg-slate-50',
    soft:'bg-[#edf5e7] text-brand hover:bg-[#e2efd8]',
    danger:'bg-rose-50 text-rose-700 hover:bg-rose-100',
    dark:'bg-ink text-white hover:bg-black',
    ghost:'text-muted hover:bg-slate-100',
  };
  return <button className={`${base} ${styles[variant] || styles.primary} ${className}`} disabled={disabled || loading} {...props}>{loading && <LoaderCircle size={16} className="animate-spin" />}{children}</button>;
}
export function Pill({ children, tone='neutral' }) {
  const tones = {neutral:'bg-slate-100 text-slate-600',green:'bg-emerald-50 text-emerald-700',yellow:'bg-amber-50 text-amber-700',red:'bg-rose-50 text-rose-700',blue:'bg-blue-50 text-blue-700',dark:'bg-ink text-white'};
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${tones[tone] || tones.neutral}`}>{children}</span>;
}
export function Notice({ children, type='error', onClose }) {
  return <div role="alert" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${type==='success'?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-rose-200 bg-rose-50 text-rose-800'}`}><AlertCircle size={17} className="mt-0.5 shrink-0"/><div className="flex-1">{children}</div>{onClose&&<button aria-label="Dismiss alert" onClick={onClose}><X size={16}/></button>}</div>;
}
export function Field({ label, hint, ...props }) {
  return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">{label}</span><input className="field" {...props}/>{hint&&<span className="block text-xs text-muted">{hint}</span>}</label>;
}
export function SelectField({ label, children, ...props }) {
  return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">{label}</span><select className="field" {...props}>{children}</select></label>;
}
