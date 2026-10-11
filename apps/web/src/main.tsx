import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FlashLab } from './pages/FlashLab.tsx';
import { Home } from './pages/Home.tsx';
import { Panel } from './pages/Panel.tsx';
import { Precheck } from './pages/Precheck.tsx';
import { Presence } from './pages/Presence.tsx';
import { Privacy } from './pages/Privacy.tsx';
import { Report } from './pages/Report.tsx';
import { Visio } from './pages/Visio.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/check/:token" element={<Precheck />} />
        <Route path="/confidentialite" element={<Privacy />} />
        <Route path="/confidentialite/:token" element={<Privacy />} />
        <Route path="/presence/:token" element={<Presence />} />
        <Route path="/visio/:id" element={<Visio />} />
        <Route path="/panel/:id" element={<Panel />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="/lab/flash" element={<FlashLab />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
