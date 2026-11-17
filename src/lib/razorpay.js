import { isSupabaseConfigured, supabase } from './supabase';

const razorpayKeyId = (import.meta.env.VITE_RAZORPAY_KEY_ID || '').trim();
let checkoutScript;

export const isRazorpayEnabled = Boolean(isSupabaseConfigured && razorpayKeyId);

function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScript) return checkoutScript;

  checkoutScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    document.head.appendChild(script);
  });
  return checkoutScript;
}

async function invokePaymentFunction(name, body) {
  if (!supabase) throw new Error('Online payments are not configured.');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error('The payment service could not be reached. Please try again or pay at reception.');
  if (!data?.ok) throw new Error(data?.error || 'The payment service could not process this request.');
  return data;
}

export async function payWithRazorpay(order) {
  if (!isRazorpayEnabled) throw new Error('Online payments are not configured for this restaurant yet.');
  const checkoutOrder = await invokePaymentFunction('create-razorpay-order', { order_id: order.id });
  await loadCheckoutScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const checkout = new window.Razorpay({
      key: razorpayKeyId,
      amount: checkoutOrder.amount,
      currency: checkoutOrder.currency,
      name: 'ServeIQ',
      description: `Table order #${order.id.slice(0, 8).toUpperCase()}`,
      order_id: checkoutOrder.gateway_order_id,
      theme: { color: '#153f32' },
      retry: { enabled: true, max_count: 2 },
      handler: async (response) => {
        try {
          const result = await invokePaymentFunction('verify-razorpay-payment', {
            order_id: order.id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          finish(resolve, result);
        } catch (error) {
          finish(reject, error);
        }
      },
      modal: { ondismiss: () => finish(reject, new Error('Payment was cancelled. You can try again whenever you are ready.')) },
    });
    checkout.on('payment.failed', response => {
      finish(reject, new Error(response?.error?.description || 'Payment failed. No charge was recorded. Please try again.'));
    });
    checkout.open();
  });
}
