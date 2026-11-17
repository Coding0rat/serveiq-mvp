import { useEffect, useSyncExternalStore } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

export const isSupabaseMode = import.meta.env.VITE_DATA_MODE === 'supabase' && isSupabaseConfigured;

const STORAGE_KEY = 'serveiq-demo-v1';
const now = () => new Date().toISOString();
const createId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [...bytes].map((byte, index) => {
      const hex = byte.toString(16).padStart(2, '0');
      return [4, 6, 8, 10].includes(index) ? `-${hex}` : hex;
    }).join('');
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
};
const image = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82`;

const emptyState = () => ({ categories: [], menuItems: [], tables: [], pairings: [], orders: [], profiles: [], isLoaded: false });

const seed = () => {
  const categories = [
    { id: 'c-starters', name: 'Small Plates', sort_order: 1 },
    { id: 'c-mains', name: 'Mains', sort_order: 2 },
    { id: 'c-drinks', name: 'Drinks', sort_order: 3 },
    { id: 'c-desserts', name: 'Desserts', sort_order: 4 },
  ];
  const menuItems = [
    {id:'i1',category_id:'c-starters',name:'Truffle Parmesan Fries',description:'Crispy fries, parmesan snow and a little truffle oil.',price:249,image_url:image('photo-1573080496219-bb080dd4f877'),is_veg:true,is_available:true},
    {id:'i2',category_id:'c-starters',name:'Crispy Lotus Stem',description:'Honey chilli glaze, sesame and spring onion.',price:289,image_url:image('photo-1547592180-85f173990554'),is_veg:true,is_available:true},
    {id:'i3',category_id:'c-starters',name:'Paneer Tikka',description:'Charred cottage cheese, mint chutney and lime.',price:329,image_url:image('photo-1567188040759-fb8a883dc6d8'),is_veg:true,is_available:true},
    {id:'i4',category_id:'c-starters',name:'Chilli Garlic Prawns',description:'Wok-tossed prawns, garlic butter and herbs.',price:429,image_url:image('photo-1625944525533-473f1a3d54e7'),is_veg:false,is_available:true},
    {id:'i5',category_id:'c-starters',name:'Cajun Chicken Bites',description:'Crisp chicken, smoky cajun dust and house dip.',price:359,image_url:image('photo-1608039829572-78524f79c4c7'),is_veg:false,is_available:true},
    {id:'i6',category_id:'c-starters',name:'Avocado Toast',description:'Sourdough, smashed avocado and chilli flakes.',price:319,image_url:image('photo-1525351484163-7529414344d8'),is_veg:true,is_available:true},
    {id:'i7',category_id:'c-mains',name:'Wild Mushroom Risotto',description:'Arborio rice, forest mushrooms and aged parmesan.',price:449,image_url:image('photo-1476124369491-e7addf5db371'),is_veg:true,is_available:true},
    {id:'i8',category_id:'c-mains',name:'Classic Margherita Pizza',description:'San Marzano tomato, mozzarella and fresh basil.',price:399,image_url:image('photo-1579751626657-72bc17010498'),is_veg:true,is_available:true},
    {id:'i9',category_id:'c-mains',name:'Smoky BBQ Chicken Pizza',description:'BBQ chicken, red onion and smoked mozzarella.',price:489,image_url:image('photo-1571407970349-bc81e7e96d47'),is_veg:false,is_available:true},
    {id:'i10',category_id:'c-mains',name:'Butter Paneer Bowl',description:'Creamy tomato paneer with jeera rice.',price:379,image_url:image('photo-1631452180519-c014fe946bc7'),is_veg:true,is_available:true},
    {id:'i11',category_id:'c-mains',name:'Herb Grilled Chicken',description:'Chicken breast, seasonal vegetables and jus.',price:529,image_url:image('photo-1532550907401-a500c9a57435'),is_veg:false,is_available:true},
    {id:'i12',category_id:'c-mains',name:'Thai Green Curry',description:'Coconut green curry, vegetables and steamed rice.',price:429,image_url:image('photo-1455619452474-d2be8b1e70cd'),is_veg:true,is_available:true},
    {id:'i13',category_id:'c-mains',name:'Classic Chicken Burger',description:'Grilled chicken, lettuce, pickles and house sauce.',price:399,image_url:image('photo-1568901346375-23c9450c58cd'),is_veg:false,is_available:true},
    {id:'i14',category_id:'c-drinks',name:'Mango Mint Cooler',description:'Fresh mango, mint, lime and sparkling water.',price:179,image_url:image('photo-1513558161293-cafb765edfd7'),is_veg:true,is_available:true},
    {id:'i15',category_id:'c-drinks',name:'Cold Brew Tonic',description:'Slow-steeped coffee, tonic and orange peel.',price:199,image_url:image('photo-1461023058943-07fcbe16d735'),is_veg:true,is_available:true},
    {id:'i16',category_id:'c-drinks',name:'Watermelon Cooler',description:'Fresh watermelon juice with a squeeze of lime.',price:159,image_url:image('photo-1525385133512-2f3bdd039054'),is_veg:true,is_available:true},
    {id:'i17',category_id:'c-drinks',name:'Classic Masala Chai',description:'Slow-simmered tea with ginger and warming spices.',price:99,image_url:image('photo-1571934811356-5cc061b6821f'),is_veg:true,is_available:true},
    {id:'i18',category_id:'c-desserts',name:'Warm Chocolate Brownie',description:'Dark chocolate brownie and vanilla bean ice cream.',price:229,image_url:image('photo-1606313564200-e75d5e30476c'),is_veg:true,is_available:true},
    {id:'i19',category_id:'c-desserts',name:'Baked Cheesecake',description:'Vanilla cheesecake, berry compote and crumb.',price:259,image_url:image('photo-1533134242443-d4fd215305ad'),is_veg:true,is_available:true},
    {id:'i20',category_id:'c-desserts',name:'Classic Tiramisu',description:'Espresso-soaked sponge, mascarpone and cocoa.',price:269,image_url:image('photo-1571877227200-a0d98ea607e9'),is_veg:true,is_available:false},
  ];
  const tables = Array.from({length:5}, (_,i) => ({ id:`T${i+1}`, number:i+1, qr_url:`/t/T${i+1}`, is_active:true }));
  const pairings = [
    {item_id:'i1',paired_item_id:'i15'}, {item_id:'i1',paired_item_id:'i14'},
    {item_id:'i3',paired_item_id:'i14'}, {item_id:'i8',paired_item_id:'i16'},
    {item_id:'i10',paired_item_id:'i17'}, {item_id:'i18',paired_item_id:'i15'},
    {item_id:'i11',paired_item_id:'i12'}, {item_id:'i13',paired_item_id:'i16'},
  ];
  const oldDate = (days) => new Date(Date.now()-days*86400000).toISOString();
  const historical = [
    {id:'demo-old-1',table_id:'T2',status:'served',total:748,payment_status:'paid',payment_method:'pay_at_reception',created_at:oldDate(1),items:[{id:'oi-old-1a',menu_item_id:'i1',quantity:1,notes:'',price:249},{id:'oi-old-1b',menu_item_id:'i15',quantity:1,notes:'',price:199},{id:'oi-old-1c',menu_item_id:'i18',quantity:1,notes:'',price:229}]},
    {id:'demo-old-2',table_id:'T4',status:'served',total:1007,payment_status:'paid',payment_method:'pay_online',created_at:oldDate(2),items:[{id:'oi-old-2a',menu_item_id:'i8',quantity:1,notes:'',price:399},{id:'oi-old-2b',menu_item_id:'i16',quantity:1,notes:'',price:159},{id:'oi-old-2c',menu_item_id:'i3',quantity:1,notes:'',price:329}]},
    {id:'demo-old-3',table_id:'T1',status:'served',total:958,payment_status:'paid',payment_method:'pay_at_reception',created_at:oldDate(3),items:[{id:'oi-old-3a',menu_item_id:'i1',quantity:1,notes:'',price:249},{id:'oi-old-3b',menu_item_id:'i15',quantity:1,notes:'',price:199},{id:'oi-old-3c',menu_item_id:'i10',quantity:1,notes:'',price:379}]},
  ];
  return { categories, menuItems, tables, pairings, orders: historical, profiles: [], isLoaded: true };
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!parsed.categories || !parsed.menuItems || !parsed.orders || !parsed.tables) return seed();
    return { ...parsed, isLoaded: true };
  } catch { return seed(); }
}
let state = isSupabaseMode ? emptyState() : load();
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener());
function persist() {
  if (!isSupabaseMode) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* demo continues in memory */ }
  }
  emit();
}
if (typeof window !== 'undefined' && !isSupabaseMode) {
  window.addEventListener('storage', e => { if (e.key === STORAGE_KEY && e.newValue) { try { state = JSON.parse(e.newValue); emit(); } catch {} } });
}
export const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getSnapshot = () => state;

let remoteRefreshPromise = null;
let remoteBootstrapped = false;
let staffRealtimeChannel = null;
const noOp = () => {};
const logRemoteError = error => { if (import.meta.env.DEV) console.error('[ServeIQ Supabase]', error); };

function mapRemoteOrder(row, menuItems = state.menuItems) {
  const items = (row.order_items || row.items || []).map(item => ({
    id: item.id,
    menu_item_id: item.menu_item_id,
    quantity: Number(item.quantity),
    notes: item.notes || '',
    price: Number(item.price),
    name: item.name || menuItems.find(m => m.id === item.menu_item_id)?.name || 'Menu item',
  }));
  return { ...row, total: Number(row.total || 0), items };
}

export async function refreshRemoteState() {
  if (!isSupabaseMode || !supabase) return state;
  if (remoteRefreshPromise) return remoteRefreshPromise;
  remoteRefreshPromise = (async () => {
    const [categoriesRes, itemsRes, tablesRes, pairsRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').order('name'),
      supabase.from('tables').select('*').order('number'),
      supabase.from('item_pairings').select('*'),
    ]);
    for (const result of [categoriesRes, itemsRes, tablesRes, pairsRes]) {
      if (result.error) throw result.error;
    }
    const menuItems = itemsRes.data || [];
    let orders = [];
    const { data: userResult } = await supabase.auth.getUser();
    if (userResult?.user) {
      const { data: profile } = await supabase.from('profiles').select('role,display_name').eq('id', userResult.user.id).maybeSingle();
      if (profile && ['admin', 'kitchen'].includes(profile.role)) {
        const { data: orderRows, error: orderError } = await supabase.from('orders').select('*,order_items(*)').order('created_at', { ascending: false });
        if (orderError) throw orderError;
        orders = (orderRows || []).map(row => mapRemoteOrder(row, menuItems));
      }
    }
    state = {
      categories: categoriesRes.data || [],
      menuItems,
      tables: tablesRes.data || [],
      pairings: pairsRes.data || [],
      orders,
      profiles: [],
      isLoaded: true,
    };
    emit();
    return state;
  })().finally(() => { remoteRefreshPromise = null; });
  return remoteRefreshPromise;
}

function bootstrapRemote() {
  if (!isSupabaseMode || !supabase) return;
  if (!remoteBootstrapped) {
    remoteBootstrapped = true;
    refreshRemoteState().catch(logRemoteError);
  }
}

export function useDemoState() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { if (isSupabaseMode) bootstrapRemote(); }, []);
  return snapshot;
}

export function startStaffRealtime() {
  if (!isSupabaseMode || !supabase || staffRealtimeChannel) return;
  staffRealtimeChannel = supabase.channel('orders:all', { config: { private: true } })
    .on('broadcast', { event: 'order_update' }, () => { refreshRemoteState().catch(logRemoteError); })
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') logRemoteError(new Error(`Staff Realtime subscription: ${status}`));
    });
}
export function stopStaffRealtime() {
  if (staffRealtimeChannel && supabase) supabase.removeChannel(staffRealtimeChannel);
  staffRealtimeChannel = null;
}

export async function fetchPublicOrderSnapshot(orderId) {
  if (!isSupabaseMode || !supabase) return null;
  const { data, error } = await supabase.rpc('get_public_order_snapshot', { p_order_id: orderId });
  if (error) throw error;
  if (!data) return null;
  const order = mapRemoteOrder(data, state.menuItems);
  mergeRemoteOrder(order);
  return order;
}
export function mergeRemoteOrder(order) {
  if (!order?.id) return;
  const normalized = mapRemoteOrder(order, state.menuItems);
  const nextOrders = [normalized, ...state.orders.filter(existing => existing.id !== normalized.id)];
  state = { ...state, orders: nextOrders };
  emit();
}
export function subscribeToPublicOrder(orderId, onUpdate) {
  if (!isSupabaseMode || !supabase) return noOp;
  const channel = supabase.channel(`order:${orderId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'order_update' }, async () => {
      try {
        const order = await fetchPublicOrderSnapshot(orderId);
        if (order) onUpdate?.(order);
      } catch (error) { logRemoteError(error); }
    })
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') logRemoteError(new Error(`Order Realtime subscription: ${status}`));
    });
  return () => { if (supabase) supabase.removeChannel(channel); };
}

