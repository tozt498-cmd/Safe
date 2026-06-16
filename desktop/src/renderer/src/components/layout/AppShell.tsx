import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { BroadcastListener } from '../BroadcastListener';

export function AppShell() {
  const location = useLocation();
  return (
    <div className="app-ambient flex h-screen flex-col overflow-hidden">
      <Titlebar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto max-w-6xl px-8 py-8"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <BroadcastListener />
    </div>
  );
}
