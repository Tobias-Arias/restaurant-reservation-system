/**
 * Punto de entrada de la aplicación React.
 * Monta el árbol de componentes y aplica los estilos globales.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

import './styles/global.css';
import './styles/navbar.css';
import './styles/menu.css';
import './styles/reservas.css';
import './styles/admin.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
