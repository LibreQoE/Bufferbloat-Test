# Setting Up HTTPS with HTTP/2 Support

This guide explains how to set up HTTPS with HTTP/2 support for the LibreQoS Bufferbloat Test using Let's Encrypt certificates and Hypercorn.

## Prerequisites

- A domain name pointing to your server (e.g., `bufferbloat.example.com`)
- Ubuntu Server 22.04 or 24.04
- Root or sudo access
- Port 80 and 443 open in your firewall

## Option 1: Automated Setup (Recommended)

We've provided a script that automates the entire HTTPS setup process:

1. Make the script executable (if not already):
   ```bash
   chmod +x setup_https.sh
   ```

2. Run the script with your domain name:
   ```bash
   sudo ./setup_https.sh yourdomain.example.com
   ```
   
   Or run it without arguments to be prompted for your domain:
   ```bash
   sudo ./setup_https.sh
   ```

3. The script will:
   - Install certbot if needed
   - Obtain Let's Encrypt certificates for your domain
   - Configure the systemd service to use HTTPS with HTTP/2 support
   - Set up automatic certificate renewal
   - Start the HTTPS service with HTTP/2 enabled

4. Once complete, access your application at:
   ```
   https://yourdomain.example.com
   ```

## Option 2: Manual Setup

If you prefer to set up HTTPS manually, follow these steps:

### Step 1: Install Certbot

```bash
sudo apt update
sudo apt install -y certbot
```

### Step 2: Obtain Let's Encrypt Certificate

Stop any services using port 80:
```bash
sudo systemctl stop libreqos-bufferbloat.service
```

Obtain the certificate:
```bash
sudo certbot certonly --standalone -d yourdomain.example.com
```

### Step 3: Configure the HTTPS Service

1. Create or edit the HTTPS service file:
   ```bash
   sudo nano /etc/systemd/system/libreqos-bufferbloat-https.service
   ```

2. Add the following content (replace `yourdomain.example.com` with your domain):
   ```
   [Unit]
   Description=LibreQoS Bufferbloat Test Server (HTTPS)
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/home/libreqos_bufferbloat_test
   ExecStart=/usr/bin/python3 /home/libreqos_bufferbloat_test/server/main.py --port 443 --ssl-keyfile /etc/letsencrypt/live/yourdomain.example.com/privkey.pem --ssl-certfile /etc/letsencrypt/live/yourdomain.example.com/fullchain.pem --http2
   Restart=on-failure
   RestartSec=5
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

### Step 4: Enable and Start the Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable libreqos-bufferbloat-https.service
sudo systemctl start libreqos-bufferbloat-https.service
```

### Step 5: Set Up Certificate Renewal Hook

Create a renewal hook to restart the service when certificates are renewed:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo nano /etc/letsencrypt/renewal-hooks/deploy/restart-libreqos.sh
```

Add the following content:
```bash
#!/bin/bash
systemctl restart libreqos-bufferbloat-https.service
```

Make it executable:
```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-libreqos.sh
```

## HTTP/2 Support

HTTP/2 provides significant performance improvements over HTTP/1.1, especially for the LibreQoS Bufferbloat Test:

### Benefits of HTTP/2

1. **Connection Multiplexing**: HTTP/2 allows multiple requests and responses to be sent over a single TCP connection simultaneously. This overcomes the browser's 6-connection limit per domain, enabling:
   - Higher concurrency for upload and download tests
   - Better saturation of gigabit connections
   - More accurate bufferbloat measurements

2. **Binary Protocol**: HTTP/2 uses a binary protocol instead of text, which is more efficient to parse and less error-prone.

3. **Header Compression**: HTTP/2 compresses headers, reducing overhead.

### How It Works

The LibreQoS Bufferbloat Test uses Hypercorn as the ASGI server when HTTP/2 is enabled. Hypercorn supports HTTP/2 and provides the following configuration:

- Up to 250 concurrent streams per connection (configurable)
- Proper flow control to prevent overwhelming the client or server
- Graceful fallback to HTTP/1.1 for older browsers

### Requirements

- HTTPS is required for HTTP/2 in browsers
- The `--http2` flag must be passed to the server
- The `hypercorn` and `h2` Python packages must be installed (included in requirements.txt)

## Certificate Auto-Renewal

Let's Encrypt certificates are valid for 90 days. Certbot automatically installs a systemd timer to renew certificates before they expire.

To check the status of the auto-renewal timer:
```bash
sudo systemctl status certbot.timer
```

## Troubleshooting

### Check Service Logs

```bash
sudo journalctl -u libreqos-bufferbloat-https.service
```

### Check Certbot Logs

```bash
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Test Certificate Renewal

```bash
sudo certbot renew --dry-run
```

### Common Issues

1. **Port 80/443 already in use**: Make sure no other services (like Apache or Nginx) are using these ports.

2. **Certificate not found**: Verify the paths in the service file match your actual certificate paths.

3. **Permission denied**: Ensure the service is running as root or has proper permissions to access the certificate files.

4. **HTTP/2 not working**: Verify that:
   - You're using HTTPS (HTTP/2 requires TLS in browsers)
   - The `--http2` flag is included in the service file
   - You've installed the required dependencies (`pip install -r server/requirements.txt`)
   - Your browser supports HTTP/2 (most modern browsers do)

5. **Checking HTTP/2 status**: Use browser developer tools (Network tab) to verify the protocol being used, or use:
   ```bash
   curl -I --http2 https://yourdomain.example.com
   ```

## Security Considerations

- The Let's Encrypt certificate will be automatically renewed by the certbot timer
- Consider implementing additional security headers in your FastAPI application
- Regularly update your system and dependencies to patch security vulnerabilities