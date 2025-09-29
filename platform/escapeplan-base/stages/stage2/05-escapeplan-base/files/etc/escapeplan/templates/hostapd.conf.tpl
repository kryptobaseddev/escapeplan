# EscapePlan hostapd configuration template
# Values replaced by EscapePlan control panel or CLI before enabling the service.
interface=wlan0
ssid=ESCAPEPLAN_NET
channel=6
hw_mode=g
wpa=2
auth_algs=1
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
wpa_passphrase=REPLACE_WITH_SECURE_PSK
ieee80211n=1
ieee80211ac=1
require_ht=1
