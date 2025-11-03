import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Purge PDFs older than specified hours */
export function purgeOldPdfs(storageDir: string, hours: number): void {
  const dir = resolve(storageDir);
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  try {
    const entries = readdirSync(dir).filter((f) => f.endsWith('.pdf'));
    for (const f of entries) {
      const fp = join(dir, f);
      try {
        const st = statSync(fp);
        if (st.mtimeMs < cutoff) unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
  } catch {
    // ignore missing dir etc.
  }
}
