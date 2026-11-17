import { adminClient, json, optionsResponse, razorpayRequest, rejectDisallowedBrowserOrigin } from '../_shared/payment.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return optionsResponse(request);
  const originError = rejectDisallowedBrowserOrigin(request);
  if (originError) return originError;
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, request);

  try {
    const { order_id: orderId } = await request.json();
    if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ ok: false, error: 'Invalid order.' }, 400, request);

    const admin = adminClient();
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id,total,payment_method,payment_status')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.payment_method !== 'pay_online') return json({ ok: false, error: 'This order is not eligible for online payment.' }, 400, request);
    if (order.payment_status === 'paid') return json({ ok: false, error: 'This bill has already been paid.' }, 409, request);

    const { data: existing, error: existingError } = await admin
      .from('payment_attempts')
      .select('gateway_order_id,amount_paise,currency,status')
      .eq('order_id', order.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ ok: true, gateway_order_id: existing.gateway_order_id, amount: existing.amount_paise, currency: existing.currency }, 200, request);

    const amount = Math.round(Number(order.total) * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) return json({ ok: false, error: 'The bill total is not valid for payment.' }, 400, request);
    const receipt = `sq_${order.id.replaceAll('-', '').slice(0, 30)}`;
    const gatewayResponse = await razorpayRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({ amount, currency: 'INR', receipt, notes: { serveiq_order_id: order.id } }),
    });
    const gatewayOrder = await gatewayResponse.json();
    if (!gatewayResponse.ok || !gatewayOrder?.id) throw new Error('Razorpay could not create a payment order.');

    const { error: insertError } = await admin.from('payment_attempts').insert({
      order_id: order.id, provider: 'razorpay', gateway_order_id: gatewayOrder.id,
      amount_paise: amount, currency: 'INR', status: 'created',
    });
    if (insertError) {
      const { data: concurrent } = await admin.from('payment_attempts')
        .select('gateway_order_id,amount_paise,currency').eq('order_id', order.id).maybeSingle();
      if (concurrent) return json({ ok: true, gateway_order_id: concurrent.gateway_order_id, amount: concurrent.amount_paise, currency: concurrent.currency }, 200, request);
      throw insertError;
    }
    return json({ ok: true, gateway_order_id: gatewayOrder.id, amount, currency: 'INR' }, 200, request);
  } catch (error) {
    console.error('create-razorpay-order', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'Could not start online payment. Please try again.' }, 500, request);
  }
});
