---
"escapeplan-api": patch
---

Add retry logic for transient EROFS errors in backup system

Backup operations now retry up to 3 times on EROFS (read-only filesystem) errors, which can occur transiently during high I/O operations on Raspberry Pi.
