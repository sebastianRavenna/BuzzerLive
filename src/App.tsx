import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { HomePage } from './pages/HomePage';
import { PosicionesPage } from './pages/PosicionesPage';
import { PartidosPage } from './pages/PartidosPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="posiciones" element={<PosicionesPage />} />
          <Route path="partidos" element={<PartidosPage />} />
          {/* TODO: Add more routes */}
          {/* <Route path="partido/:id" element={<MarcadorPage />} /> */}
          {/* <Route path="partido/:id/live" element={<PartidoLivePage />} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
