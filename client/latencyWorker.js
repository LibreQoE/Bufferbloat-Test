/**
 * Web Worker for measuring latency
 * This worker runs in a separate thread and sends ping requests every 200ms
 */

// Configuration
const PING_INTERVAL = 200; // ms
let isRunning = false;
let pingTimer = null;

// Handle messages from the main thread
self.onmessage = function(e) {
    const command = e.data.command;
    
    switch (command) {
        case 'start':
            startLatencyMeasurement();
            break;
        case 'stop':
            stopLatencyMeasurement();
            break;
        default:
            console.error('Unknown command:', command);
    }
};

/**
 * Start sending ping requests at regular intervals
 */
function startLatencyMeasurement() {
    if (isRunning) return;
    
    isRunning = true;
    self.postMessage({ type: 'status', status: 'started' });
    
    // Start the ping loop
    pingTimer = setInterval(sendPing, PING_INTERVAL);
}

/**
 * Stop sending ping requests
 */
function stopLatencyMeasurement() {
    if (!isRunning) return;
    
    clearInterval(pingTimer);
    isRunning = false;
    self.postMessage({ type: 'status', status: 'stopped' });
}

/**
 * Send a ping request and measure the round-trip time
 */
async function sendPing() {
    const startTime = performance.now();
    
    try {
        // Send a request to the ping endpoint
        const response = await fetch('/ping', {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-store'
            }
        });
        
        if (response.ok) {
            const endTime = performance.now();
            const rtt = endTime - startTime;
            
            // Send the result back to the main thread
            self.postMessage({
                type: 'latency',
                timestamp: Date.now(),
                rtt: rtt
            });
        } else {
            self.postMessage({
                type: 'error',
                error: `Ping failed with status: ${response.status}`
            });
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message
        });
    }
}

// Let the main thread know the worker is ready
self.postMessage({ type: 'status', status: 'ready' });