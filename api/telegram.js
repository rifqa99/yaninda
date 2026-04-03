export default async function handler(req, res) {
    const { location } = req.body;
  
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;
  
    const msg = `🚨 NEW REQUEST\n📍 ${location}`;
  
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: msg })
      });
  
      res.status(200).json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  }