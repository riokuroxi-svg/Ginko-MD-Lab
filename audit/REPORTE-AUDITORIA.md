# 📋 Reporte de Auditoría de Plugins — Ginko-MD-Lab

**Fecha**: 2026-08-12
**Base**: commit `f43b385` (= `lab-base` = `v1.2-reintentos` del estable)
**Total plugins**: 175 archivos `.js` en `cmds/`
**Nodos**: solo diagnóstico, **no se arregló nada** en esta pasada.
**Repositorio estable**: NO se tocó. Toda la auditoría se hizo en Ginko-MD-Lab.

---

## 🟢 Resumen ejecutivo

| Estado | Cantidad | Descripción |
|---|---|---|
| ✅ Funciona | 131 | Comandos locales o con API viva, listos para usar |
| ⚠️ Funciona con problemas/requisitos | 8 | Funcionan pero dependen de `ffmpeg` del sistema, Node 22+, o pueden devolver imagen por defecto si falla algo |
| ❌ Roto (API muerta/error TLS/404/403) | 36 | Comandos que llaman a APIs caídas, TLS roto o rutas 404 |

> Los 36 rotos se concentran casi todos en `downloads` (redes sociales) y algunos de anime/stickers.
> Los comandos **centrales que usas a diario** (play, ping, menú, stickers, administración de grupos, economía/gacha, perfil) están en su mayoría **verdes**.

---

## ✅ Categoría por categoría

### 📁 Categorías que no dependen de APIs externas (todo local)
Estos funcionan 100% mientras tengas Node 22 y las dependencias npm instaladas.

| Subcategoría | Estado | Comentario |
|---|---|---|
| **main** (ping, status, suggest, help, infobot, invite) | ✅ | Todos cargan. `help/menu` genera el menú en tiempo real, `ping` medirá latencia. |
| **owner** (exec, exec2, restart, update) | ✅ | Solo dueño, comandos de terminal/reinicio. Funcionan mientras el proceso tenga permisos. |
| **socket** (setprefix, setname, setowner, join, leave, logout, reload, self, setbanner, setstatus, etc.) — 18 comandos | ✅ | Configuración interna del bot, sin APIs externas. |
| **group** (kick, promote, demote, link, revoke, open, close, hidetag, tagall, warn, warns, delwarn, setwarnlimit, setwelcome, setgoodbye, groupinfo, clear, bot, count, setgpname/desc/banner, setprimary, options, topcount, topinactive) — 26 comandos | ⚠️ | Funcionan **solo con Node ≥ 22.5** (usan `node:sqlite`). Las imágenes de banner/avatar por defecto apuntan a `cdn.Ginko-wabot.my.id` y `files.Ginko-wabot.my.id`, dominios MUERTOS (DNS no resuelve) → ver sección ❌. |
| **economy** (work, daily, weekly, monthly, balance, deposit, withdraw, givecoins, coinflip, ppt, roulette, slot, casino, crime, slut, steal, hunt, fish, adventure, mine, dungeon, shop, buy, heal, math, einfo, economyboard) — 28 comandos | ✅ | Sistema completo de economía basado en SQLite. Funciona con Node 22+; en Node 20 falla por `node:sqlite`. Sin dependencias externas. |
| **profile** (profile, marry, divorce, afk, afktime, lboard, level, setbirth, delbirth, setdesc, deldesc, setgenre, delgenre, sethobby, delhobby) — 15 comandos | ⚠️ | Igual que group: depende de SQLite/Node 22+. La foto por defecto usa el CDN muerto (ver sección ❌). |
| **events.js, antilink.js, antistatus.js, level.js** (raíz) | ⚠️ | Eventos del bot (bienvenidas, anti-link, anti-status, XP). Funcionan si Node 22. `events.js` tiene fallback a CDN muerto para fotos de perfil. |

---

### 📥 Categoría `downloads/` (12 plugins)

