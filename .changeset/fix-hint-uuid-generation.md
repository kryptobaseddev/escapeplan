---
"escapeplan-web": patch
---

fix(web): use safe UUID generation for hints

Replace direct crypto.randomUUID() call with safe uid() utility function that has proper browser compatibility checks. Prevents TypeError when crypto.randomUUID is not available.
