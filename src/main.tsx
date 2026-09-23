import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'

// React toma el control del contenedor que hemos definido en index.html.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* BrowserRouter permitirá navegar entre páginas sin recargar el documento. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
