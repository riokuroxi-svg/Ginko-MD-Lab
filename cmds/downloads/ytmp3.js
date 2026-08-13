import yts from 'yt-search'
import fetch from 'node-fetch'

/**
 * .play <búsqueda o URL de YouTube>
 *
 * Busca el video y muestra una tarjeta con botones para elegir:
 *   🎵 Audio MP3
 *   🎬 Video MP4 (360p)
 *   📄 Audio como documento
 *   📁 Video como documento
 *
 * Detecta iPhone por el formato del ID del mensaje (patrón "3A" + 18 chars):
 *   - En Android / escritorio: botones nativos (nativeFlow single_select).
 *   - En iPhone (donde los botones a veces no se ven): fallback a reacciones
 *     con emojis (👍 ❤️ 📄 📁), o bien responder citando el mensaje con el
 *     número/palabra (1/audio, 2/video, 3/videodoc, 4/audiodoc).
 *
 * El listener de respuestas (botones/reacciones/citas) se registra UNA SOLA
 * VEZ por socket mediante el flag sock._ginkoPlayListener para no duplicar
 * eventos cuando el comando se usa varias veces.
 */

// -------------------- configuración --------------------
const MAX_REINTENTOS = 3
const ESPERA_BASE_MS = 1500
const PENDING_TTL_MS = 10 * 60 * 1000 // 10 minutos
const MAX_MB_AUDIO = 50 * 1024 * 1024 // 50 MB
const MAX_MB_VIDEO = 100 * 1024 * 1024 // 100 MB

// Comandos que disparan DESCARGA DIRECTA (sin menú de botones):
//   - .mp3, .ytmp3, .ytaudio, .playaudio → audio directo
//   - .play → muestra el menú interactivo
const ALIAS_MENU = ['play']
const ALIAS_AUDIO_DIRECTO = ['mp3', 'ytmp3', 'ytaudio', 'playaudio']

// Jobs pendientes: mapa messageId → jobData
// El messageId es el ID de la tarjeta de información que enviamos, así que
// solo respondemos a selecciones/reacciones que citan esa tarjeta.
function getPendingMap(sock) {
  if (!sock._ginkoPlayPending) sock._ginkoPlayPending = new Map()
  return sock._ginkoPlayPending
}

// Los mensajes de iPhone empiezan con "3A" y tienen 18 caracteres
// (heurística probada en Baileys / WhiskeySockets).
function esIphone(m) {
  return /^3A.{18}$/.test(String(m?.key?.id || ''))
}

function dormir(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * Envuelve una promesa con un tiempo límite. Si no resuelve en "ms" ms,
 * la rechaza con un error descriptivo. Se usa para ponerle timeout a
 * yts() (yt-search no trae AbortController propio) y a cualquier otra
 * operación que pudiera colgarse.
 */
function conTiempo(promesa, ms, etiqueta) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Tiempo de espera agotado (${Math.round(ms / 1000)}s): ${etiqueta}`)),
      ms
    )
  })
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer))
}

function sanitizeFilename(name = 'audio') {
  return String(name)
    .replace(/\.(mp3|mp4|mkv|webm|mov|avi|m4a)$/i, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'audio'
}

// -------------------- validación de archivos --------------------
function esMp3Valido(buf) {
  if (!buf || buf.length < 4) return false
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true // ID3
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true // sync MPEG
  return false
}

function esMp4Valido(buf) {
  if (!buf || buf.length < 12) return false
  // Firma MP4: los bytes 4-7 deben ser "ftyp"
  try {
    return buf.slice(4, 8).toString('latin1') === 'ftyp'
  } catch {
    return false
  }
}

// -------------------- YouTube --------------------
const isYTUrl = (url = '') =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const getVideoId = (text = '') => {
  const raw = String(text || '').trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ]
  for (const pattern of patterns) {
    const m = raw.match(pattern)
    if (m?.[1]) return m[1]
  }
  return null
}

async function getVideoInfo(input, video_id) {
  // yts() no acepta AbortController directamente, así que lo envolvemos
  // con conTiempo() para evitar que se cuelgue indefinidamente si hay
  // problemas de red (que fue lo que pasó en las pruebas en Termux).
  const BUSQUEDA_TIMEOUT = 20000
  if (video_id) {
    console.log(`[play] 🔎 Buscando info del video ID "${video_id}" (timeout ${BUSQUEDA_TIMEOUT/1000}s)...`)
    try {
      const info = await conTiempo(
        yts({ videoId: video_id }),
        BUSQUEDA_TIMEOUT,
        'no se pudo obtener la información del video (yt-search videoId)'
      )
      if (info?.videoId) {
        console.log(`[play] ✅ Info de videoId OK → "${info.title?.slice(0, 60)}..."`)
        return { ...info, url: `https://youtu.be/${info.videoId}`, image: info.thumbnail || info.image }
      }
    } catch (e) {
      console.log(`[play] ⚠️ Búsqueda por videoId falló: ${e.message}, probando búsqueda por texto...`)
    }
  }
  console.log(`[play] 🔎 Buscando "${String(input).slice(0, 60)}" (timeout ${BUSQUEDA_TIMEOUT/1000}s)...`)
  const search = await conTiempo(
    yts(input),
    BUSQUEDA_TIMEOUT,
    'la búsqueda en YouTube tardó demasiado (revisa tu conexión a internet)'
  )
  const video = search.videos?.[0] || search.all?.find(v => v.type === 'video') || null
  if (video) console.log(`[play] ✅ Encontrado → "${video.title?.slice(0, 60)}"`)
  else console.log('[play] ⚠️ La búsqueda no devolvió resultados')
  return video
}

