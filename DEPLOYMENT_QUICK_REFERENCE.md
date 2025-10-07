# Quick Reference - Graceful Shutdown Fix Deployment

## Prerequisites
- Production server: **10.0.10.138**
- User: **escapeplan**
- Package: `/mnt/projects/escape-plan/escapeplan-app/dist/escapeplan_1.0.0_amd64.deb`

## 1-Minute Deployment

```bash
# 1. Copy package to server
scp /mnt/projects/escape-plan/escapeplan-app/dist/escapeplan_1.0.0_amd64.deb escapeplan@10.0.10.138:~/

# 2. Connect to server
ssh escapeplan@10.0.10.138

# 3. Test BEFORE (should take 90+ seconds)
time sudo systemctl restart escapeplan-api

# 4. Install fix
sudo dpkg -i ~/escapeplan_1.0.0_amd64.deb

# 5. Restart service
sudo systemctl restart escapeplan-api

# 6. Test AFTER (should take <10 seconds)
time sudo systemctl restart escapeplan-api

# 7. Verify logs
sudo journalctl -u escapeplan-api -n 50 | grep -E "SIGTERM|shutdown|Socket.IO"
```

## Expected Log Output

```
Oct 06 XX:XX:XX escapeplan node[XXXX]: SIGTERM received, starting graceful shutdown...
Oct 06 XX:XX:XX escapeplan node[XXXX]: Closing Socket.IO connections...
Oct 06 XX:XX:XX escapeplan node[XXXX]: Socket.IO closed
Oct 06 XX:XX:XX escapeplan node[XXXX]: Graceful shutdown complete
```

## Success Criteria
- ✅ Shutdown time: <10 seconds
- ✅ Logs show "Socket.IO closed"
- ✅ Logs show "Graceful shutdown complete"
- ✅ No "Killing..." or "SIGKILL" messages
- ✅ Service restarts successfully
- ✅ API responds: `curl http://localhost:4000/health`

## Quick Rollback

```bash
# If issues occur
sudo dpkg -r escapeplan
# Install previous version from backup
```

## Full Documentation
- **Detailed Guide**: `GRACEFUL_SHUTDOWN_FIX.md`
- **Summary**: `SHUTDOWN_FIX_SUMMARY.md`
- **Test Script**: `scripts/test-shutdown-fix.sh`

## Support
Check logs: `sudo journalctl -u escapeplan-api -n 100`
