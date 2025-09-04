/**
 * @file Centralized application configuration and constants.
 */

/** App title used in headers and metadata. */
export const APP_TITLE = 'Multi-Agent Gemini Chat';

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
