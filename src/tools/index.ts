export type ToolCapabilities = {
  network: boolean;
};

export interface ToolExecuteParams<TInput = any> {
  input: TInput;
  signal?: AbortSignal;
}

export interface ToolResult<TOutput = any> {
  ok: boolean;
  data?: TOutput;
  error?: string;
}

export interface Tool<TInput = any, TOutput = any> {
  name: string;
  capabilities: ToolCapabilities;
  execute(params: ToolExecuteParams<TInput>): Promise<ToolResult<TOutput>>;
}

export type SearchInput = { query: string; maxResults?: number };
export type SearchDoc = { title: string; url: string; raw_content?: string };
export type SearchOutput = { results: SearchDoc[] };

