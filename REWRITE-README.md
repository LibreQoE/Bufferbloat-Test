# LibreQoS Bufferbloat Test Rewrite

This is a complete rewrite of the LibreQoS Bufferbloat Test application to address issues with download traffic continuing past phase boundaries and improve the overall reliability and accuracy of the test.

**Note: This rewrite has been integrated as the default implementation.**

## Key Improvements

1. **Clear Phase Separation**: Each phase is completely isolated, with no possibility of traffic continuing across phase boundaries.

2. **Comprehensive Stream Tracking**: All network streams are properly tracked and terminated at phase boundaries.

3. **Enhanced Throughput Visualization**: The throughput chart now displays all network activity, including out-of-phase traffic.

4. **Simplified Parameter Discovery**: A more conservative approach to parameter discovery that prevents overshooting and network congestion.

5. **Fail-safe Mechanisms**: Multiple layers of protection ensure streams are terminated properly.

## New Components

### 1. Stream Manager (`streamManager.js`)

A new Stream Manager component handles the creation, tracking, and termination of all network streams. It provides a robust registry system for tracking active streams and ensures proper cleanup when streams are terminated.

### 2. Phase Controller (`phaseController.js`)

The Phase Controller manages test phases and ensures clean transitions between them. It enforces a hard barrier between phases, preventing traffic from continuing past phase boundaries.

### 3. Parameter Discovery (`parameterDiscovery.js`)

A simplified parameter discovery methodology uses a linear ramp-up approach with strict latency thresholds instead of binary search. This prevents overshooting and causing network congestion during warmup phases.

### 4. Throughput Monitor (`throughputMonitor.js`)

The Throughput Monitor tracks and reports all network activity, regardless of phase. It provides accurate throughput measurements and detects out-of-phase traffic.

### 5. Throughput Chart (`throughputChart.js`)

The Throughput Chart has been updated to display all network activity, including traffic that continues past phase boundaries. It provides clear visual indicators for phase transitions and out-of-phase traffic.

## Deploying the Rewrite

The rewrite has been integrated as the default implementation. To deploy the changes:

1. Upload the updated files to your server:
   - `client/streamManager.js`
   - `client/phaseController.js`
   - `client/parameterDiscovery.js`
   - `client/throughputMonitor.js`
   - `client/throughputChart.js`
   - `client/app.js`

2. Restart the service:

```bash
systemctl restart libreqos-bufferbloat-https.service
```

3. Access the test page in your browser and click "Start Test" to begin the test.

4. Observe the test progress through all phases and verify that all traffic is properly visualized in the throughput chart.

## Implementation Details

### Stream Management

Streams are now tracked in a registry system that ensures all streams are properly terminated at phase boundaries. Each stream has a unique ID and is tracked throughout its lifecycle.

### Phase Transitions

Phase transitions now include a hard barrier that ensures all resources from the previous phase are fully released before starting the next phase. This prevents traffic from continuing across phase boundaries.

### Parameter Discovery

The parameter discovery methodology now uses a linear ramp-up approach with strict latency thresholds. It starts with minimal parameters and gradually increases them until either the latency threshold is exceeded or the throughput plateaus.

### Throughput Monitoring

The throughput monitor now tracks all network activity, regardless of phase. It detects out-of-phase traffic and provides accurate throughput measurements.

## Future Improvements

1. **Network Quiescence Detection**: Implement more sophisticated detection of network quiescence during phase transitions.

2. **Adaptive Latency Thresholds**: Adjust latency thresholds based on network conditions.

3. **More Detailed Reporting**: Provide more detailed reports on out-of-phase traffic and potential issues.

4. **User Interface Enhancements**: Improve the user interface to provide more information about the test progress and results.