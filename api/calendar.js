// Vercel Serverless Function (Edge is optional, standard is fine)
// This file will be deployed as an API route at /api/calendar

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Cache-Control: 
  // s-maxage=180: CDN/Vercel Edge cache for 3 minutes (180s)
  // stale-while-revalidate=60: Serve stale content for up to 60s while revalidating
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');

  const { type } = req.query; // 'work' or 'holiday'

  let targetUrl = '';
  if (type === 'work') {
    targetUrl = process.env.VITE_WORK_CAL_URL;
  } else if (type === 'holiday') {
    targetUrl = 'https://calendars.icloud.com/holidays/cn_zh.ics/';
  } else {
    return res.status(400).json({ error: 'Missing or invalid type parameter' });
  }

  try {
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        Accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.8'
      }
    });
    if (!response.ok) {
      throw new Error(`Upstream fetch failed: ${response.status}`);
    }
    const text = await response.text();
    res.status(200).send(text);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
}
