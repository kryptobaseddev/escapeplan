# EscapePlan Installation Guide

Complete installation instructions for EscapePlan escape room management system.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Online Installation](#online-installation)
3. [Offline Installation](#offline-installation)
4. [Post-Installation Setup](#post-installation-setup)
5. [Network Configuration](#network-configuration)
6. [Upgrading](#upgrading)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements

#### Supported Devices
- **Raspberry Pi 4 Model B** (4GB RAM minimum, 8GB recommended)
- **Raspberry Pi 5** (4GB or 8GB)

#### Storage
- **16GB microSD card** minimum
- **32GB+ recommended** for production use (logs, media, backups)
- Class 10 or UHS-I speed rating recommended

#### Accessories
- **Power supply**: Official Raspberry Pi PSU or equivalent (5V/3A minimum)
- **Ethernet cable**: For initial setup (optional if using WiFi)
- **USB drive**: For offline installation (8GB+ recommended)

#### Optional
- **External SSD/HDD**: For camera recordings and backups
- **Heatsink/Fan**: For better thermal performance
- **Case**: Protective enclosure for Raspberry Pi

### Network Requirements

#### Online Installation
- Active internet connection (Ethernet or WiFi)
- 2-3GB download bandwidth
- Stable connection for initial setup

#### Offline Installation
- No internet required
- USB drive with downloaded releases
- Ethernet connection for file transfer (optional)

### Client Device Requirements
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- JavaScript enabled
- 1024x768 minimum screen resolution (tablet/desktop recommended)

---

## Online Installation

### Step 1: Download Release Files

1. **Visit the Releases Page**
   ```
   https://github.com/kryptobaseddev/escapeplan/releases/latest
   ```

2. **Download Required Files**
   - `escapeplan-base-vX.Y.Z.img.xz` (Base OS image, ~1.5GB)
   - `escapeplan-base-vX.Y.Z.img.xz.sha256` (Checksum file)
   - `escapeplan-app-vX.Y.Z.deb` (Application package, optional for updates)

3. **Verify Checksum** (Recommended)
   ```bash
   # On Linux/macOS
   sha256sum -c escapeplan-base-vX.Y.Z.img.xz.sha256

   # On Windows (PowerShell)
   Get-FileHash escapeplan-base-vX.Y.Z.img.xz -Algorithm SHA256
   ```

### Step 2: Flash Image to microSD Card

#### Method A: Using Raspberry Pi Imager (Recommended)

1. **Download Raspberry Pi Imager**
   - Visit: https://www.raspberrypi.com/software/
   - Install for your OS (Windows, macOS, Linux)

2. **Flash the Image**
   - Open Raspberry Pi Imager
   - Click "Choose OS" → "Use custom"
   - Select downloaded `.img.xz` file
   - Click "Choose Storage" → Select your microSD card
   - Click "Write" (no need to decompress first)
   - Wait 5-10 minutes for writing and verification

3. **Eject Safely**
   - Click "Continue" when finished
   - Safely eject microSD card

#### Method B: Using Command Line (Linux/macOS)

1. **Decompress and Flash**
   ```bash
   # Identify your microSD card device
   lsblk
   # Look for your card (e.g., /dev/sdb, /dev/mmcblk0)

   # Flash the image (replace /dev/sdX with your device)
   xzcat escapeplan-base-vX.Y.Z.img.xz | sudo dd of=/dev/sdX bs=4M status=progress oflag=sync

   # Sync and eject
   sync
   sudo eject /dev/sdX
   ```

2. **Important Notes**
   - Double-check device name (`lsblk` or `fdisk -l`)
   - Using wrong device will destroy data
   - Process takes 10-15 minutes

#### Method C: Using Balena Etcher (Cross-platform)

1. **Download Balena Etcher**
   - Visit: https://www.balena.io/etcher/
   - Install for your OS

2. **Flash the Image**
   - Open Balena Etcher
   - Click "Flash from file" → Select `.img.xz` file
   - Click "Select target" → Choose microSD card
   - Click "Flash!" and wait

### Step 3: First Boot

1. **Insert microSD Card**
   - Remove from computer
   - Insert into Raspberry Pi

2. **Connect Network** (Choose One)
   - **Option A**: Connect Ethernet cable
   - **Option B**: Use WiFi (see [Network Configuration](#network-configuration))

3. **Power On**
   - Connect power supply
   - Green LED will blink (disk activity)
   - First boot takes 2-3 minutes (services starting)

4. **Wait for Access Point**
   - After 2-3 minutes, WiFi network appears
   - SSID: `EscapePlan`
   - Password: `escapeplan2024`

### Step 4: Connect to EscapePlan

1. **Connect to WiFi**
   - On your tablet/phone/laptop
   - Join WiFi network: `EscapePlan`
   - Enter password: `escapeplan2024`

2. **Open Web Browser**
   - Navigate to: `https://10.10.10.1`
   - You'll see a certificate warning (expected)

3. **Accept Certificate**
   - Click "Advanced" or "Details"
   - Click "Proceed to 10.10.10.1" or "Accept Risk"
   - This is normal for self-signed certificates

4. **EscapePlan Login Page Appears**
   - You're now connected!
   - Proceed to [Post-Installation Setup](#post-installation-setup)

---

## Offline Installation

Perfect for locations without internet access.

### Step 1: Prepare USB Drive

1. **Download Release Files** (On Internet-Connected Computer)
   - Base OS image: `escapeplan-base-vX.Y.Z.img.xz`
   - Application package: `escapeplan-app-vX.Y.Z.deb`
   - Checksum files

2. **Format USB Drive**
   - Format as FAT32 or exFAT
   - Label: `ESCAPEPLAN` (optional)

3. **Copy Files to USB**
   ```
   USB Drive Root/
   ├── escapeplan-base-vX.Y.Z.img.xz
   ├── escapeplan-app-vX.Y.Z.deb
   └── checksums.sha256
   ```

### Step 2: Flash Image (Same as Online)

Follow [Online Installation - Step 2](#step-2-flash-image-to-microsd-card) to flash the base OS image.

### Step 3: Boot and Transfer Application

1. **First Boot** (Same as Online)
   - Insert microSD card
   - Power on Raspberry Pi
   - Wait for WiFi access point

2. **Connect to EscapePlan WiFi**
   - SSID: `EscapePlan`
   - Password: `escapeplan2024`

3. **Transfer Application Package**
   - Insert USB drive into Raspberry Pi
   - SSH into device (or use web terminal if available)
   ```bash
   # Default credentials (SSH)
   ssh escapeplan@10.10.10.1
   # Password: escapeplan

   # Mount USB drive (usually auto-mounted)
   ls /media/escapeplan/

   # Copy .deb package
   cp /media/escapeplan/escapeplan-app-vX.Y.Z.deb ~/

   # Install application
   sudo dpkg -i ~/escapeplan-app-vX.Y.Z.deb

   # Verify installation
   sudo systemctl status escapeplan-api
   sudo systemctl status escapeplan-web
   ```

4. **Access Web Interface**
   - Navigate to: `https://10.10.10.1`
   - Proceed to [Post-Installation Setup](#post-installation-setup)

---

## Post-Installation Setup

### Initial Configuration Wizard

1. **Create First Operator Account**
   - Username: Your choice (e.g., `admin`)
   - Email: Valid email address
   - Password: Strong password (12+ characters)
   - Role: Administrator

2. **Configure Location**
   - Business name
   - Address and contact information
   - Timezone selection
   - Operating hours

3. **Add Your First Game**
   - Game name and description
   - Difficulty rating
   - Duration and player capacity
   - Pricing tiers

4. **Optional: Camera Setup**
   - Add RTSP/MJPEG camera URLs
   - Test camera feeds
   - Configure recording settings

### Change Default Passwords

1. **Change WiFi Password**
   ```bash
   ssh escapeplan@10.10.10.1
   sudo nmcli connection modify EscapePlan-AP wifi-sec.psk "YourNewPassword"
   sudo nmcli connection down EscapePlan-AP
   sudo nmcli connection up EscapePlan-AP
   ```

2. **Change System User Password**
   ```bash
   passwd
   # Enter new password
   ```

3. **Change Database Password** (Advanced)
   ```bash
   sudo -u postgres psql
   ALTER USER escapeplan WITH PASSWORD 'new_secure_password';
   \q

   # Update application configuration
   sudo nano /opt/escapeplan/api/.env
   # Update DATABASE_URL password
   sudo systemctl restart escapeplan-api
   ```

### Configure Backup

1. **Enable Automatic Backups**
   ```bash
   sudo systemctl enable escapeplan-backup.timer
   sudo systemctl start escapeplan-backup.timer
   ```

2. **Test Backup**
   ```bash
   sudo /opt/escapeplan/scripts/backup.sh
   ls -lh /var/backups/escapeplan/
   ```

---

## Network Configuration

### Access Point Mode (Default)

EscapePlan creates its own WiFi network on first boot:

- **SSID**: `EscapePlan`
- **Password**: `escapeplan2024`
- **IP Range**: `10.10.10.0/24`
- **Gateway**: `10.10.10.1`
- **DHCP**: Enabled (10.10.10.100 - 10.10.10.200)

### Ethernet Connection

To access EscapePlan via Ethernet:

1. **Connect Ethernet Cable**
2. **Find IP Address**
   ```bash
   # On Raspberry Pi console
   ip addr show eth0
   ```
3. **Access via Browser**
   ```
   https://<ethernet-ip-address>
   ```

### Connecting to Existing WiFi

To connect EscapePlan to your existing WiFi network:

```bash
ssh escapeplan@10.10.10.1

# Scan available networks
sudo nmcli device wifi list

# Connect to network
sudo nmcli device wifi connect "YourSSID" password "YourPassword"

# Verify connection
ip addr show wlan0
```

### Static IP Configuration

```bash
sudo nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses 192.168.1.100/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "8.8.8.8,8.8.4.4"

sudo nmcli connection up "Wired connection 1"
```

---

## Upgrading

See [UPGRADE.md](UPGRADE.md) for detailed upgrade instructions.

### Quick Upgrade

```bash
# Download new .deb package
wget https://github.com/kryptobaseddev/escapeplan/releases/download/vX.Y.Z/escapeplan-app-vX.Y.Z.deb

# Backup database (important!)
sudo /opt/escapeplan/scripts/backup.sh

# Install upgrade
sudo dpkg -i escapeplan-app-vX.Y.Z.deb

# Restart services
sudo systemctl restart escapeplan-api escapeplan-web
```

---

## Troubleshooting

### WiFi Access Point Not Appearing

1. **Wait 3-5 Minutes**
   - First boot takes time
   - Services need to start

2. **Check LEDs**
   - Red LED: Power (should be solid)
   - Green LED: Activity (should blink occasionally)

3. **Try Ethernet Connection**
   - Connect Ethernet cable
   - SSH to device
   - Check NetworkManager status
   ```bash
   sudo systemctl status NetworkManager
   sudo nmcli connection show
   ```

### Cannot Connect to Web Interface

1. **Verify IP Address**
   ```bash
   # Should be 10.10.10.1 for WiFi AP
   ip addr show wlan0
   ```

2. **Check nginx Status**
   ```bash
   sudo systemctl status nginx
   ```

3. **Check Firewall**
   ```bash
   sudo iptables -L -n
   ```

4. **Test with curl**
   ```bash
   curl -k https://10.10.10.1
   ```

### Application Not Starting

1. **Check Service Status**
   ```bash
   sudo systemctl status escapeplan-api
   sudo systemctl status escapeplan-web
   ```

2. **Check Logs**
   ```bash
   sudo journalctl -u escapeplan-api -n 50
   sudo tail -f /opt/escapeplan/logs/api.log
   ```

3. **Verify Database**
   ```bash
   sudo -u postgres psql -c "\l"
   sudo -u postgres psql escapeplan -c "SELECT * FROM users LIMIT 1;"
   ```

### More Help

For additional troubleshooting, see:
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [GitHub Discussions](https://github.com/kryptobaseddev/escapeplan/discussions)
- [GitHub Issues](https://github.com/kryptobaseddev/escapeplan/issues)

---

## Next Steps

After successful installation:

1. Read [QUICKSTART.md](QUICKSTART.md) for a guided tour
2. Review [SECURITY.md](SECURITY.md) for security best practices
3. Explore the web interface and configure your games
4. Set up regular backups
5. Join the community discussions

---

**Need Help?** Visit [GitHub Discussions](https://github.com/kryptobaseddev/escapeplan/discussions)
