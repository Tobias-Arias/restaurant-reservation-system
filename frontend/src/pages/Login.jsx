/**
 * Inicio de sesión.
 * Ruta: /login
 *
 * Tras autenticar, redirige según el rol:
 *   cliente -> /mis-reservas
 *   admin   -> /admin
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sinErrores, validarLogin } from '../utils/validation';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import ErrorMessage from '../components/ErrorMessage';

export default function Login() {
  const navegar = useNavigate();
  const location = useLocation();
  const { iniciarSesion } = useAuth();

  const [formulario, setFormulario] = useState({ email: '', password: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const destino = location.state?.from;

  const cambiar = (campo) => (evento) => {
    const { value } = evento.target;
    setFormulario((anterior) => ({ ...anterior, [campo]: value }));
    setErrores((anterior) => ({ ...anterior, [campo]: '' }));
  };

  async function enviar(evento) {
    evento.preventDefault();

    const validacion = validarLogin(formulario);
    setErrores(validacion);
    if (!sinErrores(validacion)) return;

    setEnviando(true);
    setError(null);

    try {
      const usuario = await iniciarSesion(formulario.email, formulario.password);
      const ruta = destino || (usuario.rol === 'admin' ? '/admin' : '/mis-reservas');
      navegar(ruta, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth">
      <Card titulo="Iniciar sesión" subtitulo="Accedé a tus reservas o al panel administrativo.">
        <form className="formulario" onSubmit={enviar} noValidate>
          <ErrorMessage mensaje={error} titulo="No pudimos iniciar sesión" onCerrar={() => setError(null)} />

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
            label="Contraseña"
            name="password"
            type="password"
            value={formulario.password}
            onChange={cambiar('password')}
            error={errores.password}
            autoComplete="current-password"
            placeholder="••••••••"
            requerido
          />

          <div className="formulario__acciones formulario__acciones--centradas">
            <Button type="submit" cargando={enviando} tamano="grande" className="btn--completo">
              Iniciar sesión
            </Button>
          </div>
        </form>

        <p className="auth__pie">
          ¿Todavía no tenés cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
      </Card>
    </div>
  );
}
