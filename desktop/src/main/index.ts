import { app, BrowserWindow } from 'electron';
import { createWindow, createTray, getMainWindow, setQuitting } from './window.js';
import { registerIpc } from './ipc.js';
import { getSettings } from './settings.js';
import { initAutoUpdate } from './updater.js';
import { isAdmin, relaunchAsAdmin } from './system/admin.js';

app.on('before-quit', () => setQuitting(true));

// On garde l'app vivante en arrière-plan (tray) même sans fenêtre.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !getSettings().closeToTray) app.quit();
});

async function bootstrap() {
  // --- Élévation automatique (droits administrateur) ------------------------
  // La majorité des optimisations (point de restauration, TRIM, télémétrie,
  // TCP/IP, dossier Windows\Temp…) EXIGENT les droits admin. On relance donc
  // l'app en admin AVANT le verrou d'instance unique. Tout est protégé :
  // si l'UAC est refusé ou en cas d'erreur, on ouvre quand même en mode
  // utilisateur (un bandeau proposera de relancer en admin).
  if (process.platform === 'win32' && app.isPackaged && !process.argv.includes('--elevated')) {
    try {
      if (getSettings().autoElevate && !(await isAdmin())) {
        if (relaunchAsAdmin(['--elevated'])) {
          app.quit();
          return;
        }
      }
    } catch {
      /* on continue en mode utilisateur normal */
    }
  }

  // Instance unique : au 2e lancement, on ré-affiche la fenêtre existante.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (!win.isVisible()) win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  await app.whenReady();
  registerIpc();
  createWindow();
  createTray();
  initAutoUpdate();

  // Applique le réglage de lancement au démarrage.
  app.setLoginItemSettings({ openAtLogin: getSettings().launchAtStartup });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else getMainWindow()?.show();
  });
}

bootstrap();
