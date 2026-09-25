import React, { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { getStorageAdapter, markMigrationComplete } from './services/storage';

// Route-level code splitting: the dashboard doesn't pay for the editor (ReactFlow,
// Prism, commands) and the editor doesn't pay for the dashboard.
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const ProjectEditor = React.lazy(() => import('./components/ProjectEditor'));

export default function App() {
  const [isMigrating, setIsMigrating] = useState(true);

  React.useEffect(() => {
    getStorageAdapter().migrate()
      .then(() => { markMigrationComplete(); setIsMigrating(false); })
      .catch((err) => {
        console.error('Migration failed', err);
        markMigrationComplete(); // Allow app to proceed despite migration failure
        setIsMigrating(false);
      });
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
    <HashRouter>
      <React.Suspense fallback={<div className="h-screen w-screen bg-nt-bg" />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/:projectId" element={<ProjectEditor />} />
        </Routes>
      </React.Suspense>
    </HashRouter>
  );
}
