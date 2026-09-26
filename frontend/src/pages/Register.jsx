/**
 * Registro de clientes.
 * Ruta: /registro
 *
 * El registro NUNCA puede elegir el rol: el backend siempre crea la cuenta
 * con rol 'cliente'. Para obtener permisos de administrador hay que ejecutar
 * database/promote_admin.sql (ver README.md).
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sinErrores, validarRegistro } from '../utils/validation';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import ErrorMessage from '../components/ErrorMessage';

export default function Register() {
  const navegar = useNavigate();
  const { registrar } = useAuth();

  const [formulario, setFormulario] = useState({ nombre: '', apellido: '', email: '', password: '', telefono: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (evento) => {
    const { value } = evento.target;
    setFormulario((anterior) => ({ ...anterior, [campo]: value }));
    setErrores((anterior) => ({ ...anterior, [campo]: '' }));
  };

  async function enviar(evento) {
    evento.preventDefault();

    const validacion = validarRegistro(formulario);
    setErrores(validacion);
    if (!sinErrores(validacion)) return;

    setEnviando(true);
    setError(null);

    try {
      await registrar(formulario);
      navegar('/mis-reservas', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth">
      <Card titulo="Crear cuenta" subtitulo="Podés reservar y gestionar tus visitas desde tu cuenta.">
        <form className="formulario" onSubmit={enviar} noValidate>
          <ErrorMessage mensaje={error} titulo="No pudimos crear la cuenta" onCerrar={() => setError(null)} />

          <div className="formulario__fila">
            <Input
              label="Nombre"
              name="nombre"
              value={formulario.nombre}
              onChange={cambiar('nombre')}
              error={errores.nombre}
              autoComplete="given-name"
              requerido
            />
            <Input
              label="Apellido"
              name="apellido"
              value={formulario.apellido}
              onChange={cambiar('apellido')}
              error={errores.apellido}
              autoComplete="family-name"
              requerido
            />
          </div>

          <Input
            label="Email"
            name="email"
            type="email"
            value={formulario.email}
            onChange={cambiar('email')}
            error={errores.email}
            autoComplete="email"
            placeholder="tunombre@correo.com"
            requerido
          />

          <Input
            label="Teléfono"
            name="telefono"
            type="tel"
            value={formulario.telefono}
            onChange={cambiar('telefono')}
            error={errores.telefono}
            autoComplete="tel"
            ayuda="Opcional. Nos sirve para confirmarte la reserva."
          />

          <Input
            label="Contraseña"
            name="password"
            type="password"
            value={formulario.password}
            onChange={cambiar('password')}
            error={errores.password}
            autoComplete="new-password"
            ayuda="Mínimo 8 caracteres, con al menos una letra y un número."
            requerido
          />

          <div className="formulario__acciones formulario__acciones--centradas">
            <Button type="submit" cargando={enviando} tamano="grande" className="btn--completo">
              Crear cuenta
            </Button>
          </div>
        </form>

        <p className="auth__pie">
          ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </Card>
    </div>
  );
}
