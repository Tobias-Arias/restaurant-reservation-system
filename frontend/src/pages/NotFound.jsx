/**
 * Página 404.
 * Ruta: *
 */

import Button from '../components/Button';

export default function NotFound() {
  return (
    <div className="no-encontrado">
      <p className="no-encontrado__codigo">404</p>
      <h1 className="no-encontrado__titulo">No encontramos esta página</h1>
      <p className="no-encontrado__texto">
        El enlace que seguiste no existe o fue movido. Volvé al inicio para seguir navegando.
      </p>
      <div className="no-encontrado__acciones">
        <Button a="/">Ir al inicio</Button>
        <Button variante="secundario" a="/menu">
          Ver el menú
        </Button>
      </div>
    </div>
  );
}
