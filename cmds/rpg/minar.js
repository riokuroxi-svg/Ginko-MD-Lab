import db from '#db';
import { geminiGenerate } from '#lib/geminiRole';

/**
 * .minar / .mine / .excavar
 * Mini-RPG: el usuario excava en el bosque de Ginko.
 *  - Cooldown 30 min por usuario.
 *  - Gana 1-3 recursos aleatorios (rareza: comun/poco comun/raro/epico/legendario).
 *  - Gana XP y monedas.
 *  - La IA narra lo que pasó (1 llamada por minada); si falla, usa texto fallback sin IA.
 */

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos

const RECURSOS = [
  // { id, nombre, emoji, rareza, peso, valor }
  { id: 'piedra',   nombre: 'Piedra',          emoji: '🪨', rareza: 'común',     peso: 45, valor: 1 },
  { id: 'madera',   nombre: 'Madera',          emoji: '🪵', rareza: 'común',     peso: 35, valor: 2 },
  { id: 'hierba',   nombre: 'Hierbas de ginko',emoji: '🌿', rareza: 'común',     peso: 30, valor: 2 },
  { id: 'tierra',   nombre: 'Tierra fértil',   emoji: '🟫', rareza: 'común',     peso: 20, valor: 1 },
  { id: 'cobre',    nombre: 'Cobre',           emoji: '🟠', rareza: 'poco común', peso: 15, valor: 5 },
  { id: 'hongo',    nombre: 'Hongo brillante', emoji: '🍄', rareza: 'poco común', peso: 12, valor: 6 },
  { id: 'hierro',   nombre: 'Hierro',          emoji: '⬛', rareza: 'raro',      peso: 8,  valor: 12 },
  { id: 'plata',    nombre: 'Plata',           emoji: '⚪', rareza: 'raro',      peso: 5,  valor: 18 },
  { id: 'rubi',     nombre: 'Rubí',            emoji: '🔴', rareza: 'épico',     peso: 2,  valor: 45 },
  { id: 'zafiro',   nombre: 'Zafiro',          emoji: '🔵', rareza: 'épico',     peso: 2,  valor: 45 },
  { id: 'esmeralda',nombre: 'Esmeralda',       emoji: '🟢', rareza: 'épico',     peso: 2,  valor: 50 },
  { id: 'oro',      nombre: 'Oro',             emoji: '🟡', rareza: 'legendario',peso: 1,  valor: 120 },
  { id: 'diamante', nombre: 'Diamante',        emoji: '💎', rareza: 'legendario',peso: 1,  valor: 200 },
  { id: 'hojaginko',nombre: 'Hoja de ginko dorada', emoji: '🍂', rareza: 'legendario', peso: 1, valor: 250 },
];

const RAREZA_EMOJI = {
  'común':      '⚪',
  'poco común': '🟢',
  'raro':       '🔵',
  'épico':      '🟣',
  'legendario': '🟡',
};

// XP por minada según rareza del recurso principal
const XP_POR_RAREZA = { 'común': 8, 'poco común': 15, 'raro': 28, 'épico': 55, 'legendario': 120 };

function pickWeighted(list, rng = Math.random) {
  const total = list.reduce((s, it) => s + it.peso, 0);
  let r = rng() * total;
  for (const it of list) {
    r -= it.peso;
    if (r <= 0) return it;
  }
  return list[0];
}

