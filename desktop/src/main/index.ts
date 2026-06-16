import { app, BrowserWindow } from 'electron';
import { createWindow, createTray, getMainWindow, setQuitting } from './window.js';
import { registerIpc } from './ipc.js';
import { getSettings } from './settings.js';

// Instance unique : au 2e lancement, on ré-affiche la fenêtre existante.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (!win.isVisible()) win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    createWindow();
    createTray();

    // Applique le réglage de lancement au démarrage.
    app.setLoginItemSettings({ openAtLogin: getSettings().launchAtStartup });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else getMainWindow()?.show();
    });
  });

  app.on('before-quit', () => setQuitting(true));

  // On garde l'app vivante en arrière-plan (tray) même sans fenêtre.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !getSettings().closeToTray) app.quit();
  });
}
