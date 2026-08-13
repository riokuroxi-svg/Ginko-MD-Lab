// TTS (Texto a voz) con voces reales de Microsoft Edge (GRATIS, sin API key).
// Usa voces Neurales en español con distintas voces (mujer/hombre, varios acentos).
// Uso:
//   .tts <texto>                       -> voz por defecto (Dalia, mujer MX)
//   .tts voz:<nombre> <texto>          -> elegir voz
//   .tts <texto> --voz jorge
//   .voces                             -> lista de voces disponibles
import { synthesize, VOICES, DEFAULT_VOICE, resolveVoice } from '#lib/edgeTTS';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default {
  command: ['tts', 'voz', 'decirvoz', 'speak', 'ttsvoz', 'voces', 'ttsvoces'],
  category: 'utils',
  description: 'Convierte texto a audio con varias voces en español.',
  run: async ({ msg, sock, args, usedPrefix, command }) => {
    const cmd = command.toLowerCase();

    // Lista de voces
    if (cmd === 'voces' || cmd === 'ttsvoces' || args[0] === 'list' || args[0] === 'voces') {
      const def = VOICES[DEFAULT_VOICE];
      let txt = '🎙️ *Voces disponibles:*\n\n';
      for (const [key, v] of Object.entries(VOICES)) {
        txt += `• *${key}* → ${v.name}${key === DEFAULT_VOICE ? ' _(predeterminada)_' : ''}\n`;
      }
      txt += `\nUso: *${usedPrefix}tts voz:jorge Hola qué tal*`;
      txt += `\nO: *${usedPrefix}tts Hola --voz elena*`;
      return msg.reply(txt);
    }

    if (!args[0]) {
      return msg.reply(
        `🎙️ *Texto a voz*\n\n` +
        `Escribe: *${usedPrefix}tts <texto>*\n\n` +
        `Voces disponibles (usa *${usedPrefix}voces* para verlas):\n` +
        `${Object.entries(VOICES).slice(0,6).map(([k,v])=>`• ${k} (${v.name})`).join('\n')}\n\n` +
        `Ej: *${usedPrefix}tts voz:dalia Hola amigos*`
      );
    }

    let raw = args.join(' ');
    // Detectar voz por flag --voz o voz:
    let voiceKey = DEFAULT_VOICE;
    const mFlag = raw.match(/--voz\s+([a-zA-Záéíóúñ]+)/i) || raw.match(/(?:^|\s)voz:([a-zA-Záéíóúñ]+)/i);
    if (mFlag) {
      voiceKey = mFlag[1].toLowerCase();
      raw = raw.replace(mFlag[0], ' ').trim();
    }
    // Si el primer arg es el nombre exacto de una voz seguido de texto, también lo toma
    if (!raw && args[0]) raw = args.join(' ');
    if (!raw.trim()) return msg.reply('⚠️ Escribe el texto que quieres convertir a voz.');

    const voice = resolveVoice(voiceKey);

    await msg.react('🎙️');
    const statusMsg = await msg.reply(`⏳ Generando audio con voz *${voice.name}*...`);

    try {
      const mp3Buf = await synthesize(raw, voiceKey);
      if (!mp3Buf || mp3Buf.length < 500) throw new Error('Audio vacío');

      const tmp = path.join(os.tmpdir(), `ginko_tts_${Date.now()}.mp3`);
      fs.writeFileSync(tmp, mp3Buf);

      await sock.sendMessage(msg.chat, {
        audio: { url: tmp },
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: `tts_${voiceKey}.mp3`
      }, { quoted: msg });

      fs.unlinkSync(tmp);
      try { await sock.sendMessage(msg.chat, { delete: statusMsg.key }); } catch (_) {}
      await msg.react('✅');
    } catch (e) {
      try { await sock.sendMessage(msg.chat, { delete: statusMsg.key }); } catch (_) {}
      await msg.reply(`❌ No pude generar el audio: ${e.message || e}`);
      await msg.react('❌');
    }
  }
};
