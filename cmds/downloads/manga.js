/**
 * .manga  —  buscador y lector de manga por MangaDex (envía imágenes directamente, sin PDF).
 *
 * Uso:
 *   .manga <título>                → buscar mangas
 *   .manga info <id>               → portada + sinopsis + datos
 *   .manga caps <id>               → listar capítulos disponibles
 *   .manga leer <id> <cap>         → enviar imágenes del capítulo (lotes de 10 páginas)
 */

const UA = 'GinkoBot/1.0 (Mozilla/5.0 compatible)';
const API = 'https://api.mangadex.org';
const MAX_PAGS_POR_LOTE = 10;
const CAPS_POR_LISTA = 30;

// Cache en memoria (10 min)
const cache = {};
const CACHE_TTL = 10 * 60 * 1000;

async function mdFetch(path) {
  const res = await fetch(API + path, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const err = await res.json(); msg = err?.errors?.[0]?.detail || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}
function cGet(k) { const c = cache[k]; return c && Date.now() - c.t < CACHE_TTL ? c.v : null; }
function cSet(k, v) { cache[k] = { t: Date.now(), v }; }

export default {
  command: ['manga', 'mangadex', 'leermanga'],
  category: 'downloads',
  description: 'Buscar y leer mangas por MangaDex (imágenes).',
  run: async ({ msg, sock, args, usedPrefix, command, text }) => {
    if (!text) {
      return msg.reply(
        `《✧》 *MangaDex* (lector de mangas)\n\n`
        + `• ${usedPrefix}manga <título> → buscar\n`
        + `• ${usedPrefix}manga info <id> → sinopsis + portada\n`
        + `• ${usedPrefix}manga caps <id> → lista de capítulos\n`
        + `• ${usedPrefix}manga leer <id> <cap> → capítulo en imágenes\n\n`
        + `Ej: ${usedPrefix}manga jujutsu kaisen`
      );
    }
    const [accion, ...resto] = text.trim().split(/\s+/);
    try {
      if (accion === 'caps') return await verCaps(msg, sock, usedPrefix, resto.join(' '));
      if (accion === 'leer') return await leerCap(msg, sock, usedPrefix, resto);
      if (accion === 'info') return await infoManga(msg, sock, usedPrefix, resto[0]);
      return await buscar(msg, usedPrefix, text);
    } catch (e) {
      await msg.react('❌').catch(() => {});
      msg.reply(`《✧》 Error de MangaDex.\n> ${e.message}`);
    }
  },
};

async function buscar(msg, p, query) {
  await msg.react('🔍').catch(() => {});
  const key = 'b:' + query.toLowerCase();
  let data = cGet(key);
  if (!data) {
    data = await mdFetch(
      `/manga?title=${encodeURIComponent(query)}`
      + '&limit=8'
      + '&availableTranslatedLanguage[]=es&availableTranslatedLanguage[]=en'
      + '&contentRating[]=safe&contentRating[]=suggestive'
      + '&includes[]=cover_art&includes[]=author'
      + '&order[relevance]=desc'
    );
    cSet(key, data);
  }
  const resultados = data?.data || [];
  if (!resultados.length) return msg.reply(`《✧》 No encontré mangas con "*${query}*".`);

  let teks = `📚 *Resultados de "${query}":*\n\n`;
  for (const m of resultados.slice(0, 8)) {
    const a = m.attributes;
    const titulo = a.title?.es || a.title?.en || Object.values(a.title)[0] || 'Sin título';
    const year = a.year || '';
    teks += `▸ *${titulo}*\n`;
    teks += `  ID: \`${m.id}\`\n`;
    if (year) teks += `  ${year}\n`;
    teks += `  ${p}manga caps ${m.id}\n\n`;
  }
  teks += `> Usa \`${p}manga info <id>\` para sinopsis y portada.`;
  msg.reply(teks);
}

async function infoManga(msg, sock, p, id) {
  if (!id) return msg.reply(`《✧》 Usa: ${p}manga info <id>`);
  await msg.react('🔍').catch(() => {});
  const key = 'i:' + id;
  let det = cGet(key);
  if (!det) {
    det = await mdFetch(`/manga/${id}?includes[]=cover_art&includes[]=author`);
    cSet(key, det);
  }
  const m = det?.data;
  if (!m) return msg.reply('《✧》 Manga no encontrado.');
  const a = m.attributes || {};
  const titulo = a.title?.es || a.title?.en || Object.values(a.title)[0] || 'Sin título';
  const desc = (a.description?.es || a.description?.en || 'Sin sinopsis.').replace(/\[\/?[a-z]+\]/g, '').replace(/\n+/g, ' ').slice(0, 500);
  const year = a.year || '—';
  const status = { ongoing: '🟢 En emisión', completed: '✅ Terminado', hiatus: '⏸ Pausado', cancelled: '❌ Cancelado' }[a.status] || a.status || '—';
  const author = (m.relationships || []).find(r => r.type === 'author')?.attributes?.name || 'Desconocido';
  const cover = (m.relationships || []).find(r => r.type === 'cover_art');
  const coverUrl = cover ? `https://uploads.mangadex.org/covers/${id}/${cover.attributes.fileName}.512.jpg` : null;

  let totalCaps = 0;
  try {
    const feed = await mdFetch(`/manga/${id}/feed?translatedLanguage[]=es&translatedLanguage[]=en&limit=1&order[chapter]=desc&contentRating[]=safe&contentRating[]=suggestive`);
    totalCaps = feed.total || 0;
  } catch (_) {}

  const teks =
    `📚 *${titulo}*\n\n`
    + `✍ *Autor:* ${author}\n`
    + `📅 *Año:* ${year}\n`
    + `📊 *Estado:* ${status}\n`
    + `📖 *Capítulos:* ~${totalCaps}\n\n`
    + `📝 *Sinopsis:*\n${desc}${desc.length >= 499 ? '...' : ''}\n\n`
    + `> Ver caps: ${p}manga caps ${id}\n`
    + `> Leer cap. 1: ${p}manga leer ${id} 1`;

  if (coverUrl) {
    await sock.sendMessage(msg.chat, { image: { url: coverUrl }, caption: teks }, { quoted: msg });
  } else {
    msg.reply(teks);
  }
}

async function verCaps(msg, sock, p, id) {
  if (!id) return msg.reply(`《✧》 Usa: ${p}manga caps <id>`);
  await msg.react('📑').catch(() => {});
  const key = 'c:' + id;
  let feed = cGet(key);
  if (!feed) {
    feed = await mdFetch(
      `/manga/${id}/feed?translatedLanguage[]=es&translatedLanguage[]=en&limit=100`
      + '&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&includeFutureUpdates=0'
    );
    cSet(key, feed);
  }
  const caps = [];
  const vistos = new Set();
  for (const ch of (feed.data || [])) {
    const num = ch.attributes?.chapter;
    const lang = ch.attributes?.translatedLanguage;
    if (!num) continue;
    const k = `${num}:${lang}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    caps.push({ num: parseFloat(num), lang, title: ch.attributes?.title || '' });
  }
  caps.sort((a, b) => a.num - b.num);
  if (!caps.length) return msg.reply('《✧》 No hay capítulos disponibles.');

  const total = caps.length;
  let teks = `📑 *Capítulos disponibles* (${total})\n\n`;
  teks += `> Prefiere capítulos en 🇪🇸 español cuando existen.\n`;
  teks += `> Se muestran ${Math.min(CAPS_POR_LISTA, total)} de ${total}.\n\n`;
  for (const c of caps.slice(0, CAPS_POR_LISTA)) {
    teks += `▸ Cap *${c.num}* ${c.lang === 'es' ? '🇪🇸' : '🇬🇧'} → ${p}manga leer ${id} ${c.num}\n`;
  }
  if (total > CAPS_POR_LISTA) teks += `\n> ...y ${total - CAPS_POR_LISTA} más (capítulos recientes al final).\n`;
  teks += `\n> Uso: ${p}manga leer ${id} <número>`;
  msg.reply(teks);
}

async function leerCap(msg, sock, p, args) {
  if (args.length < 2) return msg.reply(`《✧》 Usa: ${p}manga leer <id> <capítulo>`);
  const id = args[0];
  const capNum = args[1];
  await msg.react('📖').catch(() => {});
  const waitMsg = await sock.sendMessage(msg.chat, { text: `⏳ *Manga:* buscando capítulo ${capNum}...` }, { quoted: msg }).catch(() => null);
  const update = async (txt) => {
    if (waitMsg?.key) {
      try { await sock.sendMessage(msg.chat, { text: txt, edit: waitMsg.key }); return; } catch (_) {}
    }
    await msg.reply(txt).catch(() => {});
  };

  try {
    // Cargar feed
    const feedKey = 'c:' + id;
    let feed = cGet(feedKey);
    if (!feed) {
      feed = await mdFetch(
        `/manga/${id}/feed?translatedLanguage[]=es&translatedLanguage[]=en&limit=500`
        + '&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&includeFutureUpdates=0'
      );
      cSet(feedKey, feed);
    }

    // Preferir capítulo en español; si no, inglés
    const cap = (feed.data || []).find(ch => ch.attributes?.chapter === String(capNum) && ch.attributes?.translatedLanguage === 'es')
             || (feed.data || []).find(ch => ch.attributes?.chapter === String(capNum));
    if (!cap) {
      await update(`《✧》 No encontré el capítulo *${capNum}*.\n> Usa *${p}manga caps ${id}* para ver los disponibles.`);
      return;
    }

    // Nombre del manga
    let nombreManga = 'Manga';
    try {
      const mKey = 'i:' + id;
      let det = cGet(mKey);
      if (!det) { det = await mdFetch(`/manga/${id}`); cSet(mKey, det); }
      nombreManga = det.data?.attributes?.title?.es || det.data?.attributes?.title?.en || Object.values(det.data?.attributes?.title || {})[0] || 'Manga';
    } catch (_) {}

    // At-home
    const chId = cap.id;
    const ahKey = 'ah:' + chId;
    let atHome = cGet(ahKey);
    if (!atHome) {
      atHome = await mdFetch(`/at-home/server/${chId}`);
      cSet(ahKey, atHome);
    }
    const baseUrl = atHome.baseUrl;
    const hash = atHome.chapter.hash;
    const pages = atHome.chapter.dataSaver || atHome.chapter.data || [];
    if (!pages.length) { await update('《✧》 Este capítulo no tiene páginas.'); return; }

    const lang = cap.attributes?.translatedLanguage || '';
    const titulo = cap.attributes?.title || '';
    const intro =
      `📖 *${nombreManga}* · cap. *${capNum}*${lang ? ` (${lang.toUpperCase()})` : ''}\n`
      + (titulo ? `_${titulo}_\n` : '')
      + `📄 ${pages.length} páginas (se envían en lotes)`;
    await update(intro);

    // Enviar páginas en lotes (1ª con caption, resto sin caption)
    for (let i = 0; i < pages.length; i += MAX_PAGS_POR_LOTE) {
      const lote = pages.slice(i, i + MAX_PAGS_POR_LOTE);
      const urls = lote.map(pg => `${baseUrl}/data-saver/${hash}/${pg}`);
      try {
        await sock.sendMessage(msg.chat, {
          image: { url: urls[0] },
          caption: `📖 ${nombreManga} · cap. ${capNum} · pág. ${i + 1}${urls.length > 1 ? '–' + (i + urls.length) : ''}/${pages.length}`,
        }, { quoted: msg });
        for (let j = 1; j < urls.length; j++) {
          await sock.sendMessage(msg.chat, { image: { url: urls[j] } }, { quoted: msg });
        }
      } catch (e) {
        await msg.reply(`⚠️ Falló un lote de páginas (${i + 1}–${i + lote.length}). El servidor de MangaDex puede estar saturado; inténtalo más tarde.`).catch(() => {});
        break;
      }
    }
    await msg.react('✔️').catch(() => {});
  } catch (e) {
    await update(`《✧》 Error: ${e.message}`);
  }
}
