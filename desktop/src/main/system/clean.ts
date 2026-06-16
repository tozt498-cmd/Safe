import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { CleanCategory, CleanScan, CleanResult } from '../../shared/types.js';

const execp = promisify(exec);

const LOCAL = process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local');
const WINROOT = process.env.SystemRoot || 'C:\\Windows';

interface CatDef {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
  dirs: string[]; // dossiers dont on vide le CONTENU
  files?: { dir: string; pattern: RegExp }[]; // fichiers ciblés par motif
  special?: 'recycle';
}

const CATEGORIES: CatDef[] = [
  {
    id: 'user-temp',
    label: 'Fichiers temporaires (utilisateur)',
    description: 'Fichiers temporaires de votre session Windows.',
    recommended: true,
    dirs: [os.tmpdir()],
  },
  {
    id: 'windows-temp',
    label: 'Fichiers temporaires (système)',
    description: 'Dossier C:\\Windows\\Temp (peut nécessiter des droits admin).',
    recommended: true,
    dirs: [join(WINROOT, 'Temp')],
  },
  {
    id: 'browser-cache',
    label: 'Cache navigateurs',
    description: 'Cache de Chrome et Microsoft Edge.',
    recommended: true,
    dirs: [
      join(LOCAL, 'Google', 'Chrome', 'User Data', 'Default', 'Cache', 'Cache_Data'),
      join(LOCAL, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache', 'Cache_Data'),
    ],
  },
  {
    id: 'thumbnails',
    label: 'Cache des miniatures',
    description: 'Miniatures de l\'explorateur Windows (régénérées automatiquement).',
    recommended: true,
    dirs: [],
    files: [
      { dir: join(LOCAL, 'Microsoft', 'Windows', 'Explorer'), pattern: /^thumbcache_.*\.db$/i },
    ],
  },
  {
    id: 'crash-dumps',
    label: 'Rapports de plantage',
    description: 'Fichiers de vidage mémoire des applications plantées.',
    recommended: true,
    dirs: [join(LOCAL, 'CrashDumps')],
  },
  {
    id: 'windows-update',
    label: 'Cache de mises à jour Windows',
    description: 'Anciens fichiers d\'installation (droits admin requis).',
    recommended: false,
    dirs: [join(WINROOT, 'SoftwareDistribution', 'Download')],
  },
  {
    id: 'recycle-bin',
    label: 'Corbeille',
    description: 'Vide la corbeille de tous les lecteurs.',
    recommended: true,
    dirs: [],
    special: 'recycle',
  },
];

async function pathSize(p: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  let entries;
  try {
    entries = await fs.readdir(p, { withFileTypes: true });
  } catch {
    return { bytes, files };
  }
  for (const e of entries) {
    const full = join(p, e.name);
    try {
      if (e.isDirectory()) {
        const sub = await pathSize(full);
        bytes += sub.bytes;
        files += sub.files;
      } else if (e.isFile()) {
        const st = await fs.stat(full);
        bytes += st.size;
        files += 1;
      }
    } catch {
      /* fichier verrouillé / inaccessible — ignoré */
    }
  }
  return { bytes, files };
}

async function matchFiles(dir: string, pattern: RegExp): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && pattern.test(e.name))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

async function recycleBinSize(): Promise<{ bytes: number; files: number }> {
  try {
    const ps =
      '$s=(New-Object -ComObject Shell.Application).NameSpace(0xA);' +
      '$b=0;$n=0;foreach($i in $s.Items()){$b+=$i.Size;$n++};Write-Output \"$b|$n\"';
    const { stdout } = await execp(`powershell -NoProfile -Command "${ps}"`, {
      timeout: 15000,
      windowsHide: true,
    });
    const [b, n] = stdout.trim().split('|');
    return { bytes: Number(b) || 0, files: Number(n) || 0 };
  } catch {
    return { bytes: 0, files: 0 };
  }
}

export async function scanClean(): Promise<CleanScan> {
  const categories: CleanCategory[] = [];
  for (const cat of CATEGORIES) {
    let bytes = 0;
    let files = 0;
    if (cat.special === 'recycle') {
      const r = await recycleBinSize();
      bytes = r.bytes;
      files = r.files;
    } else {
      for (const d of cat.dirs) {
        const r = await pathSize(d);
        bytes += r.bytes;
        files += r.files;
      }
      for (const f of cat.files || []) {
        for (const full of await matchFiles(f.dir, f.pattern)) {
          try {
            const st = await fs.stat(full);
            bytes += st.size;
            files += 1;
          } catch {
            /* ignore */
          }
        }
      }
    }
    categories.push({
      id: cat.id,
      label: cat.label,
      description: cat.description,
      sizeBytes: bytes,
      fileCount: files,
      recommended: cat.recommended,
    });
  }
  return {
    categories,
    totalBytes: categories.reduce((a, c) => a + c.sizeBytes, 0),
    scannedAt: Date.now(),
  };
}

async function emptyDir(dir: string): Promise<{ freed: number; removed: number; errors: number }> {
  let freed = 0;
  let removed = 0;
  let errors = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { freed, removed, errors };
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    try {
      const size = e.isDirectory() ? (await pathSize(full)).bytes : (await fs.stat(full)).size;
      await fs.rm(full, { recursive: true, force: true });
      freed += size;
      removed += 1;
    } catch {
      errors += 1; // fichier en cours d'utilisation
    }
  }
  return { freed, removed, errors };
}

export async function runClean(categoryIds: string[]): Promise<CleanResult> {
  const result: CleanResult = { freedBytes: 0, removedFiles: 0, errors: 0, perCategory: [] };

  for (const id of categoryIds) {
    const cat = CATEGORIES.find((c) => c.id === id);
    if (!cat) continue;
    let freed = 0;
    let removed = 0;

    if (cat.special === 'recycle') {
      const before = await recycleBinSize();
      try {
        await execp('powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', {
          timeout: 20000,
          windowsHide: true,
        });
        freed = before.bytes;
        removed = before.files;
      } catch {
        result.errors += 1;
      }
    } else {
      for (const d of cat.dirs) {
        const r = await emptyDir(d);
        freed += r.freed;
        removed += r.removed;
        result.errors += r.errors;
      }
      for (const f of cat.files || []) {
        for (const full of await matchFiles(f.dir, f.pattern)) {
          try {
            const st = await fs.stat(full);
            await fs.rm(full, { force: true });
            freed += st.size;
            removed += 1;
          } catch {
            result.errors += 1;
          }
        }
      }
    }

    result.freedBytes += freed;
    result.removedFiles += removed;
    result.perCategory.push({ id, freedBytes: freed, removedFiles: removed });
  }

  return result;
}
