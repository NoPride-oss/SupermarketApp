const Stripe = require('stripe');

let stripeClient = null;

function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  stripeClient = new Stripe(key, { apiVersion: '2023-10-16' });
  return stripeClient;
}

async function createCheckoutSession({ lineItems, successUrl, cancelUrl, customerEmail, metadata }) {
  const stripe = getStripe();
  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail,
    metadata
  });
}

async function getCheckoutSession(sessionId) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

module.exports = { createCheckoutSession, getCheckoutSession };
