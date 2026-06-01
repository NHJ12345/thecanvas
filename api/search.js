export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q, maxResults = '20' } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  const max = Math.min(parseInt(maxResults) || 20, 50);
  const ytKey = process.env.YOUTUBE_API_KEY;
  const vimeoToken = process.env.VIMEO_ACCESS_TOKEN;

  if (!ytKey && !vimeoToken) {
    return res.status(503).json({
      error: 'API 키가 설정되지 않았습니다.',
      hint: 'Vercel 대시보드 → Settings → Environment Variables → YOUTUBE_API_KEY 또는 VIMEO_ACCESS_TOKEN 추가 필요'
    });
  }

  const [ytResults, vimeoResults] = await Promise.all([
    ytKey ? searchYouTube(q, max, ytKey) : [],
    vimeoToken ? searchVimeo(q, Math.ceil(max / 2), vimeoToken) : [],
  ]);

  // Merge: interleave YouTube and Vimeo results
  const merged = [];
  const maxLen = Math.max(ytResults.length, vimeoResults.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < ytResults.length) merged.push(ytResults[i]);
    if (i < vimeoResults.length) merged.push(vimeoResults[i]);
  }

  res.json(merged.slice(0, max * 2));
}

async function searchYouTube(q, maxResults, key) {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('key', key);
    url.searchParams.set('order', 'relevance');

    const r = await fetch(url.toString());
    const data = await r.json();
    if (data.error) return [];

    return (data.items || []).map(item => ({
      vid: item.id.videoId,
      title: item.snippet.title,
      desc: (item.snippet.description || '').slice(0, 200),
      src: item.snippet.channelTitle,
      published: item.snippet.publishedAt?.slice(0, 10) || '',
      type: 'youtube',
    }));
  } catch { return []; }
}

async function searchVimeo(q, maxResults, token) {
  try {
    const url = new URL('https://api.vimeo.com/videos');
    url.searchParams.set('query', q);
    url.searchParams.set('per_page', String(maxResults));
    url.searchParams.set('sort', 'relevant');
    url.searchParams.set('filter', 'embeddable');
    url.searchParams.set('filter_embeddable', 'true');
    url.searchParams.set('fields', 'uri,name,description,user,release_time');

    const r = await fetch(url.toString(), {
      headers: { Authorization: `bearer ${token}` }
    });
    const data = await r.json();
    if (!data.data) return [];

    return data.data.map(item => {
      const vid = item.uri?.replace('/videos/', '') || '';
      return {
        vid,
        title: item.name || '',
        desc: (item.description || '').slice(0, 200),
        src: item.user?.name || 'Vimeo',
        published: item.release_time?.slice(0, 10) || '',
        type: 'vimeo',
      };
    }).filter(v => v.vid);
  } catch { return []; }
}
