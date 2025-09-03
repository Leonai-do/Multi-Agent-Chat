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

/**
 * Resolve Gemini API key from environment.
 * Prefers Vite-style `import.meta.env.VITE_GEMINI_API_KEY`,
 * falls back to `process.env.GEMINI_API_KEY` if defined.
 */
export const getGeminiApiKey = (): string | undefined => {
  const viteKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY as string | undefined;
  const nodeKey = (globalThis as any)?.process?.env?.GEMINI_API_KEY as string | undefined;
  return viteKey || nodeKey;
};

