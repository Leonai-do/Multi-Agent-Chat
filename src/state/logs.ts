export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface AppLog { ts: string; level: LogLevel; message: string; data?: any }

let buffer: AppLog[] = [];

export function addLog(level: LogLevel, message: string, data?: any) {
  const ts = new Date().toISOString();
  buffer.push({ ts, level, message, data });
  try {
    // Keep a rolling snapshot in localStorage for crash resilience
    localStorage.setItem('app-logs-snapshot', JSON.stringify(buffer.slice(-500)));
  } catch {}
}

export function getLogs(): AppLog[] { return buffer.slice(); }
export function clearLogs() { buffer = []; try { localStorage.removeItem('app-logs-snapshot'); } catch {} }

export function exportLogs(filename?: string) {
  const name = filename || `logs-session-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  const blob = new Blob([JSON.stringify(buffer, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