// -------------------- lempi.lat API --------------------
async function getAudioFromApi(url) {
  const apiUrl = `https://api.lempi.lat/dl/yta?url=${encodeURIComponent(url)}&apikey=montekey28`
  const ctrlMeta = new AbortController()
  const toMeta = setTimeout(() => ctrlMeta.abort(), 25000)
  let res
  try {
    res = await fetch(apiUrl, { headers: { accept: 'application/json' }, signal: ctrlMeta.signal })
  } finally { clearTimeout(toMeta) }
  if (!res.ok) throw new Error(`API respondió HTTP ${res.status}`)
  const json = await res.json()
  if (!json?.status || !json?.datos?.url) {
    throw new Error('La API no devolvió enlace de descarga (puede estar saturada)')
  }

  const ctrlAudio = new AbortController()
  const toAudio = setTimeout(() => ctrlAudio.abort(), 90000)
  let audioRes
  try {
    audioRes = await fetch(json.datos.url, { signal: ctrlAudio.signal })
  } finally { clearTimeout(toAudio) }
  if (!audioRes.ok) throw new Error(`Enlace de audio roto (HTTP ${audioRes.status})`)
  const buffer = Buffer.from(await audioRes.arrayBuffer())
  if (buffer.length < 50 * 1024) {
    throw new Error(`Archivo demasiado pequeño (${buffer.length} bytes), probablemente corrupto`)
  }
  return { buffer, name: json.datos.archivo || 'audio.mp3' }
}

async function getVideoFromApi(url) {
  const apiUrl = `https://api.lempi.lat/dl/ytv?url=${encodeURIComponent(url)}&apikey=montekey28`
  const ctrlMeta = new AbortController()
  const toMeta = setTimeout(() => ctrlMeta.abort(), 30000)
  let res
  try {
    res = await fetch(apiUrl, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' },
      signal: ctrlMeta.signal
    })
  } finally { clearTimeout(toMeta) }
  if (!res.ok) throw new Error(`API respondió HTTP ${res.status}`)
  const json = await res.json()
  if (!json?.status || !json?.datos?.url) {
    throw new Error('La API no devolvió enlace de video')
  }

  const ctrlVideo = new AbortController()
  const toVideo = setTimeout(() => ctrlVideo.abort(), 120000)
  let videoRes
  try {
    videoRes = await fetch(json.datos.url, {
      signal: ctrlVideo.signal,
      headers: { 'user-agent': 'Mozilla/5.0' }
    })
  } finally { clearTimeout(toVideo) }
  if (!videoRes.ok) throw new Error(`Enlace de video roto (HTTP ${videoRes.status})`)
  const buffer = Buffer.from(await videoRes.arrayBuffer())
  if (buffer.length < 100 * 1024) {
    throw new Error(`Archivo demasiado pequeño (${buffer.length} bytes), probablemente corrupto`)
  }
  return {
    buffer,
    name: json.datos.archivo || 'video.mp4',
    calidad: json.datos.calidad || '360p',
    tamaño: json.datos.tamaño || null
  }
}

