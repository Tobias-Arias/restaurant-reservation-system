/**
 * Error de aplicación con código HTTP asociado.
 *
 * Se usa para diferenciar los errores "previstos" (validación, permisos,
 * no encontrado) de los errores inesperados: sólo los primeros se envían
 * al cliente con su mensaje real; los segundos se sustituyen por un
 * mensaje genérico para no filtrar información interna.
 */
class HttpError extends Error {
  /**
   * @param {number} status  Código HTTP (400, 401, 403, 404, 409, 422, 500).
   * @param {string} message Mensaje en español, apta para mostrar al usuario.
   * @param {object} [detalles] Información adicional opcional.
   */
  constructor(status, message, detalles = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.detalles = detalles;
    this.esEsperado = true;
    Error.captureStackTrace?.(this, HttpError);
  }

  static badRequest(message = 'La solicitud contiene datos inválidos.', detalles) {
    return new HttpError(400, message, detalles);
  }

  static noAutorizado(message = 'Debes iniciar sesión para continuar.') {
    return new HttpError(401, message);
  }

  static prohibido(message = 'No tienes permisos para realizar esta acción.') {
    return new HttpError(403, message);
  }

  static noEncontrado(message = 'El recurso solicitado no existe.') {
    return new HttpError(404, message);
  }

  static conflicto(message = 'La operación entra en conflicto con el estado actual.') {
    return new HttpError(409, message);
  }

  static noProcesable(message = 'No se pudo procesar la solicitud.', detalles) {
    return new HttpError(422, message, detalles);
  }
}

module.exports = HttpError;
