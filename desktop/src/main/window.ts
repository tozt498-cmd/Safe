import { app, BrowserWindow, Tray, Menu, nativeImage, Notification } from 'electron';
import { join } from 'node:path';
import { getSettings } from './settings.js';
import { runBoost } from './system/boost.js';

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

export function createWindow(): BrowserWindow {
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
    },
  });

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
