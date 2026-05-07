// Bagani Oil API Server
// Serves static site + API routes — all on baganioil.ph, no subdomain needed
// Routes: /ping  /chat  /sanity-query  /external-news  + static _site/

'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const {createClient} = require('@sanity/client');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── ENV ──────────────────────────────────────────────────────────────────────
const SANITY_PROJECT_ID  = process.env.SANITY_PROJECT_ID  || 'c7mgn6k7';
const SANITY_DATASET     = process.env.SANITY_DATASET     || 'production';
const SANITY_WRITE_TOKEN = process.env.SANITY_WRITE_TOKEN || '';
const GROQ_API_KEY       = process.env.GROQ_API_KEY       || '';

// ── Sanity clients ───────────────────────────────────────────────────────────
const readClient = createClient({
  projectId:  SANITY_PROJECT_ID,
  dataset:    SANITY_DATASET,
  apiVersion: '2024-01-01',
  useCdn:     true,
});

const writeClient = SANITY_WRITE_TOKEN
  ? createClient({
      projectId:  SANITY_PROJECT_ID,
      dataset:    SANITY_DATASET,
      apiVersion: '2024-01-01',
      useCdn:     false,
      token:      SANITY_WRITE_TOKEN,
    })
  : null;

// ════════════════════════════════════════════════════════════════════════════
// PING
// ════════════════════════════════════════════════════════════════════════════
app.get('/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ════════════════════════════════════════════════════════════════════════════
// SANITY PROXY  GET /sanity-query
// ════════════════════════════════════════════════════════════════════════════
const DEFAULT_API_VER = '2024-01-01';

app.get('/sanity-query', async (req, res) => {
  try {
    const { query, projectId, dataset, apiVer, preview, token } = req.query;
    if (!query) return res.status(400).json({ error: 'Missing query parameter' });

    const pid      = projectId || SANITY_PROJECT_ID;
    const ds       = dataset   || SANITY_DATASET;
    const ver      = apiVer    || DEFAULT_API_VER;
    const isPreview = preview === 'true';

    const host = isPreview
      ? `https://${pid}.api.sanity.io`
      : `https://${pid}.apicdn.sanity.io`;

    let url = `${host}/v${ver}/data/query/${ds}?query=${encodeURIComponent(query)}`;
    if (isPreview) url += '&perspective=previewDrafts';

    const headers = {};
    if (isPreview && token) headers.Authorization = `Bearer ${token}`;

    const upstream = await fetch(url, { headers });
    const body     = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Sanity request failed', details: body });
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(body);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CHAT  POST /chat
// ════════════════════════════════════════════════════════════════════════════
const STOPWORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','can','able',
  'about','above','after','again','against','all','along','also','although',
  'among','and','any','anyone','anything','as','at','because','before','both',
  'but','by','each','else','every','few','for','from','get','give','he','her',
  'here','him','his','how','i','if','in','into','just','like','look','many',
  'me','more','most','much','my','no','not','now','of','off','on','only','or',
  'other','our','out','over','own','please','same','see','she','since','so',
  'some','still','take','than','that','their','them','then','there','these',
  'they','this','those','through','to','too','under','until','up','very','was',
  'way','we','well','were','what','when','where','which','while','who','why',
  'with','you','your','po','ang','ng','na','sa','mga','ba','ko','mo','hindi',
  'ito','iyan','yung','yun','ano','saan','paano','pwede','gusto',
]);
const SYNONYMS = {
  scooter:'scooter JASO MB', automatic:'automatic ATF transmission',
  atf:'ATF automatic transmission', gear:'gear GL-4', diesel:'diesel CI-4',
  gasoline:'gasoline SL', petrol:'gasoline SL', motorbike:'motorcycle 4T',
  bike:'motorcycle 4T', motor:'motorcycle 4T', engine:'engine oil',
  lubricant:'oil lubricant', lubrication:'oil lubricant',
  store:'store location', dealer:'dealer store location',
  reseller:'dealer store', buy:'store dealer location buy',
  purchase:'store dealer buy', price:'price dealer',
  contact:'contact phone email', phone:'phone contact',
  address:'address location', amihan:'Amihan motorcycle',
  laon:'Laon diesel engine', aman:'Aman gear',
  anitun:'Anitun ATF transmission', hanan:'Hanan gasoline',
  '2t':'2T two-stroke', '4t':'4T four-stroke',
  twostroke:'2T two-stroke', fourstroke:'4T four-stroke',
  manual:'manual gear GL-4', transmission:'transmission ATF gear',
};

function extractKeywords(text) {
  const lower    = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens   = lower.split(/\s+/).filter(t => t.length > 1 && !STOPWORDS.has(t));
  const expanded = new Set(tokens);
  tokens.forEach(t => {
    if (SYNONYMS[t]) SYNONYMS[t].split(' ').forEach(s => expanded.add(s));
  });
  return Array.from(expanded).join(' ');
}

function formatContext(products, faqs, stores, articles, site) {
  let ctx = '';
  if (products.length) {
    ctx += '\nPRODUCTS:\n';
    products.forEach(p => {
      ctx += `- ${p.name} (${p.line||''}) | ${p.spec||''}\n`;
      if (p.shortDesc)       ctx += `  ${p.shortDesc}\n`;
      if (p.applicationText) ctx += `  For use: ${p.applicationText}\n`;
      if (p.approvalsText)   ctx += `  Standards: ${p.approvalsText}\n`;
      if (p.availableSizes?.length) ctx += `  Sizes: ${p.availableSizes.join(', ')}\n`;
      if (p.faqs?.length) p.faqs.forEach(f => { ctx += `  Q: ${f.q}\n  A: ${f.a}\n`; });
    });
  }
  if (faqs.length) {
    ctx += '\nFREQUENTLY ASKED QUESTIONS:\n';
    faqs.forEach(f => { ctx += `Q: ${f.question}\nA: ${f.answer}\n`; });
  }
  if (stores.length) {
    ctx += '\nSTORE LOCATIONS:\n';
    stores.forEach(s => { ctx += `- ${s.name}: ${s.address||''}, ${s.city||''} | Phone: ${s.phone||'N/A'}\n`; });
  }
  if (articles.length) {
    ctx += '\nRECENT NEWS/ARTICLES:\n';
    articles.forEach(a => { ctx += `- ${a.title} (${a.category||'News'}${a.date?', '+a.date:''}): ${a.excerpt||''}\n`; });
  }
  if (site) {
    ctx += '\nCONTACT INFORMATION:\n';
    if (site.phone)   ctx += `Phone: ${site.phone}\n`;
    if (site.email)   ctx += `Email: ${site.email}\n`;
    if (site.address) ctx += `Address: ${site.address}\n`;
  }
  return ctx;
}

function saveChatLog(sessionId, userMessage, botReply, retrievedTypes, noContentFound, pageUrl) {
  if (!writeClient) return;
  writeClient.create({
    _type: 'chatLog', sessionId: sessionId||'unknown', userMessage, botReply,
    retrievedTypes: retrievedTypes||[], noContentFound: !!noContentFound,
    pageUrl: pageUrl||'', timestamp: new Date().toISOString(),
  }).catch(e => console.warn('[Chat] Log write failed:', e.message));
}

const OUT_OF_SCOPE = 'Sorry, your question is outside the information available on this website. You can reach us on Facebook or call us for more help.';
const GREETINGS    = ['hello','hi','hey','sup','good morning','good afternoon','good evening','kumusta','kamusta','musta','magandang','ola','helo','howdy'];

app.options('/chat', (req, res) => res.sendStatus(204));
app.get('/chat',    (req, res) => res.json({ ok: true, service: 'bagani-chat' }));

app.post('/chat', async (req, res) => {
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'AI service not configured' });

  let userMessage, sessionId, pageUrl;
  try {
    userMessage = ((req.body.message)||'').trim().slice(0,500).replace(/<[^>]*>/g,'');
    sessionId   = ((req.body.sessionId)||'').trim().slice(0,100);
    pageUrl     = ((req.body.pageUrl)||'').trim().slice(0,200);
  } catch {
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (!userMessage) return res.status(400).json({ error: 'Empty message' });
  if (userMessage.length < 3) {
    return res.json({ reply: 'Maaari mo bang i-type ang iyong buong tanong? (Please type your full question.)', suggestMessenger: false });
  }

  const msgLower  = userMessage.toLowerCase().trim();
  const wordCount = msgLower.split(/\s+/).length;
  const isJustGreeting = wordCount <= 3 && GREETINGS.some(g =>
    msgLower === g || msgLower.startsWith(g+' ') || msgLower.startsWith(g+'!') || msgLower.startsWith(g+',')
  );
  if (isJustGreeting) {
    const reply = "Hi! Welcome to Bagani Oil! I'm here to help you find the right oil for your vehicle, locate a store, or answer any questions about our products. What can I help you with?";
    saveChatLog(sessionId, userMessage, reply, [], false, pageUrl);
    return res.json({ reply, suggestMessenger: false });
  }

  const keywords = extractKeywords(userMessage);
  let products=[], faqs=[], stores=[], articles=[], site=null;

  try {
    [products, faqs, stores, articles, site] = await Promise.all([
      keywords.length > 0 ? readClient.fetch(
        `*[_type=="product"&&(name match $kw||line match $kw||spec match $kw||shortDesc match $kw||description match $kw||applicationText match $kw||approvalsText match $kw)][0..3]{name,line,spec,shortDesc,applicationText,approvalsText,availableSizes,"faqs":faqs[]{q,a}}`,
        {kw:keywords}
      ).catch(()=>[]) : [],
      keywords.length > 0 ? readClient.fetch(
        `*[_type=="faq"&&(question match $kw||answer match $kw)][0..3]{question,answer,category}`,
        {kw:keywords}
      ).catch(()=>[]) : [],
      keywords.length > 0 ? readClient.fetch(
        `*[_type=="store"&&(name match $kw||city match $kw||address match $kw)][0..5]{name,address,city,phone}`,
        {kw:keywords}
      ).catch(()=>[]) : [],
      keywords.length > 0 ? readClient.fetch(
        `*[_type=="article"&&(title match $kw||excerpt match $kw)][0..2]{title,date,category,excerpt}`,
        {kw:keywords}
      ).catch(()=>[]) : [],
      readClient.fetch(`*[_type=="siteSettings"&&_id=="siteSettings"][0]{phone,email,address}`,{}).catch(()=>null),
    ]);
  } catch(e) { console.warn('[Chat] Sanity fetch error:', e.message); }

  let totalResults = products.length + faqs.length + stores.length + articles.length;
  if (totalResults === 0) {
    try {
      const [fp, ff] = await Promise.all([
        readClient.fetch(`*[_type=="product"]|order(name asc)[0..3]{name,line,spec,shortDesc,applicationText,approvalsText,availableSizes,"faqs":faqs[]{q,a}}`,{}).catch(()=>[]),
        readClient.fetch(`*[_type=="faq"]|order(order asc)[0..3]{question,answer}`,{}).catch(()=>[]),
      ]);
      products=fp; faqs=ff; totalResults=fp.length+ff.length;
    } catch(e) { console.warn('[Chat] Fallback fetch error:', e.message); }
  }

  const retrievedTypes=[
    ...(products.length?['product']:[]), ...(faqs.length?['faq']:[]),
    ...(stores.length?['store']:[]),   ...(articles.length?['article']:[]),
  ];

  if (totalResults === 0 && !site) {
    saveChatLog(sessionId, userMessage, OUT_OF_SCOPE, [], true, pageUrl);
    return res.json({ reply: OUT_OF_SCOPE, suggestMessenger: false });
  }

  const context = formatContext(products, faqs, stores, articles, site);
  const SYSTEM_PROMPT =
`You are Bagani AI, the helpful assistant for Bagani Oil — a premium Filipino lubricants brand.

STRICT RULES:
1. You may ONLY answer using the CONTEXT PROVIDED BELOW. Do not use any outside knowledge.
2. If the context does not contain enough information to answer the question, respond EXACTLY with: "${OUT_OF_SCOPE}"
3. Never invent product names, specs, prices, or any details not in the context.
4. Be friendly and concise (2–4 sentences max). Use a warm Filipino-friendly tone.
5. If the user needs pricing, bulk orders, complaints, or wants to talk to a real person, end your reply with exactly: SUGGEST_MESSENGER

=== CONTEXT FROM BAGANI OIL WEBSITE ===${context}
=== END CONTEXT ===`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role:'system', content:SYSTEM_PROMPT }, { role:'user', content:userMessage }],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Chat] Groq error:', response.status, errText);
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const data = await response.json();
    let reply  = data?.choices?.[0]?.message?.content || '';
    const suggestMessenger = reply.includes('SUGGEST_MESSENGER');
    reply = reply.replace(/SUGGEST_MESSENGER\n?/g, '').trim();

    if (!reply) return res.json({ reply:"Sorry, I couldn't generate a response. Please try again.", suggestMessenger:false });

    saveChatLog(sessionId, userMessage, reply, retrievedTypes, false, pageUrl);
    return res.json({ reply, suggestMessenger });
  } catch(err) {
    console.error('[Chat] error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// EXTERNAL NEWS  GET /external-news
// ════════════════════════════════════════════════════════════════════════════
const OIL_KEYWORDS_NEWS = [
  'oil','petroleum','petron','shell','caltex','seaoil','jetti','phoenix',
  'fuel','gasoline','diesel','lubricant','crude','kerosene','lng','lpg',
  'department of energy','doe energy','fuel price','oil price','pump price',
];
const SOURCES = [
  { url:'https://data.gmanews.tv/gno/rss/news/feed.xml', source:'GMA News' },
  { url:'https://www.philstar.com/rss/headlines',         source:'Philstar' },
  { url:'https://www.philstar.com/rss/business',          source:'Philstar Business' },
];
const EXTERNAL_EXCERPT_MAX_CHARS = 520;

function decodeEntities(text) {
  return text
    .replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&#160;/g,' ')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'").replace(/&apos;/gi,"'")
    .replace(/&ldquo;/gi,'\u201C').replace(/&rdquo;/gi,'\u201D')
    .replace(/&lsquo;/gi,'\u2018').replace(/&rsquo;/gi,'\u2019')
    .replace(/&mdash;/gi,'\u2014').replace(/&ndash;/gi,'\u2013')
    .replace(/&hellip;/gi,'\u2026').replace(/&trade;/gi,'\u2122')
    .replace(/&reg;/gi,'\u00AE').replace(/&copy;/gi,'\u00A9')
    .replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(parseInt(c,10)))
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));
}
function stripHtml(input) {
  return decodeEntities((input||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
function stripHtmlKeepBreaks(input) {
  return decodeEntities(
    (input||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h[1-6]|tr)>/gi,'\n').replace(/<[^>]+>/g,' ')
  ).replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim();
}
function createNewsSummary(input, maxChars=260) {
  const text=stripHtml(input||'');
  if (!text) return '';
  const min=Math.floor(maxChars*0.55);
  const hasTerm=/[.!?]["')\]]?$/.test(text);
  if (text.length<=maxChars) {
    if (hasTerm) return text;
    const sc=text.lastIndexOf('. ');
    if (sc>=Math.floor(text.length*0.45)) return text.slice(0,sc+1).trim();
    const wc=text.lastIndexOf(' ');
    if (wc>40) return text.slice(0,wc).trim().replace(/[,:;\-]+$/,'')+' ...';
    return text;
  }
  let sentenceCut=-1;
  for (let i=min;i<Math.min(text.length,maxChars+40);i++) {
    const ch=text[i];
    if ((ch==='.'||ch==='!'||ch==='?')&&(i===text.length-1||text[i+1]===' ')) sentenceCut=i+1;
  }
  if (sentenceCut>0) return text.slice(0,sentenceCut).trim();
  let wc=text.lastIndexOf(' ',maxChars);
  if (wc<min) wc=maxChars;
  return text.slice(0,wc).trim().replace(/[,:;\-]+$/,'')+' ...';
}
function extractArticleParagraphSummary(html,maxChars=380) {
  if (!html) return '';
  const cleaned=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ');
  const paragraphs=[];
  const pRegex=/<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match=pRegex.exec(cleaned))!==null) {
    const text=stripHtmlKeepBreaks(match[1]);
    if (!text) continue;
    const lower=text.toLowerCase();
    if (lower.includes('copyright')||lower.includes('all rights reserved')||lower.includes('advertisement')) continue;
    if (text.length>=60) paragraphs.push(text);
    if (paragraphs.length>=3) break;
  }
  if (!paragraphs.length) return '';
  let joined=paragraphs.join(' ');
  if (joined.length>maxChars) joined=joined.slice(0,maxChars);
  return joined.trim();
}
function extractTag(block,tag) {
  const cdata=block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cdata) return cdata[1].trim();
  const normal=block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return normal?normal[1].trim():'';
}
function extractImageFromBlock(block,descriptionRaw) {
  let match;
  match=block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i); if (match) return match[1];
  match=block.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i); if (match) return match[1];
  match=block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i); if (match) return match[1];
  match=(descriptionRaw||'').match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i); if (match) return match[1];
  const encoded=extractTag(block,'content:encoded');
  match=(encoded||'').match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i); if (match) return match[1];
  return '';
}
function absolutizeUrl(rawUrl,baseUrl) {
  if (!rawUrl) return '';
  const cleaned=decodeEntities(String(rawUrl)).trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('//')) return 'https:'+cleaned;
  try { return new URL(cleaned,baseUrl||undefined).toString(); } catch { return ''; }
}
function parseRssItems(xml) {
  const items=[];
  const itemRegex=/<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match=itemRegex.exec(xml))!==null) {
    const block=match[1];
    const title=stripHtml(extractTag(block,'title'));
    const link=stripHtml(extractTag(block,'link'));
    const guid=stripHtml(extractTag(block,'guid'));
    const descriptionRaw=extractTag(block,'description');
    const pubDate=stripHtml(extractTag(block,'pubDate')||extractTag(block,'dc:date'));
    const description=stripHtmlKeepBreaks(descriptionRaw);
    const imageRaw=extractImageFromBlock(block,descriptionRaw);
    const url=link||(guid.startsWith('http')?guid:'');
    const image=absolutizeUrl(imageRaw,url);
    if (url&&title) items.push({title,url,description,image,pubDate});
  }
  return items;
}
function isOilRelated(item) {
  const text=`${item.title} ${item.description}`.toLowerCase();
  return OIL_KEYWORDS_NEWS.some(kw=>text.includes(kw));
}
function normalizeYoutubeEmbed(url) {
  if (!url) return null;
  const m=url.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i);
  return m?`https://www.youtube.com/embed/${m[1]}?rel=0`:null;
}
async function fetchArticleMedia(url,timeoutMs=5000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},signal:controller.signal});
    if (!response.ok) return {image:null,videoEmbed:null};
    const html=await response.text();
    const ytMatch=html.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i);
    if (ytMatch) return {image:`https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,videoEmbed:`https://www.youtube.com/embed/${ytMatch[1]}?rel=0`};
    const ogImage=html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogVideo=html.match(/<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/i);
    const twImage=html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const ogDesc=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    const metaDesc=html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const embed=normalizeYoutubeEmbed(ogVideo?.[1]);
    const paraSum=extractArticleParagraphSummary(html);
    const bestDesc=stripHtmlKeepBreaks((ogDesc?.[1])||(metaDesc?.[1])||'');
    const resolvedImage=absolutizeUrl((ogImage?.[1])||(twImage?.[1])||'',url);
    return {image:resolvedImage||null,videoEmbed:embed,description:paraSum||bestDesc||null};
  } catch { return {image:null,videoEmbed:null,description:null}; }
  finally { clearTimeout(timer); }
}
async function fetchWithTimeout(url,timeoutMs=15000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/rss+xml,text/xml'},signal:controller.signal});
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
  finally { clearTimeout(timer); }
}
async function fetchRssWithRetry(url,attempts=2) {
  let last=null;
  for (let i=0;i<attempts;i++) {
    last=await fetchWithTimeout(url,15000+(i*5000));
    if (last) return last;
    if (i<attempts-1) await new Promise(r=>setTimeout(r,600+(i*600)));
  }
  return last;
}

