import { adminClient, hmacHex, json, markPaymentCaptured, optionsResponse, signaturesMatch } from '../_shared/payment.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, request);

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';
    if (!webhookSecret || !signaturesMatch(await hmacHex(webhookSecret, rawBody), signature)) return json({ ok: false, error: 'Invalid webhook signature.' }, 401, request);

    const event = JSON.parse(rawBody);
    const payment = event?.payload?.payment?.entity;
    if (!payment?.order_id || !payment?.id) return json({ ok: true }, 200, request);

    const admin = adminClient();
    const { data: attempt, error } = await admin.from('payment_attempts')
      .select('id,order_id,amount_paise,status').eq('gateway_order_id', payment.order_id).maybeSingle();
    if (error) throw error;
    if (!attempt || Number(payment.amount) !== Number(attempt.amount_paise)) return json({ ok: true }, 200, request);

    if (event.event === 'payment.captured') {
      await markPaymentCaptured({ gatewayOrderId: payment.order_id, gatewayPaymentId: payment.id });
    } else if (event.event === 'payment.failed' && attempt.status !== 'captured') {
      await admin.from('payment_attempts').update({ status: 'failed', failure_reason: payment.error_description || 'Payment failed.' }).eq('id', attempt.id);
      await admin.from('orders').update({ payment_status: 'failed', paid_at: null }).eq('id', attempt.order_id).neq('payment_status', 'paid');
    }
    return json({ ok: true }, 200, request);
  } catch (error) {
    console.error('razorpay-webhook', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'Webhook processing failed.' }, 500, request);
  }
});
