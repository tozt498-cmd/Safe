import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Resolver } from 'node:dns/promises';
import { performance } from 'node:perf_hooks';
import si from 'systeminformation';
import type {
  SpeedTestResult,
  PingResult,
  DnsCandidate,
  WifiNetwork,
  OpResult,
} from '../../shared/types.js';

const execp = promisify(exec);

// ---- Test de débit (Cloudflare, public) -----------------------------------
async function measurePing(samples = 6): Promise<{ avg: number; jitter: number }> {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    try {
      const t = performance.now();
      await fetch('https://speed.cloudflare.com/__down?bytes=1000');
      times.push(performance.now() - t);
    } catch {
      /* ignore */
    }
  }
  if (!times.length) return { avg: 0, jitter: 0 };
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const jitter =
    times.slice(1).reduce((a, t, i) => a + Math.abs(t - times[i]), 0) / Math.max(1, times.length - 1);
  return { avg: +avg.toFixed(1), jitter: +jitter.toFixed(1) };
}

export async function speedTest(): Promise<SpeedTestResult> {
  const { avg, jitter } = await measurePing();

  // Download
  let downloadMbps = 0;
  try {
    const bytes = 25_000_000;
    const t = performance.now();
    const res = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`);
    const buf = await res.arrayBuffer();
    const sec = (performance.now() - t) / 1000;
    downloadMbps = +((buf.byteLength * 8) / sec / 1e6).toFixed(1);
  } catch {
    /* hors-ligne */
  }

  // Upload
  let uploadMbps = 0;
  try {
    const payload = Buffer.alloc(8_000_000, 1);
    const t = performance.now();
    await fetch('https://speed.cloudflare.com/__up', { method: 'POST', body: payload });
    const sec = (performance.now() - t) / 1000;
    uploadMbps = +((payload.byteLength * 8) / sec / 1e6).toFixed(1);
  } catch {
    /* ignore */
  }

  return {
    downloadMbps,
    uploadMbps,
    pingMs: avg,
    jitterMs: jitter,
    server: 'Cloudflare',
    at: Date.now(),
  };
}

// ---- Ping / latence / perte de paquets ------------------------------------
export async function pingTest(host = '1.1.1.1', count = 12): Promise<PingResult> {
  let stdout = '';
  try {
    ({ stdout } = await execp(`ping -n ${count} ${host}`, { timeout: 25000, windowsHide: true }));
  } catch (e) {
    stdout = (e as { stdout?: string }).stdout || '';
  }

  const samples: number[] = [];
  const re = /[=<]\s?(\d+)\s?ms/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stdout))) samples.push(Number(m[1]));

  const received = samples.length;
  const packetLoss = +(((count - received) / count) * 100).toFixed(0);
  const avg = received ? samples.reduce((a, b) => a + b, 0) / received : 0;
  const jitter =
    received > 1
      ? samples.slice(1).reduce((a, t, i) => a + Math.abs(t - samples[i]), 0) / (received - 1)
      : 0;

  return {
    host,
    avgMs: +avg.toFixed(1),
    minMs: received ? Math.min(...samples) : 0,
    maxMs: received ? Math.max(...samples) : 0,
    jitterMs: +jitter.toFixed(1),
    packetLoss,
    samples,
  };
}

// ---- Benchmark DNS ---------------------------------------------------------
const DNS_LIST = [
  { name: 'Cloudflare', address: '1.1.1.1' },
  { name: 'Google', address: '8.8.8.8' },
  { name: 'Quad9', address: '9.9.9.9' },
  { name: 'OpenDNS', address: '208.67.222.222' },
  { name: 'AdGuard', address: '94.140.14.14' },
];

async function dnsLatency(address: string): Promise<number | null> {
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  resolver.setServers([address]);
  try {
    const t = performance.now();
    await resolver.resolve4('cloudflare.com');
    return +(performance.now() - t).toFixed(1);
  } catch {
    return null;
  }
}

export async function dnsBenchmark(): Promise<DnsCandidate[]> {
  const results = await Promise.all(
    DNS_LIST.map(async (d) => {
      const latencyMs = await dnsLatency(d.address);
      return { name: d.name, address: d.address, latencyMs, reachable: latencyMs != null };
    }),
  );
  return results.sort((a, b) => (a.latencyMs ?? 9999) - (b.latencyMs ?? 9999));
}

async function defaultIface(): Promise<string> {
  try {
    return (await si.networkInterfaceDefault()) || 'Wi-Fi';
  } catch {
    return 'Wi-Fi';
  }
}

export async function applyDns(address: string): Promise<OpResult> {
  const iface = await defaultIface();
  try {
    await execp(`netsh interface ip set dns name="${iface}" static ${address} primary`, {
      timeout: 10000,
      windowsHide: true,
    });
    return { ok: true, message: `DNS appliqué (${address}) sur « ${iface} ».` };
  } catch (e) {
    return {
      ok: false,
      message: 'Droits administrateur requis pour changer le DNS.',
      detail: (e as Error).message,
    };
  }
}

export async function flushDns(): Promise<OpResult> {
  try {
    await execp('ipconfig /flushdns', { timeout: 10000, windowsHide: true });
    return { ok: true, message: 'Cache DNS vidé avec succès.' };
  } catch (e) {
    return { ok: false, message: 'Échec du vidage du cache DNS.', detail: (e as Error).message };
  }
}

// ---- Optimisation TCP/IP ---------------------------------------------------
export async function tcpOptimize(): Promise<OpResult> {
  const cmds = [
    'netsh int tcp set global autotuninglevel=normal',
    'netsh int tcp set global ecncapability=enabled',
    'netsh int tcp set heuristics disabled',
    'netsh int tcp set global rss=enabled',
    'netsh int tcp set global timestamps=disabled',
  ];
  let applied = 0;
  for (const c of cmds) {
    try {
      await execp(c, { timeout: 8000, windowsHide: true });
      applied++;
    } catch {
      /* nécessite admin */
    }
  }
  if (applied === 0) {
    return { ok: false, message: 'Aucun réglage appliqué — relancez l\'application en administrateur.' };
  }
  return { ok: true, message: `${applied}/${cmds.length} optimisations TCP/IP appliquées.` };
}

// ---- Réinitialisation de la pile réseau ------------------------------------
export async function resetNetwork(): Promise<OpResult> {
  const cmds = ['netsh winsock reset', 'netsh int ip reset', 'ipconfig /flushdns'];
  let applied = 0;
  for (const c of cmds) {
    try {
      await execp(c, { timeout: 12000, windowsHide: true });
      applied++;
    } catch {
      /* admin requis */
    }
  }
  if (applied === 0) {
    return { ok: false, message: 'Réinitialisation refusée — droits administrateur requis.' };
  }
  return {
    ok: true,
    message: 'Pile réseau réinitialisée. Redémarrez le PC pour finaliser.',
    detail: `${applied}/${cmds.length} commandes exécutées`,
  };
}

// ---- Wi-Fi -----------------------------------------------------------------
export async function wifiScan(): Promise<WifiNetwork[]> {
  let current = { ssid: '', signal: 0, channel: 0 };
  try {
    const { stdout } = await execp('netsh wlan show interfaces', { timeout: 8000, windowsHide: true });
    const ssid = stdout.match(/^\s*SSID\s*:\s*(.+)$/m)?.[1]?.trim() || '';
    const sig = Number(stdout.match(/(?:Signal|Signal)\s*:\s*(\d+)%/)?.[1] || 0);
    const ch = Number(stdout.match(/(?:Channel|Canal)\s*:\s*(\d+)/)?.[1] || 0);
    current = { ssid, signal: sig, channel: ch };
  } catch {
    /* pas de Wi-Fi */
  }

  try {
    const { stdout } = await execp('netsh wlan show networks mode=bssid', {
      timeout: 10000,
      windowsHide: true,
    });
    const blocks = stdout.split(/\r?\n\r?\n/);
    const nets: WifiNetwork[] = [];
    let pendingSsid = '';
    let pendingAuth = '';
    for (const block of blocks) {
      const ssidM = block.match(/SSID\s+\d+\s*:\s*(.*)/);
      if (ssidM) pendingSsid = ssidM[1].trim();
      const authM = block.match(/(?:Authentication|Authentification)\s*:\s*(.+)/);
      if (authM) pendingAuth = authM[1].trim();
      const sigM = block.match(/Signal\s*:\s*(\d+)%/);
      const chM = block.match(/(?:Channel|Canal)\s*:\s*(\d+)/);
      if (sigM && pendingSsid) {
        nets.push({
          ssid: pendingSsid,
          signalPercent: Number(sigM[1]),
          channel: chM ? Number(chM[1]) : null,
          security: pendingAuth || 'Inconnu',
          frequency: chM && Number(chM[1]) > 14 ? 5 : 2.4,
          current: pendingSsid === current.ssid,
        });
      }
    }
    // dédoublonnage par SSID en gardant le meilleur signal
    const best = new Map<string, WifiNetwork>();
    for (const n of nets) {
      const ex = best.get(n.ssid);
      if (!ex || n.signalPercent > ex.signalPercent) best.set(n.ssid, n);
    }
    return [...best.values()].sort((a, b) => b.signalPercent - a.signalPercent);
  } catch {
    return [];
  }
}