// -------------------- descarga con reintentos y validación --------------------
async function descargarAudio(url, title) {
  let ultimo = null
  for (let i = 1; i <= MAX_REINTENTOS; i++) {
    try {
      console.log(`[play:mp3] Intento ${i}/${MAX_REINTENTOS} → ${title}`)
      const r = await getAudioFromApi(url)
      if (r?.buffer?.length && esMp3Valido(r.buffer)) {
        console.log(`[play:mp3] ✅ OK (${(r.buffer.length/1024/1024).toFixed(2)} MB)`)
        return r
      }
      ultimo = new Error('El archivo no es un MP3 válido')
    } catch (e) {
      ultimo = e
      console.log(`[play:mp3] ⚠️ Intento ${i} falló: ${e.message}`)
    }
    if (i < MAX_REINTENTOS) await dormir(ESPERA_BASE_MS * i)
  }
  throw ultimo || new Error('Fallaron todos los intentos')
}

async function descargarVideo(url, title) {
  let ultimo = null
  for (let i = 1; i <= MAX_REINTENTOS; i++) {
    try {
      console.log(`[play:mp4] Intento ${i}/${MAX_REINTENTOS} → ${title}`)
      const r = await getVideoFromApi(url)
      if (r?.buffer?.length && esMp4Valido(r.buffer)) {
        console.log(`[play:mp4] ✅ OK (${(r.buffer.length/1024/1024).toFixed(2)} MB)`)
        return r
      }
      ultimo = new Error('El archivo no es un MP4 válido (pudo llegar como WebM)')
    } catch (e) {
      ultimo = e
      console.log(`[play:mp4] ⚠️ Intento ${i} falló: ${e.message}`)
    }
    if (i < MAX_REINTENTOS) await dormir(ESPERA_BASE_MS * i)
  }
  throw ultimo || new Error('Fallaron todos los intentos')
}

// -------------------- listener de respuestas (botones / reacciones / citas) --------------------
function registrarListener(sock) {
  if (sock._ginkoPlayListener) return
  sock._ginkoPlayListener = true

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages || []) {
      if (!m?.message || !m?.key?.id) continue
      // Ignorar mensajes del propio bot para no loops
      if (m.key.fromMe) continue

      try {
        await procesarRespuesta(sock, m)
      } catch (e) {
        console.log('[play-listener] error:', e?.message || e)
      }
    }
  })
}

async function procesarRespuesta(sock, m) {
  const pending = getPendingMap(sock)
  if (pending.size === 0) return // limpieza temprana

  // -------- 1) reacciones (👍 ❤️ 📄 📁) --------
  const reaction = m.message?.reactionMessage
  if (reaction?.key?.id) {
    const job = pending.get(reaction.key.id)
    if (job && !job._procesando && !job._completado) {
      const emoji = String(reaction.text || '').trim()
      const mapeo = { '👍': 'audio', '❤️': 'video', '📄': 'audiodoc', '📁': 'videodoc' }
      const eleccion = mapeo[emoji]
      if (eleccion) await ejecutarDescarga(sock, job, eleccion, m)
    }
    return
  }

  // -------- 2) botones / listas / native flow --------
  let selectedId = ''
  let ctxStanzaId = ''

  const lrm = m.message?.listResponseMessage
  const brm = m.message?.buttonsResponseMessage
  const trm = m.message?.templateButtonReplyMessage
  const irm = m.message?.interactiveResponseMessage
  const nfrm = irm?.nativeFlowResponseMessage

  if (lrm?.singleSelectReply?.selectedRowId) {
    selectedId = String(lrm.singleSelectReply.selectedRowId)
    ctxStanzaId = lrm.contextInfo?.stanzaId || ''
  } else if (brm?.selectedButtonId) {
    selectedId = String(brm.selectedButtonId)
    ctxStanzaId = brm.contextInfo?.stanzaId || ''
  } else if (trm?.selectedId) {
    selectedId = String(trm.selectedId)
    ctxStanzaId = trm.contextInfo?.stanzaId || ''
  } else if (nfrm?.paramsJson) {
    try {
      const p = JSON.parse(typeof nfrm.paramsJson === 'string' ? nfrm.paramsJson : '{}')
      selectedId = String(p.id || '')
    } catch {}
    ctxStanzaId = irm?.contextInfo?.stanzaId || nfrm.contextInfo?.stanzaId || ''
  } else if (irm?.body?.text) {
    selectedId = String(irm.body.text)
  }

  if (selectedId) {
    const job = ctxStanzaId ? pending.get(ctxStanzaId) : null
    if (job && !job._procesando && !job._completado) {
      await ejecutarDescarga(sock, job, selectedId, m)
      return
    }
    // Fallback: si no tiene stanzaId, usar el último job del mismo chat
    if (!ctxStanzaId) {
      const chat = m.key.remoteJid
      for (const [, j] of Array.from(pending.entries()).reverse()) {
        if (j.chat === chat && !j._procesando && !j._completado) {
          await ejecutarDescarga(sock, j, selectedId, m)
          return
        }
      }
    }
    return
  }

  // -------- 3) citando la tarjeta y escribiendo un número/palabra --------
  const ext = m.message?.extendedTextMessage
  const texto = String(
    m.message?.conversation ||
    ext?.text || ''
  ).trim().toLowerCase()
  const citado = ext?.contextInfo?.stanzaId
  if (citado && texto) {
    const job = pending.get(citado)
    if (job && !job._procesando && !job._completado) {
      const primera = texto.split(/\s+/)[0]
      const validas = ['1', 'audio', '2', 'video', '3', 'videodoc', '4', 'audiodoc', 'mp3', 'mp4']
      if (validas.includes(primera)) {
        const modo = (primera === '1' || primera === 'audio' || primera === 'mp3') ? 'audio'
                   : (primera === '2' || primera === 'video' || primera === 'mp4') ? 'video'
                   : (primera === '3' || primera === 'videodoc') ? 'videodoc'
                   : 'audiodoc'
        await ejecutarDescarga(sock, job, modo, m)
      }
    }
  }
}

