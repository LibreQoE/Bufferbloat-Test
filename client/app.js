/**
 * Main Application Module
 * Coordinates all modules and runs the bufferbloat test
 */

import { createLatencyChart, resetChart, addLatencyDataPoint } from './timelineChart.js';
import { createThroughputChart, resetThroughputChart, updateThroughputChart,
         addDownloadThroughputDataPoint, addUploadThroughputDataPoint } from './throughputChart.js';
import { startDownloadSaturation, startUploadSaturation, startBidirectionalSaturation, stopAllStreams,
         getDownloadThroughputData, getUploadThroughputData } from './saturation.js';
import { analyzeAndDisplayResults } from './results.js';
import { initUI, startTestUI, TEST_PHASES, getCurrentPhase, getElapsedTime } from './ui.js';

// Test data storage
const testData = {
    baselineLatency: [],
    downloadLatency: [],
    uploadLatency: [],
    bidirectionalLatency: [], // Added bidirectional latency
    cooldownLatency: [],
    downloadThroughput: {
        download: [],    // Download phase (5-15s)
        bidirectional: [] // Bidirectional phase (25-30s)
    },
    uploadThroughput: {
        upload: [],      // Upload phase (15-25s)
        bidirectional: [] // Bidirectional phase (25-30s)
    }
};

// Web Worker for latency measurements
let latencyWorker = null;

// Chart instances
let latencyChart = null;
let throughputChart = null;

/**
 * Initialize the application
 */
function init() {
    console.log('Initializing LibreQoS Bufferbloat Test');
    
    // Initialize UI
    initUI();
    
    // Create charts
    latencyChart = createLatencyChart('latencyChart');
    throughputChart = createThroughputChart('throughputChart');
    
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
    
    // Throughput measurement events
    window.addEventListener('throughput:download', handleDownloadThroughput);
    window.addEventListener('throughput:upload', handleUploadThroughput);
    
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
    
    // Reset charts
    resetChart(latencyChart);
    resetThroughputChart(throughputChart);
    
    // Start the UI updates
    startTestUI();
    
    // Initialize and start the latency worker
    initLatencyWorker();
    
    // Start timer for adding zero values
    if (zeroValuesTimer) {
        clearInterval(zeroValuesTimer);
    }
    zeroValuesTimer = setInterval(() => {
        addZeroDownloadValues();
        addZeroUploadValues();
    }, 200);
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
        case TEST_PHASES.BIDIRECTIONAL:
            // Start both download and upload saturation simultaneously
            stopAllStreams();
            startBidirectionalSaturation();
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
    
    // Stop zero values timer
    if (zeroValuesTimer) {
        clearInterval(zeroValuesTimer);
        zeroValuesTimer = null;
    }
    
    // Stop any active streams
    stopAllStreams();
    
    // Get throughput data
    const allDownloadData = getDownloadThroughputData();
    const allUploadData = getUploadThroughputData();
    
    // Split the data into phases
    // Assuming the first 2/3 of download data is from download phase, last 1/3 from bidirectional
    const downloadPhaseEnd = Math.floor(allDownloadData.length * 2/3);
    testData.downloadThroughput.download = allDownloadData.slice(0, downloadPhaseEnd);
    testData.downloadThroughput.bidirectional = allDownloadData.slice(downloadPhaseEnd);
    
    // Assuming the first 1/2 of upload data is from upload phase, last 1/2 from bidirectional
    const uploadPhaseEnd = Math.floor(allUploadData.length * 1/2);
    testData.uploadThroughput.upload = allUploadData.slice(0, uploadPhaseEnd);
    testData.uploadThroughput.bidirectional = allUploadData.slice(uploadPhaseEnd);
    
    console.log('Download throughput data:', allDownloadData);
    console.log('Upload throughput data:', allUploadData);
    
    // Combine data for the chart
    const combinedDownloadData = [
        ...testData.downloadThroughput.download,
        ...testData.downloadThroughput.bidirectional
    ];
    
    const combinedUploadData = [
        ...testData.uploadThroughput.upload,
        ...testData.uploadThroughput.bidirectional
    ];
    
    // Update throughput chart configuration without redrawing the data
    updateThroughputChart(throughputChart);
    
    // Analyze and display results
    analyzeAndDisplayResults(testData);
}

/**
 * Handle download throughput event
 * @param {CustomEvent} event - The throughput event
 */
function handleDownloadThroughput(event) {
    const throughput = event.detail.throughput;
    const elapsedTime = getElapsedTime();
    const currentPhase = getCurrentPhase();
    
    // Store throughput data by phase
    if (currentPhase === TEST_PHASES.DOWNLOAD) {
        testData.downloadThroughput.download.push(throughput);
    } else if (currentPhase === TEST_PHASES.BIDIRECTIONAL) {
        testData.downloadThroughput.bidirectional.push(throughput);
    }
    
    // Add data point to throughput chart
    addDownloadThroughputDataPoint(throughputChart, elapsedTime, throughput);
}

/**
 * Add zero values for download throughput during upload phase
 * This prevents the line from "clinging" across phases
 */
function addZeroDownloadValues() {
    if (getCurrentPhase() === TEST_PHASES.UPLOAD) {
        const elapsedTime = getElapsedTime();
        addDownloadThroughputDataPoint(throughputChart, elapsedTime, 0);
    }
}

// Set up a timer to add zero values during inactive phases
let zeroValuesTimer = null;

/**
 * Add zero values for upload throughput during non-upload phases
 * This prevents the line from "clinging" across phases
 */
function addZeroUploadValues() {
    const currentPhase = getCurrentPhase();
    if (currentPhase === TEST_PHASES.BASELINE || currentPhase === TEST_PHASES.DOWNLOAD) {
        const elapsedTime = getElapsedTime();
        addUploadThroughputDataPoint(throughputChart, elapsedTime, 0);
    }
}

/**
 * Handle upload throughput event
 * @param {CustomEvent} event - The throughput event
 */
function handleUploadThroughput(event) {
    const throughput = event.detail.throughput;
    const elapsedTime = getElapsedTime();
    const currentPhase = getCurrentPhase();
    
    // Store throughput data by phase
    if (currentPhase === TEST_PHASES.UPLOAD) {
        testData.uploadThroughput.upload.push(throughput);
    } else if (currentPhase === TEST_PHASES.BIDIRECTIONAL) {
        testData.uploadThroughput.bidirectional.push(throughput);
    }
    
    // Add data point to throughput chart
    addUploadThroughputDataPoint(throughputChart, elapsedTime, throughput);
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
        case TEST_PHASES.BIDIRECTIONAL:
            // Add case for bidirectional phase
            testData.bidirectionalLatency.push(latency);
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
    testData.bidirectionalLatency = []; // Reset bidirectional latency
    testData.cooldownLatency = [];
    testData.downloadThroughput = {
        download: [],
        bidirectional: []
    };
    testData.uploadThroughput = {
        upload: [],
        bidirectional: []
    };
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