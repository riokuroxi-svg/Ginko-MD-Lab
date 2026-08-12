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

## 🚀 Instalación en Termux

Es EXACTAMENTE la misma que el repo principal, solo cambia la URL del clon:

```bash
termux-setup-storage
apt update && apt upgrade -y
pkg install -y git nodejs-lts ffmpeg imagemagick
git clone https://github.com/riokuroxi-svg/Ginko-MD-Lab.git
cd Ginko-MD-Lab
npm install --omit=optional --no-audit --no-fund
nano settings.js       # cambia el número owner por el tuyo
npm start
```

> Si ya tienes el Ginko-MD estable instalado, **NO uses el mismo número de bot** para probar el Lab para no mezclar sesiones.

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
