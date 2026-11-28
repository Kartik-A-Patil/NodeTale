import React, { useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { runStorageMigration } from './services/storage';
import { shortenProjectIds } from './services/storageService';

// Plain paths on the web (/k3x9q2ab7d). The desktop app loads from file://,
// where only the hash works; nobody sees its address bar anyway.
const Router = import.meta.env.VITE_PLATFORM === 'electron' ? HashRouter : BrowserRouter;

// Links from before plain paths: /#/abc -> /abc.
if (Router === BrowserRouter && window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1));
}

// Route-level code splitting: the dashboard doesn't pay for the editor (ReactFlow,
// Prism, commands) and the editor doesn't pay for the dashboard.
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const ProjectEditor = React.lazy(() => import('./components/ProjectEditor'));
const SharePreview = React.lazy(() => import('./components/SharePreview'));

export default function App() {
  const [isMigrating, setIsMigrating] = useState(true);

  React.useEffect(() => {
    runStorageMigration()
      .then(() => shortenProjectIds().catch((err) => console.error('[Storage] Short ids failed', err)))
      .then(() => setIsMigrating(false));
  }, []);

  if (isMigrating) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#121212] text-zinc-400 flex-col gap-4">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p>Initializing Storage...</p>
      </div>
    );
  }

  return (
    <Router>
      <React.Suspense fallback={<div className="h-screen w-screen bg-nt-bg" />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/share" element={<SharePreview />} />
          <Route path="/:projectId" element={<ProjectEditor />} />
        </Routes>
      </React.Suspense>
    </Router>
  );
}
