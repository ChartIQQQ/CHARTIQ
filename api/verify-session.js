// api/verify-session.js
// Vercel Serverless Function — verifies a Stripe Checkout session is paid

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ paid: false, error: 'No session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Allow access if payment succeeded OR subscription is active
    const paid = session.payment_status === 'paid' || session.status === 'complete';

    res.status(200).json({ paid });
  } catch (err) {
    console.error('Stripe verify error:', err);
    res.status(200).json({ paid: false });
  }
};
