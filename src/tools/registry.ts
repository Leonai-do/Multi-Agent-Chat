import type { Tool } from './index';

const registry = new Map<string, Tool<any, any>>();

export function registerTool(tool: Tool<any, any>) {
  registry.set(tool.name, tool);
}

export function getTool<TIn = any, TOut = any>(name: string): Tool<TIn, TOut> | undefined {
  return registry.get(name) as Tool<TIn, TOut> | undefined;
}

export function listTools(): string[] {
  return Array.from(registry.keys());
}

