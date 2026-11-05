# Architecture rules
- Caution date tracking is synchronized by database update triggers, not insert triggers, so imported and historical statuses never invent dates.
- ADV caution tracking uses a unique project/caution key; imports remap custom caution keys after recreating caution IDs.
- Caution focus uses shared date/export helpers and paginated reads, keeping Excel dates and date calculations consistent.