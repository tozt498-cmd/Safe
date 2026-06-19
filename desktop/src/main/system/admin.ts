import { execFile, execFileSync } from 'node:child_process';

/**
 * Indique si le processus courant dispose des droits administrateur.
 * `net session` échoue (code ≠ 0) si l'on n'est pas élevé — test fiable et rapide.
 */
export function isAdmin(): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(false);
    execFile('net', ['session'], { windowsHide: true }, (err) => resolve(!err));
  });
}

/**
 * Relance l'application AVEC les droits administrateur (déclenche l'UAC).
 * - Renvoie `true` si l'instance élevée a bien été lancée (UAC accepté).
 * - Renvoie `false` si l'utilisateur a refusé l'UAC ou en cas d'échec
 *   (l'appelant peut alors continuer normalement, en mode utilisateur).
 *
 * On passe `--elevated` à la nouvelle instance pour éviter toute boucle.
 */
export function relaunchAsAdmin(extraArgs: string[] = []): boolean {
  if (process.platform !== 'win32') return false;
  try {
    const exe = process.execPath.replace(/'/g, "''");
    const args = [...process.argv.slice(1).filter((a) => a !== '--elevated'), ...extraArgs];
    const argList = args.length
      ? '-ArgumentList ' + args.map((a) => `'${a.replace(/'/g, "''")}'`).join(',')
      : '';
    // -ErrorAction Stop + try/catch : si l'UAC est REFUSÉ, on sort avec le code 1
    // (sinon Start-Process échoue silencieusement et on quitterait l'app à tort).
    const cmd = `try { Start-Process -FilePath '${exe}' ${argList} -Verb RunAs -ErrorAction Stop } catch { exit 1 }`;
    // execFileSync : bloque le temps que l'utilisateur réponde à l'UAC.
    // Code de sortie ≠ 0 (refus/erreur) -> exception -> on retombe dans le catch.
    execFileSync('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', cmd], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}
