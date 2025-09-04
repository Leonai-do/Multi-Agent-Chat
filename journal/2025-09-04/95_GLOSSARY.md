---
term: "Collaboration Trace"
definition: "Agents’ initial and refined responses shown alongside the final answer."
example: "Inline trace at top of model message with collapse/expand."

---
term: "Provisional message"
definition: "A temporary streamed message updated as chunks arrive."
example: "Final synthesis writes chunks into a provisional message."

---
term: "Final synthesis stream"
definition: "The last agent’s streamed output combining refined drafts."
example: "If chunks stall, final_done length can be 0."

---
term: "Default-open"
definition: "UI preference to show trace expanded on new renders."
example: "General setting keeps collaboration trace open by default."

---
term: "Idle timer"
definition: "Server-side cutoff if no bytes are written for some time."
example: "/api/generateStream idle set around 25s; consider 45–60s."

---
term: "Step timeout"
definition: "Client-side abort window for a phase step."
example: "Final step 30s; align with server idle to avoid aborts."

