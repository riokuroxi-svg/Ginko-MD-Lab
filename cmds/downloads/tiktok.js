import fetch from 'node-fetch'

const MAX_REINTENTOS = 3
const ESPERA_BASE_MS = 1500

const dormir = ms => new Promise(r => setTimeout(r, ms))

async function fetchConReintento(url, opciones = {}) {
  let ultimoError
  for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 25000)
      let res
      try {
        res = await fetch(url, { ...opciones, signal: ctrl.signal })
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (e) {
      ultimoError = e
      console.log(`[tiktok] ⚠️ Intento ${intento} falló: ${e.message}`)
      if (intento < MAX_REINTENTOS) await dormir(ESPERA_BASE_MS * intento)
    }
  }
  throw ultimoError || new Error('Fallaron todos los intentos')
}

export default {
  command: ['tiktok', 'tt'],
  category: 'downloads',
  description: 'Descargar un video de TikTok.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    if (!args.length) {
      return msg.reply(`《✧》 Por favor, ingresa un enlace de TikTok.\nEjemplo: *${usedPrefix}tiktok* https://vt.tiktok.com/xxxxx`)
    }
    const text = args.join(" ").trim()
    const isUrl = /(?:https?:?\/{2})?(?:w{3}|vm|vt|t)?\.?tiktok\.com\/[^\s&]+/i.test(text)
    if (!isUrl) {
      return msg.reply('《✧》 Por favor ingresa un enlace válido de TikTok.')
    }

    // lempi.lat usa apikey= y devuelve la estructura:
    // { status, titulo, portada, autor:{usuario,nombre,avatar},
    //   estadisticas:{vistas,likes,comentarios,...}, musica:{titulo,url}, datos:{url,tamaño,tipo,archivo} }
    const endpoint = `${global.APIs.Ginko.url}/dl/tiktok?url=${encodeURIComponent(text)}&apikey=${global.APIs.Ginko.key}`
    try {
      const res = await fetchConReintento(endpoint, { headers: { 'accept': 'application/json', 'user-agent': 'Mozilla/5.0' } })
      const json = await res.json()
      if (!json.status || !json.datos?.url) {
        return msg.reply('《✧》 No se pudo obtener el video de TikTok. Puede que el enlace esté privado o eliminado.')
      }

      const { titulo, autor, duracion, estadisticas, datos, musica } = json
      const authorName = autor?.nombre || autor?.usuario || 'Desconocido'
      const authorUser = autor?.usuario ? '@' + autor.usuario : ''

      const caption = `ㅤ۟∩　ׅ　★ ໌　ׅ　🅣𝗂𝗄𝖳𝗈𝗄 🅓ownload　ׄᰙ\n\n𖣣ֶㅤ֯⌗ ✎  ׄ ⬭ *Título:* ${titulo || 'Sin título'}\n𖣣ֶㅤ֯⌗ ꕥ  ׄ ⬭ *Autor:* ${authorName} ${authorUser}\n𖣣ֶㅤ֯⌗ ⴵ  ׄ ⬭ *Duración:* ${duracion ? duracion + 's' : 'N/A'}\n𖣣ֶㅤ֯⌗ ❖  ׄ ⬭ *Likes:* ${Number(estadisticas?.likes || 0).toLocaleString()}\n𖣣ֶㅤ֯⌗ ❀  ׄ ⬭ *Comentarios:* ${Number(estadisticas?.comentarios || 0).toLocaleString()}\n𖣣ֶㅤ֯⌗ ✿  ׄ ⬭ *Vistas:* ${Number(estadisticas?.vistas || estadisticas?.plays || 0).toLocaleString()}\n𖣣ֶㅤ֯⌗ ☆  ׄ ⬭ *Compartidos:* ${Number(estadisticas?.compartidos || 0).toLocaleString()}\n𖣣ֶㅤ֯⌗ ❒  ׄ ⬭ *Sonido:* ${musica?.titulo || 'audio original'}`.trim()

      const mediaUrl = datos.url
      const fileName = datos.archivo || 'tiktok.mp4'

      if (json.portada) {
        await sock.sendMessage(msg.chat, {
          image: { url: json.portada },
          caption
        }, { quoted: msg })
      } else {
        await msg.reply(caption)
      }

      if (datos.tipo === 'image' || /\.(jpg|jpeg|png|webp)/i.test(fileName)) {
        await sock.sendMessage(msg.chat, { image: { url: mediaUrl } }, { quoted: msg })
      } else {
        await sock.sendMessage(msg.chat, {
          video: { url: mediaUrl },
          mimetype: 'video/mp4',
          fileName: fileName
        }, { quoted: msg })
      }

      if (musica?.url) {
        await sock.sendMessage(msg.chat, {
          audio: { url: musica.url },
          mimetype: 'audio/mpeg',
          fileName: `${sanitize(titulo || 'tiktok_audio')}.mp3`
        }, { quoted: msg })
      }
    } catch (e) {
      console.error('Error en tiktok:', e)
      await msg.reply(`> Error al descargar de TikTok después de ${MAX_REINTENTOS} intentos: ${e?.message || 'error desconocido'}.\n> Intenta de nuevo en unos segundos.`)
    }
  },
}

function sanitize(s = 'audio') {
  return String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'audio'
}
