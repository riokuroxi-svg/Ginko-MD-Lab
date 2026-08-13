// Edge-TTS ligero: Microsoft ReadAloud (gratis, sin API key).
// Voces Neurales en español con voces distintas (femenina/masculina, varios acentos).
import WebSocket from 'ws';
import crypto from 'crypto';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_VERSION = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_VERSION}`;
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const MAX_CHUNK = 4500; // caracteres por solicitud (Edge acepta ~5k pero dividimos por seguridad)

// Voces disponibles por nombre corto -> ShortName oficial
export const VOICES = {
  dalia:  { name: 'Dalia (MX, mujer)',       short: 'es-MX-DaliaNeural' },
  jorge:  { name: 'Jorge (MX, hombre)',      short: 'es-MX-JorgeNeural' },
  elvira: { name: 'Elvira (ES, mujer)',      short: 'es-ES-ElviraNeural' },
  alvaro: { name: 'Álvaro (ES, hombre)',     short: 'es-ES-AlvaroNeural' },
  elena:  { name: 'Elena (AR, mujer)',       short: 'es-AR-ElenaNeural' },
  tomas:  { name: 'Tomás (AR, hombre)',      short: 'es-AR-TomasNeural' },
  salome: { name: 'Salomé (CO, mujer)',      short: 'es-CO-SalomeNeural' },
  catalina:{name:'Catalina (CL, mujer)',     short: 'es-CL-CatalinaNeural' },
  lorenzo:{ name: 'Lorenzo (CL, hombre)',    short: 'es-CL-LorenzoNeural' },
  ximena: { name: 'Ximena (ES, mujer)',      short: 'es-ES-XimenaNeural' }
};

export const DEFAULT_VOICE = 'dalia';

function generateSecMsGec() {
  let ticks = (Date.now() / 1000) + 11644473600;
  ticks -= ticks % 300;
  ticks = Math.floor(ticks * 10_000_000);
  return crypto.createHash('sha256')
    .update(String(ticks) + TRUSTED_CLIENT_TOKEN)
    .digest('hex')
    .toUpperCase();
}

function muid() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

function uuidNoDash() {
  return crypto.randomUUID().replace(/-/g, '');
}

function jsDate() {
  return new Date().toUTCString().replace(/GMT$/, 'GMT+0000 (Coordinated Universal Time)');
}

function ssml(text, shortName) {
  const safe = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lang = shortName.slice(0, 5); // es-MX
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${shortName}'>` +
    `<prosody pitch='+0Hz' rate='+0%' volume='+0%'>${safe}</prosody>` +
    `</voice></speak>`
  );
}

// Trocea texto en pedazos sin cortar frases.
function splitText(text, max = MAX_CHUNK) {
  text = String(text || '').trim();
  if (!text) return [];
  if (text.length <= max) return [text];
  const chunks = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('. ', max);
    if (cut < max * 0.6) cut = rest.lastIndexOf('. ', max);
    if (cut < max * 0.6) cut = rest.lastIndexOf('! ', max);
    if (cut < max * 0.6) cut = rest.lastIndexOf('? ', max);
    if (cut < max * 0.6) cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.6) cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.6) cut = max;
    else cut += 2;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut);
  }
  if (rest.trim()) chunks.push(rest.trim());
  return chunks;
}

function synthesizeChunk(text, shortName) {
  return new Promise((resolve, reject) => {
    const gec = generateSecMsGec();
    const cid = uuidNoDash();
    let ws;
    try {
      ws = new WebSocket(
        `${WSS_URL}&ConnectionId=${cid}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`,
        {
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
            'Sec-WebSocket-Version': '13',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_VERSION.split('.')[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM_VERSION.split('.')[0]}.0.0.0`,
            'Cookie': `muid=${muid()};`
          },
          perMessageDeflate: true
        }
      );
    } catch (e) {
      return reject(e);
    }
    const chunks = [];
    let done = false;
    const to = setTimeout(() => {
      if (!done) { done = true; try { ws.close(); } catch (_) {} reject(new Error('Tiempo de espera agotado en Edge-TTS')); }
    }, 30000);
    ws.on('open', () => {
      const ts = jsDate();
      ws.send(
        `X-Timestamp:${ts}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"${OUTPUT_FORMAT}"}}}}\r\n`
      );
      ws.send(
        `X-RequestId:${cid}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${ts}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml(text, shortName)
      );
    });
    ws.on('message', (d, isBin) => {
      if (!isBin) {
        const s = d.toString();
        if (s.includes('Path:turn.end')) { done = true; clearTimeout(to); try { ws.close(); } catch (_) {} return; }
        return;
      }
      const buf = Buffer.isBuffer(d) ? d : Buffer.from(d);
      if (buf.length < 2) return;
      const hl = buf.readUInt16BE(0);
      if (hl > buf.length) return;
      if (2 + hl < buf.length) chunks.push(buf.slice(2 + hl));
    });
    ws.on('error', (e) => {
      if (!done) { done = true; clearTimeout(to); reject(e); }
    });
    ws.on('close', (code) => {
      if (done && chunks.length) resolve(Buffer.concat(chunks));
      else if (!done) { done = true; clearTimeout(to); reject(new Error('Conexión cerrada sin audio (código ' + code + ')')); }
    });
  });
}

// Sintetiza texto (de cualquier longitud) usando una voz. Devuelve Buffer MP3.
// voiceKey puede ser una clave del objeto VOICES (ej. 'dalia') o el ShortName (ej. 'es-MX-DaliaNeural').
export async function synthesize(text, voiceKey = DEFAULT_VOICE) {
  const parts = splitText(text);
  if (!parts.length) throw new Error('Texto vacío');
  let shortName;
  if (VOICES[voiceKey]) shortName = VOICES[voiceKey].short;
  else if (voiceKey && voiceKey.startsWith('es-')) shortName = voiceKey;
  else shortName = VOICES[DEFAULT_VOICE].short;
  const buffers = [];
  for (const p of parts) {
    const buf = await synthesizeChunk(p, shortName);
    buffers.push(buf);
  }
  return Buffer.concat(buffers);
}

// Cache de lista de voces (no la usamos ahora pero queda disponible)
let _voiceCache = null;
export async function listVoices() {
  if (_voiceCache) return _voiceCache;
  const resp = await fetch(VOICES_URL, {
    headers: {
      'User-Agent': `Mozilla/5.0 Edg/${CHROMIUM_VERSION.split('.')[0]}.0.0.0`
    }
  });
  if (!resp.ok) throw new Error('No se pudo cargar la lista de voces');
  const data = await resp.json();
  _voiceCache = data.filter(v => (v.Locale || '').startsWith('es-'));
  return _voiceCache;
}

export function resolveVoice(arg) {
  if (!arg) return VOICES[DEFAULT_VOICE];
  const key = String(arg).toLowerCase().replace(/[^a-z]/g, '');
  if (VOICES[key]) return VOICES[key];
  // Buscar por nombre
  for (const v of Object.values(VOICES)) {
    if (v.short.toLowerCase().includes(arg.toLowerCase())) return v;
  }
  return VOICES[DEFAULT_VOICE];
}
