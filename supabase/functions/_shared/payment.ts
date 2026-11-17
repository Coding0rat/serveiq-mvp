import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const allowedOrigin = (Deno.env.get('ALLOWED_ORIGIN') || '').trim().replace(/\/+$/, '');

function normalizeOrigin(origin: string | null) {
  return origin?.trim().replace(/\/+$/, '') || '';
}

export function isAllowedBrowserOrigin(request: Request) {
  return Boolean(allowedOrigin && normalizeOrigin(request.headers.get('origin')) === allowedOrigin);
}

export function corsHeaders(request?: Request) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  };
  if (request && isAllowedBrowserOrigin(request)) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

export function optionsResponse(request: Request) {
  if (!isAllowedBrowserOrigin(request)) return json({ ok: false, error: 'Request origin is not allowed.' }, 403, request);
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export const json = (body: Record<string, unknown>, status = 200, request?: Request) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });

export function rejectDisallowedBrowserOrigin(request: Request) {
  if (isAllowedBrowserOrigin(request)) return null;
  return json({ ok: false, error: 'Request origin is not allowed.' }, 403, request);
}

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('Server configuration is incomplete.');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function requiredSecret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

export async function razorpayRequest(path: string, init: RequestInit = {}) {
  const keyId = requiredSecret('RAZORPAY_KEY_ID');
  const keySecret = requiredSecret('RAZORPAY_KEY_SECRET');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Basic ${btoa(`${keyId}:${keySecret}`)}`);
  headers.set('Content-Type', 'application/json');
  return fetch(`https://api.razorpay.com/v1${path}`, { ...init, headers });
}

export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function signaturesMatch(expected: string, received: string) {
  if (!received || expected.length !== received.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  return mismatch === 0;
}

export async function markPaymentCaptured({
  gatewayOrderId,
  gatewayPaymentId,
  signatureVerified = false,
}: {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signatureVerified?: boolean;
}) {
  const admin = adminClient();
  const { data: attempt, error: attemptError } = await admin
    .from('payment_attempts')
    .select('id,order_id,status')
    .eq('gateway_order_id', gatewayOrderId)
    .maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt) throw new Error('Payment attempt not found.');

  const now = new Date().toISOString();
  const update = {
    status: 'captured', gateway_payment_id: gatewayPaymentId, captured_at: now,
    signature_verified_at: signatureVerified ? now : null,
    failure_reason: null,
  };
  const { error: paymentUpdateError } = await admin.from('payment_attempts').update(update).eq('id', attempt.id);
  if (paymentUpdateError) throw paymentUpdateError;
  const { error: orderUpdateError } = await admin
    .from('orders')
    .update({ payment_status: 'paid', paid_at: now })
    .eq('id', attempt.order_id)
    .neq('payment_status', 'paid');
  if (orderUpdateError) throw orderUpdateError;
  return attempt.order_id;
}
