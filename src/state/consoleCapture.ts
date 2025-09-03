import { logEvent } from './logs';

function safeSerialize(args: any[]): any[] {
  return args.map(a => {
    try {
      if (a instanceof Error) return { name: a.name, message: a.message, stack: a.stack };
      if (typeof a === 'object') return JSON.parse(JSON.stringify(a));
      return a;
    } catch {
      return String(a);
    }
  });
}

export function hookConsoleAndNetwork() {
  // Console capture
  const orig = { ...console } as any;
  ['log','info','warn','error'].forEach((lvl) => {
    const fn = (console as any)[lvl].bind(console);
    (console as any)[lvl] = (...args: any[]) => {
      try { logEvent('console', lvl as any, args.map(a => (a && a.message) || String(a)).join(' '), safeSerialize(args)); } catch {}
      fn(...args);
    };
  });

  // Window errors
  window.addEventListener('error', (ev) => {
    try { logEvent('errors', 'error', ev.message || 'window.onerror', { filename: (ev as any).filename, lineno: (ev as any).lineno, colno: (ev as any).colno, error: ev.error?.stack || String(ev.error) }); } catch {}
  });
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    try { logEvent('errors', 'error', 'unhandledrejection', { reason: (ev.reason && ev.reason.stack) || String(ev.reason) }); } catch {}
  });

  // Fetch capture
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = Date.now();
    let url = typeof input === 'string' ? input : (input as any).url;
    let method = (init && init.method) || (typeof input !== 'string' && (input as any).method) || 'GET';
    try { logEvent('network', 'info', 'fetch:start', { url, method }); } catch {}
    try {
      const res = await origFetch(input, init);
      const ms = Date.now() - started;
      try { logEvent('network', 'info', 'fetch:end', { url, method, status: (res as any).status, ms }); } catch {}
      return res;
    } catch (e: any) {
      const ms = Date.now() - started;
      try { logEvent('network', 'error', 'fetch:error', { url, method, ms, error: e?.message || String(e) }); } catch {}
      throw e;
    }
  };
}

