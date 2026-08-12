/**
 * Devuelve la imagen de avatar por defecto como Buffer,
 * para usar cuando WhatsApp no tiene foto de perfil del usuario/grupo.
 * Reemplaza el CDN muerto "cdn.Ginko-wabot.my.id".
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const _dirname = dirname(fileURLToPath(import.meta.url));
const avatarPath = join(_dirname, '..', 'assets', 'avatar-default.png');

let _cachedBuffer = null;

export function defaultAvatar() {
  if (_cachedBuffer) return _cachedBuffer;
  try {
    _cachedBuffer = readFileSync(avatarPath);
  } catch {
    // Si por alguna razón el archivo no existe, devolvemos null y el
    // llamador puede omitir la imagen (mejor que un crash).
    return null;
  }
  return _cachedBuffer;
}

export default defaultAvatar;
