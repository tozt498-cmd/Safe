import { app, BrowserWindow, Tray, Menu, nativeImage, Notification } from 'electron';
import { join } from 'node:path';
import { getSettings } from './settings.js';
import { runBoost } from './system/boost.js';
import * as entitlement from './entitlement.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let trayNoticeShown = false;

export function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(app.getAppPath(), 'build', 'icon.png');
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setQuitting(v: boolean) {
  isQuitting = v;
}

// Verrouille la fenêtre en production : aucun DevTools (raccourcis, menu
// contextuel, ouverture par code), et navigation/popups bloqués.
function hardenWindow(win: BrowserWindow) {
  const wc = win.webContents;

  // Bloque les raccourcis d'ouverture des DevTools (F12, Ctrl+Shift+I/J/C).
  wc.on('before-input-event', (event, input) => {
    if (!app.isPackaged) return;
    const key = (input.key || '').toLowerCase();
    const isF12 = key === 'f12';
    const isInspect = input.control && input.shift && ['i', 'j', 'c'].includes(key);
    if (isF12 || isInspect) event.preventDefault();
  });

  // Désactive le menu contextuel (clic droit -> "Inspecter").
  wc.on('context-menu', (event) => {
    if (app.isPackaged) event.preventDefault();
  });

  // Filet de sécurité : si les DevTools s'ouvrent malgré tout, on les referme.
  wc.on('devtools-opened', () => {
    if (app.isPackaged) wc.closeDevTools();
  });

  // Aucune nouvelle fenêtre (les liens externes passent par shell.openExternal).
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Empêche la navigation hors de l'application.
  wc.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });
}

export function createWindow(): BrowserWindow {
  // Supprime le menu d'application (retire aussi "Toggle Developer Tools").
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#0A0C10',
    title: 'SafeMarket Optimiseur',
    icon: iconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // DevTools désactivés dans la version packagée (production).
      devTools: !app.isPackaged,
    },
  });

  hardenWindow(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting && getSettings().closeToTray) {
      e.preventDefault();
      mainWindow?.hide();
      if (!trayNoticeShown && Notification.isSupported()) {
        trayNoticeShown = true;
        new Notification({
          title: 'SafeMarket Optimiseur',
          body: 'L\'application continue en arrière-plan. Clic droit sur l\'icône pour quitter.',
          icon: iconPath(),
        }).show();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

export function createTray() {
  const image = nativeImage.createFromPath(iconPath()).resize({ width: 18, height: 18 });
  tray = new Tray(image);
  tray.setToolTip('SafeMarket Optimiseur');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Ouvrir SafeMarket',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Optimisation en 1 clic',
      click: async () => {
        // Fonctionnalité Pro : vérifiée côté serveur, même depuis le tray.
        if (!(await entitlement.isPro())) {
          if (Notification.isSupported()) {
            new Notification({
              title: 'Licence Pro requise',
              body: 'Active une clé pour utiliser l\'optimisation en 1 clic.',
              icon: iconPath(),
            }).show();
          }
          return;
        }
        const res = await runBoost();
        if (Notification.isSupported()) {
          const mb = (res.freedBytes / (1024 * 1024)).toFixed(0);
          new Notification({
            title: 'Optimisation terminée',
            body: `${mb} Mo nettoyés • ${res.memoryFreedMB} Mo de RAM libérés.`,
            icon: iconPath(),
          }).show();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}
