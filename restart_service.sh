#!/bin/bash

# LibreQoS Bufferbloat Test - Service Restart Script
# This script restarts the LibreQoS Bufferbloat Test service

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./restart_service.sh)"
  exit 1
fi

# Check which service is running
if systemctl is-active libreqos-bufferbloat-https.service &>/dev/null; then
  SERVICE_NAME="libreqos-bufferbloat-https.service"
  echo "Restarting HTTPS service..."
elif systemctl is-active libreqos-bufferbloat.service &>/dev/null; then
  SERVICE_NAME="libreqos-bufferbloat.service"
  echo "Restarting HTTP service..."
else
  echo "No LibreQoS Bufferbloat Test service is currently running."
  echo "Please start the service first using:"
  echo "  - For HTTP: systemctl start libreqos-bufferbloat.service"
  echo "  - For HTTPS: systemctl start libreqos-bufferbloat-https.service"
  exit 1
fi

# Restart the service
systemctl restart $SERVICE_NAME

# Check if restart was successful
if systemctl is-active $SERVICE_NAME &>/dev/null; then
  echo "Service restarted successfully!"
  echo "Service status:"
  systemctl status $SERVICE_NAME --no-pager
  
  # Install new dependencies if needed
  echo "Checking for new dependencies..."
  pip3 install -r /home/libreqos_bufferbloat_test/server/requirements.txt
  
  echo ""
  echo "To view logs: journalctl -u $SERVICE_NAME -f"
else
  echo "Failed to restart service. Please check the logs:"
  echo "journalctl -u $SERVICE_NAME -n 50"
  exit 1
fi

exit 0