---
id: CJCT-20250904-008
time: "2025-09-04T12:28:00-04:00"
type: improvement
change: "Inline collaboration trace with default-open preference stored in settings"
impact: [ux, clarity]
measurement: "Reduce manual collapse toggles per run (track clicks/session)"
---
TL;DR: Trace renders at top and opens by default; fewer clicks.
Before → After:
- External wrapper below bubble → Inline section with divider at top.
- No default setting → General toggle persisted via localStorage.
Evidence:
- Visible toggle in Settings → General; trace appears open on new messages.
