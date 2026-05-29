export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q, maxResults = '20' } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: 'YouTube API 키가 설정되지 않았습니다.',
      hint: 'Vercel 대시보드 → Settings → Environment Variables → YOUTUBE_API_KEY 추가 필요'
    });
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', String(Math.min(parseInt(maxResults) || 20, 50)));
    url.searchParams.set('key', key);
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('relevanceLanguage', 'ko');

    const r = await fetch(url.toString());
    const data = await r.json();

    if (data.error) {
      return res.status(r.status).json({ error: data.error.message });
    }

    const results = (data.items || []).map(item => ({
      vid: item.id.videoId,
      title: item.snippet.title,
      desc: (item.snippet.description || '').slice(0, 200),
      src: item.snippet.channelTitle,
      published: item.snippet.publishedAt?.slice(0, 10) || '',
    }));

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
