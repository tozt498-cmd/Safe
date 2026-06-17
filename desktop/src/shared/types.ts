// Types partagés entre le process main (Node/Electron) et le renderer (React).

export interface SystemInfo {
  hostname: string;
  os: string;
  osBuild: string;
  manufacturer: string;
  model: string;
  cpuBrand: string;
  cpuCores: number;
  cpuThreads: number;
  gpuModel: string;
  totalMemGB: number;
  uptimeSec: number;
}

export interface LiveStats {
  cpu: { load: number; perCore: number[]; speedGHz: number; tempC: number | null };
  mem: { usedGB: number; totalGB: number; percent: number };
  gpu: { load: number | null; memPercent: number | null; tempC: number | null; model: string };
  disk: { readMBs: number; writeMBs: number; busyPercent: number | null };
  net: { rxMbps: number; txMbps: number; iface: string };
  battery: { percent: number | null; charging: boolean | null };
  timestamp: number;
}

export interface HealthScore {
  score: number; // 0..100
  grade: 'Excellent' | 'Bon' | 'Moyen' | 'Faible' | 'Critique';
  factors: { label: string; value: number; weight: number; detail: string }[];
}

export interface CleanCategory {
  id: string;
  label: string;
  description: string;
  sizeBytes: number;
  fileCount: number;
  recommended: boolean;
}

export interface CleanScan {
  categories: CleanCategory[];
  totalBytes: number;
  scannedAt: number;
}

export interface CleanResult {
  freedBytes: number;
  removedFiles: number;
  errors: number;
  perCategory: { id: string; freedBytes: number; removedFiles: number }[];
}

export interface ProcessItem {
  pid: number;
  name: string;
  cpu: number;
  memMB: number;
  user: string;
}

export interface StartupItem {
  id: string;
  name: string;
  command: string;
  location: string; // registre / dossier
  enabled: boolean;
  impact: 'Élevé' | 'Moyen' | 'Faible';
}

export interface DiskItem {
  fs: string; // lettre de lecteur
  type: string;
  label: string;
  sizeGB: number;
  usedGB: number;
  freeGB: number;
  usePercent: number;
}

export interface SoftwareItem {
  id: string;
  name: string;
  version: string;
  publisher: string;
  installDate: string | null;
  sizeMB: number | null;
  uninstallString: string | null;
}

export interface SpeedTestResult {
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
  server: string;
  at: number;
}

export interface PingResult {
  host: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  jitterMs: number;
  packetLoss: number;
  samples: number[];
}

export interface DnsCandidate {
  name: string;
  address: string;
  latencyMs: number | null;
  reachable: boolean;
}

export interface WifiNetwork {
  ssid: string;
  signalPercent: number;
  channel: number | null;
  security: string;
  frequency: number | null;
  current: boolean;
}

export interface BenchmarkResult {
  cpuSingle: number;
  cpuMulti: number;
  memoryScore: number;
  diskScore: number;
  overall: number;
  durationMs: number;
  at: number;
}

export interface OpResult {
  ok: boolean;
  message: string;
  detail?: string;
}

export interface BoostResult {
  freedBytes: number;
  memoryFreedMB: number;
  steps: { label: string; ok: boolean; detail: string }[];
}

// ---- Optimisation Totale ---------------------------------------------------
export type TotalStepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

export interface TotalCategory {
  id: string;
  label: string;
  description: string;
  sensitive: boolean;
  recommended: boolean;
}

export interface TotalStepResult {
  id: string;
  label: string;
  status: TotalStepStatus;
  detail: string;
  freedBytes?: number;
  memoryFreedMB?: number;
  items?: number;
}

export interface TotalProgress {
  index: number; // étape courante (1-based)
  total: number;
  overallPercent: number;
  current: TotalStepResult;
}

export interface TotalReport {
  freedBytes: number;
  memoryFreedMB: number;
  itemsOptimized: number;
  durationMs: number;
  steps: TotalStepResult[];
  restorePoint: boolean;
}

// ---- Jeux ------------------------------------------------------------------
export interface GameInfo {
  id: string;
  name: string;
  tagline: string;
  accent: string; // couleur d'accent de la carte
  running: boolean;
}

export interface GameProgress {
  gameId: string;
  index: number;
  total: number;
  overallPercent: number;
  current: TotalStepResult;
}

export interface GameReport extends TotalReport {
  gameId: string;
  gameName: string;
}