app.get('/external-news', async (req, res) => {
  const all=[];
  const rssResults=await Promise.allSettled(
    SOURCES.map(async source=>{
      const xml=await fetchRssWithRetry(source.url,2);
      if (!xml) return [];
      return parseRssItems(xml).filter(isOilRelated).map(item=>({
        slug:null,title:item.title,date:item.pubDate?new Date(item.pubDate).toISOString():null,
        image:item.image||null,videoEmbed:null,
        excerpt:createNewsSummary(item.description||'',EXTERNAL_EXCERPT_MAX_CHARS),
        tags:['Oil & Gas'],isExternal:true,url:item.url,source:source.source,
      }));
    })
  );
  for (const r of rssResults) {
    if (r.status==='fulfilled'&&Array.isArray(r.value)) all.push(...r.value);
  }
  all.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const seen=new Set();
  const deduped=all.filter(item=>{
    const key=`${item.title}|${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0,24);

  await Promise.all(deduped.map(async item=>{
    if (!item.url) return;
    const media=await fetchArticleMedia(item.url);
    if (media.videoEmbed) item.videoEmbed=media.videoEmbed;
    if (media.image) item.image=media.image;
    const summarySource=media.description||item.excerpt||'';
    item.excerpt=createNewsSummary(summarySource,EXTERNAL_EXCERPT_MAX_CHARS);
  }));

  res.setHeader('Cache-Control','public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600');
  res.json({ refreshedAt:new Date().toISOString(), count:deduped.length, items:deduped });
});

// ════════════════════════════════════════════════════════════════════════════
// STATIC SITE — serve the 11ty _site/ build only if it exists locally
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const SITE_DIR = path.join(__dirname, '..', '_site');
const siteExists = fs.existsSync(SITE_DIR);

if (siteExists) {
  app.use(express.static(SITE_DIR));
  app.use((req, res) => {
    res.status(404).sendFile(path.join(SITE_DIR, '404.html'));
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

// ════════════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`Bagani API + static site running on port ${PORT}`);
});
