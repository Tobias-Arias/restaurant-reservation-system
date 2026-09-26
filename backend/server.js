/**
 * Punto de entrada del backend.
 *
 * Responsabilidades:
 *   - verificar que la configuración de horarios del backend coincide con la
 *     de la base de datos (evita que la regla de no solapamiento difiera),
 *   - comprobar que Supabase responde,
 *   - abrir el puerto HTTP,
 *   - cerrar limpiamente ante Ctrl+C.
 */

const app = require('./app');
const config = require('./config');
const db = require('./database/supabase');
const { verificarCoherenciaHorarios } = require('./utils/validators');
const { obtenerTurnos, HORARIOS } = require('./config/horarios');

async function comprobarDependencias() {
  await verificarCoherenciaHorarios();

  const { data, error } = await db.admin.rpc('fn_duracion_reserva');
  if (error) {
    throw new Error(
      'No se pudo conectar con Supabase. Revisá SUPABASE_URL y las claves en backend/.env, ' +
        'y ejecutá database/schema.sql en el proyecto de Supabase.'
    );
  }
  console.log(`[supabase] conexión OK. Duración de reserva en la BD: ${data} minutos.`);
}

async function iniciar() {
  console.log('');
  console.log('  ============================================================');
  console.log(`   ${config.restaurante.nombre} · API de reservas`);
  console.log('  ============================================================');
  console.log(`   Entorno ....... ${config.env}`);
  console.log(`   Puerto ........ ${config.port}`);
  console.log(`   Reserva ....... ${HORARIOS.duracionMinutos} minutos por mesa`);
  console.log(
    `   Turnos ........ ${obtenerTurnos()
      .map((t) => `${t.turno} ${t.inicio}-${t.fin} (${t.slots.join(', ')})`)
      .join('  |  ')}`
  );
  console.log(`   CORS .......... ${config.corsOrigins.join(', ')}`);
  console.log('  --------------------------------------------------------');

  try {
    await comprobarDependencias();
  } catch (error) {
    console.error(`\n[arranque] ${error.message}\n`);
    process.exit(1);
  }

  const servidor = app.listen(config.port, () => {
    console.log(`\n  API disponible en  http://localhost:${config.port}/api`);
    console.log(`  Health check en  http://localhost:${config.port}/api/health\n`);
  });

  const apagar = (senal) => {
    console.log(`\n[servidor] ${senal} recibido, cerrando...`);
    servidor.close(() => process.exit(0));
    // Si alguna conexión se queda colgada, se fuerza la salida.
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));

  process.on('unhandledRejection', (motivo) => {
    console.error('[servidor] promesa rechazada sin capturar:', motivo);
  });
}

iniciar();
