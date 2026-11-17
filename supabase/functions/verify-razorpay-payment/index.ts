import { adminClient, hmacHex, json, markPaymentCaptured, optionsResponse, razorpayRequest, rejectDisallowedBrowserOrigin, signaturesMatch } from '../_shared/payment.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  const originError = rejectDisallowedBrowserOrigin(request);
  if (originError) return originError;
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, request);

  try {
    const body = await request.json();
    const fields = ['order_id', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'];
    if (fields.some(field => typeof body[field] !== 'string' || !body[field])) return json({ ok: false, error: 'Invalid payment response.' }, 400, request);

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) throw new Error('Missing RAZORPAY_KEY_SECRET.');
    const expected = await hmacHex(keySecret, `${body.razorpay_order_id}|${body.razorpay_payment_id}`);
    if (!signaturesMatch(expected, body.razorpay_signature)) return json({ ok: false, error: 'Payment signature could not be verified.' }, 400, request);

    const admin = adminClient();
    const { data: attempt, error: attemptError } = await admin.from('payment_attempts')
      .select('order_id,gateway_order_id,amount_paise,currency').eq('gateway_order_id', body.razorpay_order_id).maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt || attempt.order_id !== body.order_id) return json({ ok: false, error: 'Payment does not match this order.' }, 400, request);

    const paymentResponse = await razorpayRequest(`/payments/${encodeURIComponent(body.razorpay_payment_id)}`);
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== attempt.gateway_order_id || payment.amount !== attempt.amount_paise || payment.currency !== attempt.currency) {
      return json({ ok: false, error: 'Payment details could not be confirmed.' }, 400, request);
    }
    if (payment.status !== 'captured') return json({ ok: true, paid: false }, 200, request);

    await markPaymentCaptured({ gatewayOrderId: attempt.gateway_order_id, gatewayPaymentId: body.razorpay_payment_id, signatureVerified: true });
    return json({ ok: true, paid: true }, 200, request);
  } catch (error) {
    console.error('verify-razorpay-payment', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'Could not verify the payment yet.' }, 500, request);
  }
});
