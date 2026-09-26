/**
 * GestiÃ³n de reservas (administrador).
 * Ruta: /admin/reservas
 *
 * Tabla con filtros por fecha y estado, y acciones Ver / Editar / Confirmar /
 * Cancelar / Completar. Cada acciÃ³n pasa por la API: el backend vuelve a
 * validar el estado y los permisos.
 */

import { useCallback, useEffect, useState } from 'react';
import { clienteApi, mesaApi, reservaApi } from '../services/api';
import { ESTADOS_RESERVA, fechaLarga, hora, numero } from '../utils/format';
import { obtenerDuracion, obtenerSlots } from '../utils/horarios';
import { fechaDesplazada, sinErrores, validarReserva } from '../utils/validation';
import Button from '../components/Button';
import Card from '../components/Card';
import Table from '../components/Table';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalAcciones } from '../components/Modal';
import Input, { Select } from '../components/Input';
import ErrorMessage from '../components/ErrorMessage';
import SuccessMessage from '../components/SuccessMessage';

/** Acciones disponibles segÃºn el estado actual de la reserva. */
const ACCIONES = {
  pendiente: ['ver', 'editar', 'confirmar', 'cancelar'],
  confirmada: ['ver', 'editar', 'completar', 'cancelar'],
  completada: ['ver'],
  cancelada: ['ver'],
};

const FILTROS_ESTADO = [
  { valor: '', etiqueta: 'Todos los estados' },
  ...Object.entries(ESTADOS_RESERVA).map(([valor, cfg]) => ({ valor, etiqueta: cfg.etiqueta })),
];

const ACCION_MENSAJE = {
  confirmar: 'confirmada',
  cancelar: 'cancelada',
  completar: 'completada',
};

const TITULO_ACCION = {
  confirmar: 'Confirmar reserva',
  cancelar: 'Cancelar reserva',
  completar: 'Completar reserva',
};

