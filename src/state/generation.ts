/**
 * @file GenerationController coordinates a single generation run lifecycle.
 * It provides an AbortController signal, tracks isGenerating state,
 * and exposes a small event system for future extensibility.
 */

export type GenerationEventMap = {
  start: void;
  stop: void;
  finish: void;
};

type Listener<K extends keyof GenerationEventMap> = (payload: GenerationEventMap[K]) => void;

export class GenerationController {
  private controller: AbortController | null = null;
  private listeners: { [K in keyof GenerationEventMap]?: Set<Listener<K>> } = {} as any;
  public isGenerating = false;
  private runToken: symbol | null = null;

  /** Start a new run, creating a fresh AbortController. */
  start() {
    // If already generating, stop previous run first
    if (this.controller) {
      try { this.controller.abort(); } catch {}
    }
    this.controller = new AbortController();
    this.isGenerating = true;
    this.runToken = Symbol('generation-run');
    this.emit('start');
    return this.runToken;
  }

  /** Soft-finish a run (called in finally blocks). */
  finish(token?: symbol) {
    // Only finish if token matches current run, if provided
    if (token && this.runToken && token !== this.runToken) return;
    this.isGenerating = false;
    this.emit('finish');
    this.controller = null;
    this.runToken = null;
  }

  /** Returns the current run token, if any, for logging correlation. */
  get token(): symbol | null { return this.runToken; }

  /** Abort current run (user pressed Stop). */
  stop() {
    if (this.controller) {
      try { this.controller.abort(); } catch {}
    }
    this.isGenerating = false;
    this.emit('stop');
  }

  /** Get the AbortSignal for the current run. */
  get signal(): AbortSignal {
    if (!this.controller) {
      // Create a non-aborting signal as a fallback (for safety)
      const c = new AbortController();
      this.controller = c;
    }
    return this.controller.signal;
  }

  on<K extends keyof GenerationEventMap>(evt: K, cb: Listener<K>) {
    if (!this.listeners[evt]) this.listeners[evt] = new Set();
    (this.listeners[evt] as Set<Listener<K>>).add(cb);
    return () => (this.listeners[evt] as Set<Listener<K>>).delete(cb);
  }

  private emit<K extends keyof GenerationEventMap>(evt: K, payload?: GenerationEventMap[K]) {
    const set = this.listeners[evt] as Set<Listener<K>> | undefined;
    if (set) for (const cb of set) {
      try { cb(payload as GenerationEventMap[K]); } catch {}
    }
  }
}

export default GenerationController;