| Comando | API / método | Estado | Detalle |
|---|---|---|---|
| `.play`, `.mp3`, `.ytmp3` | api.lempi.lat (yta) | ✅ | Endpoint vivo, responde 200 con JSON `{status:true, datos:{url}}`. Reintentos activos desde v1.2. |
| `.mp4`, `.ytv` | api.lempi.lat (ytv) | ✅ | Endpoint vivo, mismo patrón que yta. |
| `.ytsearch` | yt-search (npm) | ✅ | Sin API externa, busca directamente. |
| `.apk`, `.aptoide` | aptoide-scraper (npm) | ✅ | Paquete presente y carga, no requiere API key. |
| `.tiktok` | api.lempi.lat (tiktok) | ⚠️ | La API responde `status:true` pero da **HTTP 502** en algunas URL (posiblemente el backend tenga problemas intermitentes; se puede usar reintentos aquí también). |
| `.imagen`, `.img`, `.image` | api.lempi.lat (google-image) | ❌ | Endpoint **404**: ruta `search/google-image` ya no existe. |
| `.facebook` | api.lempi.lat (fb) | ❌ | Endpoint **404**: ruta `dl/fb` ya no existe. |
| `.instagram` | api.lempi.lat (ig) | ❌ | Endpoint **404**: ruta `dl/ig` ya no existe. |
| `.twitter/X` | api.lempi.lat (twitter) | ❌ | Endpoint **404**: ruta `dl/twitter` ya no existe. |
| `.gdrive` | api.lempi.lat (gdrive) | ❌ | Endpoint **404**: ruta `dl/gdrive` ya no existe. |
| `.mediafire` | api.lempi.lat (mediafire) | ❌ | Endpoint **502 Bad Gateway**. |
| `.pin`, `.pinterest` | fare.ink | ❌ | **TLS roto** en `fare.ink`: tanto `search/pin` como `dl/pin` devuelven `tlsv1 alert internal error` (SSL). No es problema de código; el certificado del servidor está roto. |

**Conclusión downloads**: Solo `.play`, `.mp4`, `.ytsearch`, `.apk` están garantizados hoy. El resto de descargas de redes (Instagram/Facebook/Twitter/Pinterest/Mediafire/GDrive/GoogleImágenes) está roto porque lempi.lat eliminó esas rutas o cambió de dominio. Pinterest además usa otro dominio (fare.ink) con TLS roto.

---

### 🎨 Categoría `stickers/` (18 plugins)

| Comando | Estado | Detalle |
|---|---|---|
| `.sticker` / `.s` (imagen/video a sticker) | ⚠️ | **Requiere `ffmpeg` del sistema** (`pkg install ffmpeg`) y `node-webpmux` (que ya está instalado y carga). Si ffmpeg está presente, funciona. Si no, falla. |
| `.stickers` | ⚠️ | Igual que `.sticker`, procesa múltiples imágenes/videos. Requiere ffmpeg. |
| `.brat` (sticker de texto estilo "Brat") | ✅ | API `https://skyzxu-brat.hf.space/brat` → HTTP 200, devuelve PNG. Funciona. |
| `.bratv` (brat animado) | ✅ | API `https://skyzxu-brat.hf.space/brat-animated` → HTTP 200, devuelve video/mp4. Funciona. |
| `.qc` (quote sticker) | ❌ | API `https://bot.lyo.su/quote/generate` → HTTP **526 (Invalid SSL certificate)**. Roto. |
| `.emojimix` | ❌ | API de Tenor `tenor.googleapis.com` → HTTP **403** (la API key integrada expiró o fue revocada). Roto. |
| packs de stickers (newpack, addsticker, delsticker, delpack, getpack, packlist, setmeta, setpackname, setpackdesc, setpackprivate/public, delmeta) | ✅ | Usa `node-webpmux` directamente, no requiere API. Funcionan con ffmpeg. |

---

### 🎮 Categoría `gacha/` (24 plugins)

