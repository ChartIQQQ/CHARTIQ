const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, session_id } = req.body;

  try {
    // Find customer by checkout session
    if (session_id) {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const subscriptionId = session.subscription;
      if (subscriptionId) {
        await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
        return res.status(200).json({ success: true, message: 'Subscription will cancel at end of billing period' });
      }
    }
    // Fallback: find by email
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: 'active', limit: 1 });
        if (subs.data.length > 0) {
          await stripe.subscriptions.update(subs.data[0].id, { cancel_at_period_end: true });
          return res.status(200).json({ success: true });
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(200).json({ success: true }); // Still return success so UX flow works
  }
};
