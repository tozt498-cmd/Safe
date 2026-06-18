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
import { getSettings, setSettings } from './settings.js';
import { iconPath } from './window.js';

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
  ipcMain.handle('app:notify', (_e, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: iconPath() }).show();
    }
    return true;
  });

  // ---- Métriques -----------------------------------------------------------
  ipcMain.handle('sys:info', () => getSystemInfo());
  ipcMain.handle('sys:live', () => getLiveStats());
  ipcMain.handle('sys:health', () => getHealthScore());

  // ---- Nettoyage / optimisation -------------------------------------------
  ipcMain.handle('clean:scan', () => scanClean());
  ipcMain.handle('clean:run', (_e, ids: string[]) => runClean(ids));
  ipcMain.handle('optimize:freeMemory', () => freeMemory());
  ipcMain.handle('optimize:gameMode', (_e, on: boolean) => setGameMode(on));
  ipcMain.handle('boost:run', () => runBoost());

  // Optimisation Totale — progression diffusée via 'total:progress'
  ipcMain.handle('total:categories', () => totalCategories());
  ipcMain.handle('total:run', (e, ids: string[]) =>
    runTotal(ids, (p) => {
      if (!e.sender.isDestroyed()) e.sender.send('total:progress', p);
    }),
  );

  // Optimisation par jeu — progression diffusée via 'games:progress'
  ipcMain.handle('games:list', () => listGames());
  ipcMain.handle('games:run', (e, gameId: string) =>
    runGameOptimization(gameId, (p) => {
      if (!e.sender.isDestroyed()) e.sender.send('games:progress', p);
    }),
  );

  // ---- Processus / démarrage ----------------------------------------------
  ipcMain.handle('proc:list', () => listProcesses());
  ipcMain.handle('proc:kill', (_e, pid: number) => killProcess(pid));
  ipcMain.handle('startup:list', () => listStartup());
  ipcMain.handle('startup:set', (_e, { id, enable }: { id: string; enable: boolean }) =>
    setStartupItem(id, enable),
  );

  // ---- Disques / logiciels -------------------------------------------------
  ipcMain.handle('disks:list', () => listDisks());
  ipcMain.handle('software:list', () => listSoftware());
  ipcMain.handle('software:uninstall', (_e, uninstallString: string | null) =>
    uninstallSoftware(uninstallString),
  );

  // ---- Benchmark -----------------------------------------------------------
  ipcMain.handle('bench:run', () => runBenchmark());

  // ---- Réseau --------------------------------------------------------------
  ipcMain.handle('net:speed', () => speedTest());
  ipcMain.handle('net:ping', (_e, host?: string) => pingTest(host));
  ipcMain.handle('net:dnsBench', () => dnsBenchmark());
  ipcMain.handle('net:applyDns', (_e, address: string) => applyDns(address));
  ipcMain.handle('net:flushDns', () => flushDns());
  ipcMain.handle('net:tcpOptimize', () => tcpOptimize());
  ipcMain.handle('net:reset', () => resetNetwork());
  ipcMain.handle('net:wifi', () => wifiScan());
}