export default function AdminReservas() {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState('');

  const [filtros, setFiltros] = useState({ fecha: fechaDesplazada(0), estado: '', clienteId: '' });
  const [clientes, setClientes] = useState([]);
  const [mesas, setMesas] = useState([]);

  const [detalle, setDetalle] = useState(null);
  const [aConfirmar, setAConfirmar] = useState(null);
  const [editando, setEditando] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  const slots = obtenerSlots();
  const duracion = obtenerDuracion();

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await reservaApi.listar({
        fecha: filtros.fecha,
        estado: filtros.estado,
        clienteId: filtros.clienteId,
        limite: 200,
      });
      setReservas(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    Promise.all([clienteApi.listar({ limite: 200 }), mesaApi.listar()])
      .then(([c, m]) => {
        setClientes(c.data);
        setMesas(m.data);
      })
      .catch(() => {
        // Los filtros son auxiliares: si fallan, la tabla sigue funcionando.
      });
  }, []);

  // ------------------------------------------------------------- acciones
  async function transicion(reserva, accion) {
    setProcesando(true);
    setErrorAccion(null);
    try {
      const metodos = { confirmar: reservaApi.confirmar, cancelar: reservaApi.cancelar, completar: reservaApi.completar };
      const { data } = await metodos[accion](reserva.id);
      setReservas((anteriores) => anteriores.map((r) => (r.id === data.id ? data : r)));
      setAConfirmar(null);
      setExito(`Reserva ${data.codigo}: ${ACCION_MENSAJE[accion]}.`);
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    const validacion = validarReserva({ ...editando.reserva, slotsValidos: slots });
    setEditando((anterior) => ({ ...anterior, errores: validacion }));
    if (!sinErrores(validacion)) return;

    setProcesando(true);
    setErrorAccion(null);
    try {
      const { data } = await reservaApi.actualizar(editando.reserva.id, {
        fecha: editando.reserva.fecha,
        hora: editando.reserva.hora,
        personas: Number(editando.reserva.personas),
        mesaId: Number(editando.reserva.mesaId),
        observaciones: editando.reserva.observaciones,
      });
      setReservas((anteriores) => anteriores.map((r) => (r.id === data.id ? data : r)));
      setEditando(null);
      setExito(`Reserva ${data.codigo} actualizada.`);
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  const columnas = [
    {
      clave: 'codigo',
      titulo: 'N.Âº',
      render: (r) => <strong>{r.codigo}</strong>,
    },
    {
      clave: 'cliente',
      titulo: 'Cliente',
      render: (r) => (
        <div className="tabla__principal">
          <strong>{r.cliente.nombreCompleto}</strong>
          <span className="tabla__nota">{r.cliente.email}</span>
        </div>
      ),
    },
    {
      clave: 'fecha',
      titulo: 'Fecha',
      render: (r) => (
        <div className="tabla__principal">
          <span>{r.fecha.split('-').reverse().join('/')}</span>
          <span className="tabla__nota">{hora(r.hora)}</span>
        </div>
      ),
    },
    {
      clave: 'mesa',
      titulo: 'Mesa',
      render: (r) => `N.Âº ${r.mesa.numero} (${r.mesa.capacidad})`,
    },
    {
      clave: 'personas',
      titulo: 'Personas',
      alinear: 'center',
      render: (r) => numero(r.personas),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (r) => <StatusBadge estado={r.estado} />,
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (r) => (
        <div className="tabla__acciones">
          {ACCIONES[r.estado]?.includes('ver') && (
            <button type="button" className="link" onClick={() => setDetalle(r)}>
              Ver
            </button>
          )}
          {ACCIONES[r.estado]?.includes('editar') && (
            <button type="button" className="link" onClick={() => setEditando({ reserva: { ...r }, errores: {} })}>
              Editar
            </button>
          )}
          {ACCIONES[r.estado]?.includes('confirmar') && (
            <button type="button" className="link link--exito" onClick={() => { setErrorAccion(null); setAConfirmar({ ...r, accion: 'confirmar' }); }}>
              Confirmar
            </button>
          )}
          {ACCIONES[r.estado]?.includes('completar') && (
            <button type="button" className="link" onClick={() => { setErrorAccion(null); setAConfirmar({ ...r, accion: 'completar' }); }}>
              Completar
            </button>
          )}
          {ACCIONES[r.estado]?.includes('cancelar') && (
            <button type="button" className="link link--peligro" onClick={() => { setErrorAccion(null); setAConfirmar({ ...r, accion: 'cancelar' }); }}>
              Cancelar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="admin-reservas">
      <header className="admin-pagina__cabecera">
        <div>
          <h1 className="admin-pagina__titulo">Reservas</h1>
          <p className="admin-pagina__bajada">
            {cargando ? 'Cargando...' : `${reservas.length} reserva(s) para los filtros aplicados`}
          </p>
        </div>
        <Button variante="secundario" onClick={cargar} disabled={cargando}>
          Actualizar
        </Button>
      </header>

      <SuccessMessage mensaje={exito} onCerrar={() => setExito('')} autoCerrar={6000} />
      <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />

      {/* -------------------------------------------------------- FILTROS */}
      <Card titulo="Filtros" sinPadding>
        <div className="admin-filtros">
          <Input
            label="Fecha"
            name="filtroFecha"
            type="date"
            value={filtros.fecha}
            onChange={(e) => setFiltros((a) => ({ ...a, fecha: e.target.value }))}
            ayuda="Dejalo vacÃ­o para ver todas las fechas."
          />
          <Select
            label="Estado"
            name="filtroEstado"
            value={filtros.estado}
            onChange={(e) => setFiltros((a) => ({ ...a, estado: e.target.value }))}
            opciones={FILTROS_ESTADO}
            placeholder="Todos los estados"
          />
          <Select
            label="Cliente"
            name="filtroCliente"
            value={filtros.clienteId}
            onChange={(e) => setFiltros((a) => ({ ...a, clienteId: e.target.value }))}
            opciones={clientes.map((c) => ({ valor: c.id, etiqueta: c.nombreCompleto }))}
            placeholder="Todos los clientes"
          />
          <div className="admin-filtros__acciones">
            <Button
              variante="fantasma"
              onClick={() => setFiltros({ fecha: '', estado: '', clienteId: '' })}
              disabled={!filtros.fecha && !filtros.estado && !filtros.clienteId}
            >
              Limpiar
            </Button>
          </div>
        </div>
      </Card>

      <Card sinPadding>
        <ErrorMessage mensaje={error} titulo="No pudimos cargar las reservas" onReintentar={cargar} />
        <Table
          columnas={columnas}
          filas={reservas}
          cargando={cargando}
          claveFila={(r) => r.id}
          mensajeVacio="No hay reservas para los filtros seleccionados."
        />
      </Card>

      {/* ------------------------------------------------- MODAL DETALLE */}
      <Modal
        abierto={Boolean(detalle)}
        onCerrar={() => setDetalle(null)}
        titulo={`Reserva ${detalle?.codigo ?? ''}`}
        descripcion={detalle ? fechaLarga(detalle.fecha) : ''}
        pie={<ModalAcciones onCancelar={() => setDetalle(null)} onConfirmar={() => setDetalle(null)} textoConfirmar="Cerrar" />}
      >
        {detalle && (
          <dl className="detalle">
            <div>
              <dt>Estado</dt>
              <dd><StatusBadge estado={detalle.estado} /></dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd>
                {detalle.cliente.nombreCompleto}
                <span className="detalle__nota">{detalle.cliente.email}</span>
                <span className="detalle__nota">{detalle.cliente.telefono ?? 'Sin telÃ©fono'}</span>
              </dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>
                {detalle.fecha.split('-').reverse().join('/')} Â· {hora(detalle.hora)}
                <span className="detalle__nota">OcupaciÃ³n de {duracion} minutos</span>
              </dd>
            </div>
            <div>
              <dt>Mesa</dt>
              <dd>
                N.Âº {detalle.mesa.numero} Â· {detalle.mesa.capacidad} lugares Â· {detalle.mesa.ubicacion}
              </dd>
            </div>
            <div>
              <dt>Personas</dt>
              <dd>{detalle.personas}</dd>
            </div>
            <div>
              <dt>Observaciones</dt>
              <dd>{detalle.observaciones || 'Sin observaciones'}</dd>
            </div>
          </dl>
        )}
      </Modal>

      {/* --------------------------------------------- CONFIRMAR ACCIÃ“N */}
      <Modal
        abierto={Boolean(aConfirmar)}
        onCerrar={() => setAConfirmar(null)}
        titulo={TITULO_ACCION[aConfirmar?.accion] ?? 'Confirmar acciÃ³n'}
        descripcion="RevisÃ¡ los datos antes de continuar."
        pie={
          <ModalAcciones
            onCancelar={() => setAConfirmar(null)}
            onConfirmar={() => transicion(aConfirmar, aConfirmar.accion)}
            textoConfirmar={TITULO_ACCION[aConfirmar?.accion] ?? 'Confirmar'}
            cargando={procesando}
          />
        }
      >
        {aConfirmar && (
          <div className="modal__texto">
            <p>
              Reserva <strong>{aConfirmar.codigo}</strong> Â· {aConfirmar.fecha.split('-').reverse().join('/')} Â·{' '}
              {hora(aConfirmar.hora)} Â· Mesa N.Âº {aConfirmar.mesa.numero} Â· {aConfirmar.cliente.nombreCompleto}
            </p>
            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </div>
        )}
      </Modal>

      {/* --------------------------------------------------- MODAL EDITAR */}
      <Modal
        abierto={Boolean(editando)}
        onCerrar={() => setEditando(null)}
        titulo={`Editar reserva ${editando?.reserva?.codigo ?? ''}`}
        descripcion="Al cambiar fecha, hora o mesa se vuelve a comprobar que no haya superposiciÃ³n."
        pie={
          <ModalAcciones
            onCancelar={() => setEditando(null)}
            onConfirmar={guardarEdicion}
            textoConfirmar="Guardar cambios"
            cargando={procesando}
          />
        }
      >
        {editando && (
          <form className="formulario" onSubmit={guardarEdicion} noValidate>
            <div className="formulario__fila">
              <Input
                label="Fecha"
                name="editFecha"
                type="date"
                value={editando.reserva.fecha}
                onChange={(e) =>
                  setEditando((a) => ({ ...a, reserva: { ...a.reserva, fecha: e.target.value } }))
                }
                error={editando.errores?.fecha}
              />
              <Select
                label="Hora"
                name="editHora"
                value={editando.reserva.hora}
                onChange={(e) =>
                  setEditando((a) => ({ ...a, reserva: { ...a.reserva, hora: e.target.value } }))
                }
                error={editando.errores?.hora}
                ayuda={slots.join(' Â· ')}
                placeholder="Seleccionar horario"
                opciones={slots.map((slot) => ({ valor: slot, etiqueta: slot }))}
              />
            </div>

            <div className="formulario__fila">
              <Select
                label="Mesa"
                name="editMesa"
                value={editando.reserva.mesaId}
                onChange={(e) =>
                  setEditando((a) => ({ ...a, reserva: { ...a.reserva, mesaId: e.target.value } }))
                }
                opciones={mesas.map((m) => ({ valor: m.id, etiqueta: `Mesa ${m.numero} (${m.capacidad} pers.)` }))}
                placeholder="Seleccionar mesa"
                error={editando.errores?.mesaId}
              />
              <Input
                label="Personas"
                name="editPersonas"
                type="number"
                min={1}
                max={40}
                value={editando.reserva.personas}
                onChange={(e) =>
                  setEditando((a) => ({ ...a, reserva: { ...a.reserva, personas: e.target.value } }))
                }
                error={editando.errores?.personas}
              />
            </div>

            <Input
              label="Observaciones"
              name="editObservaciones"
              rows={3}
              value={editando.reserva.observaciones ?? ''}
              onChange={(e) =>
                setEditando((a) => ({ ...a, reserva: { ...a.reserva, observaciones: e.target.value } }))
              }
            />

            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </form>
        )}
      </Modal>
    </div>
  );
}
