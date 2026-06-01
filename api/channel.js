export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { brand } = req.query;
  if (!brand) return res.status(400).json({ error: 'brand required' });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(503).json({ error: 'No API key' });

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'channel');
    url.searchParams.set('q', `${brand} official`);
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('key', key);

    const r = await fetch(url.toString());
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const channels = (data.items || []).map(item => ({
      id: item.snippet.channelId,
      title: item.snippet.channelTitle,
      desc: (item.snippet.description || '').slice(0, 100),
      thumb: item.snippet.thumbnails?.default?.url || '',
    }));

    res.json(channels);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
