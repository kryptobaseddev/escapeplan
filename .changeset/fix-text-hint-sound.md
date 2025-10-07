---
"escapeplan-api": patch
---

fix(api): default text hint sound not playing

Fix issue where default text hint sound asset configured in system settings wasn't playing. Changed from modifying readonly payload parameter to using local mutable variable that's properly passed to emitRoomDisplayMedia().