function msReloj(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ss = s % 60;
  if (h > 0) return `${h}h ${mm}m`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${ss}s`;
}

function inventarioAdd(invStr, recId, cant) {
  const obj = (() => { try { return JSON.parse(invStr || '{}'); } catch { return {}; } })();
  obj[recId] = (obj[recId] || 0) + cant;
  return JSON.stringify(obj);
}

async function narracionIA(userName, recursos, criticoLegendario) {
  const lineasRecursos = recursos.map(r => `${r.emoji} ${r.nombre} (${r.rareza})`).join(', ');
  const tono = criticoLegendario
    ? 'épico, emocionante, como si el usuario hubiera encontrado algo muy raro y brillante en el bosque'
    : recursos.some(r => r.rareza === 'épico' || r.rareza === 'legendario')
      ? 'emocionante, como un hallazgo afortunado en el bosque'
      : 'chistoso, cotidiano, describiendo una tarde cualquiera minando en el bosque de ginko';
  const prompt =
`Eres la narradora de un mini-RPG ambientado en el Bosque de Ginko. El usuario "${userName}" está minando/excavando y acaba de encontrar: ${lineasRecursos}.
Escribe UN PÁRRAFO CORTO de máximo 2 oraciones en español (${tono}), en segunda persona. Nombra los recursos naturalesmente. Menciona brevemente hojas de ginko, el viento, raíces o algo del bosque. NO inventes premios extra ni más recursos. NO uses markdown, solo texto plano con emojis suaves. Respuesta corta.`;
  const txt = await geminiGenerate(prompt, { temperature: 0.95, maxTokens: 200 });
  return txt;
}

const FALLBACKS = {
  comun: [
    '🌿 Excavas entre las raíces de un árbol de ginko y encuentras unas cuantas cosas bajo tierra...',
    '🍃 El viento mueve las hojas doradas mientras picás la tierra y sacas algunos materiales.',
    '🌱 Una ardilla te mira raro mientras sacas unas piedras y hierbas del suelo.',
  ],
  suerte: [
    '✨ ¡Brilla algo entre las hojas! Te acercás y encontrás algo mejor de lo común...',
    '🌟 Das con un hueco pequeño en la roca y hay algo que brilla adentro...',
    '🍂 Una hoja dorada de ginko cae justo sobre un montículo de tierra... decides picar ahí.',
  ],
  legendario: [
    '💫 ¡De repente el suelo emite un brillo intenso! Te late el corazón... encontraste algo LEGENDARIO.',
    '🌟🌟 Una luz dorada ilumina el bosque. ¡No lo puedes creer, hallaste un recurso legendario!',
    '🔥 El aire huele a tierra mojada y magia. Picás con cuidado y aparece algo increíble...',
  ],
};

function fallbackText(recursos) {
  const legend = recursos.some(r => r.rareza === 'legendario');
  const bueno = recursos.some(r => r.rareza === 'épico' || r.rareza === 'raro');
  const pool = legend ? FALLBACKS.legendario : bueno ? FALLBACKS.suerte : FALLBACKS.comun;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default {
  command: ['minar', 'mine', 'excavar'],
  category: 'rpg',
  description: 'Mina recursos en el Bosque de Ginko. Cooldown 30 min.',
  run: async ({ msg, sock, args }) => {
    const userId = msg.sender;
    const chatId = msg.chat;

    // Asegurar columnas en DB (setCreate lo hace solo si faltan).
    db.setCreate('users', userId, 'rpg_xp', 0);
    db.setCreate('users', userId, 'rpg_level', 1);
    db.setCreate('users', userId, 'rpg_minadas', 0);
    db.setCreate('users', userId, 'lastMine', 0);
    db.setCreate('chat_users', [chatId, userId], 'rpg_inventory', '{}');
    db.setCreate('chat_users', [chatId, userId], 'rpg_streak', 0);
    db.setCreate('chat_users', [chatId, userId], 'rpg_lastMineDay', '');

    const user = db.getUser(userId);
    const chatUser = db.getChatUser(chatId, userId);

    const now = Date.now();
    const last = user.lastMine || 0;
    const resta = COOLDOWN_MS - (now - last);

    if (resta > 0) {
      return msg.reply(`⏳ *Estás cansado/a de picar.*\nPodrás minar de nuevo en *${msReloj(resta)}*.`);
    }

    await msg.react('⛏️');

    // Cantidad de recursos (1-3) con peso a 1.
    const tirada = Math.random();
    const cantidad = tirada < 0.55 ? 1 : tirada < 0.88 ? 2 : 3;
    const recursos = [];
    for (let i = 0; i < cantidad; i++) {
      recursos.push(pickWeighted(RECURSOS));
    }

    // Bonus por racha diaria.
    const hoy = new Date(now).toDateString();
    let racha = chatUser.rpg_streak || 0;
    const ultimoDia = chatUser.rpg_lastMineDay || '';
    const ayer = new Date(now - 86400000).toDateString();
    if (ultimoDia === hoy) {
      // ya minó hoy → racha se mantiene
    } else if (ultimoDia === ayer) {
      racha = Math.min(racha + 1, 30);
    } else {
      racha = 1;
    }
    db.setChatUser(chatId, userId, 'rpg_streak', racha);
    db.setChatUser(chatId, userId, 'rpg_lastMineDay', hoy);

    // Monedas base + bonus por rareza + bonus racha.
    const valorTotal = recursos.reduce((s, r) => s + r.valor, 0);
    const bonusRacha = Math.floor(valorTotal * 0.05 * Math.min(racha, 10));
    const monedasGanadas = valorTotal + bonusRacha;

    // XP = del recurso más raro + pequeño bonus por múltiples.
    const rarezaOrden = ['común', 'poco común', 'raro', 'épico', 'legendario'];
    const topRareza = recursos
      .map(r => rarezaOrden.indexOf(r.rareza))
      .reduce((a, b) => Math.max(a, b), 0);
    const xpGanado = XP_POR_RAREZA[rarezaOrden[topRareza]] + (cantidad - 1) * 5 + Math.min(racha, 10);

    const rpgXP = (user.rpg_xp || 0) + xpGanado;
    let rpgNivel = user.rpg_level || 1;
    const xpParaSubir = 100 + (rpgNivel - 1) * 60;
    let subioNivel = false;
    if (rpgXP >= xpParaSubir) {
      rpgNivel += 1;
      subioNivel = true;
    }

    const minadas = (user.rpg_minadas || 0) + 1;

    // Guardar en inventario.
    let invStr = chatUser.rpg_inventory || '{}';
    for (const r of recursos) {
      invStr = inventarioAdd(invStr, r.id, 1);
    }

    // Guardar en DB.
    db.setUser(userId, 'lastMine', now);
    db.setUser(userId, 'rpg_xp', subioNivel ? rpgXP - xpParaSubir : rpgXP);
    db.setUser(userId, 'rpg_level', rpgNivel);
    db.setUser(userId, 'rpg_minadas', minadas);
    db.setChatUser(chatId, userId, 'rpg_inventory', invStr);
    db.setChatUser(chatId, userId, 'coins', (chatUser.coins || 0) + monedasGanadas);
    // También dar exp global si aplica al usuario (el sistema de nivel principal
    // maneja su propio XP, solo sumamos poquito).
    db.setUser(userId, 'exp', (user.exp || 0) + Math.floor(xpGanado / 2));

    // Narrar con IA (sin await para no demorar mucho si falla rápido; sí esperamos pero con timeout).
    const pushName = msg.pushName || 'Aventurero/a';
    const criticoLegendario = recursos.some(r => r.rareza === 'legendario');
    let narracion = await Promise.race([
      narracionIA(pushName, recursos, criticoLegendario),
      new Promise(r => setTimeout(() => r(null), 6000)),
    ]);
    if (!narracion) narracion = fallbackText(recursos);

    // Armar mensaje final.
    const lines = [];
    lines.push(`╭⛏️ *Bosque de Ginko — Minar*`);
    lines.push(`│`);
    lines.push(`│ ${narracion}`);
    lines.push(`│`);
    for (const r of recursos) {
      lines.push(`│ ${RAREZA_EMOJI[r.rareza]} ${r.emoji} *${r.nombre}* \`(${r.rareza})\``);
    }
    lines.push(`│`);
    lines.push(`│ 💰 *+${monedasGanadas}* monedas${bonusRacha > 0 ? ` (+${bonusRacha} racha 🔥)` : ''}`);
    lines.push(`│ ✨ *+${xpGanado} XP*`);
    if (racha > 1) lines.push(`│ 🔥 Racha diaria: *${racha}* día(s)`);
    lines.push(`│ ⛏️ Minadas totales: *${minadas}*`);
    if (subioNivel) {
      lines.push(`│`);
      lines.push(`│ 🎉 *¡SUBISTE DE NIVEL!* Ahora eres nivel *${rpgNivel}* 🎊`);
    }
    lines.push(`╰\`Usa .bolsa para ver tu inventario · .perfil para tu ficha\``);

    await msg.react(criticoLegendario ? '💎' : '✨');
    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};
