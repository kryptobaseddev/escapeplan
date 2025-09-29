# EscapePlan dnsmasq configuration template
interface=wlan0
bind-interfaces
dhcp-range=10.10.10.100,10.10.10.199,12h
dhcp-option=option:router,10.10.10.1
dhcp-option=option:dns-server,10.10.10.1
domain=escapeplan.local
address=/escapeplan.local/10.10.10.1
