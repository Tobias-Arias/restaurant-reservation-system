/**
 * GestiÃ³n de mesas (administrador).
 * Ruta: /admin/mesas
 *
 * Crear, editar, cambiar estado y eliminar. El backend impide eliminar una
 * mesa con reservas sin resolver y devuelve un 409 explicativo; aquÃ­ se
 * muestra ese mensaje tal cual.
 */

import { useCallback, useEffect, useState } from 'react';
import { mesaApi } from '../services/api';
import { ESTADOS_MESA, UBICACIONES, hora, numero, ubicacion as textoUbicacion } from '../utils/format';
import { obtenerSlots } from '../utils/horarios';
import { sinErrores, validarMesa } from '../utils/validation';
import Button from '../components/Button';
import Card from '../components/Card';
import MesaCard from '../components/MesaCard';
import Modal, { ModalAcciones } from '../components/Modal';
import Input, { Select } from '../components/Input';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import SuccessMessage from '../components/SuccessMessage';
import EmptyState from '../components/EmptyState';

const MESA_VACIA = { id: null, numero: '', capacidad: '', ubicacion: 'interior', estado: 'disponible' };

export default function AdminMesas() {
  const [mesas, setMesas] = useState([]);
  const [salon, setSalon] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState('');

  const [editando, setEditando] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  const [slot, setSlot] = useState(obtenerSlots()[1] ?? '19:30');
  const slots = obtenerSlots();

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [lista, estado] = await Promise.all([mesaApi.listar(), mesaApi.estadoSalon({ hora: slot })]);
      setMesas(lista.data);
      setSalon(estado.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [slot]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ocupadas = salon.filter((f) => f.ocupada).length;

  async function guardar(evento) {
    evento.preventDefault();

    const validacion = validarMesa(editando.mesa);
    setEditando((anterior) => ({ ...anterior, errores: validacion }));
    if (!sinErrores(validacion)) return;

    setProcesando(true);
    setErrorAccion(null);
    try {
      const cuerpo = {
        numero: Number(editando.mesa.numero),
        capacidad: Number(editando.mesa.capacidad),
        ubicacion: editando.mesa.ubicacion,
        estado: editando.mesa.estado,
      };
      const { data } = editando.mesa.id
        ? await mesaApi.actualizar(editando.mesa.id, cuerpo)
        : await mesaApi.crear(cuerpo);

      setMesas((anteriores) =>
        editando.mesa.id
          ? anteriores.map((m) => (m.id === data.id ? data : m))
          : [...anteriores, data].sort((a, b) => a.numero - b.numero)
      );
      setExito(editando.mesa.id ? `Mesa ${data.numero} actualizada.` : `Mesa ${data.numero} creada.`);
      setEditando(null);
      cargar();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEstado(mesa) {
    setProcesando(true);
    setErrorAccion(null);
    try {
      const destino = mesa.estado === 'disponible' ? 'mantenimiento' : 'disponible';
      const { data } = await mesaApi.actualizar(mesa.id, { estado: destino });
      setMesas((anteriores) => anteriores.map((m) => (m.id === data.id ? data : m)));
      setExito(`Mesa ${data.numero} ahora estÃ¡ en estado ${ESTADOS_MESA[data.estado].etiqueta.toLowerCase()}.`);
      cargar();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function eliminar() {
    setProcesando(true);
    setErrorAccion(null);
    try {
      const { data } = await mesaApi.eliminar(aEliminar.id);
      setMesas((anteriores) => anteriores.filter((m) => m.id !== data.id));
      setExito(data.mensaje);
      setAEliminar(null);
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="admin-mesas">
      <header className="admin-pagina__cabecera">
        <div>
          <h1 className="admin-pagina__titulo">Mesas</h1>
          <p className="admin-pagina__bajada">
            {mesas.length} mesa(s) Â· {ocupadas} ocupada(s) a las {hora(slot)}
          </p>
        </div>
        <div className="admin-pagina__acciones">
          <Select
            label="Ver salÃ³n a las"
            name="slot"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            opciones={slots.map((s) => ({ valor: s, etiqueta: s }))}
            placeholder="Horario"
          />
          <Button onClick={() => { setEditando({ mesa: { ...MESA_VACIA }, errores: {} }); setErrorAccion(null); }}>
            Crear mesa
          </Button>
        </div>
      </header>

      <SuccessMessage mensaje={exito} onCerrar={() => setExito('')} autoCerrar={6000} />
      <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
      <ErrorMessage mensaje={error} titulo="No pudimos cargar las mesas" onReintentar={cargar} />

      {cargando && <Loading texto="Cargando mesas..." variante="esqueleto" filas={6} />}

      {!cargando && mesas.length === 0 && (
        <EmptyState
          icono="ðŸª‘"
          titulo="No hay mesas cargadas"
          descripcion="Crea la primera mesa para empezar a recibir reservas."
          accion={<Button onClick={() => setEditando({ mesa: { ...MESA_VACIA }, errores: {} })}>Crear mesa</Button>}
        />
      )}

      {!cargando && mesas.length > 0 && (
        <>
          <Card titulo="Inventario" subtitulo="Todas las mesas del restaurante">
            <div className="admin-mesas__rejilla">
              {mesas.map((mesa) => {
                const enSalon = salon.find((f) => f.mesaId === mesa.id);
                return (
                  <MesaCard
                    key={mesa.id}
                    mesa={{ ...mesa, reserva: enSalon?.ocupada ? enSalon.reserva : null }}
                    onEditar={() => { setEditando({ mesa: { ...mesa }, errores: {} }); setErrorAccion(null); }}
                    onCambiarEstado={() => cambiarEstado(mesa)}
                    pie={
                      <Button
                        variante="fantasma"
                        tamano="pequeno"
                        onClick={() => { setAEliminar(mesa); setErrorAccion(null); }}
                      >
                        Eliminar
                      </Button>
                    }
                  />
                );
              })}
            </div>
          </Card>

          <Card titulo={`Estado del salÃ³n Â· ${hora(slot)}`} subtitulo={`${ocupadas} de ${salon.length} mesas ocupadas`}>
            <div className="admin-mesas__salon">
              {salon.map((fila) => (
                <div
                  key={fila.mesaId}
                  className={`admin-mesas__salon-item ${fila.ocupada ? 'is-ocupada' : 'is-libre'}`}
                  title={fila.ocupada ? `Reserva ${fila.reserva.codigo}` : 'Mesa libre'}
                >
                  <strong>{fila.numero}</strong>
                  <span>{fila.ocupada ? hora(fila.reserva.hora) : 'Libre'}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* -------------------------------------------------- MODAL EDITAR */}
      <Modal
        abierto={Boolean(editando)}
        onCerrar={() => setEditando(null)}
        titulo={editando?.mesa?.id ? `Editar mesa ${editando.mesa.numero}` : 'Crear nueva mesa'}
        descripcion="El nÃºmero de mesa es Ãºnico en todo el restaurante."
        pie={
          <ModalAcciones
            onCancelar={() => setEditando(null)}
            onConfirmar={guardar}
            textoConfirmar={editando?.mesa?.id ? 'Guardar cambios' : 'Crear mesa'}
            cargando={procesando}
          />
        }
      >
        {editando && (
          <form className="formulario" onSubmit={guardar} noValidate>
            <div className="formulario__fila">
              <Input
                label="NÃºmero"
                name="numero"
                type="number"
                min={1}
                max={999}
                value={editando.mesa.numero}
                onChange={(e) =>
                  setEditando((a) => ({ ...a, mesa: { ...a.mesa, numero: e.target.value } }))
                }
                error={editando.errores?.numero}
                requerido
              />
              <Input
                label="Capacidad"
                name="capacidad"
                type="number"
                min={1}
                max={40}
                value={editando.mesa.capacidad}
                onChange={(e) =>
                  setEditando((a) => ({ ...a, mesa: { ...a.mesa, capacidad: e.target.value } }))
                }
                error={editando.errores?.capacidad}
                ayuda="Lugares disponibles."
                requerido
              />
            </div>

            <div className="formulario__fila">
              <Select
                label="UbicaciÃ³n"
                name="ubicacion"
                value={editando.mesa.ubicacion}
                onChange={(e) =>
                  setEditando((a) => ({ ...a, mesa: { ...a.mesa, ubicacion: e.target.value } }))
                }
                opciones={Object.entries(UBICACIONES).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
                placeholder="Seleccionar ubicaciÃ³n"
              />
              <Select
                label="Estado"
                name="estado"
                value={editando.mesa.estado}
                onChange={(e) => setEditando((a) => ({ ...a, mesa: { ...a.mesa, estado: e.target.value } }))}
                opciones={Object.entries(ESTADOS_MESA).map(([valor, cfg]) => ({ valor, etiqueta: cfg.etiqueta }))}
                placeholder="Seleccionar estado"
                ayuda="Las mesas en mantenimiento no admiten reservas."
              />
            </div>

            <p className="modal__nota">
              {textoUbicacion(editando.mesa.ubicacion)} Â· {numero(editando.mesa.capacidad || 0)} lugares
            </p>
            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </form>
        )}
      </Modal>

      {/* ------------------------------------------------- MODAL BORRAR */}
      <Modal
        abierto={Boolean(aEliminar)}
        onCerrar={() => setAEliminar(null)}
        titulo="Eliminar mesa"
        descripcion="Esta acciÃ³n no se puede deshacer."
        tamano="chico"
        pie={
          <ModalAcciones
            onCancelar={() => setAEliminar(null)}
            onConfirmar={eliminar}
            textoConfirmar="SÃ­, eliminar"
            cargando={procesando}
          />
        }
      >
        {aEliminar && (
          <div className="modal__texto">
            <p>
              Â¿ConfirmÃ¡s que querÃ©s eliminar la <strong>mesa {aEliminar.numero}</strong> ({aEliminar.capacidad}{' '}
              lugares, {textoUbicacion(aEliminar.ubicacion)})?
            </p>
            <p className="modal__nota">
              Si tiene reservas pendientes o confirmadas, el sistema la va a proteger y no la va a
              dejar eliminar.
            </p>
            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
