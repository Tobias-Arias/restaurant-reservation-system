/**
 * Respuestas HTTP uniformes para toda la API.
 *
 *   Éxito -> { success: true,  data: ... , meta?: ... }
 *   Error -> { success: false, message: "...", detalles?: ... }
 *
 * Centralizar esto evita que cada controlador invente su propio formato.
 */

const ok = (res, data, { status = 200, meta } = {}) => {
  const cuerpo = { success: true, data };
  if (meta) cuerpo.meta = meta;
  return res.status(status).json(cuerpo);
};

const creado = (res, data, opciones = {}) => ok(res, data, { ...opciones, status: 201 });

const sinContenido = (res) => res.status(204).json({ success: true, data: null });

module.exports = { ok, creado, sinContenido };
