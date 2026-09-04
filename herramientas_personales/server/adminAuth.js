const { createHmac, timingSafeEqual } = require('node:crypto');

/**
 * Mismo esquema que el panel de admin de prisma_2: una sola contraseña
 * compartida (ADMIN_PASSWORD) que se cambia por un token firmado con
 * vencimiento, para no mandar la contraseña en cada pedido. Se repite acá
 * (en vez de compartir código entre los dos proyectos, que ni siquiera están
 * en el mismo repo) porque esta parte del panel — la carga del Excel — vive
 * enteramente en este servidor, sin tocar la base de prisma_2.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24hs

function secreto() {
  return process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || '';
}

function firmarToken(expiraEn) {
  const payload = String(expiraEn);
  const firma = createHmac('sha256', secreto()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${firma}`).toString('base64url');
}

function tokenValido(token) {
  try {
    const decodificado = Buffer.from(token, 'base64url').toString('utf8');
    const [payload, firma] = decodificado.split('.');
    if (!payload || !firma) return false;

    const firmaEsperada = createHmac('sha256', secreto()).update(payload).digest('hex');
    const a = Buffer.from(firma);
    const b = Buffer.from(firmaEsperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

    const expiraEn = Number(payload);
    return Number.isFinite(expiraEn) && Date.now() < expiraEn;
  } catch {
    return false;
  }
}

function login(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: 'El servidor no tiene configurada ADMIN_PASSWORD.' });
  }

  const { password } = req.body ?? {};
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Falta la contraseña.' });
  }

  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  const coincide = a.length === b.length && timingSafeEqual(a, b);
  if (!coincide) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  const expiraEn = Date.now() + TOKEN_TTL_MS;
  res.json({ token: firmarToken(expiraEn), expiraEn });
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  if (!token || !tokenValido(token)) {
    return res.status(401).json({ error: 'Sesión inválida o vencida. Volvé a iniciar sesión.' });
  }
  next();
}

module.exports = { login, requireAdmin };
