---
id: CJCT-20250904-005
time: "2025-09-04T12:16:00-04:00"
type: issue
severity: high
status: open
component: "pipeline/final-synthesis"
symptoms: ["final response empty after refinement", "intermittent ‘fetch failed’ shown to user"]
root_cause: "final stream occasionally delivers no chunks (first-chunk stall)"
files_modified: ["src/components/App.tsx"]
commit_style: "diff"
---
TL;DR: Final stream sometimes returns no chunks; UI shows empty/‘fetch failed’.
Evidence/Steps:
- Pipeline logs previously showed final_done length: 0.
- Network logs show 200 for /api/generateStream during successful runs.
Fix attempted:
- Added non-streaming fallback + earlier provisional; rolled back due to regressions.
Why:
- Fallback recovered text but affected stability; reverted to baseline while we isolate root cause.
Follow-ups:
- Align client step timeout with server idle; increase server idle timer.
- Add minimal diagnostics for empty-stream vs aborted.
Code:
```diff
// Future change (planned)
- const stepTimer = setTimeout(() => stepController.abort(), 30000);
+ const stepTimer = setTimeout(() => stepController.abort(), 45000);
```
