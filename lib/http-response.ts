export class HttpResponseError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'HttpResponseError'; }
}
/** Keep gateway/login-page failures readable without exposing returned HTML. */
export async function readJsonResponse<T>(response: Response): Promise<T> {
  const unavailable = '連線暫時無法完成，請重新整理或稍後重試。 / Connection unavailable. Refresh or retry shortly.';
  if (response.redirected) throw new HttpResponseError('登入已逾時，請重新登入後重試。 / Your session has expired. Sign in again.', 401);
  let value: unknown;
  try { value = await response.json(); } catch { throw new HttpResponseError(unavailable, response.status); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpResponseError(unavailable, response.status);
  return value as T;
}

/** Retry only reads. Checkout and payment mutations must never replay. */
export async function fetchReadJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  if (init.method && init.method.toUpperCase() !== 'GET') throw new Error('Only GET requests can retry.');
  for (let attempt = 0; ; attempt++) {
    try {
      const timeout = AbortSignal.timeout(35000);
      const response = await fetch(url, {...init, method:'GET', signal:init.signal ? AbortSignal.any([init.signal, timeout]) : timeout});
      const value = await readJsonResponse<T & {error?:string}>(response);
      if (!response.ok) throw new HttpResponseError(value.error || '連線暫時無法完成，請重試。 / Connection unavailable. Please retry.', response.status);
      return value;
    } catch (error) {
      const retry = error instanceof HttpResponseError ? [408,502,503,504].includes(error.status) : error instanceof TypeError || error instanceof Error && error.name === 'TimeoutError';
      if (!retry || attempt >= 1 || init.signal?.aborted) throw error;
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
}
