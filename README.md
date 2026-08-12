<p align="center">
<img src="./assets/bocchi-banner.png" alt="Bocchi banner" width="100%"/>
</p>

<h1 align="center">🧪 Ginko-MD-Lab</h1>
<h3 align="center">Repositorio experimental — NO usar en producción</h3>

<p align="center">
<img src="https://img.shields.io/badge/status-laboratorio-9333ea?style=for-the-badge">
<img src="https://img.shields.io/badge/Base-Ginko--MD--v1.2--reintentos-e11d48?style=for-the-badge">
<img src="https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=nodedotjs">
</p>

<p align="center">
  <sub>🍁 IG: <a href="https://instagram.com/__ikg.05">@__ikg.05</a></sub>
</p>

---

## ⚠️ Aviso importante

Este repositorio es un **fork/laboratorio** de [Ginko-MD](https://github.com/riokuroxi-svg/Ginko-MD) donde se prueban nuevas características ANTES de meterlas al bot estable.

- **Si quieres el bot que sí funciona**, usa el repo principal: 👉 https://github.com/riokuroxi-svg/Ginko-MD
- Aquí se rompen cosas a propósito. Puede que los comandos no funcionen, que haya errores en consola, que se caiga a medias.
- El punto de partida (commit inicial) es exactamente **`v1.2-reintentos`** del repo estable (el .play funciona con reintentos automáticos).
- El repo original **nunca se toca** desde aquí.

---

## 🧪 Qué se está probando en este Lab

- [ ] Botones interactivos de Audio/Video después de una búsqueda de YouTube

*(Se irá actualizando según avance)*

---

## 🚀 Instalación en Termux (Android)
**Copia y pega estos comandos UNO POR UNO en Termux, no te saltes ninguno:**

#### Paso 1: Dar permiso de almacenamiento
```bash
termux-setup-storage
```
*Acepta el permiso cuando aparezca la ventana.*

#### Paso 2: Actualizar paquetes e instalar dependencias del sistema
```bash
apt update && apt upgrade -y
```

```bash
pkg install -y git nodejs-lts ffmpeg imagemagick
```
*Si te pregunta algo durante la instalación, escribe `y` y presiona ENTER.*

#### Paso 3: Clonar este repositorio (Lab)
```bash
git clone https://github.com/riokuroxi-svg/Ginko-MD-Lab.git
```

#### Paso 4: Entrar a la carpeta del bot
```bash
cd Ginko-MD-Lab
```

#### Paso 5: Instalar dependencias de Node.js
```bash
npm install --omit=optional --no-audit --no-fund
```
*Espera que termine, puede tardar de 2 a 5 minutos.*

#### Paso 6: Configurar tu número (dueño del bot)
Abre el archivo de configuración:
```bash
nano settings.js
```
Busca la línea que dice tu número de owner y cámbialo por tu número de teléfono (solo dígitos, sin `+`, sin espacios, con código de país). Por ejemplo, si eres de México es `52` seguido de tu número.

Guarda el archivo:
1. Presiona `Ctrl + O`
2. Presiona `ENTER`
3. Presiona `Ctrl + X`

#### Paso 7: Arrancar el bot por primera vez
```bash
npm start
```
- Cuando aparezca el menú de opciones, elige la opción `2` para usar código de 8 dígitos.
- Ingresa el número del bot con código de país cuando te lo pida.
- Copia el código de vinculación que aparece en pantalla y ponlo en WhatsApp:
  > Ajustes → Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono

✅ ¡Listo! El bot estará conectado.

> ⚠️ Si ya tienes el Ginko-MD estable instalado, **no vincules el mismo número de bot** en el Lab para no mezclar sesiones.

---

### ☁️ Método 2: VPS Linux (Ubuntu/Debian)
```bash
apt update && apt upgrade -y
apt install -y git nodejs npm ffmpeg imagemagick
git clone https://github.com/riokuroxi-svg/Ginko-MD-Lab.git
cd Ginko-MD-Lab
npm install --omit=optional --no-audit --no-fund
nano settings.js
npm start
```

---

### 🟢 Dejar el bot corriendo en segundo plano (PM2)
Para que no se apague cuando cierres Termux o la terminal:
```bash
npm install -g pm2
termux-wake-lock
pm2 start index.js --name ginko-lab
pm2 save
```

| Acción | Comando |
|---|---|
| Ver logs en tiempo real | `pm2 logs ginko-lab` |
| Parar el bot | `pm2 stop ginko-lab` |
| Reiniciar el bot | `pm2 restart ginko-lab` |
| Eliminar el proceso | `pm2 delete ginko-lab` |
| Ver estado | `pm2 status` |

---

## 🔄 Solución de problemas comunes

### Si se cortó internet o se apagó el bot
```bash
cd ~/Ginko-MD-Lab && npm start
```

### Volver a vincular de cero
```bash
cd ~/Ginko-MD-Lab
rm -rf Sessions/Owner
npm start
```

### Error de dependencias rotas
```bash
cd ~/Ginko-MD-Lab
rm -rf node_modules package-lock.json
npm install --omit=optional --no-audit --no-fund
```

### Volver al punto base (deshacer todos los experimentos)
```bash
cd ~/Ginko-MD-Lab
git reset --hard lab-base
npm install
npm start
```

---

## 📝 Prefijo y comandos básicos
El prefijo por defecto es el **punto** (`.`). Comandos que funcionan desde el día 1:

| Comando | Qué hace |
|---|---|
| `.play <canción>` | Descarga música de YouTube (con reintentos) |
| `.mp4 <video>` | Descarga video de YouTube |
| `.menu` | Lista completa de comandos |
| `.sticker` | Convierte imagen/video en sticker al responderla |
| `.ping` | Velocidad de respuesta |

---

---

## 🔄 Volver a un punto seguro

```bash
git reset --hard lab-base   # estado inicial idéntico a v1.2-reintentos
npm install
npm start
```

---

## 📁 Relación con el repo principal

| Repo | URL | Estado | Uso |
|---|---|---|---|
| Ginko-MD | https://github.com/riokuroxi-svg/Ginko-MD | ✅ Estable | Día a día |
| Ginko-MD-Lab | https://github.com/riokuroxi-svg/Ginko-MD-Lab | 🧪 Experimental | Pruebas |

El commit inicial de este Lab está tageado como `lab-base` y coincide exactamente con `v1.2-reintentos` del repo estable. Cualquier experimento nuevo va en commits posteriores.

---

<p align="center">
  <sub>🧪 Ginko-MD-Lab — 2026</sub>
</p>
