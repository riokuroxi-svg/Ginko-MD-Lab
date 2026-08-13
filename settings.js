import { watchFile, unwatchFile } from "fs";
import chalk from "chalk";
import { fileURLToPath } from "url";

// Pon AQUÍ tu número de teléfono como owner (solo dígitos, sin + ni espacios)
// Ejemplo: México 525574370309
global.owner = ['525574370309'];

// Créditos
global.dev = "🍁 Ginko-MD";
global.links = {
  channel: "https://whatsapp.com/channel/0029VbDVFpSGJP89hfZUe522",
  github: "https://github.com/riokuroxi-svg/Ginko-MD",
  gmail: ""
}
global.my = {
  ch1: ''
};

// APIs externas (NO CAMBIAR — son necesarias para que funcionen los comandos)
global.APIs = { 
  yuki: { url: "https://api.yuki-wabot.my.id", key: "YukiBot-MD" },
  vreden: { url: "https://api.vreden.web.id", key: null },
  ootaizumi: { url: "https://api.ootaizumi.web.id", key: null },
  delirius: { url: "https://api.delirius.store", key: null },
  zenzxz: { url: "https://api.zenzxz.my.id", key: null },
  siputzx: { url: "https://app.siputzx.my.id", key: null },
  Ginko: { url: "https://api.lempi.lat", key: "montekey28" }
};

// Nombre predeterminado del bot
global.botname = "Ginko-MD";

// Mensajes por defecto
global.mess = {
  socket: '⚠️ Este comando solo puede ser ejecutado por un sub-bot.',
  admin: '🔒 Este comando solo puede ser ejecutado por los Administradores del Grupo.',
  botAdmin: '⚠️ Necesito ser Administrador del Grupo para ejecutar este comando.'
};

let file = fileURLToPath(import.meta.url);
watchFile(file, () => {
  unwatchFile(file);
  import(`${file}?update=${Date.now()}`);
});
