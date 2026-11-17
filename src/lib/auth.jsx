import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { isSupabaseMode, refreshRemoteState, startStaffRealtime, stopStaffRealtime } from './demoStore';

const AuthContext = createContext(null);
const ACCOUNTS = {
  'kitchen@serveiq.demo': { password: 'Kitchen123!', role: 'kitchen', name: 'Kitchen Team' },
  'admin@serveiq.demo': { password: 'Admin123!', role: 'admin', name: 'Restaurant Admin' },
};

async function getStaffUser(session) {
  if (!session?.user || !supabase) return null;
  const { data: profile, error } = await supabase.from('profiles').select('role,display_name').eq('id', session.user.id).maybeSingle();
  if (error) throw error;
  if (!profile || !['admin','kitchen'].includes(profile.role)) throw new Error('This account has no ServeIQ staff role. Ask an administrator to assign a role in public.profiles.');
  return { id: session.user.id, email: session.user.email, role: profile.role, name: profile.display_name || session.user.email };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (isSupabaseMode) return null;
    try { return JSON.parse(localStorage.getItem('serveiq-demo-user') || 'null'); } catch { return null; }
  });

  useEffect(() => {
    if (!isSupabaseMode || !supabase) return undefined;
    let active = true;
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active || error || !data.session) return;
      try {
        const staffUser = await getStaffUser(data.session);
        if (!active) return;
        setUser(staffUser);
        await refreshRemoteState();
        await refreshRemoteState();
        startStaffRealtime();
      } catch (e) {
        if (active) setUser(null);
      }
    };
    loadSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isSupabaseMode) return;
    if (user) localStorage.setItem('serveiq-demo-user', JSON.stringify(user));
    else localStorage.removeItem('serveiq-demo-user');
  }, [user]);

  const signIn = async (email, password) => {
    if (isSupabaseMode && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message || 'Could not sign in.');
      try {
        const staffUser = await getStaffUser(data.session);
        setUser(staffUser);
        await refreshRemoteState();
        await refreshRemoteState();
        startStaffRealtime();
        return staffUser;
      } catch (e) {
        await supabase.auth.signOut();
        throw e;
      }
    }
    const account = ACCOUNTS[email.trim().toLowerCase()];
    if (!account || account.password !== password) throw new Error('Email or password is incorrect. Use one of the demo accounts below.');
    const session = { email: email.trim().toLowerCase(), role: account.role, name: account.name };
    setUser(session);
    return session;
  };
  const signOut = async () => {
    if (isSupabaseMode && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      stopStaffRealtime();
      setUser(null);
      await refreshRemoteState();
      return;
    }
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
