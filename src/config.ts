/**
 * @file Centralized application configuration and constants.
 */

/** App title used in headers and metadata. */
export const APP_TITLE = 'Multi-Agent Chat';

/** Default input placeholder text. */
export const INPUT_PLACEHOLDER = 'Ask anything...';

/** LocalStorage keys. */
export const LS_CHATS_KEY = 'multi-agent-chats';
export const LS_TAVILY_KEY = 'tavily-api-key';
export const LS_GEMINI_KEY = 'gemini-api-key';
export const LS_AGENT_INSTRUCTIONS = 'agent-instructions';
export const LS_AGENT_NAMES = 'agent-names';
export const LS_GROQ_KEY = 'groq-api-key';
export const LS_PROVIDER_GLOBAL = 'provider-global';
export const LS_PROVIDER_PER_AGENT = 'provider-per-agent';
export const LS_MODEL_GLOBAL = 'model-global';
export const LS_MODEL_PER_AGENT = 'model-per-agent';
export const LS_FLAG_VISION = 'flag-vision-enabled';
export const LS_FLAG_FUNCTIONS = 'flag-functions-enabled';
export const LS_TRACE_DEFAULT_OPEN = 'trace-default-open';
export const LS_FLAG_INTERNET = 'flag-internet-enabled';
export const LS_TOOLS_INCLUDE_WEB = 'tools-include-web';
export const LS_TOOLS_MAX_SOURCES = 'tools-max-sources';
export const LS_AGENT_COUNT = 'agent-count';

/**
 * Resolve Gemini API key from environment.
 * Prefers Vite-style `import.meta.env.VITE_GEMINI_API_KEY`,
 * falls back to `process.env.GEMINI_API_KEY` if defined.
 */
export const getGeminiApiKey = (): string | undefined => {
  // Prefer user-provided key saved in localStorage (if present)
  try {
    const ls = (globalThis as any)?.localStorage?.getItem?.(LS_GEMINI_KEY) as string | null;
    if (ls && ls.trim()) return ls;
  } catch {}
  const viteKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY as string | undefined;
  const nodeKey = (globalThis as any)?.process?.env?.GEMINI_API_KEY as string | undefined;
  return viteKey || nodeKey;
};

/** Resolve Groq API key, same precedence as Gemini. */
export const getGroqApiKey = (): string | undefined => {
  try {
    const ls = (globalThis as any)?.localStorage?.getItem?.(LS_GROQ_KEY) as string | null;
    if (ls && ls.trim()) return ls;
  } catch {}
  const viteKey = (import.meta as any)?.env?.VITE_GROQ_API_KEY as string | undefined;
  const nodeKey = (globalThis as any)?.process?.env?.GROQ_API_KEY as string | undefined;
  return viteKey || nodeKey;
};

/** Feature flag helpers (default false). */
export const getVisionEnabled = (): boolean => {
  try { return localStorage.getItem(LS_FLAG_VISION) === '1'; } catch { return false; }
};
export const getFunctionsEnabled = (): boolean => {
  try { return localStorage.getItem(LS_FLAG_FUNCTIONS) === '1'; } catch { return false; }
};

/** Collaboration trace default visibility (default true). */
export const getTraceDefaultOpen = (): boolean => {
  try {
    const v = localStorage.getItem(LS_TRACE_DEFAULT_OPEN);
    if (v === null) return true; // default: open
    return v === '1';
  } catch {
    return true;
  }
};

export const getInternetEnabledFlag = (): boolean => {
  try { return localStorage.getItem(LS_FLAG_INTERNET) === '1'; } catch { return false; }
};

export const getIncludeWebResults = (): boolean => {
  try {
    const v = localStorage.getItem(LS_TOOLS_INCLUDE_WEB);
    return v === null ? true : v === '1';
  } catch { return true; }
};

export const getMaxWebSources = (): number => {
  try {
    const v = parseInt(localStorage.getItem(LS_TOOLS_MAX_SOURCES) || '3', 10);
    if (Number.isNaN(v)) return 3;
    return Math.min(Math.max(1, v), 10);
  } catch { return 3; }
};

export const getAgentCount = (): number => {
  try {
    const v = parseInt(localStorage.getItem(LS_AGENT_COUNT) || '4', 10);
    if (Number.isNaN(v)) return 4;
    return Math.max(1, Math.min(8, v));
  } catch { return 4; }
};