async function ejecutarDescarga(sock, job, modo, m) {
  job._procesando = true
  const chat = job.chat
  const from = m?.key || job.cardKey
  const pref = job.pref

  // Normalizar el id de selección: acepta tanto palabras humanas (audio/video...),
  // los números 1-4 del fallback de citas, como los IDs internos cortos que usamos
  // en los botones nativos (__ginko_pa/pad/pv/pvd).
  const id = String(modo || '').trim().toLowerCase()
  let tipo = ''
  let comoDoc = false
  if (id === '__ginko_pad' || id === 'audiodoc' || id === '4' || id === '📄') { tipo = 'audio'; comoDoc = true }
  else if (id === '__ginko_pa' || id === 'audio' || id === '1' || id === 'mp3' || id === '👍' || id === '🎵') { tipo = 'audio'; comoDoc = false }
  else if (id === '__ginko_pvd' || id === 'videodoc' || id === '3' || id === '📁') { tipo = 'video'; comoDoc = true }
  else if (id === '__ginko_pv' || id === 'video' || id === '2' || id === 'mp4' || id === '❤️' || id === '🎬') { tipo = 'video'; comoDoc = false }
  else tipo = 'audio'

  const reactionEmoji = tipo === 'audio' ? (comoDoc ? '📄' : '🎵') : (comoDoc ? '📁' : '🎬')
  try { await sock.sendMessage(chat, { react: { text: reactionEmoji, key: m.key } }) } catch {}

  const msgDescanso = `⏳ Descargando ${tipo === 'audio' ? 'audio (MP3)' : 'video (MP4)'}${comoDoc ? ' como documento' : ''}...\n> *${job.title}*`
  await sock.sendMessage(chat, { text: msgDescanso }, { quoted: m })

  try {
    if (tipo === 'audio') {
      const r = await descargarAudio(job.url, job.title)
      const sizeMB = r.buffer.length / 1024 / 1024
      if (sizeMB > (MAX_MB_AUDIO / 1024 / 1024)) {
        throw new Error(`El audio pesa ${sizeMB.toFixed(1)} MB (máx ${Math.round(MAX_MB_AUDIO/1024/1024)} MB)`)
      }
      const fname = `${sanitizeFilename(job.title)}.mp3`
      await sock.sendMessage(chat, {
        [comoDoc ? 'document' : 'audio']: r.buffer,
        mimetype: 'audio/mpeg',
        fileName: fname,
        ptt: false
      }, { quoted: m })
    } else {
      const r = await descargarVideo(job.url, job.title)
      const sizeMB = r.buffer.length / 1024 / 1024
      if (sizeMB > (MAX_MB_VIDEO / 1024 / 1024)) {
        throw new Error(`El video pesa ${sizeMB.toFixed(1)} MB (máx ${Math.round(MAX_MB_VIDEO/1024/1024)} MB)`)
      }
      const fname = `${sanitizeFilename(job.title)}.mp4`

      if (!esMp4Valido(r.buffer)) {
        // No es un MP4 real (podría ser WebM): mandarlo como documento para evitar "algo salió mal"
        comoDoc = true
        await sock.sendMessage(chat, { text: '⚠️ La API no devolvió un MP4 válido en esta calidad, te lo envío como documento.' }, { quoted: m }).catch(() => {})
      }

      await sock.sendMessage(chat, {
        [comoDoc ? 'document' : 'video']: r.buffer,
        mimetype: 'video/mp4',
        fileName: fname,
        caption: `乂 *Video descargado*\n> ❒ Título › *${job.title}*${r.calidad ? `\n> ❒ Calidad › *${r.calidad}*` : ''}`
      }, { quoted: m })
    }

    job._completado = true
    // Limpiar job tras 1 minuto
    setTimeout(() => getPendingMap(sock).delete(job.cardId), 60_000)
  } catch (e) {
    job._procesando = false
    console.error('[play] error descarga:', e)
    await sock.sendMessage(chat, {
      text: `❌ *Error al descargar:* ${e?.message || e}\n\n> Prueba con otro enlace o vuelve a intentarlo en unos segundos.`
    }, { quoted: m })
  }
}