export async function createOrder({ tableId, items, paymentMethod }) {
  if (isSupabaseMode && supabase) {
    if (!Array.isArray(items) || !items.length) throw new Error('Add at least one item before placing an order.');
    const table = state.tables.find(t => t.id.toLowerCase() === String(tableId).toLowerCase() && t.is_active);
    if (!table) throw new Error('This table is not available. Please ask a team member for help.');
    const payload = items.map(row => ({ menu_item_id: row.menu_item_id, quantity: row.quantity, notes: String(row.notes || '').slice(0,240) }));
    const { data: orderId, error } = await supabase.rpc('place_order', { p_table_id: table.id, p_items: payload, p_payment_method: paymentMethod || 'pay_at_reception' });
    if (error) throw new Error(error.message || 'Could not place the order.');
    const order = await fetchPublicOrderSnapshot(orderId);
    if (!order) throw new Error('Order was created, but the guest bill could not be loaded. Refresh the page.');
    return order;
  }
  const table = state.tables.find(t => t.id.toLowerCase() === String(tableId).toLowerCase() && t.is_active);
  if (!table) throw new Error('This table is not available. Please ask a team member for help.');
  if (!Array.isArray(items) || !items.length) throw new Error('Add at least one item before placing an order.');
  const normalized = items.map((row) => {
    const menuItem = state.menuItems.find(m => m.id === row.menu_item_id);
    if (!menuItem || !menuItem.is_available) throw new Error(`${menuItem?.name || 'An item'} is currently unavailable. Remove it and try again.`);
    const quantity = Math.max(1, Math.min(20, Number.parseInt(row.quantity, 10) || 1));
    return { id: createId(), menu_item_id: menuItem.id, quantity, notes: String(row.notes || '').slice(0, 240), price: Number(menuItem.price) };
  });
  const subtotal = normalized.reduce((sum, row) => sum + row.price * row.quantity, 0);
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const order = { id: createId(), table_id: table.id, status: 'placed', total: Math.round((subtotal + tax) * 100) / 100, payment_status: 'pending', payment_method: paymentMethod || 'pay_at_reception', created_at: now(), items: normalized };
  state = { ...state, orders: [order, ...state.orders] };
  persist();
  return order;
}

