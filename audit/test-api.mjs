/**
 * Auditoría rápida de APIs que usan los plugins:
 * hace petición HTTP a cada endpoint y clasifica:
 *   ✅ responde 200 con JSON esperado
 *   ⚠️ responde pero con warning/error parcial
 *   ❌ error de red, TLS, 4xx/5xx, timeout, o formato inválido
 */
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

const TIMEOUT = 15000;
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36';

const tests = [
  // ===== DOWNLOADS =====
  { cat: 'downloads', plugin: 'ytmp3 / ytmp4 (.play, .mp4)',
    url: 'https://api.lempi.lat/dl/yta?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&apikey=montekey28',
    expect: j => j?.status && j?.datos?.url },
  { cat: 'downloads', plugin: 'ytmp4',
    url: 'https://api.lempi.lat/dl/ytv?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&apikey=montekey28',
    expect: j => j?.status && j?.datos?.url },
  { cat: 'downloads', plugin: 'tiktok',
    url: 'https://api.lempi.lat/dl/tiktok?url=https%3A%2F%2Fwww.tiktok.com%2F%40scout2005_05%2Fvideo%2F7400000000000000000&apikey=montekey28',
    expect: j => j?.status },
  { cat: 'downloads', plugin: 'instagram',
    url: 'https://api.lempi.lat/dl/ig?url=https%3A%2F%2Fwww.instagram.com%2Freel%2FDAbCdEfGhIj%2F&apikey=montekey28',
    expect: j => j?.status !== undefined },
  { cat: 'downloads', plugin: 'facebook',
    url: 'https://api.lempi.lat/dl/fb?url=https%3A%2F%2Fwww.facebook.com%2Freel%2Fvideos%2F123&apikey=montekey28',
    expect: j => j?.status !== undefined },
  { cat: 'downloads', plugin: 'twitter (X)',
    url: 'https://api.lempi.lat/dl/twitter?url=https%3A%2F%2Fx.com%2Fnobody%2Fstatus%2F123&apikey=montekey28',
    expect: j => j?.status !== undefined },
  { cat: 'downloads', plugin: 'pinterest (.pin)',
    url: 'https://fare.ink/search/pin?q=goku&limit=5',
    expect: j => j?.status && Array.isArray(j.results) },
  { cat: 'downloads', plugin: 'pinterest descarga',
    url: 'https://fare.ink/dl/pin?url=https%3A%2F%2Fwww.pinterest.com%2Fpin%2F123',
    expect: j => j?.status !== undefined },
  { cat: 'downloads', plugin: 'mediafire',
    url: 'https://api.lempi.lat/dl/mediafire?url=https%3A%2F%2Fwww.mediafire.com%2Ffile%2Ftest&apikey=montekey28',
    expect: j => j?.status !== undefined },
  { cat: 'downloads', plugin: 'imagen (búsqueda imágenes)',
    url: 'https://api.lempi.lat/search/google-image?query=goku&apikey=montekey28',
    expect: j => j?.status !== undefined },
  { cat: 'downloads', plugin: 'gdrive',
    url: 'https://api.lempi.lat/dl/gdrive?url=https%3A%2F%2Fdrive.google.com%2Ffile%2Fd%2Ftest&apikey=montekey28',
    expect: j => j?.status !== undefined },
  { cat: 'downloads', plugin: 'aptoide-scraper (.apk)',
    url: null, deps: ['aptoide-scraper'] }, // verificamos en código
  // ===== ANIME =====
  { cat: 'anime', plugin: 'waifu',
    url: 'https://api.waifu.pics/sfw/waifu',
    expect: j => j?.url },
  { cat: 'anime', plugin: 'ppcouple',
    url: null }, // lee código
  { cat: 'anime', plugin: 'shares',
    url: null },
  // ===== NSFW =====
  { cat: 'nsfw', plugin: 'danbooru', url: null },
  { cat: 'nsfw', plugin: 'gelbooru', url: null },
  { cat: 'nsfw', plugin: 'xnxx', url: null },
  { cat: 'nsfw', plugin: 'xvideos', url: null },
  // ===== UTILS =====
  { cat: 'utils', plugin: 'chatgpt',
    url: null }, // lee código
  { cat: 'utils', plugin: 'translate', deps: ['@vitalets/google-translate-api'] },
  { cat: 'utils', plugin: 'hd (upscale)', url: null }, // usa ffmpeg
  { cat: 'utils', plugin: 'tourl', url: null }, // sube a servidor
  { cat: 'utils', plugin: 'gitclone', url: null },
];

const results = [];

async function test(t) {
  const r = { cat: t.cat, plugin: t.plugin, status: '?', detail: '' };
  if (t.deps) { r.detail = 'deps: '+t.deps.join(', '); return r; }
  if (!t.url) { r.status = 'skip-code'; r.detail = 'sin URL, ver en código'; return r; }
  try {
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), TIMEOUT);
    const res = await fetch(t.url, { signal: ctrl.signal, headers: { 'accept':'application/json', 'user-agent': UA } });
    clearTimeout(to);
    if (!res.ok) {
      r.status = '❌';
      r.detail = `HTTP ${res.status}`;
      return r;
    }
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { r.status='⚠️'; r.detail='No es JSON ('+text.slice(0,80)+')'; return r; }
    if (t.expect(j)) { r.status='✅'; r.detail='OK'; return r; }
    r.status='⚠️'; r.detail='JSON sin el campo esperado: '+JSON.stringify(j).slice(0,150);
  } catch(e) {
    r.status='❌';
    let msg = e.message || String(e);
    if (msg.includes('TLS') || msg.includes('SSL') || msg.includes('alert')) msg = 'Error TLS/SSL: '+msg;
    if (msg.includes('ENOTFOUND')) msg = 'DNS no resuelve (dominio caído/muerto)';
    if (msg.includes('timeout') || msg.includes('abort')) msg = 'Timeout (>15s)';
    if (msg.includes('ECONNREFUSED')) msg = 'Conexión rechazada';
    r.detail = msg;
  }
  return r;
}

console.log('🔍 Iniciando auditoría de APIs...\n');
for (const t of tests) {
  const r = await test(t);
  results.push(r);
  console.log(`  ${r.status.padEnd(6)} [${r.cat.padEnd(10)}] ${r.plugin.padEnd(30)} → ${r.detail}`);
}
writeFileSync('audit/api-results.json', JSON.stringify(results,null,2));
console.log('\n✅ Resultados guardados en audit/api-results.json');
