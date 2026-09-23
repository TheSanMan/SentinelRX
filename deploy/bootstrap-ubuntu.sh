#!/usr/bin/env bash
set -euo pipefail

# Run on an Ubuntu 24.04 Oracle VM as the default ubuntu user.
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Docker's official Ubuntu apt repository supplies Engine, Buildx and Compose.
. /etc/os-release
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker

# OCI Ubuntu images end INPUT with a reject rule. Permit public HTTP and HTTPS
# before that rule, and restore these two rules after each reboot.
sudo tee /usr/local/sbin/sentinelrx-open-web-ports >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
for port in 80 443; do
    if ! iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
        iptables -I INPUT 5 -p tcp --dport "$port" -j ACCEPT
    fi
done
EOF
sudo chmod 0755 /usr/local/sbin/sentinelrx-open-web-ports
sudo tee /etc/systemd/system/sentinelrx-web-firewall.service >/dev/null <<'EOF'
[Unit]
Description=Allow SentinelRx HTTP and HTTPS through the instance firewall
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/sentinelrx-open-web-ports
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now sentinelrx-web-firewall.service

docker --version
sudo docker compose version
