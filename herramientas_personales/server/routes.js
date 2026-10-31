const { Router } = require('express');
const { login: adminLogin, requireAdmin } = require('./adminAuth');
const { obtenerHojas, guardarActual, leerActual } = require('./googleSheets');

const router = Router();

router.get('/salud', (_req, res) => res.json({ ok: true }));

// --- Panel de administración: login ---
router.post('/admin/login', adminLogin);

// --- Panel de administración: datos en vivo desde el Google Sheet de Prisma ---
// Trae TODAS las hojas de la planilla tal cual están, sin asumir su
// estructura — es para tener los datos a mano para un futuro estudio del
// negocio, no un reporte con un formato fijo todavía. Reemplaza a la carga
// manual de un archivo Excel: ahora se actualiza con un botón, en vivo.
router.post('/admin/sheet/actualizar', requireAdmin, async (_req, res) => {
  try {
    const datos = await obtenerHojas();
    const registro = guardarActual(datos);
    res.json({
      actualizadoEn: registro.actualizadoEn,
      hojas: registro.hojas.map((h) => ({ nombre: h.nombre, totalFilas: h.totalFilas, totalColumnas: h.totalColumnas })),
    });
  } catch (err) {
    console.error('[admin/sheet/actualizar] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo leer la planilla de Google Sheets.' });
  }
});

router.get('/admin/sheet/actual', requireAdmin, (_req, res) => {
  const registro = leerActual();
  if (!registro) return res.status(404).json({ error: 'Todavía no se trajeron datos del Sheet.' });
  res.json(registro);
});

module.exports = { router };
