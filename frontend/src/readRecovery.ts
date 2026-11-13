// Only the public, side-effect-free storefront GET path opts into this policy.
const transientStatuses = new Set([408, 500, 502, 503, 504]);

export class ReadRequestError extends Error {
  constructor(message: string, readonly recoverable: boolean) {
    super(message);
    this.name = 'ReadRequestError';
  }
}

export function isRecoverableReadError(error: unknown): boolean {
  return error instanceof ReadRequestError && error.recoverable;
}

export function isTransientReadStatus(status: number): boolean {
  return transientStatuses.has(status);
}

/** Initial attempt plus two retries. Parsing and business validation happen outside. */
export async function retryRead(request: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response: Response | undefined;
    try {
      response = await request(controller.signal);
    } catch (error) {
      const transient = controller.signal.aborted || error instanceof TypeError;
      if (!transient) throw error;
      if (attempt === 2) throw new ReadRequestError('errors.request_failed', true);
    } finally {
      clearTimeout(timeout);
    }
    if (response && (!isTransientReadStatus(response.status) || attempt === 2)) return response;
    // Release a failed response before opening another connection.
    if (response?.body) void response.body.cancel().catch(() => {});
    await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 500 : 1500));
  }
}