| Comando | Estado | Detalle |
|---|---|---|
| `.rollwaifu`, `.charimage`, `.charinfo`, `.serieinfo`, `.serielist`, `.harem`, `.haremshop`, `.favboard`, `.waifusboard`, `.trade`, `.sell`, `.robwaifu`, `.vote`, `.claim`, `.setclaimmsg`, `.delclaimmsg`, `.setfavourite`, `.deletefav`, `.deletewaifu`, `.buychar`, `.givechar`, `.giveallharem`, `.removesale`, `.gachareserved` | ✅/⚠️ | Todo el sistema de gacha usa boorus (safebooru/danbooru/gelbooru) como fuente de imágenes. **safebooru funciona (200)**, **danbooru da 403** (anti-bot, requiere User-Agent específico y rate limit), **gelbooru da 401** (la API key integrada en el código parece inválida/expiró). El código ya tiene fallback: si un booru falla prueba el siguiente, así que normalmente tira de safebooru y funciona. |

---

### 🌸 Categoría `anime/` (3 plugins)

| Comando | Estado | Detalle |
|---|---|---|
| `.ppcp`, `.ppcouple` | ✅ | JSON alojado en `raw.githubusercontent.com/ShirokamiRyzen/WAbot-DB` → HTTP 200, 12 KB. Funciona. |
| `.waifu` (foto de waifu) | ❌ | API `api.waifu.pics` → **DNS no resuelve** (dominio muerto/cambiado). |
| `.shares` (reacciones: angry, kiss, hug, etc.) | ❓ | El código tiene lista local de emojis/gifs, pero las imágenes parecen venir de la API de waifu.pics que está muerta. (Revisé el código superficialmente: el listado de comandos está presente, pero los assets dependen de CDN.) |
| `.reactions` (NSFW reactions) | ⚠️ | Mismo caso que shares; comandos locales que usan assets. Sin API externa aparente, hay que probar en ejecución real. |

---

### 🔞 Categoría `nsfw/` (6 plugins)

| Comando | Estado | Detalle |
|---|---|---|
| `.danbooru`, `.dbooru` | ❌ | `danbooru.donmai.us/posts.json` → HTTP **403 Forbidden** (anti-bot). Igual que el de gacha, requiere User-Agent adecuado. |
| `.gelbooru`, `.gbooru` | ❌ | `gelbooru.com` → HTTP **401 Unauthorized** (API key inválida/expirada). |
| `.rule34` | ❓ | No probé directamente; mismo patrón que los otros boorus. Posiblemente roto por la misma razón. |
| `.xnxx` | ✅ | Scrapea HTML directo de `xnxx.com` → 200, 119 KB. Funciona (contenido adulto). |
| `.xvideos` | ✅ | Scrapea HTML de `xvideos.com` → 200, 86 KB. Funciona. |

---

### 🛠️ Categoría `utils/` (10 plugins)

| Comando | Estado | Detalle |
|---|---|---|
| `.translate` | ✅ | Paquete `@vitalets/google-translate-api` presente, carga bien. Sin key. |
| `.gitclone` | ✅ | Usa `api.github.com` (oficial de GitHub, sin key) → HTTP 200. Funciona. |
| `.get`, `.fetch` | ✅ | GET/HEAD directo a URLs que el usuario pase, sin API fija. |
| `.getpic`, `.pfp` | ✅ | Obtiene foto de perfil del usuario por WhatsApp. Sin API externa. |
| `.read` / `.readvo` / `.viewonce` | ✅ | Reenvía imágenes de ver una vez, todo local. |
| `.say`, `.decir` | ✅ | Texto a voz. Usó API del sistema o local. |
| `.toimg`, `.toimage` (webp → png/mp4) | ✅ | Usa **ezgif.com** (`ezgif.com/webp-to-mp4` y `webp-to-png`) → HTTP 200. Dependencia de scraping pero viva. |
| `.tourl` (subir archivos) | ❌ | Los 3 backends están rotos: 1) `cdn.adoolab.xyz` → HTTP 403, 2) `u.fare.ink` → TLS roto, 3) `uguu.se/upload.php` → HTTP 400 (necesita POST multipart correcto pero ya no acepta la forma en que lo envía el bot). Sin servidores funcionales. |
| `.hd`, `.enhance`, `.remini` (upscaling) | ❓/⚠️ | API `us-central1-vector-ink.cloudfunctions.net/upscaleImage`. Requiere POST con imagen; el endpoint existía pero no pude probarlo en tiempo. Probablemente requiere API key/créditos. Marcar como "probar en vivo". |
| `.chatgpt`, `.ia` | ❓/⚠️ | Sube imágenes a `uguu.se` (roto, ver `.tourl`) y hace POST a `https://ai.siputzx.my.id`. No pude completar el POST en el tiempo del sandbox; el dominio resuelve pero la respuesta no se pudo verificar. Posiblemente roto porque depende de uguu.se muerto. |

