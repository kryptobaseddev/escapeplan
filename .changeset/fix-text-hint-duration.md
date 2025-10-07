---
"escapeplan-web": patch
---

fix(web): text hint duration too short

Change text hint auto-dismiss duration from hardcoded 3 seconds to configurable value read from timer broadcast (roomConfig.textHintDurationSeconds), defaulting to 60 seconds.
