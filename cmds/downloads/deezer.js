/**
 * .deezer <búsqueda o enlace>  →  busca música en Deezer y envía preview (30s) + info del track.
 */
import { processMp3ForWhatsApp } from '#lib/mp3Utils'

export default {
  command: ['deezer', 'dzr', 'deezermusic'],
  category: 'downloads',
  description: 'Buscar música en Deezer (preview de 30 segundos).',
  run: async ({ msg, sock, usedPrefix, command, text }) => {
    if (!text) return msg.reply(`《✧》 Escribe qué canción buscar.\n> Ejemplo: ${usedPrefix}deezer Bad Bunny Diles`);
    try {
      await msg.react('🎧');
      // Buscar
      const url = `https://api.deezer.com/search?q=${encodeURIComponent(text)}&limit=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const track = data?.data?.[0];
      if (!track) return msg.reply('《✧》 No encontré esa canción en Deezer.');

      const caption = [
        `🎧 *Deezer*`,
        `• *Título:* ${track.title}`,
        `• *Artista:* ${track.artist?.name || '—'}`,
        `• *Álbum:* ${track.album?.title || '—'}`,
        `• *Duración:* ${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`,
        `• *Explícito:* ${track.explicit_lyrics ? 'Sí' : 'No'}`,
        `• *Link:* ${track.link}`,
        '',
        '_Se envía un preview de 30s (Deezer no da canciones completas gratis)._',
      ].join('\n');

      // Enviar portada + info
      if (track.album?.cover_medium || track.album?.cover) {
        const cover = track.album?.cover_medium || track.album?.cover;
        await sock.sendMessage(msg.chat, { image: { url: cover }, caption }, { quoted: msg });
      } else {
        await msg.reply(caption);
      }

      // Enviar preview de audio (30s) con portada personalizada
      if (track.preview) {
        const audioRes = await fetch(track.preview);
        if (audioRes.ok) {
          const buf = Buffer.from(await audioRes.arrayBuffer());
          const nombre = `${track.artist.name} - ${track.title}`;
          let final = buf, segs = 0;
          try { const p = await processMp3ForWhatsApp(buf, nombre); final = p.buffer; segs = p.seconds || 0 } catch {}
          const payload = { audio: final, mimetype: 'audio/mpeg', fileName: nombre + '.mp3', ptt: false };
          if (segs > 0) payload.seconds = segs;
          await sock.sendMessage(msg.chat, payload, { quoted: msg });
        }
      } else {
        if (!(track.album?.cover_medium)) await msg.reply(caption);
        await msg.reply('⚠️ Esta canción no tiene preview disponible.');
      }
      await msg.react('✔️');
    } catch (e) {
      await msg.react('❌');
      msg.reply(`《✧》 Error en Deezer.\n> ${e.message}`);
    }
  },
};
