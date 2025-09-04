---
id: CJCT-20250904-012
time: "2025-09-04T12:42:00-04:00"
type: backlog
priority: P1
owner: "pipeline"
---
Align final step timeouts: set client step timeout ≥ server idle to prevent premature aborts.

---
id: CJCT-20250904-013
time: "2025-09-04T12:42:30-04:00"
type: backlog
priority: P1
owner: "pipeline"
---
Add diagnostics when final stream yields 0 bytes vs aborted (log counters + first-chunk latency).

---
id: CJCT-20250904-014
time: "2025-09-04T12:43:00-04:00"
type: backlog
priority: P2
owner: "server"
---
Increase /api/generateStream idle timer from 25s to 45–60s to reduce first-chunk stalls.

---
id: CJCT-20250904-015
time: "2025-09-04T12:43:30-04:00"
type: backlog
priority: P2
owner: "settings-ui"
---
Extend General settings with rendering options (compact mode, timestamps visibility, toolbar density) post pipeline stabilization.

---
id: CJCT-20250904-016
time: "2025-09-04T12:44:00-04:00"
type: backlog
priority: P2
owner: "observability"
---
Add a small status badge showing first-chunk latency for final synthesis to surface slow streams.