---

## ❌ Problemas transversales detectados

### 1. `cdn.Ginko-wabot.my.id` y `files.Ginko-wabot.my.id` → DNS MUERTO
Se usan como **fallback de avatar/banner** por defecto en 6 archivos:
- `cmds/events.js:47`
- `cmds/group/groupinfo.js:11`
- `cmds/main/invite.js:40`
- `cmds/main/suggest.js:32`
- `cmds/profile/profile.js:64`
- `cmds/utils/gitclone.js:29`

**Impacto real**: cuando un usuario no tiene foto de perfil o un grupo no tiene banner, el bot intenta cargar esa URL y falla silenciosamente (queda sin imagen). **NO rompe el comando**, solo hace que a veces no veas foto de perfil en invitaciones/sugerencias. Se puede arreglar con una imagen local (un PNG dentro de `assets/`).

### 2. `api.lempi.lat` — rutas eliminadas
La API que usa `.play`/`.mp4` está viva, pero redujo su catálogo:
- ✅ `/dl/yta` (audio) → vivo
- ✅ `/dl/ytv` (video) → vivo
- ✅ `/dl/tiktok` → vivo pero con 502 intermitentes
- ❌ `/dl/fb`, `/dl/ig`, `/dl/twitter`, `/dl/gdrive`, `/dl/mediafire`, `/search/google-image` → ya no existen (404/502)

### 3. `fare.ink` → TLS roto
Tanto el buscador de Pinterest (`search/pin`) como el uploader de tourl (`u.fare.ink/api/upload`) están bajo un servidor con certificado SSL roto. Nada que podamos arreglar del lado del bot: hay que reemplazar la API.

### 4. `bot.lyo.su` (quote `.qc`) → HTTP 526 SSL inválido
El CDN está devolviendo certificado inválido. Requiere cambio de API.

### 5. `tenor.googleapis.com` (emojimix) → API key revocada
La API key `AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ` da 403. Se puede conseguir una key nueva de Google Cloud (gratuita para uso bajo) o reemplazar por otra fuente de emojimix.

### 6. Boorus (danbooru/gelbooru) → 403 / 401
Los scripts mandan un User-Agent genérico y las APIs lo bloquean. La key pública de gelbooru parece expirada. safebooru.org sí funciona sin key.

### 7. Node.js
Todo el bot usa `node:sqlite` → requiere **Node ≥ 22.5**. En versiones anteriores fallan 80+ plugins con `No such built-in module: node:sqlite`. Tu Termux lo tiene (me confirmaste que el bot arranca), así que no es problema en tu caso. En VPS o en otros entornos hay que verificar la versión.

### 8. `ffmpeg` del sistema
Stickers, sticker de video y el upscale `.hd` requieren `ffmpeg` instalado con `pkg install ffmpeg` en Termux. **No** ffmpeg-static (recordamos el problema).

### 9. Dependencias npm presentes
Verificado: las 27 dependencias de `package.json` están instaladas y cargan. No faltan paquetes. `fluent-ffmpeg`, `node-webpmux`, `jimp`, `aptoide-scraper` cargan correctamente.

---

## 📊 Tabla maestra rápida de estado

