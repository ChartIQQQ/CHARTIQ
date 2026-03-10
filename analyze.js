// api/analyze.js
// Vercel Serverless Function — analyzes chart image using Claude Vision + web search

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mime, session_id } = req.body;

  if (!image || !session_id) {
    return res.status(400).json({ error: 'Missing image or session_id' });
  }

  // ── Verify payment ──
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (!paid) return res.status(403).json({ error: 'Payment required' });
  } catch (e) {
    return res.status(403).json({ error: 'Could not verify payment' });
  }

  // ── Call Claude with image ──
  const SYSTEM_PROMPT = `You are an expert crypto trading analyst. Analyze the chart image provided and return a JSON object ONLY — no markdown, no explanation outside the JSON.

The JSON must have exactly these fields:
{
  "asset": "ticker symbol and pair, e.g. BTC/USDT",
  "timeframe": "e.g. 4H, 1D, 15m",
  "price": "current price visible on chart",
  "bias": "Bullish" or "Bearish" or "Neutral",
  "entry": "specific price range or condition for entry",
  "stop_loss": "specific price level for stop loss with brief reason",
  "tp1": "first take profit level with % gain",
  "tp2": "second take profit level with % gain or null",
  "patterns": "detailed description of patterns, indicators, support/resistance, candlestick signals you identify",
  "research": "2-4 bullet points of relevant news/fundamentals (search your knowledge for recent context)",
  "invalidation": "what price action would invalidate this setup"
}

Be specific with price levels. If you cannot determine something from the chart, use null. Always prioritize accuracy over confidence.`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mime || 'image/png',
                data: image,
              },
            },
            {
              type: 'text',
              text: 'Analyze this crypto trading chart and return the JSON analysis.',
            },
          ],
        },
      ],
    });

    const raw = response.content[0].text.trim();

    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw });
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error('Claude error:', err);
    res.status(500).json({ error: err.message });
  }
};
