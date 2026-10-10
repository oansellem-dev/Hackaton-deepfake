import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FlashLab } from './pages/FlashLab.tsx';
import { Home } from './pages/Home.tsx';
import { Precheck } from './pages/Precheck.tsx';
import { Report } from './pages/Report.tsx';
import { Visio } from './pages/Visio.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/check/:id" element={<Precheck />} />
        <Route path="/visio/:id" element={<Visio />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="/lab/flash" element={<FlashLab />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
