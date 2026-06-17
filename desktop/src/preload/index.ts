import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  SystemInfo,
  LiveStats,
  HealthScore,
  CleanScan,
  CleanResult,
  ProcessItem,
  StartupItem,
  DiskItem,
  SoftwareItem,
  SpeedTestResult,
  PingResult,
  DnsCandidate,
  WifiNetwork,
  BenchmarkResult,
  OpResult,
  BoostResult,
  TotalCategory,
  TotalProgress,
  TotalReport,
  GameInfo,
  GameProgress,
  GameReport,
} from '../shared/types.js';

// Production -> backend hébergé (Render). Dev -> backend local.
const PROD_API = 'https://safeoptimiseur.onrender.com';
const DEV_API = 'http://127.0.0.1:4317';
const API_BASE = import.meta.env.PROD ? PROD_API : DEV_API;

export const api = {
  config: {
    apiUrl: `${API_BASE}/api`,
    wsUrl: `${API_BASE.replace(/^http/, 'ws')}/ws`,
  },

  // Fenêtre
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  },

  // Application
  app: {
    version: (): Promise<string> => ipcRenderer.invoke('app:version'),
    hwid: (): Promise<{ hwid: string; label: string }> => ipcRenderer.invoke('app:hwid'),
    getSettings: (): Promise<{ closeToTray: boolean; launchAtStartup: boolean; theme: 'dark' | 'light' }> =>
      ipcRenderer.invoke('app:getSettings'),
    setSettings: (patch: Record<string, unknown>) => ipcRenderer.invoke('app:setSettings', patch),
    notify: (title: string, body: string) => ipcRenderer.invoke('app:notify', { title, body }),
  },

  // Métriques
  metrics: {
    info: (): Promise<SystemInfo> => ipcRenderer.invoke('sys:info'),
    live: (): Promise<LiveStats> => ipcRenderer.invoke('sys:live'),
    health: (): Promise<HealthScore> => ipcRenderer.invoke('sys:health'),
  },

  // Nettoyage / optimisation
  clean: {
    scan: (): Promise<CleanScan> => ipcRenderer.invoke('clean:scan'),
    run: (ids: string[]): Promise<CleanResult> => ipcRenderer.invoke('clean:run', ids),
  },
  optimize: {
    freeMemory: (): Promise<OpResult & { freedMB: number }> => ipcRenderer.invoke('optimize:freeMemory'),
    gameMode: (on: boolean): Promise<OpResult> => ipcRenderer.invoke('optimize:gameMode', on),
  },
  boost: {
    run: (): Promise<BoostResult> => ipcRenderer.invoke('boost:run'),
  },
  total: {
    categories: (): Promise<TotalCategory[]> => ipcRenderer.invoke('total:categories'),
    run: (ids: string[]): Promise<TotalReport> => ipcRenderer.invoke('total:run', ids),
    onProgress: (cb: (p: TotalProgress) => void) => {
      const handler = (_e: IpcRendererEvent, p: TotalProgress) => cb(p);
      ipcRenderer.on('total:progress', handler);
      return () => ipcRenderer.removeListener('total:progress', handler);
    },
  },
  games: {
    list: (): Promise<GameInfo[]> => ipcRenderer.invoke('games:list'),
    run: (gameId: string): Promise<GameReport> => ipcRenderer.invoke('games:run', gameId),
    onProgress: (cb: (p: GameProgress) => void) => {
      const handler = (_e: IpcRendererEvent, p: GameProgress) => cb(p);
      ipcRenderer.on('games:progress', handler);
      return () => ipcRenderer.removeListener('games:progress', handler);
    },
  },

  // Processus / démarrage
  processes: {
    list: (): Promise<ProcessItem[]> => ipcRenderer.invoke('proc:list'),
    kill: (pid: number): Promise<OpResult> => ipcRenderer.invoke('proc:kill', pid),
  },
  startup: {
    list: (): Promise<StartupItem[]> => ipcRenderer.invoke('startup:list'),
    set: (id: string, enable: boolean): Promise<OpResult> =>
      ipcRenderer.invoke('startup:set', { id, enable }),
  },

  // Disques / logiciels
  disks: {
    list: (): Promise<DiskItem[]> => ipcRenderer.invoke('disks:list'),
  },
  software: {
    list: (): Promise<SoftwareItem[]> => ipcRenderer.invoke('software:list'),
    uninstall: (uninstallString: string | null): Promise<OpResult> =>
      ipcRenderer.invoke('software:uninstall', uninstallString),
  },

  // Benchmark
  benchmark: {
    run: (): Promise<BenchmarkResult> => ipcRenderer.invoke('bench:run'),
  },

  // Réseau
  network: {
    speed: (): Promise<SpeedTestResult> => ipcRenderer.invoke('net:speed'),
    ping: (host?: string): Promise<PingResult> => ipcRenderer.invoke('net:ping', host),
    dnsBench: (): Promise<DnsCandidate[]> => ipcRenderer.invoke('net:dnsBench'),
    applyDns: (address: string): Promise<OpResult> => ipcRenderer.invoke('net:applyDns', address),
    flushDns: (): Promise<OpResult> => ipcRenderer.invoke('net:flushDns'),
    tcpOptimize: (): Promise<OpResult> => ipcRenderer.invoke('net:tcpOptimize'),
    reset: (): Promise<OpResult> => ipcRenderer.invoke('net:reset'),
    wifi: (): Promise<WifiNetwork[]> => ipcRenderer.invoke('net:wifi'),
  },
};

export type Api = typeof api;

contextBridge.exposeInMainWorld('api', api);
