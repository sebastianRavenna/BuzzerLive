import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { HomePage } from './pages/HomePage';
import { PosicionesPage } from './pages/PosicionesPage';
import { PartidosPage } from './pages/PartidosPage';
import { PartidoLivePage } from './pages/PartidoLivePage';
import { MarcadorPublicoPage } from './pages/MarcadorPublicoPage';
import { InstallPWA } from './components/common/InstallPWA';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="posiciones" element={<PosicionesPage />} />
          <Route path="partidos" element={<PartidosPage />} />
        </Route>
        {/* Pantalla de carga en vivo - sin Layout (fullscreen) */}
        <Route path="/partido/:id/live" element={<PartidoLivePage />} />
        {/* Vista pública del marcador - sin Layout (fullscreen) */}
        <Route path="/partido/:id" element={<MarcadorPublicoPage />} />
      </Routes>
      
      {/* Banner de instalación PWA */}
      <InstallPWA />
    </BrowserRouter>
  );
}

export default App;