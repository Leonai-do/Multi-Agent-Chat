/**
 * Provider SPI for text generation.
 */
export type ProviderName = 'gemini' | 'groq';

export interface ProviderCapabilities {
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
}

export interface GenerateParams {
  model: string;
  prompt: string;
  system?: string;
  signal?: AbortSignal;
}

export interface LLMProvider {
  name: ProviderName;
  capabilities: ProviderCapabilities;
  generateText(params: GenerateParams): Promise<string>;
  // Optional streaming in future
  generateStream?: (params: GenerateParams) => AsyncIterable<string>;
}