export async function updateOrder(orderId, patch) {
  if (isSupabaseMode && supabase) {
    if (patch.status) {
      const { error } = await supabase.rpc('advance_order_status', { p_order_id: orderId, p_next_status: patch.status });
      if (error) throw error;
    }
    if (patch.payment_status) {
      const targetOrder = state.orders.find(o => o.id === orderId) || await fetchPublicOrderSnapshot(orderId);
      if (patch.payment_status === 'paid' && targetOrder?.payment_method !== 'pay_online') {
        const { error } = await supabase.rpc('admin_mark_bill_paid', { p_order_id: orderId });
        if (error) throw error;
      } else if (targetOrder?.payment_method === 'pay_online') {
        throw new Error('Online payments are confirmed only by the payment gateway.');
      }
    }
    await refreshRemoteState();
    if (!state.orders.some(o=>o.id===orderId)) await fetchPublicOrderSnapshot(orderId);
    return;
  }
  state = { ...state, orders: state.orders.map(o => o.id === orderId ? { ...o, ...patch } : o) };
  persist();
}

export async function upsertMenuItem(item) {
  if (!item.name?.trim()) throw new Error('Item name is required.');
  const price = Number(item.price);
  if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid price.');
  const cleaned = { ...item, name: item.name.trim(), description: (item.description || '').trim(), price: Math.round(price*100)/100 };
  if (isSupabaseMode && supabase) {
    const { id, ...payload } = cleaned;
    const { error } = id
      ? await supabase.from('menu_items').update({ ...payload, updated_at: now() }).eq('id', id)
      : await supabase.from('menu_items').insert(payload);
    if (error) throw error;
    await refreshRemoteState();
    return;
  }
  state = { ...state, menuItems: item.id ? state.menuItems.map(i => i.id === item.id ? { ...i, ...cleaned } : i) : [{ ...cleaned, id: createId() }, ...state.menuItems] };
  persist();
}
export async function deleteMenuItem(id) {
  if (isSupabaseMode && supabase) {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) throw error;
    await refreshRemoteState();
    return;
  }
  state = { ...state, menuItems: state.menuItems.filter(i => i.id !== id), pairings: state.pairings.filter(p => p.item_id !== id && p.paired_item_id !== id) }; persist();
}
export async function upsertCategory(category) {
  if (!category.name?.trim()) throw new Error('Category name is required.');
  if (isSupabaseMode && supabase) {
    const payload = { name: category.name.trim() };
    const { error } = category.id
      ? await supabase.from('categories').update(payload).eq('id', category.id)
      : await supabase.from('categories').insert({ ...payload, sort_order: state.categories.length + 1 });
    if (error) throw error;
    await refreshRemoteState();
    return;
  }
  state = { ...state, categories: category.id ? state.categories.map(c => c.id === category.id ? { ...c, name: category.name.trim() } : c) : [...state.categories, {id:createId(),name:category.name.trim(),sort_order:state.categories.length+1}] };
  persist();
}
export async function deleteCategory(id) {
  if (state.menuItems.some(i => i.category_id === id)) throw new Error('Move or remove menu items in this category first.');
  if (isSupabaseMode && supabase) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    await refreshRemoteState();
    return;
  }
  state = { ...state, categories: state.categories.filter(c => c.id !== id) }; persist();
}
export async function setPairings(itemId, pairedIds) {
  const validIds = [...new Set(pairedIds.filter(id => id !== itemId))].slice(0,3);
  if (isSupabaseMode && supabase) {
    const { error: deleteError } = await supabase.from('item_pairings').delete().eq('item_id', itemId);
    if (deleteError) throw deleteError;
    if (validIds.length) {
      const { error: insertError } = await supabase.from('item_pairings').insert(validIds.map(id=>({item_id:itemId,paired_item_id:id})));
      if (insertError) throw insertError;
    }
    await refreshRemoteState();
    return;
  }
  const keep = state.pairings.filter(p => p.item_id !== itemId);
  const next = [...keep, ...validIds.map(id => ({ item_id:itemId, paired_item_id:id }))];
  state = { ...state, pairings: next }; persist();
}
export async function upsertTable(table) {
  const number = Number(table.number);
  if (!Number.isInteger(number) || number < 1) throw new Error('Table number must be a positive whole number.');
  const existing = state.tables.find(t => t.number === number && t.id !== table.id);
  if (existing) throw new Error('That table number already exists.');
  if (isSupabaseMode && supabase) {
    const id = table.id || createId();
    const payload = { id, number, qr_url: `/t/${id}`, is_active: table.is_active ?? true };
    const { error } = await supabase.from('tables').upsert(payload);
    if (error) throw error;
    await refreshRemoteState();
    return;
  }
  state = { ...state, tables: table.id ? state.tables.map(t => t.id === table.id ? { ...t, number, is_active: table.is_active } : t) : [...state.tables, {id:`T${number}`,number,qr_url:`/t/T${number}`,is_active:true}] };
  persist();
}
export async function deleteTable(id) {
  if (state.orders.some(o => o.table_id === id && o.status !== 'served')) throw new Error('This table has an active order and cannot be removed.');
  if (isSupabaseMode && supabase) {
    const { error } = await supabase.from('tables').delete().eq('id', id);
    if (error) throw error;
    await refreshRemoteState();
    return;
  }
  state = { ...state, tables: state.tables.filter(t => t.id !== id) }; persist();
}
export function resetDemo() { if (isSupabaseMode) return; state = seed(); persist(); }
export async function getRecommendations(itemId) {
  if (isSupabaseMode && supabase) {
    const { data, error } = await supabase.rpc('get_item_recommendations', { p_item_id: itemId });
    if (error) throw error;
    return data || [];
  }
  const explicit = state.pairings.filter(p => p.item_id === itemId).map(p => p.paired_item_id);
  const counts = new Map();
  for (const order of state.orders) {
    const contains = order.items?.some(row => row.menu_item_id === itemId);
    if (!contains) continue;
    for (const row of order.items || []) {
      if (row.menu_item_id === itemId) continue;
      counts.set(row.menu_item_id, (counts.get(row.menu_item_id) || 0) + row.quantity);
    }
  }
  const ranked = [...counts.entries()].sort((a,b) => b[1]-a[1]).map(([id])=>id);
  const ids = [...new Set([...explicit, ...ranked])].filter(id => id !== itemId && state.menuItems.some(m => m.id === id && m.is_available));
  return ids.slice(0,3).map(id => state.menuItems.find(m => m.id === id));
}
export const formatINR = value => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(Number(value || 0));
export const calcBill = order => {
  const subtotal = (order.items || []).reduce((sum,row)=>sum + Number(row.price)*Number(row.quantity),0);
  const gst = Math.round(subtotal * .05 * 100) / 100;
  return { subtotal, gst, total: Math.round((subtotal+gst)*100)/100 };
};
