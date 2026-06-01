export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q, maxResults = '20', channelId, brand } = req.query;
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
    ytKey ? searchYouTube(q, max * 2, ytKey, channelId) : [],
    vimeoToken ? searchVimeo(q, max, vimeoToken) : [],
  ]);

  // Brand filter: if brand specified, only keep results where title contains brand name
  const brandFilter = brand ? brand.trim().toLowerCase() : null;
  const filterByBrand = (r) => {
    if (!brandFilter) return true;
    return r.title.toLowerCase().includes(brandFilter);
  };

  const filteredYt = ytResults.filter(filterByBrand);
  const filteredVimeo = vimeoResults.filter(filterByBrand);

  // Merge: interleave YouTube and Vimeo results
  const merged = [];
  const maxLen = Math.max(filteredYt.length, filteredVimeo.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < filteredYt.length) merged.push(filteredYt[i]);
    if (i < filteredVimeo.length) merged.push(filteredVimeo[i]);
  }

  res.json(merged.slice(0, max * 2));
}

async function searchYouTube(q, maxResults, key, channelId) {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('key', key);
    url.searchParams.set('order', 'relevance');
    if (channelId) url.searchParams.set('channelId', channelId);

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
    url.searchParams.set('sort', 'plays');
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