// -------------------- comando principal --------------------
const cmd = {
  command: [...ALIAS_MENU, ...ALIAS_AUDIO_DIRECTO],
  category: 'downloads',
  description: 'Descargar música/video de YouTube con menú de botones.',

  run: async ({ msg, sock, args, usedPrefix, command }) => {
    try {
      console.log(`[play] 📥 Comando recibido: "${usedPrefix}${command}" args="${args.join(' ').slice(0,80)}" de ${msg.sender?.split('@')[0]}`)

      if (!args[0]) {
        return msg.reply(`《✧》Uso: *${usedPrefix}play <búsqueda o URL>*\nEj: *${usedPrefix}play* bad bunny diles`)
      }

      const input = args.join(' ').trim()
      const videoId = getVideoId(input)
      const query = videoId ? `https://youtu.be/${videoId}` : input

      // Reacción inicial de "procesando" (para que el usuario vea que el bot sí lo recibió)
      try { await sock.sendMessage(msg.chat, { react: { text: '⏳', key: msg.key } }) } catch {}

      // Buscar info del video
      console.log(`[play] 🔍 Iniciando búsqueda para: "${query.slice(0, 80)}"`)
      const info = await getVideoInfo(query, videoId)
      if (!info?.url) {
        try { await sock.sendMessage(msg.chat, { react: { text: '❌', key: msg.key } }) } catch {}
        return msg.reply('《✧》No se encontró un video válido de YouTube.')
      }
      const url = info.url
      const title = info.title || 'audio'
      const thumbnail = info.thumbnail || info.image || null
      const channel = info.author?.name || info.author || 'Desconocido'
      const duration = info.timestamp || info.duration?.timestamp || 'Desconocido'
      const views = Number(info.views || 0).toLocaleString('es-HN')
      const ago = info.ago || 'Desconocido'

      // ---- Si el comando es alias de DESCARGA DIRECTA (.mp3 / .ytmp3) → saltar menú ----
      if (ALIAS_AUDIO_DIRECTO.includes(command)) {
        const estado = await sock.sendMessage(msg.chat, { text: `⏳ Descargando *${title}*...` }, { quoted: msg }).catch(() => null)
        try {
          const r = await descargarAudio(url, title)
          const fname = `${sanitizeFilename(title)}.mp3`
          await sock.sendMessage(msg.chat, {
            audio: r.buffer, fileName: fname, mimetype: 'audio/mpeg'
          }, { quoted: msg })
          try { if (estado?.key) await sock.sendMessage(msg.chat, { delete: estado.key }) } catch {}
        } catch (e) {
          await msg.reply(`《✧》No se pudo descargar el audio: ${e?.message || e}`)
        } finally {
          try { await sock.sendMessage(msg.chat, { react: { text: '✅', key: msg.key } }) } catch {}
        }
        return
      }

      // ---- Comando .play → mostrar menú ----
      registrarListener(sock)

      const usarBotones = !esIphone(msg)

      const infoTxt =
        `🎬 *RESULTADO ENCONTRADO*\n\n` +
        `> ❖ Título  › *${title}*\n` +
        `> ❖ Canal   › *${channel}*\n` +
        `> ⴵ Duración › *${duration}*\n` +
        `> ❀ Vistas  › *${views}*\n` +
        `> ✩ Publicado › *${ago}*\n` +
        `> ❒ Enlace › ${url}\n\n`

      let caption
      if (usarBotones) {
        caption = infoTxt +
          `🟢 *Toca el botón* de abajo para elegir formato:\n\n` +
          `🔵 Si el menú no se abre, *cita este mensaje* y escribe:\n` +
          `   *1* o *audio*   → Audio MP3 🎵\n` +
          `   *2* o *video*   → Video MP4 🎬\n` +
          `   *3* o *videodoc* → Video como documento 📁\n` +
          `   *4* o *audiodoc* → Audio como documento 📄`
      } else {
        caption = infoTxt +
          `🟡 *Reacciona a este mensaje* con un emoji:\n` +
          `   👍  → Audio MP3 🎵\n` +
          `   ❤️  → Video MP4 🎬\n` +
          `   📄  → Audio como documento\n` +
          `   📁  → Video como documento\n\n` +
          `🔵 O bien *cita este mensaje* y escribe:\n` +
          `   *1* o *audio* / *2* o *video* / *3* o *videodoc* / *4* o *audiodoc*`
      }

      // Botón nativo con mini-lista (single_select) embebida.
      // Esto genera un native flow con un botón que abre un menú de secciones.
      const botones = usarBotones ? [
        {
          text: '📥 Menú de descarga',
          sections: [
            {
              title: '🎵 AUDIO',
              rows: [
                { title: '🎵 Audio MP3', description: 'Audio normal, se reproduce en WhatsApp', rowId: '__ginko_pa' },
                { title: '📄 Audio como documento', description: 'Archivo MP3 descargable', rowId: '__ginko_pad' }
              ]
            },
            {
              title: '🎬 VIDEO',
              rows: [
                { title: '🎬 Video MP4', description: 'Video normal (calidad estándar)', rowId: '__ginko_pv' },
                { title: '📁 Video como documento', description: 'Archivo MP4 descargable', rowId: '__ginko_pvd' }
              ]
            }
          ]
        }
      ] : []

      let card
      const opts = { quoted: msg }
      try {
        if (usarBotones && thumbnail) {
          card = await sock.sendMessage(msg.chat, {
            image: { url: thumbnail },
            caption,
            footer: '❦ Ginko-MD · toca un botón para descargar ❦',
            buttons: botones
          }, opts)
        } else if (thumbnail) {
          card = await sock.sendMessage(msg.chat, {
            image: { url: thumbnail },
            caption
          }, opts)
        } else {
          card = await sock.sendMessage(msg.chat, { text: caption }, opts)
        }
      } catch (e) {
        console.log('[play] ⚠️ Falló envío con botones, reintentando sin botones:', e.message)
        card = await sock.sendMessage(msg.chat, {
          image: thumbnail ? { url: thumbnail } : undefined,
          caption: caption + '\n\n_(botones no disponibles en este cliente, usa las reacciones o cita el mensaje)_'
        }, opts).catch(async () =>
          await sock.sendMessage(msg.chat, { text: caption }, opts)
        )
      }

      if (!card?.key?.id) {
        return msg.reply('❌ No se pudo enviar la tarjeta de opciones.')
      }

      // Registrar job pendiente
      const job = {
        cardId: card.key.id,
        cardKey: card.key,
        chat: msg.chat,
        url, title, channel, duration, views, ago, thumbnail,
        pref: usedPrefix,
        commandMsg: msg,
        _createdAt: Date.now(),
        _procesando: false,
        _completado: false
      }
      getPendingMap(sock).set(card.key.id, job)

      // Auto-limpiar tras TTL
      setTimeout(() => {
        const p = getPendingMap(sock)
        const j = p.get(card.key.id)
        if (j && !j._procesando && !j._completado) p.delete(card.key.id)
      }, PENDING_TTL_MS)

      try { await sock.sendMessage(msg.chat, { react: { text: '✅', key: msg.key } }) } catch {}
    } catch (e) {
      console.error('[play] ❌ Error en comando:', e?.message || e)
      try { await sock.sendMessage(msg.chat, { react: { text: '❌', key: msg.key } }) } catch {}
      await msg.reply(
        `《✧》*Error:* ${e?.message || e}\n\n` +
        `> Si dice "tiempo de espera agotado", tu conexión es inestable o YouTube no responde.\n` +
        `> Prueba de nuevo en unos segundos.`
      )
    }
  }
}

export default cmd
