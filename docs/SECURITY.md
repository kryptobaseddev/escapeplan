# EscapePlan Security Guide

Security best practices and hardening guide for EscapePlan installations.

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Default Security Features](#default-security-features)
3. [Initial Setup Security](#initial-setup-security)
4. [Network Security](#network-security)
5. [Application Security](#application-security)
6. [System Hardening](#system-hardening)
7. [Data Protection](#data-protection)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Incident Response](#incident-response)
10. [Security Checklist](#security-checklist)

---

## Security Overview

### Threat Model

EscapePlan is designed for on-premises deployment in a trusted environment (escape room facility). Primary security concerns:

- **Physical Access**: Device in customer area
- **Network Access**: WiFi access point open to customers
- **Data Privacy**: Customer and booking information
- **Business Continuity**: Operational disruption

### Security Philosophy

- **Defense in Depth**: Multiple layers of security
- **Secure by Default**: Strong defaults out of the box
- **Least Privilege**: Minimal permissions required
- **Offline First**: No external dependencies reduces attack surface

---

## Default Security Features

EscapePlan includes these security features out of the box:

### Transport Layer Security (TLS)
- Self-signed certificate generated on first boot
- All HTTP traffic redirected to HTTPS
- Modern TLS 1.2+ only (no SSLv3, TLS 1.0/1.1)
- Strong cipher suites

### Web Server Hardening (nginx)
- Security headers enabled:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` (restrictive)
- Rate limiting enabled
- Request size limits
- Timeout protection

### Database Security
- PostgreSQL local access only (no network exposure)
- Peer authentication for system user
- Password authentication for application
- Encrypted password storage (bcrypt)

### Application Security
- JWT token authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt (cost factor 12)
- Input validation and sanitization
- SQL injection protection (parameterized queries)
- XSS protection (output encoding)
- CSRF protection

### System Security
- Firewall enabled (iptables)
- SSH enabled with password authentication
- Automatic security updates (optional)
- Log rotation configured
- Service isolation (systemd sandboxing)

---

## Initial Setup Security

### First Boot Security Tasks

**CRITICAL**: Perform these tasks immediately after first boot.

#### 1. Change Default WiFi Password

```bash
# Connect to device
ssh escapeplan@10.10.10.1
# Password: escapeplan

# Change WiFi password (minimum 12 characters)
sudo nmcli connection modify EscapePlan-AP wifi-sec.psk "YourStrongPassword123!"
sudo nmcli connection down EscapePlan-AP
sudo nmcli connection up EscapePlan-AP
```

**Recommended Password Requirements**:
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Not a dictionary word
- Unique to this device

#### 2. Change System User Password

```bash
# Change escapeplan user password
passwd
# Enter current password: escapeplan
# Enter new strong password (twice)
```

#### 3. Create Administrator Account

```bash
# Via web interface (first login)
# Navigate to https://10.10.10.1
# Complete setup wizard
# Create first operator account with strong password
```

**Administrator Password Requirements**:
- Minimum 12 characters
- Include uppercase, lowercase, numbers, symbols
- Avoid common patterns
- Use password manager

#### 4. Configure Firewall

```bash
# Default firewall rules are secure
# Verify configuration
sudo iptables -L -n

# If needed, restrict SSH access
sudo iptables -A INPUT -p tcp --dport 22 -s 10.10.10.0/24 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j DROP

# Save rules
sudo netfilter-persistent save
```

---

## Network Security

### WiFi Access Point Security

#### Change SSID (Optional)

```bash
# Change network name
sudo nmcli connection modify EscapePlan-AP wifi.ssid "YourBusinessName-WiFi"
sudo nmcli connection down EscapePlan-AP
sudo nmcli connection up EscapePlan-AP
```

#### WiFi Encryption

- **Default**: WPA2-PSK (secure)
- **Recommended**: Keep WPA2-PSK
- **Not Recommended**: WPA3 (limited device support), WEP (insecure), Open (very insecure)

#### MAC Address Filtering (Optional)

```bash
# List connected devices
sudo nmcli device wifi list

# Add MAC whitelist (if needed for restricted access)
sudo nmcli connection modify EscapePlan-AP wifi.mac-address-blacklist ""
sudo nmcli connection modify EscapePlan-AP wifi.mac-address-whitelist "AA:BB:CC:DD:EE:FF,11:22:33:44:55:66"
```

**Note**: MAC filtering provides minimal security (easily spoofed) but can limit casual access.

#### Client Isolation (Optional)

```bash
# Enable client isolation (prevents clients from seeing each other)
# Edit hostapd configuration
sudo nano /etc/NetworkManager/system-connections/EscapePlan-AP.nmconnection

# Add under [wifi] section:
# ap-isolation=1

# Restart connection
sudo nmcli connection down EscapePlan-AP
sudo nmcli connection up EscapePlan-AP
```

### Network Isolation

EscapePlan uses isolated network (`10.10.10.0/24`):

- **Gateway**: 10.10.10.1 (Raspberry Pi)
- **Client Range**: 10.10.10.100-200
- **No Internet Access**: By default (air-gapped)

#### Enable Internet Access (If Needed)

```bash
# Enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

# Add NAT rule (replace eth0 with your uplink interface)
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT
sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT

# Save rules
sudo netfilter-persistent save
```

**Warning**: Enabling internet access increases attack surface. Only enable if necessary.

### Port Security

**Default Open Ports**:
- 22/tcp: SSH (internal only)
- 80/tcp: HTTP (redirects to HTTPS)
- 443/tcp: HTTPS (web interface)
- 5432/tcp: PostgreSQL (localhost only, not exposed)

**Verify Open Ports**:
```bash
sudo ss -tulpn | grep LISTEN
```

---

## Application Security

### Authentication

#### Password Policy

**Enforced Requirements**:
- Minimum 8 characters (12+ recommended)
- Must include letters and numbers
- Case-sensitive

**Best Practices**:
- Use password manager
- Unique passwords per user
- Regular password rotation (90 days)
- Avoid password reuse

#### JWT Token Security

```bash
# Change default JWT secret (CRITICAL)
sudo nano /opt/escapeplan/api/.env

# Set strong random secret
JWT_SECRET="$(openssl rand -base64 32)"
JWT_EXPIRY="8h"

# Restart API
sudo systemctl restart escapeplan-api
```

**JWT Configuration**:
- Tokens expire after 8 hours (default)
- Refresh tokens not implemented (re-login required)
- Tokens stored in memory only (not localStorage)

#### Session Management

```bash
# Configure session timeout
sudo nano /opt/escapeplan/api/.env

# Add/modify
SESSION_TIMEOUT_MINUTES=480  # 8 hours
IDLE_TIMEOUT_MINUTES=30      # 30 minutes idle

# Restart API
sudo systemctl restart escapeplan-api
```

### Authorization

#### Role-Based Access Control (RBAC)

**Default Roles**:
- **Administrator**: Full system access
- **Manager**: Manage bookings, games, reports
- **Operator**: Create bookings, start/end sessions
- **Customer**: View own bookings (future feature)

**Permission Audit**:
```bash
# List users and roles
sudo -u postgres psql escapeplan -c "SELECT id, username, email, role, is_active FROM users;"

# Review recent authentication attempts
sudo grep -i "auth" /opt/escapeplan/logs/api.log | tail -20
```

### Input Validation

**Built-in Protection**:
- SQL injection: Parameterized queries (Drizzle ORM)
- XSS: Output encoding (React)
- CSRF: Token-based protection
- File upload: Type and size restrictions
- Rate limiting: Login attempts, API requests

**Custom Validation**:
```bash
# Configure rate limits
sudo nano /etc/nginx/sites-available/escapeplan

# Adjust if needed
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;

# Reload nginx
sudo systemctl reload nginx
```

---

## System Hardening

### SSH Hardening

#### Disable SSH Password Authentication (Use Keys)

```bash
# Generate SSH key on client device
ssh-keygen -t ed25519 -C "escapeplan-admin"

# Copy public key to Raspberry Pi
ssh-copy-id escapeplan@10.10.10.1

# Verify key login works
ssh -i ~/.ssh/id_ed25519 escapeplan@10.10.10.1

# Disable password authentication
sudo nano /etc/ssh/sshd_config

# Set these values:
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
PermitEmptyPasswords no

# Restart SSH
sudo systemctl restart ssh
```

#### Change SSH Port (Security Through Obscurity)

```bash
# Change SSH port from 22 to custom port
sudo nano /etc/ssh/sshd_config

# Change line:
Port 2222

# Update firewall
sudo iptables -A INPUT -p tcp --dport 2222 -j ACCEPT
sudo iptables -D INPUT -p tcp --dport 22 -j ACCEPT
sudo netfilter-persistent save

# Restart SSH
sudo systemctl restart ssh

# Connect using new port
ssh -p 2222 escapeplan@10.10.10.1
```

### User Account Security

#### Disable Unused Accounts

```bash
# List all users
cat /etc/passwd

# Disable unused accounts (if any)
sudo usermod -L username
```

#### Sudo Configuration

```bash
# Review sudo access
sudo cat /etc/sudoers.d/010_escapeplan

# escapeplan user has passwordless sudo for system management
# Consider requiring password for production:
sudo nano /etc/sudoers.d/010_escapeplan

# Change to:
escapeplan ALL=(ALL) ALL
```

### File System Security

#### Set Correct Permissions

```bash
# Verify application permissions
ls -la /opt/escapeplan/

# Correct ownership if needed
sudo chown -R escapeplan:escapeplan /opt/escapeplan/
sudo chmod 750 /opt/escapeplan/api/
sudo chmod 755 /opt/escapeplan/web/

# Protect configuration files
sudo chmod 600 /opt/escapeplan/api/.env
sudo chown escapeplan:escapeplan /opt/escapeplan/api/.env

# Protect uploads directory
sudo chmod 755 /opt/escapeplan/uploads/
sudo chown escapeplan:escapeplan /opt/escapeplan/uploads/
```

#### Enable Audit Logging (Optional)

```bash
# Install auditd
sudo apt install auditd

# Monitor sensitive files
sudo auditctl -w /opt/escapeplan/api/.env -p rwa -k escapeplan-config
sudo auditctl -w /etc/passwd -p wa -k user-modification
sudo auditctl -w /etc/shadow -p wa -k password-modification

# View audit logs
sudo ausearch -k escapeplan-config
```

---

## Data Protection

### Database Security

#### Change Database Password

```bash
# Generate strong password
NEW_DB_PASSWORD="$(openssl rand -base64 24)"

# Change PostgreSQL password
sudo -u postgres psql -c "ALTER USER escapeplan WITH PASSWORD '$NEW_DB_PASSWORD';"

# Update application configuration
sudo nano /opt/escapeplan/api/.env

# Update DATABASE_URL
DATABASE_URL="postgresql://escapeplan:$NEW_DB_PASSWORD@localhost:5432/escapeplan"

# Restart API
sudo systemctl restart escapeplan-api
```

#### Database Encryption at Rest (Optional)

```bash
# Use LUKS encryption for data partition
# Requires advanced setup - see Debian LUKS documentation

# Alternative: Encrypt microSD card backup images
gpg --symmetric --cipher-algo AES256 backup.img
```

#### Connection Security

```bash
# Verify PostgreSQL only listens locally
sudo ss -tulpn | grep 5432

# Should show:
# tcp   LISTEN  0  128  127.0.0.1:5432  0.0.0.0:*

# If exposed externally, fix with:
sudo nano /etc/postgresql/15/main/postgresql.conf
# Set: listen_addresses = 'localhost'
sudo systemctl restart postgresql
```

### Backup Security

#### Encrypt Backups

```bash
# Modify backup script to encrypt
sudo nano /opt/escapeplan/scripts/backup.sh

# Add encryption after pg_dump
pg_dump escapeplan | gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /etc/escapeplan/backup-key > backup.sql.gpg

# Store encryption key securely
sudo mkdir -p /etc/escapeplan
sudo openssl rand -base64 32 > /etc/escapeplan/backup-key
sudo chmod 600 /etc/escapeplan/backup-key
```

#### Secure Backup Storage

```bash
# Store backups on separate device
# Use external USB drive or network storage

# Mount external storage
sudo mkdir /mnt/backup
sudo mount /dev/sda1 /mnt/backup

# Copy backups
sudo cp /var/backups/escapeplan/*.sql /mnt/backup/

# Unmount when done
sudo umount /mnt/backup
```

#### Backup Retention

```bash
# Configure backup retention policy
sudo nano /opt/escapeplan/scripts/backup.sh

# Keep last 7 daily, 4 weekly, 6 monthly backups
# Add cleanup script:
find /var/backups/escapeplan -name "daily-*.sql" -mtime +7 -delete
find /var/backups/escapeplan -name "weekly-*.sql" -mtime +28 -delete
find /var/backups/escapeplan -name "monthly-*.sql" -mtime +180 -delete
```

### Data Sanitization

#### Remove Sensitive Data

```bash
# Delete old sessions with personal data
sudo -u postgres psql escapeplan -c "DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '1 year';"

# Archive bookings older than 2 years
sudo -u postgres psql escapeplan -c "UPDATE bookings SET archived = true WHERE created_at < NOW() - INTERVAL '2 years';"
```

#### GDPR Compliance (If Applicable)

```bash
# Export customer data (data portability)
sudo -u postgres psql escapeplan -c "\copy (SELECT * FROM customers WHERE id = 'customer-id') TO 'customer-data.csv' CSV HEADER;"

# Delete customer data (right to be forgotten)
sudo -u postgres psql escapeplan -c "DELETE FROM customers WHERE id = 'customer-id';"
# Note: Implement proper cascading deletes in application
```

---

## Monitoring and Logging

### Log Management

#### Configure Log Retention

```bash
# Configure logrotate
sudo nano /etc/logrotate.d/escapeplan

# Add:
/opt/escapeplan/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 640 escapeplan escapeplan
}

# Test configuration
sudo logrotate -d /etc/logrotate.d/escapeplan
```

#### Monitor Critical Events

```bash
# Watch authentication failures
sudo tail -f /opt/escapeplan/logs/api.log | grep -i "auth failed"

# Monitor sudo usage
sudo tail -f /var/log/auth.log | grep sudo

# Check failed SSH attempts
sudo grep "Failed password" /var/log/auth.log | tail -20
```

### Intrusion Detection

#### Install fail2ban

```bash
# Install fail2ban
sudo apt install fail2ban

# Configure for SSH
sudo nano /etc/fail2ban/jail.local

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600

# Start fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status sshd
```

#### Monitor System Resources

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Check running processes
htop

# Monitor disk I/O
sudo iotop

# Monitor network usage
sudo nethogs wlan0
```

### Security Auditing

#### Perform Regular Security Audits

```bash
# Check for rootkits
sudo apt install rkhunter
sudo rkhunter --update
sudo rkhunter --check

# Scan for vulnerabilities
sudo apt install lynis
sudo lynis audit system

# Review audit report
sudo cat /var/log/lynis-report.dat
```

#### Review User Activity

```bash
# Last logins
last -20

# Currently logged in users
who

# Login history
sudo cat /var/log/auth.log | grep "Accepted password" | tail -20

# Failed login attempts
sudo cat /var/log/auth.log | grep "Failed password" | tail -20
```

---

## Incident Response

### Suspected Compromise

If you suspect security breach:

#### 1. Isolate System

```bash
# Disconnect from network immediately
sudo nmcli connection down EscapePlan-AP
sudo ifconfig eth0 down
sudo ifconfig wlan0 down
```

#### 2. Collect Evidence

```bash
# Capture current state
ps auxf > ~/processes.txt
netstat -tulpn > ~/connections.txt
sudo iptables -L -n > ~/firewall.txt
last -20 > ~/logins.txt

# Copy logs
sudo tar -czf ~/security-incident-$(date +%Y%m%d-%H%M%S).tar.gz \
  /var/log/auth.log \
  /var/log/syslog \
  /opt/escapeplan/logs/ \
  ~/processes.txt \
  ~/connections.txt \
  ~/firewall.txt \
  ~/logins.txt
```

#### 3. Analyze Compromise

```bash
# Check for suspicious processes
ps auxf | grep -v "\["  # Non-kernel processes

# Check for unauthorized users
cat /etc/passwd | grep "/bin/bash"

# Check for suspicious cron jobs
sudo crontab -l
sudo cat /etc/crontab
ls -la /etc/cron.*

# Check for modified system files
sudo debsums -c 2>&1 | grep FAIL
```

#### 4. Contain and Remediate

```bash
# Kill suspicious processes
sudo kill -9 <PID>

# Disable compromised accounts
sudo usermod -L username

# Change all passwords immediately
passwd
sudo -u postgres psql -c "ALTER USER escapeplan WITH PASSWORD 'new-password';"

# Update application JWT secret
sudo nano /opt/escapeplan/api/.env
# Change JWT_SECRET

# Restart services
sudo systemctl restart escapeplan-api escapeplan-web
```

#### 5. Restore from Backup (If Necessary)

```bash
# Stop services
sudo systemctl stop escapeplan-api escapeplan-web

# Restore database
sudo -u postgres dropdb escapeplan
sudo -u postgres createdb escapeplan
sudo -u postgres psql escapeplan < /var/backups/escapeplan/backup-YYYYMMDD.sql

# Re-flash microSD if system compromised
# Use clean backup image
```

#### 6. Review and Harden

- Review incident cause
- Apply necessary patches
- Implement additional security measures
- Update security procedures
- Document incident and response

---

## Security Checklist

### Initial Setup
- [ ] Change default WiFi password
- [ ] Change system user password
- [ ] Create administrator account with strong password
- [ ] Change JWT secret
- [ ] Configure firewall
- [ ] Enable automatic security updates

### Network Security
- [ ] WiFi password minimum 12 characters
- [ ] SSID changed to non-default (optional)
- [ ] Client isolation enabled (optional)
- [ ] Internet access disabled (unless needed)
- [ ] Firewall rules verified

### Application Security
- [ ] All default passwords changed
- [ ] Strong password policy enforced
- [ ] JWT token expiry configured
- [ ] Role-based access reviewed
- [ ] Rate limiting enabled

### System Hardening
- [ ] SSH key authentication enabled
- [ ] SSH password auth disabled
- [ ] Unused services disabled
- [ ] File permissions correct
- [ ] Audit logging enabled (optional)

### Data Protection
- [ ] Database password changed
- [ ] Automatic backups enabled
- [ ] Backup encryption configured
- [ ] Backup retention policy set
- [ ] Off-site backup storage

### Monitoring
- [ ] Log rotation configured
- [ ] fail2ban installed and configured
- [ ] Security auditing scheduled
- [ ] Monitoring alerts configured
- [ ] Incident response plan documented

### Ongoing Maintenance
- [ ] Apply security updates monthly
- [ ] Review logs weekly
- [ ] Test backups monthly
- [ ] Security audit quarterly
- [ ] Password rotation (90 days)

---

## Additional Resources

### Security Tools

- **rkhunter**: Rootkit detection
- **lynis**: Security auditing
- **fail2ban**: Intrusion prevention
- **ufw**: Simpler firewall frontend
- **clamav**: Antivirus (optional)

### External Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email: security@escapeplan.example (if available)
3. Or report via GitHub Security Advisory
4. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

**Security is an ongoing process. Stay vigilant and keep your system updated.**
