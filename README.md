# LibreQoS Bufferbloat Test

A web-based tool for measuring bufferbloat in network connections, inspired by the Waveform Bufferbloat Test. This project focuses on accuracy, clarity, and HTTP-only performance testing.

## Overview

LibreQoS Bufferbloat Test measures how your network connection performs under load, specifically focusing on latency increases that occur during high bandwidth utilization (bufferbloat). The test runs for 30 seconds and provides a comprehensive analysis of your connection's performance.

## Features

- **30-second unified test flow** divided into 4 sequential stages
- **Accurate latency measurement** every 200ms using synchronized timestamps
- **Background throughput sampling** for statistical analysis
- **Clear visualization** of latency over time
- **Comprehensive results** including bufferbloat grading (A+ to F)
- **HTTP/2 support** for improved performance and connection multiplexing
- **Dark theme UI** with LibreQoS branding

## Test Flow

The test runs as a single 30-second process divided into 4 sequential stages:

1. **Baseline (0s-5s)**: Measures unloaded latency
2. **Download Saturation (5s-15s)**: Observes latency under download load
3. **Upload Saturation (15s-25s)**: Observes latency under upload load
4. **Bidirectional Saturation (25s-30s)**: Observes latency under simultaneous download and upload load

## Technical Implementation

### Client

- **HTML/CSS/JavaScript** frontend that runs in any modern web browser
- **Web Worker** for latency measurements
- **Chart.js** for latency visualization
- **ES Modules** for code organization

### Server

- **Python FastAPI** backend for Ubuntu Server 22.04 or 24.04
- **HTTP/2 support** with Hypercorn for multiplexed connections
- **Efficient streaming** of binary data
- **High concurrency** support for gigabit connection testing

## Bufferbloat Grading

The test assigns a grade based on the additional latency under load:

| Latency Increase | Grade |
|------------------|-------|
| < 5 ms           | A+    |
| < 30 ms          | A     |
| < 60 ms          | B     |
| < 200 ms         | C     |
| < 400 ms         | D     |
| ≥ 400 ms         | F     |

The final grade is the lower of the download and upload scores.

## Project Structure

```
server/
├── main.py            # FastAPI application entry point
├── ping.py            # Ping endpoint for latency measurement
├── download.py        # Download endpoint for downstream saturation
├── upload.py          # Upload endpoint for upstream saturation
├── __init__.py        # Python package marker
├── test_endpoints.py  # Test script for server endpoints
└── requirements.txt   # Python dependencies with Hypercorn for HTTP/2

client/
├── index.html         # Main HTML page
├── style.css          # CSS styles
├── app.js             # Main application logic
├── latencyWorker.js   # Web Worker for latency measurements
├── timelineChart.js   # Chart.js configuration and handling
├── saturation.js      # Download and upload saturation logic
├── results.js         # Results analysis and display
└── ui.js              # User interface interactions
```

## Running the Project

### Server Setup

1. Install dependencies:
   ```
   pip install -r server/requirements.txt
   ```

2. Run the server:
   ```
   python3 server/main.py
   ```

   The server will run on port 80 by default.

### Running as a Systemd Service

For production deployments, you can run the application as a systemd service:

1. Use the provided installation script:
   ```
   sudo ./install_service.sh
   ```

   This will install and start the service automatically.

2. Alternatively, follow the manual setup instructions in `SYSTEMD_SETUP.md`.

3. Once installed as a service, the application will:
   - Start automatically on system boot
   - Restart automatically if it crashes
   - Log output to the system journal

For more details, see the [Systemd Setup Guide](SYSTEMD_SETUP.md).

### Setting Up HTTPS with HTTP/2 Support

For secure access with improved performance, you can set up HTTPS with HTTP/2 support using Let's Encrypt certificates:

1. Use the provided HTTPS setup script:
   ```
   sudo ./setup_https.sh yourdomain.example.com
   ```

2. The script will:
   - Obtain Let's Encrypt certificates for your domain
   - Configure the application to use HTTPS with HTTP/2 support
   - Set up automatic certificate renewal

3. HTTP/2 Benefits:
   - **Connection Multiplexing**: Overcomes the browser's 6-connection limit
   - **Higher Concurrency**: Supports hundreds of concurrent streams over a single connection
   - **Better Performance**: Ideal for testing gigabit connections

4. For manual setup or more details, see the [HTTPS Setup Guide](HTTPS_SETUP.md).

### Client Access

Once the server is running, access the test by navigating to:
```
http://your-server-ip:80/
```

Or if you've set up HTTPS:
```
https://yourdomain.example.com/
```

Replace `your-server-ip` with the IP address of your server or `yourdomain.example.com` with your actual domain name.

## Development

- The server uses auto-reload feature for development
- HTTP/2 support requires HTTPS (TLS) and the `--http2` flag
- The client is served as static files by the FastAPI application
- All client-side code uses ES modules for better organization

## License

This project is open source and available under the MIT License.