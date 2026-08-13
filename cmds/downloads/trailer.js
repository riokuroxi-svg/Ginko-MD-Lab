import yts from 'yt-search';

/**
 * .trailer <nombre>  →  busca el tráiler oficial en YouTube y envía el video.
 */
export default {
  command: ['trailer', 'traler'],
  category: 'downloads',
  description: 'Buscar y enviar el tráiler de una película o serie.',
  run: async ({ msg, sock, args, usedPrefix, command, text }) => {
    if (!text) {
      return msg.reply(
        `《✧》 Escribe el nombre de la *película* o *serie*.\n`
        + `> Ejemplo: ${usedPrefix}trailer Venom 3`
      );
    }
    try {
      await msg.react('🎬');
      const search = await yts(`${text} trailer oficial español`);
      const trailer = search.videos && search.videos[0];
      if (!trailer) {
        await msg.react('❌');
        return msg.reply(`《✧》 No encontré el tráiler de *${text}*.`);
      }
      const caption =
        `🎬 *Tráiler*: ${trailer.title}\n`
        + `⏱ *Duración:* ${trailer.timestamp || 'N/A'}\n`
        + `👀 *Vistas:* ${(trailer.views || 0).toLocaleString()}\n`
        + `📺 *Canal:* ${trailer.author?.name || 'N/A'}\n`
        + `🔗 ${trailer.url}`;
      await sock.sendMessage(msg.chat, {
        video: { url: trailer.url },
        caption,
      }, { quoted: msg });
    } catch (e) {
      await msg.react('❌');
      msg.reply(`《✧》 No pude buscar el tráiler.\n> ${e.message || 'error'}`);
    }
  },
};
