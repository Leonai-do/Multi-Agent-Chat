---
id: CJCT-20250904-010
time: "2025-09-04T12:35:00-04:00"
type: code_change
files: ["src/components/MessageItem.tsx", "src/components/SettingsModal.tsx", "src/config.ts"]
rationale: "Inline collaboration trace with toolbar collapse; default-open toggle persisted in General settings"
---
Provide ONLY the minimal diff(s):
```diff
// src/components/MessageItem.tsx
@@
-import { logEvent } from '../state/logs';
+import { logEvent } from '../state/logs';
+import { getTraceDefaultOpen } from '../config';
@@
-const [isTraceVisible, setIsTraceVisible] = useState<boolean>(false);
+const [isTraceVisible, setIsTraceVisible] = useState<boolean>(getTraceDefaultOpen());
@@ (inside bubble, top)
+{message.role === 'model' && message.collaborationTrace && isTraceVisible && (
+  <div className="collaboration-inline">…</div>
+)}

// src/components/SettingsModal.tsx
@@
-import { LS_FLAG_VISION, LS_FLAG_FUNCTIONS } from '../config';
+import { LS_FLAG_VISION, LS_FLAG_FUNCTIONS, LS_TRACE_DEFAULT_OPEN } from '../config';
@@
+const [traceDefaultOpen, setTraceDefaultOpen] = useState<boolean>(true);
@@ (on open)
+setTraceDefaultOpen((localStorage.getItem(LS_TRACE_DEFAULT_OPEN) ?? '1') === '1');
@@ (save)
+localStorage.setItem(LS_TRACE_DEFAULT_OPEN, traceDefaultOpen ? '1' : '0');
@@ (General tab)
+<input type="checkbox" checked={traceDefaultOpen} onChange={e=>setTraceDefaultOpen(e.target.checked)} /> Keep collaboration trace open by default

// src/config.ts
@@
+export const LS_TRACE_DEFAULT_OPEN = 'trace-default-open';
+export const getTraceDefaultOpen = (): boolean => {
+  try { const v = localStorage.getItem(LS_TRACE_DEFAULT_OPEN); return v === null ? true : v === '1'; } catch { return true; }
+};
```
