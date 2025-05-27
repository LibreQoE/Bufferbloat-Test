/**
 * Main Application Module
 * Coordinates all modules and runs the bufferbloat test
 */

import { createLatencyChart, resetChart, addLatencyDataPoint } from './timelineChart.js';
import { startDownloadSaturation, startUploadSaturation, stopAllStreams, 
         getDownloadThroughputData, getUploadThroughputData } from './saturation.js';
import { analyzeAndDisplayResults } from './results.js';
import { initUI, startTestUI, TEST_PHASES, getCurrentPhase, getElapsedTime } from './ui.js';

// Test data storage
const testData = {
    baselineLatency: [],
    downloadLatency: [],
    uploadLatency: [],
    cooldownLatency: [],
    downloadThroughput: [],
    uploadThroughput: []
};

// Web Worker for latency measurements
let latencyWorker = null;

// Chart instance
let latencyChart = null;

/**
 * Initialize the application
 */
function init() {
    console.log('Initializing LibreQoS Bufferbloat Test');
    
    // Initialize UI
    initUI();
    
    // Create latency chart
    latencyChart = createLatencyChart('latencyChart');
    
    // Set up event listeners
    setupEventListeners();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Test lifecycle events
    window.addEventListener('test:start', handleTestStart);
    window.addEventListener('test:phaseChange', handlePhaseChange);
    window.addEventListener('test:complete', handleTestComplete);
    
    // Handle page unload
    window.addEventListener('beforeunload', cleanup);
}

/**
 * Handle test start event
 */
function handleTestStart() {
    console.log('Starting test');
    
    // Reset test data
    resetTestData();
    
    // Reset chart
    resetChart(latencyChart);
    
    // Start the UI updates
    startTestUI();
    
    // Initialize and start the latency worker
    initLatencyWorker();
}

/**
 * Handle phase change event
 * @param {CustomEvent} event - The phase change event
 */
function handlePhaseChange(event) {
    const phase = event.detail.phase;
    console.log(`Phase changed to: ${phase}`);
    
    switch (phase) {
        case TEST_PHASES.DOWNLOAD:
            // Start download saturation
            startDownloadSaturation();
            break;
        case TEST_PHASES.UPLOAD:
            // Stop download and start upload saturation
            stopAllStreams();
            startUploadSaturation();
            break;
        case TEST_PHASES.COOLDOWN:
            // Stop upload saturation
            stopAllStreams();
            break;
    }
}

/**
 * Handle test complete event
 */
function handleTestComplete() {
    console.log('Test complete');
    
    // Stop the latency worker
    if (latencyWorker) {
        latencyWorker.postMessage({ command: 'stop' });
        latencyWorker.terminate();
        latencyWorker = null;
    }
    
    // Stop any active streams
    stopAllStreams();
    
    // Get throughput data
    testData.downloadThroughput = getDownloadThroughputData();
    testData.uploadThroughput = getUploadThroughputData();
    
    console.log('Download throughput data:', testData.downloadThroughput);
    console.log('Upload throughput data:', testData.uploadThroughput);
    
    // Analyze and display results
    analyzeAndDisplayResults(testData);
}

/**
 * Initialize the latency worker
 */
function initLatencyWorker() {
    // Create the worker
    latencyWorker = new Worker('latencyWorker.js');
    
    // Set up message handler
    latencyWorker.onmessage = handleLatencyWorkerMessage;
    
    // Start the worker
    latencyWorker.postMessage({ command: 'start' });
}

/**
 * Handle messages from the latency worker
 * @param {MessageEvent} event - The message event
 */
function handleLatencyWorkerMessage(event) {
    const data = event.data;
    
    switch (data.type) {
        case 'latency':
            // Process latency measurement
            processLatencyMeasurement(data.rtt);
            break;
        case 'error':
            console.error('Latency worker error:', data.error);
            break;
        case 'status':
            console.log('Latency worker status:', data.status);
            break;
    }
}

/**
 * Process a latency measurement
 * @param {number} latency - The measured latency in ms
 */
function processLatencyMeasurement(latency) {
    const currentPhase = getCurrentPhase();
    const elapsedTime = getElapsedTime();
    
    // Store latency based on current phase
    switch (currentPhase) {
        case TEST_PHASES.BASELINE:
            testData.baselineLatency.push(latency);
            break;
        case TEST_PHASES.DOWNLOAD:
            testData.downloadLatency.push(latency);
            break;
        case TEST_PHASES.UPLOAD:
            testData.uploadLatency.push(latency);
            break;
        case TEST_PHASES.COOLDOWN:
            testData.cooldownLatency.push(latency);
            break;
    }
    
    // Add data point to chart
    addLatencyDataPoint(latencyChart, elapsedTime, latency);
}

/**
 * Reset test data
 */
function resetTestData() {
    testData.baselineLatency = [];
    testData.downloadLatency = [];
    testData.uploadLatency = [];
    testData.cooldownLatency = [];
    testData.downloadThroughput = [];
    testData.uploadThroughput = [];
}

/**
 * Clean up resources
 */
function cleanup() {
    // Stop the latency worker
    if (latencyWorker) {
        latencyWorker.terminate();
        latencyWorker = null;
    }
    
    // Stop any active streams
    stopAllStreams();
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', init);