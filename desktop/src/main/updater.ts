import { app, Notification } from 'electron';
import pkg from 'electron-updater';
import { iconPath } from './window.js';

const { autoUpdater } = pkg;

/**
 * Mises à jour automatiques via GitHub Releases.
 * Vérifie au démarrage puis toutes les 6 h. Télécharge en arrière-plan et
 * installe à la fermeture de l'app (sans réinstallation manuelle).
 */
export function initAutoUpdate(): void {
  if (!app.isPackaged) return; // jamais en développement

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    notify('Mise à jour disponible', `La version ${info.version} se télécharge en arrière-plan…`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    notify(
      'Mise à jour prête',
      `La version ${info.version} sera installée automatiquement à la fermeture de l'application.`,
    );
  });

  autoUpdater.on('error', () => {
    /* hors-ligne ou pas de release — ignoré silencieusement */
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 6 * 60 * 60 * 1000);
}

function notify(title: string, body: string) {
  if (Notification.isSupported()) new Notification({ title, body, icon: iconPath() }).show();
}
