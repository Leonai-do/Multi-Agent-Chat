---
id: CJCT-20250904-005
time: "2025-09-04T12:16:00-04:00"
type: issue
severity: high
status: fixed
component: "pipeline/final-synthesis"
symptoms: ["final response empty after refinement", "intermittent ‘fetch failed’ shown to user"]
root_cause: "final stream occasionally delivers no chunks (first-chunk stall)"
files_modified: ["src/components/App.tsx", "vite.config.ts"]
commit_style: "diff"
---
TL;DR: Final stream sometimes returns no chunks; API key was also exposed client-side.
Evidence/Steps:
- Pipeline logs previously showed final_done length: 0.
- Network logs show 200 for /api/generateStream during successful runs.
Fix implemented (security):
- Added server proxy /api/tools/search using server-side TAVILY_API_KEY.
- App now calls the proxy; client no longer sends the key.
Fix attempted (stream):
- Non-stream fallback + earlier provisional; rolled back due to regressions.
Why:
- Fallback recovered text but affected stability; reverted to baseline while we isolate root cause.
Follow-ups:
- Align client step timeout with server idle; increase server idle timer.
- Add minimal diagnostics for empty-stream vs aborted.
 - Implemented client retry (3 attempts with backoff) and clearer 500 troubleshooting hint.
Code:
```diff
// Future change (planned)
- const stepTimer = setTimeout(() => stepController.abort(), 30000);
+ const stepTimer = setTimeout(() => stepController.abort(), 45000);
```
