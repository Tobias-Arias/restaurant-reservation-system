/**
 * Punto de entrada del backend cuando corre como Serverless Function en Vercel.
 *
 * Vercel detecta cualquier archivo dentro de `/api` y lo expone como función.
 * Este archivo simplemente reexporta la app de Express: toda la lógica sigue
 * viviendo en `app.js`, que es el mismo que se usa en `node server.js`.
 *
 * Rutas expuestas por Vercel:  /api/mesas/disponibles  ->  /api
 *
 * Razón de la carpeta: `backend/api/index.js` + `backend/vercel.json` traducen
 * la app de Express a una función serverless sin duplicar una línea de lógica.
 */

module.exports = require('../app.js');
