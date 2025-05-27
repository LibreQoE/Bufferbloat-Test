#!/bin/bash

# LibreQoS Bufferbloat Test - HTTPS Setup Script
# This script sets up Let's Encrypt certificates and configures the HTTPS service

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./setup_https.sh)"
  exit 1
fi

# Get domain name
if [ -z "$1" ]; then
  read -p "Enter your domain name (e.g., bufferbloat.example.com): " DOMAIN_NAME
else
  DOMAIN_NAME=$1
fi

echo "Setting up HTTPS for domain: $DOMAIN_NAME"

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
  echo "Installing certbot..."
  apt update
  apt install -y certbot
fi

# Stop any existing service that might be using port 80
systemctl stop libreqos-bufferbloat.service 2>/dev/null
systemctl stop nginx 2>/dev/null
systemctl stop apache2 2>/dev/null

# Obtain Let's Encrypt certificate
echo "Obtaining Let's Encrypt certificate for $DOMAIN_NAME..."
certbot certonly --standalone --non-interactive --agree-tos --email admin@$DOMAIN_NAME -d $DOMAIN_NAME

if [ $? -ne 0 ]; then
  echo "Failed to obtain Let's Encrypt certificate. Aborting."
  exit 1
fi

echo "Certificate obtained successfully!"

# Update the service file with the domain name
echo "Configuring HTTPS service..."
sed "s/DOMAIN_NAME/$DOMAIN_NAME/g" libreqos-bufferbloat-https.service > /etc/systemd/system/libreqos-bufferbloat-https.service

# Reload systemd daemon
systemctl daemon-reload

# Enable and start the HTTPS service
systemctl enable libreqos-bufferbloat-https.service
systemctl start libreqos-bufferbloat-https.service

echo "Checking service status..."
systemctl status libreqos-bufferbloat-https.service --no-pager

echo ""
echo "HTTPS setup complete!"
echo "You can access the LibreQoS Bufferbloat Test at: https://$DOMAIN_NAME/"
echo ""
echo "To view logs: journalctl -u libreqos-bufferbloat-https.service -f"
echo "To stop service: systemctl stop libreqos-bufferbloat-https.service"
echo "To restart service: systemctl restart libreqos-bufferbloat-https.service"

# Set up certificate renewal hook
echo "Setting up certificate renewal hook..."
mkdir -p /etc/letsencrypt/renewal-hooks/deploy

cat > /etc/letsencrypt/renewal-hooks/deploy/restart-libreqos.sh << EOF
#!/bin/bash
systemctl restart libreqos-bufferbloat-https.service
EOF

chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-libreqos.sh

echo "Certificate renewal hook created. The service will be restarted automatically when certificates are renewed."

exit 0