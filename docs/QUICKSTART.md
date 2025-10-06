# EscapePlan Quick Start Guide

Get up and running with EscapePlan in 5 minutes.

---

## Before You Begin

**You'll Need:**
- Raspberry Pi 4/5 with EscapePlan image flashed
- Tablet, phone, or laptop with WiFi
- 5 minutes

**Already Have the Image?** Continue below.
**Need to Flash?** See [INSTALLATION.md](INSTALLATION.md) first.

---

## Step 1: Power On (1 minute)

1. Insert microSD card with EscapePlan image into Raspberry Pi
2. Connect power supply
3. Wait 2-3 minutes for boot and services to start
4. Look for WiFi network named `EscapePlan` on your device

---

## Step 2: Connect to EscapePlan (1 minute)

1. **Join WiFi Network**
   - Network Name: `EscapePlan`
   - Password: `escapeplan2024`

2. **Open Web Browser**
   - Navigate to: `https://10.10.10.1`

3. **Accept Certificate Warning**
   - Click "Advanced" or "Details"
   - Click "Proceed to 10.10.10.1" (safe - it's your local device)

4. **EscapePlan Login Page Loads**
   - You're connected!

---

## Step 3: Create Your Account (1 minute)

1. **Click "Create First Account"**
   - This is the initial setup wizard

2. **Fill in Details**
   - Username: `admin` (or your choice)
   - Email: Your email address
   - Password: Strong password (12+ characters)
   - Role: Administrator (auto-selected)

3. **Click "Create Account"**
   - You're automatically logged in

---

## Step 4: Configure Your Location (1 minute)

1. **Business Information**
   - Business Name: "Your Escape Room Name"
   - Address: Full address
   - Phone: Contact number
   - Email: Business email

2. **Operating Settings**
   - Timezone: Select your timezone
   - Operating Hours: Set your schedule
   - Currency: USD, EUR, etc.

3. **Click "Save and Continue"**

---

## Step 5: Add Your First Game (1 minute)

1. **Game Details**
   - Name: "Prison Break" (or your game name)
   - Description: Brief description
   - Difficulty: 1-5 stars
   - Duration: 60 (minutes)

2. **Player Capacity**
   - Minimum Players: 2
   - Maximum Players: 8
   - Recommended: 4-6

3. **Pricing**
   - Base Price: $25 (or your price)
   - Per Person: Enabled/Disabled
   - Weekday/Weekend rates (optional)

4. **Click "Create Game"**

---

## You're Ready!

EscapePlan is now configured and ready to use.

### What You Can Do Now

#### Create a Booking
1. Click "Bookings" in navigation
2. Click "New Booking"
3. Select game, date, time
4. Add customer details
5. Save booking

#### Start a Session
1. Go to "Dashboard"
2. Find upcoming booking
3. Click "Start Session"
4. Monitor in real-time
5. End session when complete

#### View Reports
1. Click "Reports" in navigation
2. View daily/weekly/monthly statistics
3. Export data if needed

#### Add More Games
1. Click "Games" in navigation
2. Click "Add Game"
3. Fill in details
4. Upload images (optional)
5. Save

---

## Next Steps

### Security (Important!)

**Change Default WiFi Password**
```bash
ssh escapeplan@10.10.10.1
# Password: escapeplan

sudo nmcli connection modify EscapePlan-AP wifi-sec.psk "YourNewStrongPassword123"
sudo nmcli connection down EscapePlan-AP
sudo nmcli connection up EscapePlan-AP
```

**Change System Password**
```bash
ssh escapeplan@10.10.10.1
passwd
# Enter new password
```

### Optional Features

#### Add Camera Feeds
1. Go to Settings > Cameras
2. Click "Add Camera"
3. Enter RTSP or MJPEG URL
4. Test connection
5. Save

Example URLs:
- RTSP: `rtsp://camera-ip:554/stream`
- MJPEG: `http://camera-ip/mjpeg`

#### Configure Backup
```bash
# Enable automatic daily backups
sudo systemctl enable escapeplan-backup.timer
sudo systemctl start escapeplan-backup.timer

# Test backup
sudo /opt/escapeplan/scripts/backup.sh
```

#### Add Team Members
1. Go to Settings > Users
2. Click "Add User"
3. Set role (Admin, Manager, Operator)
4. Send invitation

---

## Common Tasks

### Check System Status
```bash
ssh escapeplan@10.10.10.1
sudo systemctl status escapeplan-api
sudo systemctl status escapeplan-web
```

### View Logs
```bash
# API logs
sudo tail -f /opt/escapeplan/logs/api.log

# nginx logs
sudo tail -f /var/log/nginx/access.log

# System logs
sudo journalctl -u escapeplan-api -f
```

### Restart Services
```bash
# Restart API
sudo systemctl restart escapeplan-api

# Restart Web
sudo systemctl restart escapeplan-web

# Restart nginx
sudo systemctl restart nginx
```

---

## Troubleshooting

### Can't See WiFi Network?

1. Wait 3-5 minutes (first boot is slow)
2. Check Raspberry Pi power LED (should be solid red)
3. Reboot: Unplug power, wait 10 seconds, plug back in

### Can't Access Web Interface?

1. Verify you're connected to `EscapePlan` WiFi
2. Check IP address is `10.10.10.1`
3. Try `http://10.10.10.1` (without HTTPS)
4. Clear browser cache or try incognito mode

### Certificate Warning Won't Go Away?

This is normal for first access:
1. Click "Advanced" or "Details"
2. Click "Proceed anyway" or "Accept risk"
3. The warning appears once per browser

### Forgot Password?

```bash
# Reset via SSH
ssh escapeplan@10.10.10.1
sudo /opt/escapeplan/scripts/reset-password.sh admin
# Follow prompts to set new password
```

---

## Getting Help

### Documentation
- [Installation Guide](INSTALLATION.md) - Complete setup instructions
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [Security Guide](SECURITY.md) - Best practices
- [Upgrade Guide](UPGRADE.md) - How to update

### Community
- [GitHub Discussions](https://github.com/kryptobaseddev/escapeplan/discussions) - Ask questions
- [GitHub Issues](https://github.com/kryptobaseddev/escapeplan/issues) - Report bugs

---

## Feature Overview

### Dashboard
- Real-time session monitoring
- Live camera feeds
- Quick stats (revenue, bookings, sessions)
- Today's schedule

### Games Library
- Add/edit/archive games
- Upload images and videos
- Set pricing and capacity
- Difficulty ratings and tags

### Bookings
- Online and walk-in bookings
- Calendar view
- Customer management
- Payment tracking

### Sessions
- Start/end sessions
- Real-time timers
- Team tracking
- Session notes and ratings

### Reports
- Revenue reports
- Booking analytics
- Game performance
- Customer insights
- Export to CSV/PDF

### Settings
- Location configuration
- User management
- Camera setup
- System preferences
- Backup/restore

---

## Mobile App (PWA)

EscapePlan is a Progressive Web App (PWA):

### Install on iOS
1. Open Safari
2. Navigate to `https://10.10.10.1`
3. Tap Share button
4. Tap "Add to Home Screen"
5. Tap "Add"

### Install on Android
1. Open Chrome
2. Navigate to `https://10.10.10.1`
3. Tap menu (three dots)
4. Tap "Install app" or "Add to Home Screen"
5. Tap "Install"

### Install on Desktop
1. Open Chrome/Edge
2. Navigate to `https://10.10.10.1`
3. Look for install icon in address bar
4. Click "Install"

---

## Tips and Tricks

### Keyboard Shortcuts
- `Ctrl+K` or `Cmd+K`: Quick search
- `Ctrl+N` or `Cmd+N`: New booking
- `Esc`: Close modal

### Faster Booking Entry
1. Use "Quick Book" for walk-ins
2. Save frequent customers
3. Use templates for repeat bookings

### Camera Tips
- Test cameras before opening
- Use wired connection for reliability
- Set up auto-archive for recordings

### Performance
- Restart services weekly for best performance
- Clear old sessions/logs monthly
- Use external storage for camera recordings

---

## What's Next?

Now that you're up and running:

1. Explore all features in the web interface
2. Set up your remaining games
3. Configure cameras (if applicable)
4. Add team members
5. Enable automatic backups
6. Read the security guide
7. Join the community discussions

**Happy Escaping!**

---

**Questions?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or ask in [Discussions](https://github.com/kryptobaseddev/escapeplan/discussions)
