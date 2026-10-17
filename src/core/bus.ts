/** Minimal event bus for cross-feature events, e.g. 'window:opened', 'theme:switched'. */
type Handler = (detail?: any) => void;
const handlers = new Map<string, Set<Handler>>();

export const bus = {
  on(event: string, fn: Handler): () => void {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(fn);
    return () => handlers.get(event)!.delete(fn);
  },
  emit(event: string, detail?: unknown): void {
    handlers.get(event)?.forEach((fn) => {
      try { fn(detail); } catch { /* one bad listener must not break the rest */ }
    });
  },
};
