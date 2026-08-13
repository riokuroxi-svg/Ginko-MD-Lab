import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import moment from 'moment-timezone';
import { bodyMenu, menuObject } from '#system/commands';
import db from '#db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_BANNER = path.resolve(__dirname, '..', '..', 'media', 'menu.jpg');

function normalize(text = '') {
  text = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  return text.endsWith('s') ? text.slice(0, -1) : text;
}

function formatearMs(ms) {
  const segundos = Math.floor(ms / 1000);
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);
  return [dias && `${dias}d`, `${horas % 24}h`, `${minutos % 60}m`, `${segundos % 60}s`].filter(Boolean).join(' ');
}

// Genera una thumbnail chiquita del banner para el externalAdReply (Instagram)
async function makeThumb(buf) {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(buf).resize({ width: 256 }).jpeg({ quality: 60 }).toBuffer();
  } catch (_) {
    return buf;
  }
}

export default {
  command: ['allmenu', 'help', 'menu', 'ayuda'],
  category: 'main',
  description: 'Ver el menú de comandos.',
  run: async ({ msg, sock, args, usedPrefix }) => {
    try {
      const now = new Date();
      const nowMx = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
      const tiempo = nowMx.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '');
      const tempo = moment.tz('America/Mexico_City').format('hh:mm A');

      const botId = sock?.user?.id.split(':')[0] + '@s.whatsapp.net';
      const botSettings = db.getSettings(botId) || {};
      const botname = botSettings.botname || global.botname || 'Ginko-MD';
      const namebot = botSettings.namebot || botname;
      const owner = botSettings.owner || (global.owner && global.owner[0] ? global.owner[0] + '@s.whatsapp.net' : '');
      const prefix = botSettings.prefix || usedPrefix;

      // Banner
      let banner = botSettings.banner || '';
      if ((!banner || banner.includes('yuki-wabot')) && fs.existsSync(LOCAL_BANNER)) {
        banner = LOCAL_BANNER;
      }

      // Canal oficial (usamos el de settings, no el de la DB)
      const channelLink = (global.links && global.links.channel) || '';
      const canalId = (global.links && global.links.channelId) || botSettings.newsletter_id || '';
      const canalName = (global.links && global.links.channelName) || botSettings.nameid || 'Canal oficial';
      const instagram = (global.links && global.links.instagram) || '';

      const isOficialBot = global.sock?.user?.id && botId === (global.sock.user.id.split(':')[0] + '@s.whatsapp.net');
      const botType = isOficialBot ? 'Principal/Owner' : 'Sub Bot';
      const users = db.getUser();
      const usersCount = users?.length || 0;
      const { getDevice } = await import('baileys');
      const device = getDevice(msg.key.id);
      const userGlobal = db.getUser(msg.sender);
      const sender = userGlobal?.name || msg.pushName || 'Usuario';
      const time = sock.uptime ? formatearMs(Date.now() - sock.uptime) : 'Desconocido';

      const alias = {
        anime: ['anime', 'reacciones'],
        downloads: ['downloads', 'descargas'],
        economia: ['economia', 'economy', 'eco'],
        fun: ['fun', 'diversion', 'entretenimiento', 'juegos'],
        gacha: ['gacha', 'rpg'],
        grupo: ['grupo', 'group'],
        nsfw: ['nsfw', '+18'],
        profile: ['profile', 'perfil'],
        sockets: ['sockets', 'bots'],
        stickers: ['stickers', 'sticker'],
        utils: ['utils', 'utilidades', 'herramientas']
      };
      const input = normalize(args[0] || '');
      const cat = Object.keys(alias).find(k => alias[k].map(normalize).includes(input));
      const category = `${cat ? ` para \`${cat}\`` : '. *(˶ᵔ ᵕ ᵔ˶)*'}`;
      if (args[0] && !cat) {
        return msg.reply(`《✧》La categoria *${args[0]}* no existe, las categorias disponibles son: *${Object.keys(alias).join(', ')}*.\n> Para ver la lista completa escribe *${usedPrefix}menu*\n> Para ver los comandos de una categoría escribe *${usedPrefix}menu [categoría]*\n> Ejemplo: *${usedPrefix}menu anime*`);
      }

      const sections = menuObject;
      const content = cat ? String(sections[cat] || '') : Object.values(sections).map(s => String(s || '')).join('\n\n');
      let menu = bodyMenu ? String(bodyMenu || '') + '\n\n' + content : content;

      const replacements = {
        $owner: owner ? (isNaN(owner.replace(/@s\.whatsapp\.net$/, '')) ? owner : ((db.getUser(owner))?.name || owner.split('@')[0])) : 'Oculto por privacidad',
        $botType: botType,
        $device: device,
        $tiempo: tiempo,
        $tempo: tempo,
        $users: usersCount.toLocaleString(),
        $channel: channelLink,
        $instagram: instagram,
        $cat: category,
        $sender: sender,
        $botname: botname,
        $namebot: namebot,
        $prefix: usedPrefix,
        $uptime: time
      };
      for (const [key, value] of Object.entries(replacements)) {
        menu = menu.replace(new RegExp(`\\${key}`, 'g'), value);
      }

      const mentioned = [owner, msg.sender].filter(Boolean);

      // ContextInfo: reenviado desde el canal (esto hace aparecer el botón "Ver canal")
      const contextInfo = {
        mentionedJid: mentioned,
        isForwarded: true,
        ...(canalId ? {
          forwardedNewsletterMessageInfo: {
            newsletterJid: canalId,
            serverMessageId: 0,
            newsletterName: canalName
          }
        } : {})
      };

      // Tarjeta de Instagram (externalAdReply)
      if (instagram) {
        let thumbBuf = null;
        try {
          if (fs.existsSync(LOCAL_BANNER)) {
            const raw = fs.readFileSync(LOCAL_BANNER);
            thumbBuf = await makeThumb(raw);
          }
        } catch (_) {}
        contextInfo.externalAdReply = {
          title: 'Sígueme en Instagram',
          body: '@__ikg.05',
          mediaType: 1,
          renderLargerThumbnail: false,
          thumbnail: thumbBuf || undefined,
          sourceUrl: instagram,
          containsAutoReply: false
        };
      }

      if (banner) {
        const isVideo = /\.(mp4|webm)(\?|$)/i.test(banner);
        const media = isVideo
          ? { video: { url: banner }, gifPlayback: true, caption: menu.trim(), contextInfo }
          : { image: { url: banner }, caption: menu.trim(), contextInfo };
        await sock.sendMessage(msg.chat, media, { quoted: msg });
      } else {
        await sock.sendMessage(msg.chat, { text: menu.trim(), contextInfo }, { quoted: msg });
      }
    } catch (e) {
      await msg.reply(`> Ocurrió un error al mostrar el menú.\n> [Error: *${e.message}*]`);
    }
  }
};
