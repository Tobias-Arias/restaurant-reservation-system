/**
 * GestiÃ³n de clientes (administrador).
 * Ruta: /admin/clientes
 *
 * Lista, alta, ediciÃ³n, baja y consulta del historial de reservas de cada
 * cliente. Todas las rutas requieren rol admin en el backend.
 */

import { useCallback, useEffect, useState } from 'react';
import { clienteApi } from '../services/api';
import { fechaNumerica, hora, numero } from '../utils/format';
import { nombre as validarNombre, email as validarEmail, sinErrores } from '../utils/validation';
import Button from '../components/Button';
import Card from '../components/Card';
import Table from '../components/Table';
import StatusBadge from '../components/StatusBadge';
import Modal, { ModalAcciones } from '../components/Modal';
import Input from '../components/Input';
import ErrorMessage from '../components/ErrorMessage';
import SuccessMessage from '../components/SuccessMessage';
import EmptyState from '../components/EmptyState';

const CLIENTE_VACIO = { id: null, nombre: '', apellido: '', email: '', telefono: '' };

export default function AdminClientes() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState('');

  const [editando, setEditando] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await clienteApi.listar({ busqueda, limite: 200 });
      setClientes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => {
    const temporizador = setTimeout(cargar, 300);
    return () => clearTimeout(temporizador);
  }, [cargar]);

  async function guardar(evento) {
    evento.preventDefault();

    const validacion = {
      nombre: validarNombre(editando.cliente.nombre),
      apellido: validarNombre(editando.cliente.apellido, 'El apellido'),
      email: validarEmail(editando.cliente.email),
    };
    setEditando((anterior) => ({ ...anterior, errores: validacion }));
    if (!sinErrores(validacion)) return;

    setProcesando(true);
    setErrorAccion(null);
    try {
      const cuerpo = {
        nombre: editando.cliente.nombre,
        apellido: editando.cliente.apellido,
        email: editando.cliente.email,
        telefono: editando.cliente.telefono,
      };
      const { data } = editando.cliente.id
        ? await clienteApi.actualizar(editando.cliente.id, cuerpo)
        : await clienteApi.crear(cuerpo);

      setClientes((anteriores) =>
        editando.cliente.id
          ? anteriores.map((c) => (c.id === data.id ? { ...c, ...data } : c))
          : [{ ...data, totalReservas: 0 }, ...anteriores]
      );
      setExito(editando.cliente.id ? 'Cliente actualizado.' : 'Cliente creado correctamente.');
      setEditando(null);
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
      const { data } = await clienteApi.eliminar(aEliminar.id);
      setClientes((anteriores) => anteriores.filter((c) => c.id !== aEliminar.id));
      setExito(data.mensaje);
      setAEliminar(null);
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function verHistorial(cliente) {
    setErrorAccion(null);
    try {
      const { data } = await clienteApi.reservas(cliente.id);
      setHistorial({ cliente, reservas: data });
    } catch (err) {
      setErrorAccion(err.message);
    }
  }

  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Cliente',
      render: (c) => (
        <div className="tabla__principal">
          <strong>{c.nombreCompleto}</strong>
          <span className="tabla__nota">{c.email}</span>
        </div>
      ),
    },
    { clave: 'telefono', titulo: 'TelÃ©fono', render: (c) => c.telefono || 'â€”' },
    {
      clave: 'cuenta',
      titulo: 'Cuenta',
      render: (c) => (c.tieneCuenta ? <span className="badge is-confirmada">Con acceso</span> : <span className="badge is-neutro">Invitado</span>),
    },
    {
      clave: 'reservas',
      titulo: 'Reservas',
      alinear: 'center',
      render: (c) => numero(c.totalReservas),
    },
    {
      clave: 'alta',
      titulo: 'Alta',
      render: (c) => fechaNumerica(c.createdAt),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (c) => (
        <div className="tabla__acciones">
          <button type="button" className="link" onClick={() => verHistorial(c)}>
            Historial
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setEditando({ cliente: { ...c }, errores: {} });
              setErrorAccion(null);
            }}
          >
            Editar
          </button>
          <button type="button" className="link link--peligro" onClick={() => { setAEliminar(c); setErrorAccion(null); }}>
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-clientes">
      <header className="admin-pagina__cabecera">
        <div>
          <h1 className="admin-pagina__titulo">Clientes</h1>
          <p className="admin-pagina__bajada">
            {cargando ? 'Cargando...' : `${clientes.length} cliente(s) registrados`}
          </p>
        </div>
        <div className="admin-pagina__acciones">
          <Input
            label="Buscar"
            name="busqueda"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, email o telÃ©fono"
            className="admin-buscador"
          />
          <Button onClick={() => { setEditando({ cliente: { ...CLIENTE_VACIO }, errores: {} }); setErrorAccion(null); }}>
            Crear cliente
          </Button>
        </div>
      </header>

      <SuccessMessage mensaje={exito} onCerrar={() => setExito('')} autoCerrar={6000} />
      <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />

      <Card sinPadding>
        <ErrorMessage mensaje={error} titulo="No pudimos cargar los clientes" onReintentar={cargar} />
        <Table
          columnas={columnas}
          filas={clientes}
          cargando={cargando}
          mensajeVacio="No hay clientes que coincidan con la bÃºsqueda."
        />
      </Card>

      {/* ------------------------------------------------- MODAL EDITAR */}
      <Modal
        abierto={Boolean(editando)}
        onCerrar={() => setEditando(null)}
        titulo={editando?.cliente?.id ? `Editar ${editando.cliente.nombreCompleto}` : 'Crear cliente'}
        descripcion="Un cliente con cuenta puede acceder a su historial desde la web."
        pie={
          <ModalAcciones
            onCancelar={() => setEditando(null)}
            onConfirmar={guardar}
            textoConfirmar={editando?.cliente?.id ? 'Guardar cambios' : 'Crear cliente'}
            cargando={procesando}
          />
        }
      >
        {editando && (
          <form className="formulario" onSubmit={guardar} noValidate>
            <div className="formulario__fila">
              <Input
                label="Nombre"
                name="clienteNombre"
                value={editando.cliente.nombre}
                onChange={(e) => setEditando((a) => ({ ...a, cliente: { ...a.cliente, nombre: e.target.value } }))}
                error={editando.errores?.nombre}
                requerido
              />
              <Input
                label="Apellido"
                name="clienteApellido"
                value={editando.cliente.apellido}
                onChange={(e) => setEditando((a) => ({ ...a, cliente: { ...a.cliente, apellido: e.target.value } }))}
                error={editando.errores?.apellido}
                requerido
              />
            </div>

            <Input
              label="Email"
              name="clienteEmail"
              type="email"
              value={editando.cliente.email}
              onChange={(e) => setEditando((a) => ({ ...a, cliente: { ...a.cliente, email: e.target.value } }))}
              error={editando.errores?.email}
              ayuda="Ãšnico por cliente. Se usa para vincular la cuenta de acceso."
              requerido
            />

            <Input
              label="TelÃ©fono"
              name="clienteTelefono"
              type="tel"
              value={editando.cliente.telefono ?? ''}
              onChange={(e) => setEditando((a) => ({ ...a, cliente: { ...a.cliente, telefono: e.target.value } }))}
            />

            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </form>
        )}
      </Modal>

      {/* ------------------------------------------------- MODAL BORRAR */}
      <Modal
        abierto={Boolean(aEliminar)}
        onCerrar={() => setAEliminar(null)}
        titulo="Eliminar cliente"
        descripcion="Los clientes con reservas no se pueden eliminar."
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
              Â¿Eliminar a <strong>{aEliminar.nombreCompleto}</strong> ({aEliminar.email})?
            </p>
            <p className="modal__nota">
              Tiene {aEliminar.totalReservas} reserva(s) registradas. Si tiene historial, el sistema
              protegerÃ¡ el registro.
            </p>
            <ErrorMessage mensaje={errorAccion} onCerrar={() => setErrorAccion(null)} />
          </div>
        )}
      </Modal>

      {/* ---------------------------------------------- MODAL HISTORIAL */}
      <Modal
        abierto={Boolean(historial)}
        onCerrar={() => setHistorial(null)}
        titulo={`Historial de ${historial?.cliente?.nombreCompleto ?? ''}`}
        descripcion={`${historial?.reservas.length ?? 0} reserva(s) registradas`}
        tamano="grande"
        pie={
          <ModalAcciones
            onCancelar={() => setHistorial(null)}
            onConfirmar={() => setHistorial(null)}
            textoConfirmar="Cerrar"
          />
        }
      >
        {historial && <HistorialReservas cliente={historial.cliente} reservas={historial.reservas} />}
      </Modal>
    </div>
  );
}

