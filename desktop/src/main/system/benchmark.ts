import { Worker } from 'node:worker_threads';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import type { BenchmarkResult } from '../../shared/types.js';

const WINDOW_MS = 700;

// Charge de calcul déterministe (mélange entier/flottant).
const WORKLOAD = `
function bench(ms){
  const end = performance.now() + ms;
  let acc = 0, i = 0;
  while (performance.now() < end) {
    for (let k = 0; k < 20000; k++) {
      acc += Math.sqrt(i * 1.0001 + k) * Math.sin(k) + (i ^ k);
      i++;
    }
  }
  return i;
}
`;

function cpuSingle(): number {
  const fn = new Function(`${WORKLOAD}; return bench(${WINDOW_MS});`) as () => number;
  const iters = fn();
  return Math.round(iters / 1000);
}

function cpuWorker(): Promise<number> {
  const code = `
    const { performance } = require('node:perf_hooks');
    const { parentPort } = require('node:worker_threads');
    ${WORKLOAD}
    parentPort.postMessage(bench(${WINDOW_MS}));
  `;
  return new Promise((resolve) => {
    const w = new Worker(code, { eval: true });
    w.on('message', (n: number) => {
      resolve(n);
      w.terminate();
    });
    w.on('error', () => resolve(0));
  });
}

async function cpuMulti(): Promise<number> {
  const threads = Math.max(1, os.cpus().length);
  const counts = await Promise.all(Array.from({ length: threads }, () => cpuWorker()));
  return Math.round(counts.reduce((a, b) => a + b, 0) / 1000);
}

function memoryScore(): number {
  const N = 8_000_000;
  const arr = new Float64Array(N);
  const start = performance.now();
  let passes = 0;
  while (performance.now() - start < WINDOW_MS) {
    for (let i = 0; i < N; i++) arr[i] = arr[i] + i * 1.0001;
    passes++;
  }
  const sec = (performance.now() - start) / 1000;
  const mbProcessed = (passes * N * 8) / (1024 * 1024);
  return Math.round(mbProcessed / sec);
}

async function diskScore(): Promise<number> {
  const file = join(os.tmpdir(), `sm-bench-${Date.now()}.bin`);
  const sizeMB = 96;
  const buf = Buffer.alloc(sizeMB * 1024 * 1024, 7);
  try {
    let t = performance.now();
    await fs.writeFile(file, buf);
    const writeSec = (performance.now() - t) / 1000;
    t = performance.now();
    await fs.readFile(file);
    const readSec = (performance.now() - t) / 1000;
    const writeMBs = sizeMB / writeSec;
    const readMBs = sizeMB / readSec;
    return Math.round((writeMBs + readMBs) / 2);
  } catch {
    return 0;
  } finally {
    await fs.rm(file, { force: true }).catch(() => {});
  }
}

export async function runBenchmark(): Promise<BenchmarkResult> {
  const start = performance.now();
  const single = cpuSingle();
  const multi = await cpuMulti();
  const mem = memoryScore();
  const disk = await diskScore();

  // Score global pondéré (échelle indicative).
  const overall = Math.round(single * 0.25 + multi * 0.15 + mem * 0.0008 + disk * 1.2);

  return {
    cpuSingle: single,
    cpuMulti: multi,
    memoryScore: mem,
    diskScore: disk,
    overall,
    durationMs: Math.round(performance.now() - start),
    at: Date.now(),
  };
}
