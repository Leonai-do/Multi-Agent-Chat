---
id: CJCT-20250904-006
time: "2025-09-04T12:20:00-04:00"
type: win
proof: ["settings toggle visible in General", "commit checkpoint-20250904-113255"]
impact: [usability, clarity]
---
TL;DR: Collaboration trace default-open toggle shipped; checkpoint created.
What changed / why it matters:
Added a first General setting so users can keep the trace open by default. This reduces clicking and clarifies agent context. Saved a checkpoint commit/tag for safe rollback and auditing.
---
id: CJCT-20250904-018
time: "2025-09-04T12:58:00-04:00"
type: win
proof: ["vite.config.ts middleware /api/tools/search", "App.tsx now hits /api/tools/search"]
impact: [reliability, security]
---
TL;DR: Web search now routed through server proxy; Tavily key protected.
What changed / why it matters:
Moved Tavily API requests behind a server endpoint so the API key never leaves the server. This removes a critical client-side secret exposure while preserving functionality.