/** Lista de reservas de un cliente, ordenada de la mÃ¡s reciente a la mÃ¡s antigua. */
function HistorialReservas({ cliente, reservas }) {
  if (reservas.length === 0) {
    return (
      <EmptyState
        icono="ðŸ“­"
        titulo="Sin reservas"
        descripcion={`${cliente.nombreCompleto} todavÃ­a no realizÃ³ ninguna reserva.`}
      />
    );
  }

  const gastado = reservas
    .filter((r) => r.estado !== 'cancelada')
    .reduce((suma, r) => suma + r.personas, 0);

  return (
    <>
      <div className="historial__resumen">
        <div>
          <span>Email</span>
          <strong>{cliente.email}</strong>
        </div>
        <div>
          <span>TelÃ©fono</span>
          <strong>{cliente.telefono || 'â€”'}</strong>
        </div>
        <div>
          <span>Reservas</span>
          <strong>{reservas.length}</strong>
        </div>
        <div>
          <span>Plazas reservadas</span>
          <strong>{numero(gastado)}</strong>
        </div>
      </div>

      <div className="tabla__contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th>CÃ³digo</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Mesa</th>
              <th>Personas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((reserva) => (
              <tr key={reserva.id}>
                <td data-label="CÃ³digo">
                  <strong>{reserva.codigo}</strong>
                </td>
                <td data-label="Fecha">{fechaNumerica(reserva.fecha)}</td>
                <td data-label="Hora">{hora(reserva.hora)}</td>
                <td data-label="Mesa">N.Âº {reserva.mesa.numero}</td>
                <td data-label="Personas">{reserva.personas}</td>
                <td data-label="Estado">
                  <StatusBadge estado={reserva.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
