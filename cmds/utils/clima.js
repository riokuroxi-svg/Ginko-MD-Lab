/**
 * .clima [ciudad]  →  clima actual en español.
 * Usa wttr.in (gratis, sin key, con respuesta en español).
 */
export default {
  command: ['clima', 'tiempo', 'weather'],
  category: 'utils',
  description: 'Ver el clima actual de una ciudad.',
  run: async ({ msg, usedPrefix, command, text }) => {
    const ciudad = (text || 'Mexico_City').trim().replace(/\s+/g, '_');
    try {
      await msg.react('🌤️');
      const res = await fetch(`https://wttr.in/${encodeURIComponent(ciudad)}?format=j1&lang=es`, {
        headers: { 'User-Agent': 'curl/8.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const cur = d.current_condition?.[0];
      const hoy = d.weather?.[0];
      const loc = d.nearest_area?.[0];
      if (!cur) throw new Error('No se pudo obtener el clima.');

      const nombreCiudad = loc ? `${loc.areaName?.[0]?.value || ciudad}, ${loc.country?.[0]?.value || ''}` : ciudad.replace(/_/g, ' ');
      const desc = (cur.lang_es?.[0]?.value || cur.weatherDesc?.[0]?.value || '').trim();
      const emoji = climaEmoji(desc, cur.weatherCode);
      const linea = [
        `${emoji} *Clima en ${nombreCiudad}*`,
        `🌡️ *Temperatura:* ${cur.temp_C} °C (sensación ${cur.FeelsLikeC} °C)`,
        `💧 *Humedad:* ${cur.humidity}%`,
        `💨 *Viento:* ${cur.windspeedKmph} km/h`,
        `☁️ *Nubes:* ${cur.cloudcover}%`,
        `📊 *Máx/Mín hoy:* ${hoy?.maxtempC || '?'}°C / ${hoy?.mintempC || '?'}°C`,
        `🌅 *Amanecer/Atardecer:* ${hoy?.astronomy?.[0]?.sunrise || '?'} / ${hoy?.astronomy?.[0]?.sunset || '?'}`,
        `📝 ${desc}`,
      ].join('\n');
      msg.reply(linea);
    } catch (e) {
      await msg.react('❌');
      msg.reply(
        `《✧》 No pude consultar el clima de *${ciudad.replace(/_/g, ' ')}*.\n`
        + `> ${e.message}\n`
        + `> Ejemplo: ${usedPrefix}clima Pachuca`
      );
    }
  },
};

function climaEmoji(desc, code) {
  const d = (desc || '').toLowerCase();
  if (/lluvi|chubasc|torment|truena|rain/i.test(d)) return '🌧️';
  if (/niev|nieve|snow/i.test(d)) return '❄️';
  if (/niebl|bruma|fog|mist/i.test(d)) return '🌫️';
  if (/nubl|cubiert|cloud/i.test(d)) return '☁️';
  if (/parcial|intervalos nubosos|partly/i.test(d)) return '⛅';
  if (/despej|solead|clear|sunny/i.test(d)) return '☀️';
  // fallback por código
  const c = parseInt(code, 10);
  if (c >= 392 && c <= 395) return '❄️';
  if (c >= 356 && c <= 389) return '🌧️';
  if (c >= 116 && c <= 122) return '⛅';
  if (c === 113) return '☀️';
  return '🌤️';
}
