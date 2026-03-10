const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mime } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: `You are an expert crypto trading analyst. Analyze the chart image and return ONLY a valid JSON object, no markdown, no extra text. Return exactly: {"asset":"ticker pair e.g. BTC/USDT","timeframe":"e.g. 4H","price":"current price","bias":"Bullish or Bearish or Neutral","entry":"specific entry zone","stop_loss":"stop loss price and reason","tp1":"take profit 1 with % gain","tp2":"take profit 2 or null","patterns":"detailed pattern and indicator analysis","research":"2-3 bullets of news and fundamental context","invalidation":"what would invalidate this setup","confidence":"Low or Medium or High"}`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime || 'image/png', data: image } },
          { type: 'text', text: 'Analyze this crypto chart and return the JSON.' }
        ]
      }]
    });

    const raw = response.content[0].text.trim();
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    res.status(200).json(JSON.parse(clean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
