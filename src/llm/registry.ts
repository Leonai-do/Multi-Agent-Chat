import type { LLMProvider, ProviderName } from './provider';

const providers = new Map<ProviderName, LLMProvider>();

export function registerProvider(p: LLMProvider) {
  providers.set(p.name, p);
}

export function getProvider(name: ProviderName): LLMProvider | undefined {
  return providers.get(name);
}

export function listProviders(): LLMProvider[] {
  return Array.from(providers.values());
}

