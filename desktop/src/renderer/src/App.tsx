import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth';
import { useTheme } from './store/theme';
import { AppShell } from './components/layout/AppShell';
import { LockdownGate } from './components/LockdownGate';
import { Toaster } from './components/ui/Toaster';
import { LogoMark } from './components/Logo';
import { Spinner } from './components/ui/primitives';

import { AuthScreen } from './pages/AuthScreen';
import { Home } from './pages/Home';
import { OptimisationTotale } from './pages/OptimisationTotale';
import { Games } from './pages/Games';
import { Dashboard } from './pages/Dashboard';
import { Benchmark } from './pages/Benchmark';
import { Cleaning } from './pages/Cleaning';
import { Optimize } from './pages/Optimize';
import { Processes } from './pages/Processes';
import { Startup } from './pages/Startup';
import { Network } from './pages/Network';
import { Connection } from './pages/Connection';
import { Disks } from './pages/Disks';
import { Software } from './pages/Software';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';

function Splash() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-5 bg-bg">
      <div className="animate-pulse-soft">
        <LogoMark size={56} />
      </div>
      <Spinner />
    </div>
  );
}

export default function App() {
  const { status, init, user } = useAuth();
  const initTheme = useTheme((s) => s.init);

  useEffect(() => {
    initTheme();
    init();
  }, [init, initTheme]);

  return (
    <>
      {status === 'loading' && <Splash />}
      {status === 'guest' && <AuthScreen />}
      {status === 'authed' && (
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="/total" element={<OptimisationTotale />} />
            <Route path="/games" element={<Games />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="/cleaning" element={<Cleaning />} />
            <Route path="/optimize" element={<Optimize />} />
            <Route path="/processes" element={<Processes />} />
            <Route path="/startup" element={<Startup />} />
            <Route path="/network" element={<Network />} />
            <Route path="/connection" element={<Connection />} />
            <Route path="/disks" element={<Disks />} />
            <Route path="/software" element={<Software />} />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="/admin"
              element={user?.role === 'admin' ? <Admin /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      {status === 'authed' && <LockdownGate />}
      <Toaster />
    </>
  );
}
