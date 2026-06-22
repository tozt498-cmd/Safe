import { ipcMain, Notification, app, BrowserWindow, shell } from 'electron';
import { getSystemInfo, getLiveStats, getHealthScore } from './system/metrics.js';
import { scanClean, runClean } from './system/clean.js';
import { freeMemory, setGameMode } from './system/optimize.js';
import { runBoost } from './system/boost.js';
import { runTotal, totalCategories } from './system/total.js';
import { listGames, runGameOptimization } from './system/games.js';
import { listProcesses, killProcess } from './system/processes.js';
import { listStartup, setStartupItem } from './system/startup.js';
import { listDisks } from './system/disks.js';
import { listSoftware, uninstallSoftware } from './system/software.js';
import { runBenchmark } from './system/benchmark.js';
import {
  speedTest,
  pingTest,
  dnsBenchmark,
  applyDns,
  flushDns,
  tcpOptimize,
  resetNetwork,
  wifiScan,
} from './system/network.js';
import { getHwid, getHwidLabel } from './system/hwid.js';
import { isAdmin, relaunchAsAdmin } from './system/admin.js';
import * as entitlement from './entitlement.js';
import { getSettings, setSettings } from './settings.js';
import { iconPath } from './window.js';

// Garde côté serveur : refuse l'exécution d'une fonctionnalité Pro si le serveur
// ne confirme pas le statut Pro du compte. Le gating ne dépend plus du client.
type IpcHandler = (...args: any[]) => unknown;
function proGuard(handler: IpcHandler): IpcHandler {
  return async (...args: any[]) => {
    if (!(await entitlement.isPro())) {
      throw new Error('PRO_REQUIRED');
    }
    return handler(...args);
  };
}

export function registerIpc() {
  // ---- Fenêtre -------------------------------------------------------------
  ipcMain.handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.handle('window:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return false;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
    return w.isMaximized();
  });
  ipcMain.handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.handle('window:isMaximized', (e) =>
    BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false,
  );

  // ---- Application / système -----------------------------------------------
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:hwid', () => ({ hwid: getHwid(), label: getHwidLabel() }));
  ipcMain.handle('app:isAdmin', () => isAdmin());
  // Relance en administrateur ; si l'UAC est accepté, on ferme l'instance courante.
  ipcMain.handle('app:relaunchAsAdmin', () => {
    const ok = relaunchAsAdmin(['--elevated']);
    if (ok) setTimeout(() => app.quit(), 300);
    return ok;
  });
  ipcMain.handle('app:getSettings', () => getSettings());
  ipcMain.handle('app:setSettings', (_e, patch) => {
    const s = setSettings(patch);
    if ('launchAtStartup' in patch) {
      app.setLoginItemSettings({ openAtLogin: s.launchAtStartup });
    }
    return s;
  });
  ipcMain.handle('app:openExternal', (_e, url: string) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return true;
  });
  // Le renderer transmet le token de session au processus principal pour la
  // vérification d'entitlement côté serveur (jamais de secret, juste le token).
  ipcMain.handle('app:setToken', (_e, token: string | null) => {
    entitlement.setToken(token);
    return true;
  });
  ipcMain.handle('app:notify', (_e, { title, body }: { title: string; body: string }) => {
    if (getSettings().notifications && Notification.isSupported()) {
      new Notification({ title, body, icon: iconPath() }).show();
    }
    return true;
  });

  // ---- Métriques -----------------------------------------------------------
  ipcMain.handle('sys:info', () => getSystemInfo());
  ipcMain.handle('sys:live', () => getLiveStats());
  ipcMain.handle('sys:health', () => getHealthScore());

  // ---- Nettoyage / optimisation -------------------------------------------
  // Gratuit : analyse + nettoyage de base, disques, métriques.
  ipcMain.handle('clean:scan', () => scanClean());
  ipcMain.handle('clean:run', (_e, ids: string[]) => runClean(ids));
  // Pro : vérifié côté serveur via proGuard.
  ipcMain.handle('optimize:freeMemory', proGuard(() => freeMemory()));
  ipcMain.handle('optimize:gameMode', proGuard((_e, on: boolean) => setGameMode(on)));
  ipcMain.handle('boost:run', proGuard(() => runBoost()));

  // Optimisation Totale — progression diffusée via 'total:progress'
  ipcMain.handle('total:categories', () => totalCategories());
  ipcMain.handle(
    'total:run',
    proGuard((e, ids: string[]) =>
      runTotal(ids, (p) => {
        if (!e.sender.isDestroyed()) e.sender.send('total:progress', p);
      }),
    ),
  );

  // Optimisation par jeu — progression diffusée via 'games:progress'
  ipcMain.handle('games:list', () => listGames());
  ipcMain.handle(
    'games:run',
    proGuard((e, gameId: string) =>
      runGameOptimization(gameId, (p) => {
        if (!e.sender.isDestroyed()) e.sender.send('games:progress', p);
      }),
    ),
  );

  // ---- Processus / démarrage ----------------------------------------------
  ipcMain.handle('proc:list', () => listProcesses());
  ipcMain.handle('proc:kill', proGuard((_e, pid: number) => killProcess(pid)));
  ipcMain.handle('startup:list', () => listStartup());
  ipcMain.handle(
    'startup:set',
    proGuard((_e, { id, enable }: { id: string; enable: boolean }) => setStartupItem(id, enable)),
  );

  // ---- Disques / logiciels -------------------------------------------------
  ipcMain.handle('disks:list', () => listDisks());
  ipcMain.handle('software:list', () => listSoftware());
  ipcMain.handle(
    'software:uninstall',
    proGuard((_e, uninstallString: string | null) => uninstallSoftware(uninstallString)),
  );

  // ---- Benchmark -----------------------------------------------------------
  ipcMain.handle('bench:run', proGuard(() => runBenchmark()));

  // ---- Réseau --------------------------------------------------------------
  ipcMain.handle('net:speed', () => speedTest());
  ipcMain.handle('net:ping', (_e, host?: string) => pingTest(host));
  ipcMain.handle('net:dnsBench', () => dnsBenchmark());
  ipcMain.handle('net:applyDns', proGuard((_e, address: string) => applyDns(address)));
  ipcMain.handle('net:flushDns', () => flushDns());
  ipcMain.handle('net:tcpOptimize', proGuard(() => tcpOptimize()));
  ipcMain.handle('net:reset', proGuard(() => resetNetwork()));
  ipcMain.handle('net:wifi', () => wifiScan());
}
