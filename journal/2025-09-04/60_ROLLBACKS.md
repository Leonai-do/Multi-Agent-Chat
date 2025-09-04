---
id: CJCT-20250904-009
time: "2025-09-04T12:31:00-04:00"
type: rollback
reason: "Stability regression after adding early provisional + non-stream fallback in final synthesis"
scope: "src/components/App.tsx (final streaming path)"
fallback_state: "Restored baseline streaming; later checkpoint tag checkpoint-20250904-113255"
---
Steps taken:
- Reverted early provisional creation in final phase.
- Removed non-stream fallback write-back on empty stream.
- Restored original prompt and streaming loop logic.
Lessons:
- Separate UI work from pipeline risk; tune timeouts incrementally.
- Add targeted diagnostics before functional fallbacks.
