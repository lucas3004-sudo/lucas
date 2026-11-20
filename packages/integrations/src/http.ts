/**
 * Appels HTTP vers les sources publiques : délai maximal, nouvelles tentatives avec délai
 * croissant sur les erreurs temporaires (réseau, 429, 5xx). Des coupures ponctuelles ont été
 * constatées sur Géorisques et static.data.gouv.fr (docs/research/donnees-complementaires.md).
 */
export class SourceError extends Error {
  constructor(
    readonly source: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${source} : ${message}`);
  }
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface RequestOptions {
  source: string;
  retries?: number;
  timeoutMs?: number;
  init?: RequestInit;
  fetcher?: Fetcher;
  /** Pause entre tentatives (remplaçable dans les tests). */
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function request(url: string, options: RequestOptions): Promise<Response> {
  const { source, retries = 3, timeoutMs = 20_000, init, fetcher = fetch, sleep = wait } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
    try {
      const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) return response;
      if (response.status === 429 || response.status >= 500) {
        lastError = new SourceError(source, `réponse ${response.status}`, response.status);
        continue;
      }
      throw new SourceError(source, `réponse ${response.status}`, response.status);
    } catch (error) {
      if (error instanceof SourceError && error.status !== undefined && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    }
  }
  if (lastError instanceof SourceError) throw lastError;
  throw new SourceError(source, `indisponible après ${retries + 1} tentatives (${(lastError as Error)?.message ?? "erreur"})`);
}

export async function requestJson<T>(url: string, options: RequestOptions): Promise<T> {
  const response = await request(url, options);
  return (await response.json()) as T;
}
