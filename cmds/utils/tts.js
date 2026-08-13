/**
 * .tts <texto>  →  nota de voz en español que lee el texto.
 * Usa el TTS gratuito de Google Translate (client=tw-ob).
 * Trocea textos largos en varios audios porque el endpoint tiene un límite ~200 chars.
 */
const MAX_TTS = 180;

export default {
  command: ['tts', 'voz', 'decirvoz', 'speak'],
  category: 'utils',
  description: 'Convertir texto a nota de voz en español.',
  run: async ({ msg, sock, args, usedPrefix, command, text }) => {
    if (!text) {
      return msg.reply(
        `《✧》 Escribe el texto que quieres que *diga* el bot.\n`
        + `> Ejemplo: ${usedPrefix}tts Hola, este es un mensaje de voz`
      );
    }
    await msg.react('🔊');
    // Trocear el texto en oraciones de ~180 chars
    const partes = trocear(text, MAX_TTS);
    try {
      for (let i = 0; i < partes.length; i++) {
        const parte = partes[i];
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=es&client=tw-ob&q=${encodeURIComponent(parte)}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status} al pedir audio (parte ${i + 1})`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 500) throw new Error('Audio vacío.');
        await sock.sendMessage(msg.chat, {
          audio: buf,
          mimetype: 'audio/mpeg',
          ptt: true, // nota de voz
        }, { quoted: i === 0 ? msg : undefined });
      }
      await msg.react('✔️');
    } catch (e) {
      await msg.react('❌');
      msg.reply(`《✧》 No pude generar el audio.\n> ${e.message}`);
    }
  },
};

function trocear(texto, max) {
  const palabras = texto.split(/\s+/);
  const trozos = [];
  let actual = '';
  for (const p of palabras) {
    if ((actual + ' ' + p).trim().length > max) {
      if (actual) trozos.push(actual.trim());
      // Si una sola palabra es muy larga, cortarla a lo bruto
      if (p.length > max) {
        for (let i = 0; i < p.length; i += max) {
          trozos.push(p.slice(i, i + max));
        }
        actual = '';
      } else {
        actual = p;
      }
    } else {
      actual = (actual ? actual + ' ' : '') + p;
    }
  }
  if (actual.trim()) trozos.push(actual.trim());
  return trozos;
}
