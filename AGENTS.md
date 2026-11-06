# Architecture rules
- Supply-only CDT displays use the shared supplyOnly helpers for database rows and ProjectInfo, so screens and exports share the same fallback without changing CDT filter semantics.
- Caution date tracking is synchronized by database update triggers, not insert triggers, so imported and historical statuses never invent dates; the transition trigger also clears dates on « À demander »/« Non nécessaire » and resets obtention on return to « Demandée » (strict status values only).
- All app-level caution status changes go through updateCautionStatus (src/utils/cautionStatus.ts), which updates the status, history and relances; dates stay owned by the database trigger.
- ADV caution tracking uses a unique project/caution key; imports remap custom caution keys after recreating caution IDs.
- Caution focus uses shared date/export helpers and paginated reads, keeping Excel dates and date calculations consistent.
- Caution mutations return authoritative tracking after triggers; focus overlays pending changes, restores undo snapshots, and ADV views subscribe to same-tab notifications alongside Realtime to avoid stale displays.
- Historical caution recovery runs as an idempotent data script, matching exact project-scoped labels and rejecting duplicate custom names, to avoid assigning unrelated history dates.