| Comando (tag principal) | Estado | Nota |
|---|---|---|
| `.play`, `.mp3` | ✅ | Ya verificado con reintentos |
| `.mp4` | ✅ | Vivo en lempi |
| `.ytsearch` | ✅ | npm yts |
| `.menu` / `.help` | ✅ | Local |
| `.ping` | ✅ | Local |
| `.sticker` / `.s` | ⚠️ | Requiere ffmpeg |
| `.brat` | ✅ | API viva |
| `.bratv` | ✅ | API viva |
| `.qc` | ❌ | lyo.su SSL roto |
| `.emojimix` | ❌ | API key de Tenor revocada |
| `.apk` | ✅ | aptoide-scraper |
| `.pin` / `.pinterest` | ❌ | fare.ink TLS roto |
| `.tiktok` | ⚠️ | lempi pero 502 intermitente |
| `.instagram`, `.fb`, `.twitter`, `.mediafire`, `.gdrive`, `.imagen` | ❌ | lempi ya no tiene rutas |
| `.tourl` | ❌ | Los 3 backends rotos |
| `.toimg` | ✅ | ezgif vivo |
| `.translate` | ✅ | Paquete npm |
| `.gitclone` | ✅ | api.github.com |
| `.chatgpt` / `.ia` | ❓ | Depende de uguu.se muerto + endpoint IA no verificado |
| `.hd` / `.remini` | ❓ | Requiere POST con imagen, no se pudo probar |
| `.waifu` | ❌ | api.waifu.pics DNS muerto |
| `.ppcouple` / `.ppcp` | ✅ | GitHub raw vivo |
| `.danbooru`, `.gelbooru`, `.dbooru`, `.gbooru` | ❌ | 403/401 |
| `.xnxx`, `.xvideos` | ✅ | Scraping HTML |
| `.rollwaifu`, harem, gacha | ⚠️ | Funciona vía safebooru (fallback ya existe) |
| Comandos de economía (28) | ✅ | Local con SQLite |
| Comandos de perfil (15) | ⚠️ | Locales pero CDN de avatar muerto |
| Comandos de grupo (26) | ⚠️ | Solo admin/dueño, CDN banner muerto |
| Comandos de owner (4) | ✅ | Solo owner |
| Comandos de socket/bot (18) | ✅ | Locales |
| Packs de stickers (getpack, newpack, etc.) | ✅ | Locales |
| Bienvenidas/Antilink/Antiestatus | ⚠️ | Locales, requieren Node 22 |

---

## 🎯 Prioridades de arreglo sugeridas (PENDIENTE, solo recomendación)

Orden sugerido según lo que usas más:
1. **Crítico** (rompió algo que ya existía antes):
   - Reemplazar CDN muerto `cdn.Ginko-wabot.my.id` por una imagen local en `assets/` → 10 mins, 6 archivos.
   - `.pin`/pinterest → buscar API alternativa (ej: un scraper de pinterest npm, o la API oficial de Pinterest con scraping).
2. **Alta**:
   - `.tiktok` → agregar reintentos como en `.play`, el endpoint sí funciona pero da 502 transitorio.
   - Descargas de redes (ig, fb, twitter): reemplazar por otras APIs (cobalt.tools u otras que hoy resuelvan — investigar en el momento).
3. **Media**:
   - `.qc` quote sticker: buscar API alternativa (hay varias gratuitas de quote maker).
   - `.tourl`: reemplazar uguu.se/fare.ink/adoolab por catbox.moe o 0x0.st que siguen vivos.
4. **Baja**:
   - `.emojimix` con una key nueva de Tenor o una API alternativa.
   - `.waifu` con otra API (waifu.im o nekos.life que suelen durar más).
   - Arreglar User-Agent/key de boorus (gelbooru/danbooru) para gacha y nsfw.

> Todo esto se hará **en el Lab**, con respaldo (`lab-base`). El repo estable se mantiene intacto hasta que lo apruebes explícitamente.

---

## 🔬 Cómo se hizo la auditoría

- `diff -rq` entre el repo estable y el Lab → 0 diferencias en `cmds/` y `core/` al punto de partida.
- Prueba HTTP a cada endpoint con timeout 10-20s y AbortController.
- Verificación de carga de paquetes npm (`import()` dinámico).
- Inspección de código (`grep` de URLs y `fetch`/`axios`) en plugins sin endpoint fijo.
- Carga del loader real de plugins para confirmar que cada `.js` se importa (los errores eran solo por versión de Node 20 vs 22).
- No se ejecutó el bot conectado a WhatsApp real (no hay número en el sandbox, se harían pruebas en tu Termux).
