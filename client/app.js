/**
 * Main Application Module
 * Coordinates all modules and runs the bufferbloat test
 */

import { createLatencyChart, resetChart, addLatencyDataPoint } from './timelineChart.js';
import {
    createThroughputChart,
    resetThroughputChart,
    updateThroughputChart,
    addDownloadThroughputDataPoint,
    addUploadThroughputDataPoint,
    addNullDownloadDataPoint,
    addNullUploadDataPoint,
    updateThroughputChartWithAllData,
    addPhaseAnnotations
} from './throughputChart.js';
import { analyzeAndDisplayResults } from './results.js';
import { initUI, startTestUI, TEST_PHASES, getCurrentPhase, getElapsedTime } from './ui.js';
import {
    initDiscovery,
    handleMeasurement,
    isDiscoveryInProgress,
    getBestParameters,
    getParameterHistory
} from './parameterDiscovery.js';
import {
    initParameterVisualization,
    updateParameterVisualization,
    hideParameterVisualization
} from './parameterVisualization.js';
import StreamManager from './streamManager.js';
import { PhaseController, PhaseBarrier } from './phaseController.js';
import throughputMonitor, { 
    startThroughputMonitor, 
    stopThroughputMonitor, 
    resetThroughputMonitor,
    getDownloadThroughputData,
    getUploadThroughputData
} from './throughputMonitor.js';

// Global variable to store the latest latency measurement
window.latestLatencyMeasurement = 0;
window.consecutiveTimeouts = 0;

// Test data storage
const testData = {
    baselineLatency: [],
    downloadDiscoveryLatency: [], // New phase for parameter discovery
    downloadLatency: [],
    uploadDiscoveryLatency: [], // New phase for parameter discovery
    uploadLatency: [],
    bidirectionalLatency: [], // Bidirectional phase latency data
    downloadThroughput: {
        discovery: [],   // Download discovery phase
        download: [],    // Download phase
        bidirectional: [] // Bidirectional phase
    },
    uploadThroughput: {
        discovery: [],   // Upload discovery phase
        upload: [],      // Upload phase
        bidirectional: [] // Bidirectional phase
    },
    // Store the discovered optimal parameters
    optimalDownloadParams: null,
    optimalUploadParams: null,
    // Store the original optimal parameters from warmup phases
    originalOptimalDownloadParams: null,
    originalOptimalUploadParams: null,
    // Store the baseline latency for parameter discovery
    baselineLatencyAvg: 0
};

// Web Worker for latency measurements
let latencyWorker = null;

// Chart instances
let latencyChart = null;
let throughputChart = null;

// Phase controller instance
const phaseController = new PhaseController();

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
    
    // Initialize parameter visualization
    initParameterVisualization();
    
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
    
    // Stream lifecycle events
    window.addEventListener('stream:lifecycle', handleStreamLifecycleEvent);
    window.addEventListener('stream:reset', handleStreamResetEvent);
    
    // Phase change events
    window.addEventListener('phase:change', handlePhaseControllerEvent);
    
    // Handle page unload
    window.addEventListener('beforeunload', cleanup);
}

/**
 * Handle phase controller events
 * @param {CustomEvent} event - The phase change event
 */
function handlePhaseControllerEvent(event) {
    const { type, phase, timestamp, elapsedTime } = event.detail;
    console.log(`Phase controller event: ${type} - ${phase} at ${new Date(timestamp).toISOString()}`);
    
    // Update UI based on phase change
    if (type === 'start') {
        // Phase has started
    } else if (type === 'end') {
        // Phase has ended
    }
}

/**
 * Handle stream lifecycle events
 * @param {CustomEvent} event - The stream lifecycle event
 */
function handleStreamLifecycleEvent(event) {
    const { type, streamId, streamType, timestamp } = event.detail;
    console.log(`Stream ${type} event: Stream #${streamId} (${streamType}) at ${new Date(timestamp).toISOString()}`);
    
    // Log to UI if in debug mode
    if (window.debugMode) {
        const debugElement = document.getElementById('streamDebug') || createStreamDebugElement();
        const entry = document.createElement('div');
        entry.textContent = `${new Date(timestamp).toLocaleTimeString()} - ${type}: Stream #${streamId} (${streamType})`;
        entry.className = `stream-event ${type}`;
        debugElement.appendChild(entry);
        
        // Limit entries
        if (debugElement.children.length > 100) {
            debugElement.removeChild(debugElement.firstChild);
        }
    }
}

/**
 * Handle stream reset events
 * @param {CustomEvent} event - The stream reset event
 */
function handleStreamResetEvent(event) {
    const { timestamp } = event.detail;
    console.log(`Stream registry reset at ${new Date(timestamp).toISOString()}`);
    
    // Log to UI if in debug mode
    if (window.debugMode) {
        const debugElement = document.getElementById('streamDebug') || createStreamDebugElement();
        const entry = document.createElement('div');
        entry.textContent = `${new Date(timestamp).toLocaleTimeString()} - EMERGENCY RESET`;
        entry.className = 'stream-event reset';
        entry.style.color = 'red';
        entry.style.fontWeight = 'bold';
        debugElement.appendChild(entry);
    }
}

/**
 * Create stream debug element for UI
 * @returns {HTMLElement} The created debug element
 */
function createStreamDebugElement() {
    const debugElement = document.createElement('div');
    debugElement.id = 'streamDebug';
    debugElement.className = 'stream-debug';
    debugElement.style.position = 'fixed';
    debugElement.style.bottom = '10px';
    debugElement.style.right = '10px';
    debugElement.style.width = '300px';
    debugElement.style.maxHeight = '200px';
    debugElement.style.overflow = 'auto';
    debugElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
    debugElement.style.color = 'white';
    debugElement.style.padding = '5px';
    debugElement.style.fontSize = '10px';
    debugElement.style.fontFamily = 'monospace';
    debugElement.style.zIndex = '9999';
    debugElement.style.display = window.debugMode ? 'block' : 'none';
    debugElement.style.borderRadius = '5px';
    debugElement.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    document.body.appendChild(debugElement);
    return debugElement;
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
    
    // Initialize phase controller
    const testStartTime = performance.now();
    phaseController.initialize(testStartTime);
    
    // Start throughput monitor
    startThroughputMonitor(testStartTime);
    
    // Start the UI updates
    startTestUI();
    
    // Initialize and start the latency worker
    initLatencyWorker();
    
    // Set up parameter visualization updates
    setupParameterVisualizationUpdates();
    
    // Start with baseline phase
    phaseController.startPhase(TEST_PHASES.BASELINE);
}

/**
 * Handle phase change event
 * @param {CustomEvent} event - The phase change event
 */
async function handlePhaseChange(event) {
    const phase = event.detail.phase;
    console.log(`UI phase changed to: ${phase}`);
    
    // Start the phase using the phase controller
    await phaseController.startPhase(phase);
    
    // Add null values at phase boundaries to break the lines
    const elapsedTime = getElapsedTime();
    
    switch (phase) {
        case TEST_PHASES.BASELINE:
            // Calculate average baseline latency at the end of baseline phase
            if (testData.baselineLatency.length > 0) {
                testData.baselineLatencyAvg = testData.baselineLatency.reduce((sum, val) => sum + val, 0) / testData.baselineLatency.length;
                console.log(`Average baseline latency: ${testData.baselineLatencyAvg.toFixed(2)} ms`);
            }
            break;
            
        case TEST_PHASES.DOWNLOAD_WARMUP:
            console.log(`Starting download parameter discovery with aggressive initial parameters`);
            
            // Ensure any previous visualization is hidden first
            hideParameterVisualization();
            
            // Force a small delay before showing the visualization to ensure DOM is ready
            setTimeout(() => {
                // Show parameter visualization for download
                console.log("Showing download parameter visualization");
                updateParameterVisualization([], 'download');
            }, 100);
            
            // Start with more aggressive parameters for download warmup
            const dlWarmupParams = { streamCount: 3 };
            console.log(`Using aggressive initial download warmup parameters: ${JSON.stringify(dlWarmupParams)}`);
            await StreamManager.startDownloadSaturation(true, 0, dlWarmupParams);
            
            // Initialize parameter discovery
            testData.optimalDownloadParams = await initDiscovery('download', testData.baselineLatencyAvg);
            // Save a copy of the original optimal parameters
            testData.originalOptimalDownloadParams = { ...testData.optimalDownloadParams };
            console.log(`Download parameter discovery complete. Optimal parameters:`, testData.optimalDownloadParams);
            console.log(`Saved original optimal download parameters:`, testData.originalOptimalDownloadParams);
            
            // Update visualization with final parameter history
            updateParameterVisualization(getParameterHistory(), 'download');
            break;
            
        case TEST_PHASES.DOWNLOAD:
            console.log(`Using discovered optimal download parameters: ${JSON.stringify(testData.optimalDownloadParams)}`);
            
            // Keep download parameter visualization visible after warmup
            // (removed hideParameterVisualization call)
            
            // Add null value for download to break the line between Download Warmup and Download phases
            addNullDownloadDataPoint(throughputChart, elapsedTime);
            
            // Use optimal parameters with proper fallbacks
            let downloadParams;
            
            if (testData.originalOptimalDownloadParams) {
                // Use the original optimal parameters from warmup phase
                downloadParams = { ...testData.originalOptimalDownloadParams };
                // Add a flag to indicate this is for the download phase (not bidirectional)
                downloadParams.isDownloadPhase = true;
                console.log(`Using original optimal download parameters from warmup: ${JSON.stringify(downloadParams)}`);
            } else if (testData.optimalDownloadParams) {
                // Ensure streamCount is properly preserved with fallback
                downloadParams = {
                    streamCount: testData.optimalDownloadParams.streamCount !== undefined ?
                        testData.optimalDownloadParams.streamCount : 3,
                    pendingUploads: testData.optimalDownloadParams.pendingUploads !== undefined ?
                        testData.optimalDownloadParams.pendingUploads : 1,
                    isDownloadPhase: true // Add flag for download phase
                };
                console.log(`Using optimal download parameters with fallbacks: ${JSON.stringify(downloadParams)}`);
            } else {
                // Default fallback
                downloadParams = { streamCount: 3, pendingUploads: 1, isDownloadPhase: true };
                console.log(`No download parameters found, using defaults: ${JSON.stringify(downloadParams)}`);
            }
            
            console.log(`Download parameters being used: ${JSON.stringify(downloadParams)}`);
            
            // Store the parameters globally for later phases
            window.optimalDownloadParams = downloadParams;
            console.log(`Storing optimal download parameters globally: ${JSON.stringify(window.optimalDownloadParams)}`);
            
            // Start download with optimal parameters
            await StreamManager.startDownloadSaturation(false, 0, downloadParams);
            break;
            
        case TEST_PHASES.UPLOAD_WARMUP:
            console.log(`Starting upload parameter discovery with aggressive initial parameters`);
            
            // Ensure any previous visualization is hidden first
            hideParameterVisualization();
            
            // Force a small delay before showing the visualization to ensure DOM is ready
            setTimeout(() => {
                // Show parameter visualization for upload
                console.log("Showing upload parameter visualization");
                updateParameterVisualization([], 'upload');
            }, 100);
            
            // Add null value for download to break the line
            // First add a null point at the end of the Download phase
            addNullDownloadDataPoint(throughputChart, elapsedTime);
            
            // Start with more conservative parameters for upload warmup
            // Focus on starting with small chunks of data and gradually ramping up
            // Use minimal stream count and pending uploads initially
            const warmupParams = {
                streamCount: 2,           // Start with 2 streams
                pendingUploads: 2,        // Start with 2 pending uploads
                uploadDelay: 0,           // No delay between uploads
                useGradualChunkSizes: true, // Signal to use gradually increasing chunk sizes
                minDuration: 15000        // Ensure upload warmup runs for at least 15 seconds
            };
            console.log(`Using conservative initial upload warmup parameters: ${JSON.stringify(warmupParams)}`);
            console.log(`Upload warmup will start with small chunks and gradually increase to 64KB`);
            console.log(`Upload warmup will run for at least 15 seconds to ensure proper parameter discovery`);
            await StreamManager.startUploadSaturation(true, 0, warmupParams);
            
            // Initialize parameter discovery
            testData.optimalUploadParams = await initDiscovery('upload', testData.baselineLatencyAvg);
            
            // Get the best parameters directly from the discovery module
            const bestUploadWarmupParams = getBestParameters();
            console.log(`Direct best parameters from discovery module:`, bestUploadWarmupParams);
            
            // Use the best parameters from the discovery module if available
            if (bestUploadWarmupParams && bestUploadWarmupParams.streamCount && bestUploadWarmupParams.pendingUploads) {
                testData.optimalUploadParams = { ...bestUploadWarmupParams };
                console.log(`Using best parameters from discovery module:`, testData.optimalUploadParams);
            }
            
            // Ensure we have valid parameters before saving a copy
            if (testData.optimalUploadParams) {
                // Save a copy of the original optimal parameters
                testData.originalOptimalUploadParams = { ...testData.optimalUploadParams };
                console.log(`Upload parameter discovery complete. Optimal parameters:`, testData.optimalUploadParams);
                console.log(`Saved original optimal upload parameters:`, testData.originalOptimalUploadParams);
            } else {
                // Create default parameters if none were discovered
                testData.optimalUploadParams = { streamCount: 2, pendingUploads: 2, uploadDelay: 0 };
                testData.originalOptimalUploadParams = { ...testData.optimalUploadParams };
                console.log(`No upload parameters discovered, using defaults:`, testData.optimalUploadParams);
                console.log(`Saved default upload parameters as original:`, testData.originalOptimalUploadParams);
            }
            
            // Log the parameters in detail
            console.log(`UPLOAD WARMUP PHASE: Discovered optimal parameters:`);
            console.log(`  - Stream count: ${testData.optimalUploadParams.streamCount}`);
            console.log(`  - Pending uploads: ${testData.optimalUploadParams.pendingUploads}`);
            console.log(`  - Upload delay: ${testData.optimalUploadParams.uploadDelay || 0}`);
            
            // Update visualization with final parameter history
            updateParameterVisualization(getParameterHistory(), 'upload');
            break;
            
        case TEST_PHASES.UPLOAD:
            console.log(`Using discovered optimal upload parameters: ${JSON.stringify(testData.optimalUploadParams)}`);
            
            // Double-check with the discovery module for the best parameters
            const bestUploadParams = getBestParameters();
            console.log(`Direct best parameters from discovery module for upload phase:`, bestUploadParams);
            
            // Keep upload parameter visualization visible after warmup
            // (removed hideParameterVisualization call)
            
            // Add null value for upload to break the line between Upload Warmup and Upload phases
            addNullUploadDataPoint(throughputChart, elapsedTime);
            
            // Use default parameters if none were discovered
            let uploadParams;
            if (!testData.optimalUploadParams && !bestUploadParams) {
                // If no parameters were discovered, use moderate defaults
                uploadParams = { streamCount: 1, pendingUploads: 4, uploadDelay: 0 };
                console.log(`No upload parameters discovered, using moderate defaults: ${JSON.stringify(uploadParams)}`);
            } else {
                // Prioritize parameters from the discovery module if available
                const sourceParams = bestUploadParams || testData.optimalUploadParams;
                console.log(`Using parameters source:`, sourceParams);
                
                // Use the parameters discovered during warmup phase - create a deep copy
                uploadParams = {
                    // Use the actual values from sourceParams, not fallbacks
                    streamCount: sourceParams.streamCount !== undefined ?
                        sourceParams.streamCount : 1,
                    pendingUploads: sourceParams.pendingUploads !== undefined ?
                        sourceParams.pendingUploads : 4,
                    uploadDelay: 0 // No delay for full test
                };
                console.log(`Using discovered upload parameters: ${JSON.stringify(uploadParams)}`);
                
                // Log the parameters in detail
                console.log(`UPLOAD PHASE: Using parameters:`);
                console.log(`  - Stream count: ${uploadParams.streamCount}`);
                console.log(`  - Pending uploads: ${uploadParams.pendingUploads}`);
                console.log(`  - Upload delay: ${uploadParams.uploadDelay || 0}`);
            }
            
            console.log(`Upload parameters being used: ${JSON.stringify(uploadParams)}`);
            
            // Store a copy of the parameters for bidirectional phase
            // But don't overwrite the original optimal parameters discovered during warmup
            if (!testData.originalOptimalUploadParams) {
                if (testData.optimalUploadParams) {
                    // Save the original optimal parameters from warmup
                    testData.originalOptimalUploadParams = { ...testData.optimalUploadParams };
                    console.log(`Saved original optimal upload parameters: ${JSON.stringify(testData.originalOptimalUploadParams)}`);
                } else {
                    // Create default parameters if none were discovered
                    testData.originalOptimalUploadParams = { ...uploadParams };
                    console.log(`No original upload parameters found, using current parameters as original: ${JSON.stringify(testData.originalOptimalUploadParams)}`);
                }
            } else {
                console.log(`Using existing original optimal upload parameters: ${JSON.stringify(testData.originalOptimalUploadParams)}`);
            }
            
            // Store the parameters globally for later phases
            window.optimalUploadParams = uploadParams;
            console.log(`Storing optimal upload parameters globally: ${JSON.stringify(window.optimalUploadParams)}`);
            
            // Start upload with optimal parameters
            await StreamManager.startUploadSaturation(false, 0, uploadParams);
            break;
            
        case TEST_PHASES.BIDIRECTIONAL:
            console.log(`Using discovered optimal parameters for bidirectional test`);
            
            // Double-check with the discovery module for the best parameters
            const bestBiParams = getBestParameters();
            console.log(`Direct best parameters from discovery module for bidirectional phase:`, bestBiParams);
            
            // Add null values to break the lines
            // This will create a clean break between Upload and Bidirectional phases
            addNullUploadDataPoint(throughputChart, elapsedTime);
            
            // Also add a null download data point to ensure a clean break for download data
            addNullDownloadDataPoint(throughputChart, elapsedTime);
            
            // Prioritize testData over global variables to ensure we use the parameters from warmup phases
            let biDlParams, biUlParams;
            
            // For download parameters - prioritize original optimal parameters from warmup
            if (testData.originalOptimalDownloadParams) {
                // Use the original optimal parameters from warmup phase WITHOUT MODIFICATION
                biDlParams = { ...testData.originalOptimalDownloadParams };
                
                // Only set isDownloadPhase to false for bidirectional phase
                biDlParams.isDownloadPhase = false;
                console.log(`Using exact optimal download parameters from warmup for bidirectional test: ${JSON.stringify(biDlParams)}`);
            } else if (testData.optimalDownloadParams) {
                // Fall back to current optimalDownloadParams if original not available
                biDlParams = { ...testData.optimalDownloadParams };
                
                biDlParams.addDelay = false;
                biDlParams.isDownloadPhase = false;
                console.log(`Using testData download parameters for bidirectional test: ${JSON.stringify(biDlParams)}`);
            } else if (window.optimalDownloadParams) {
                biDlParams = { ...window.optimalDownloadParams };
                
                biDlParams.addDelay = false;
                biDlParams.isDownloadPhase = false;
                console.log(`Using global download parameters for bidirectional test: ${JSON.stringify(biDlParams)}`);
            } else {
                // Default fallback
                biDlParams = {
                    streamCount: 3,
                    pendingUploads: 1,
                    addDelay: false,
                    isDownloadPhase: false
                };
                console.log(`No download parameters found, using defaults for bidirectional test: ${JSON.stringify(biDlParams)}`);
            }
            
            // For upload parameters - prioritize best parameters from discovery module
            if (bestBiParams && bestBiParams.streamCount && bestBiParams.pendingUploads) {
                // Use the best parameters from the discovery module WITHOUT MODIFICATION
                biUlParams = { ...bestBiParams };
                console.log(`Using exact best parameters from discovery module for bidirectional test: ${JSON.stringify(biUlParams)}`);
                
                // Ensure we have valid values for required parameters
                if (biUlParams.streamCount === undefined || biUlParams.pendingUploads === undefined) {
                    console.log(`Best parameters missing required fields, adding defaults`);
                    biUlParams.streamCount = biUlParams.streamCount || 1;
                    biUlParams.pendingUploads = biUlParams.pendingUploads || 4;
                    biUlParams.uploadDelay = biUlParams.uploadDelay || 0;
                    console.log(`Updated upload parameters: ${JSON.stringify(biUlParams)}`);
                }
            } else if (testData.originalOptimalUploadParams) {
                // Use the original optimal parameters from warmup phase WITHOUT MODIFICATION
                biUlParams = { ...testData.originalOptimalUploadParams };
                // Keep all original properties including uploadDelay
                console.log(`Using exact original optimal upload parameters from warmup for bidirectional test: ${JSON.stringify(biUlParams)}`);
                
                // Ensure we have valid values for required parameters
                if (biUlParams.streamCount === undefined || biUlParams.pendingUploads === undefined) {
                    console.log(`Original upload parameters missing required fields, adding defaults`);
                    biUlParams.streamCount = biUlParams.streamCount || 1;
                    biUlParams.pendingUploads = biUlParams.pendingUploads || 4;
                    biUlParams.uploadDelay = biUlParams.uploadDelay || 0;
                    console.log(`Updated upload parameters: ${JSON.stringify(biUlParams)}`);
                }
            } else if (testData.optimalUploadParams) {
                // Fall back to current optimalUploadParams if original not available
                biUlParams = {
                    streamCount: testData.optimalUploadParams.streamCount !== undefined ?
                        testData.optimalUploadParams.streamCount : 1,
                    pendingUploads: testData.optimalUploadParams.pendingUploads !== undefined ?
                        testData.optimalUploadParams.pendingUploads : 4,
                    uploadDelay: 0 // No delay for bidirectional test
                };
                console.log(`Using testData upload parameters for bidirectional test: ${JSON.stringify(biUlParams)}`);
            } else if (window.optimalUploadParams) {
                biUlParams = { ...window.optimalUploadParams };
                console.log(`Using global upload parameters for bidirectional test: ${JSON.stringify(biUlParams)}`);
            } else {
                // Default fallback
                biUlParams = { streamCount: 1, pendingUploads: 4, uploadDelay: 0 };
                console.log(`No upload parameters found, using defaults for bidirectional test: ${JSON.stringify(biUlParams)}`);
            }
            
            console.log(`Download parameters: ${JSON.stringify(biDlParams)}`);
            console.log(`Upload parameters: ${JSON.stringify(biUlParams)}`);
            
            // Log the parameters in detail
            console.log(`BIDIRECTIONAL PHASE: Using parameters:`);
            console.log(`  - Download stream count: ${biDlParams.streamCount}`);
            console.log(`  - Download pending uploads: ${biDlParams.pendingUploads}`);
            console.log(`  - Upload stream count: ${biUlParams.streamCount}`);
            console.log(`  - Upload pending uploads: ${biUlParams.pendingUploads}`);
            console.log(`  - Upload delay: ${biUlParams.uploadDelay || 0}`);
            
            // Compare with original parameters - compare only the core properties
            console.log(`Are these the same as the original optimal parameters? (core properties only)`);
            
            // Extract core properties for comparison
            const extractCoreDownloadParams = (params) => {
                if (!params) return null;
                return {
                    streamCount: params.streamCount,
                    pendingUploads: params.pendingUploads
                };
            };
            
            const extractCoreUploadParams = (params) => {
                if (!params) return null;
                return {
                    streamCount: params.streamCount,
                    pendingUploads: params.pendingUploads,
                    uploadDelay: params.uploadDelay || 0
                };
            };
            
            // For download parameters
            const biDlParamsCore = extractCoreDownloadParams(biDlParams);
            const originalDlParamsCore = extractCoreDownloadParams(testData.originalOptimalDownloadParams);
            
            const dlParamsMatch = originalDlParamsCore ?
                JSON.stringify(biDlParamsCore) === JSON.stringify(originalDlParamsCore) : false;
                
            console.log(`  - Download (core properties): ${dlParamsMatch}`);
            if (!dlParamsMatch) {
                console.log(`  - Download params differences (core properties):`);
                console.log(`    - Original core: ${JSON.stringify(originalDlParamsCore)}`);
                console.log(`    - Used core: ${JSON.stringify(biDlParamsCore)}`);
                console.log(`    - Original full: ${JSON.stringify(testData.originalOptimalDownloadParams)}`);
                console.log(`    - Used full: ${JSON.stringify(biDlParams)}`);
            }
            
            // For upload parameters
            // If originalOptimalUploadParams is null, initialize it with current parameters
            if (!testData.originalOptimalUploadParams) {
                testData.originalOptimalUploadParams = { ...biUlParams };
                console.log(`Original optimal upload parameters were null, initializing with current parameters: ${JSON.stringify(testData.originalOptimalUploadParams)}`);
            }
            
            const biUlParamsCore = extractCoreUploadParams(biUlParams);
            const originalUlParamsCore = extractCoreUploadParams(testData.originalOptimalUploadParams);
            
            const ulParamsMatch = originalUlParamsCore ?
                JSON.stringify(biUlParamsCore) === JSON.stringify(originalUlParamsCore) : false;
                
            console.log(`  - Upload (core properties): ${ulParamsMatch}`);
            if (!ulParamsMatch) {
                console.log(`  - Upload params differences (core properties):`);
                console.log(`    - Original core: ${JSON.stringify(originalUlParamsCore)}`);
                console.log(`    - Used core: ${JSON.stringify(biUlParamsCore)}`);
                console.log(`    - Original full: ${JSON.stringify(testData.originalOptimalUploadParams)}`);
                console.log(`    - Used full: ${JSON.stringify(biUlParams)}`);
            }
            
            // Log the exact parameters being passed to the bidirectional saturation function
            console.log(`BIDIRECTIONAL PHASE: Passing parameters to StreamManager.startBidirectionalSaturation:`);
            console.log(`  - Download parameters: ${JSON.stringify(biDlParams)}`);
            console.log(`  - Upload parameters: ${JSON.stringify(biUlParams)}`);
            console.log(`  - Global window.optimalDownloadParams: ${JSON.stringify(window.optimalDownloadParams)}`);
            console.log(`  - Global window.optimalUploadParams: ${JSON.stringify(window.optimalUploadParams)}`);
            console.log(`  - testData.originalOptimalDownloadParams: ${JSON.stringify(testData.originalOptimalDownloadParams)}`);
            console.log(`  - testData.originalOptimalUploadParams: ${JSON.stringify(testData.originalOptimalUploadParams)}`);
            
            await StreamManager.startBidirectionalSaturation(
                0, // No fixed throughput
                0, // No fixed throughput
                biDlParams,
                biUlParams
            );
            break;
    }
}

/**
 * Handle test complete event
 */
async function handleTestComplete() {
    console.log('Test complete');
    
    // End current phase
    await phaseController.endPhase();
    
    // Stop the latency worker
    if (latencyWorker) {
        latencyWorker.postMessage({ command: 'stop' });
        latencyWorker.terminate();
        latencyWorker = null;
    }
    
    // Stop throughput monitor
    stopThroughputMonitor();
    
    // Get phase transitions from phase controller
    const phaseHistory = phaseController.getPhaseHistory();
    const phaseTransitions = phaseHistory.map((phase, index) => {
        if (index === 0) return null;
        
        const previousPhase = phaseHistory[index - 1];
        return {
            time: (phase.startTime - phaseController.testStartTime) / 1000,
            fromPhase: previousPhase.phase,
            toPhase: phase.phase
        };
    }).filter(Boolean);
    
    // Add phase annotations to the chart without redrawing the entire chart
    // This preserves the nice-looking chart from during the test
    addPhaseAnnotations(throughputChart, phaseTransitions);
    
    // Get throughput data for analysis (but don't redraw the chart)
    const downloadData = getDownloadThroughputData();
    const uploadData = getUploadThroughputData();
    
    // Extract phase-specific data for analysis
    testData.downloadThroughput.download = downloadData
        .filter(point => point.phase === TEST_PHASES.DOWNLOAD && !point.isOutOfPhase)
        .map(point => point.value);
        
    testData.uploadThroughput.upload = uploadData
        .filter(point => point.phase === TEST_PHASES.UPLOAD && !point.isOutOfPhase)
        .map(point => point.value);
        
    testData.downloadThroughput.bidirectional = downloadData
        .filter(point => point.phase === TEST_PHASES.BIDIRECTIONAL && !point.isOutOfPhase)
        .map(point => point.value);
        
    testData.uploadThroughput.bidirectional = uploadData
        .filter(point => point.phase === TEST_PHASES.BIDIRECTIONAL && !point.isOutOfPhase)
        .map(point => point.value);
    
    // Log data for debugging
    console.log('Download throughput data (download phase):', testData.downloadThroughput.download);
    console.log('Upload throughput data (upload phase):', testData.uploadThroughput.upload);
    console.log('Download throughput data (bidirectional phase):', testData.downloadThroughput.bidirectional);
    console.log('Upload throughput data (bidirectional phase):', testData.uploadThroughput.bidirectional);
    
    // Analyze and display results
    analyzeAndDisplayResults(testData);
}

/**
 * Set up periodic updates for parameter visualization during discovery
 */
function setupParameterVisualizationUpdates() {
    console.log("Setting up parameter visualization updates");
    
    // Update visualization more frequently (every 300ms) during discovery
    const updateInterval = setInterval(() => {
        const currentPhase = getCurrentPhase();
        const history = getParameterHistory();
        
        if (currentPhase === TEST_PHASES.DOWNLOAD_WARMUP) {
            console.log("Updating download parameter visualization");
            updateParameterVisualization(history, 'download');
        } else if (currentPhase === TEST_PHASES.UPLOAD_WARMUP) {
            console.log("Updating upload parameter visualization");
            updateParameterVisualization(history, 'upload');
        }
    }, 300);
    
    // Set up phase change listener to ensure visualization is shown/hidden appropriately
    window.addEventListener('test:phaseChange', (event) => {
        const phase = event.detail.phase;
        
        if (phase === TEST_PHASES.DOWNLOAD_WARMUP) {
            // Ensure visualization is shown at the start of download warmup
            setTimeout(() => {
                console.log("Phase change to download warmup - showing visualization");
                updateParameterVisualization(getParameterHistory(), 'download');
            }, 100);
        } else if (phase === TEST_PHASES.UPLOAD_WARMUP) {
            // Ensure visualization is shown at the start of upload warmup
            setTimeout(() => {
                console.log("Phase change to upload warmup - showing visualization");
                updateParameterVisualization(getParameterHistory(), 'upload');
            }, 100);
        } else if (phase === TEST_PHASES.DOWNLOAD) {
            // Keep download visualization visible when moving to download saturation phase
            console.log("Phase change to download saturation phase - keeping download visualization visible");
            // (removed hideParameterVisualization call)
        } else if (phase === TEST_PHASES.UPLOAD) {
            // Keep upload visualization visible when moving to upload saturation phase
            console.log("Phase change to upload saturation phase - keeping upload visualization visible");
            // (removed hideParameterVisualization call)
        }
    });
    
    // Clear interval on test complete
    window.addEventListener('test:complete', () => {
        console.log("Test complete - cleaning up visualization updates");
        clearInterval(updateInterval);
        // Keep visualizations visible after test completes
        // (removed hideParameterVisualization call)
    }, { once: true });
}

/**
 * Handle download throughput event
 * @param {CustomEvent} event - The throughput event
 */
function handleDownloadThroughput(event) {
    const throughput = event.detail.throughput;
    const smoothedThroughput = event.detail.smoothedThroughput;
    const elapsedTime = event.detail.time;
    const phase = event.detail.phase;
    const isOutOfPhase = event.detail.isOutOfPhase;
    
    // Store throughput data by phase
    if (phase === TEST_PHASES.DOWNLOAD_WARMUP) {
        testData.downloadThroughput.discovery.push(throughput);
        
        // If parameter discovery is in progress, send measurement
        if (isDiscoveryInProgress()) {
            // Get latest latency measurement
            const latency = testData.downloadDiscoveryLatency.length > 0 ?
                testData.downloadDiscoveryLatency[testData.downloadDiscoveryLatency.length - 1] :
                testData.baselineLatencyAvg;
                
            // Send measurement to parameter discovery module
            handleMeasurement({
                throughput: throughput,
                latency: latency
            });
        }
    } else if (phase === TEST_PHASES.DOWNLOAD) {
        testData.downloadThroughput.download.push(throughput);
    } else if (phase === TEST_PHASES.BIDIRECTIONAL) {
        testData.downloadThroughput.bidirectional.push(throughput);
    }
    
    // Add data point to throughput chart for all phases except baseline
    if (phase !== TEST_PHASES.BASELINE) {
        addDownloadThroughputDataPoint(throughputChart, elapsedTime, throughput, isOutOfPhase);
    }
}

/**
 * Handle upload throughput event
 * @param {CustomEvent} event - The throughput event
 */
function handleUploadThroughput(event) {
    const throughput = event.detail.throughput;
    const smoothedThroughput = event.detail.smoothedThroughput;
    const elapsedTime = event.detail.time;
    const phase = event.detail.phase;
    const isOutOfPhase = event.detail.isOutOfPhase;
    
    // Store throughput data by phase
    if (phase === TEST_PHASES.UPLOAD_WARMUP) {
        testData.uploadThroughput.discovery.push(throughput);
        
        // If parameter discovery is in progress, send measurement
        if (isDiscoveryInProgress()) {
            // Get latest latency measurement
            const latency = testData.uploadDiscoveryLatency.length > 0 ?
                testData.uploadDiscoveryLatency[testData.uploadDiscoveryLatency.length - 1] :
                testData.baselineLatencyAvg;
                
            // Send measurement to parameter discovery module
            handleMeasurement({
                throughput: throughput,
                latency: latency
            });
        }
    } else if (phase === TEST_PHASES.UPLOAD) {
        testData.uploadThroughput.upload.push(throughput);
    } else if (phase === TEST_PHASES.BIDIRECTIONAL) {
        testData.uploadThroughput.bidirectional.push(throughput);
    }
    
    // Add data point to throughput chart for all phases except baseline and download phases
    if (phase !== TEST_PHASES.BASELINE &&
        phase !== TEST_PHASES.DOWNLOAD_WARMUP &&
        phase !== TEST_PHASES.DOWNLOAD) {
        addUploadThroughputDataPoint(throughputChart, elapsedTime, throughput, isOutOfPhase);
    }
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
            // If this is a timeout fallback value, log it differently
            if (data.isTimeout) {
                console.log('Latency measurement timed out, using fallback value:', data.rtt);
                // Make sure timeout values are always processed and displayed
            }
            // Pass the timeout flag to processLatencyMeasurement
            processLatencyMeasurement(data.rtt, data.isTimeout);
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
 * @param {boolean} isTimeout - Whether the measurement timed out
 */
function processLatencyMeasurement(latency, isTimeout = false) {
    const currentPhase = getCurrentPhase();
    const elapsedTime = getElapsedTime();
    
    // Store latency based on current phase
    switch (currentPhase) {
        case TEST_PHASES.BASELINE:
            testData.baselineLatency.push(latency);
            break;
        case TEST_PHASES.DOWNLOAD_WARMUP:
            testData.downloadDiscoveryLatency.push(latency);
            break;
        case TEST_PHASES.DOWNLOAD:
            testData.downloadLatency.push(latency);
            break;
        case TEST_PHASES.UPLOAD_WARMUP:
            testData.uploadDiscoveryLatency.push(latency);
            break;
        case TEST_PHASES.UPLOAD:
            testData.uploadLatency.push(latency);
            break;
        case TEST_PHASES.BIDIRECTIONAL:
            testData.bidirectionalLatency.push(latency);
            break;
    }
    
    // Store the latest latency measurement in the global variable
    // This is used by the saturation.js file to adapt pacing
    window.latestLatencyMeasurement = latency;
    
    // Track consecutive timeouts
    if (isTimeout) {
        window.consecutiveTimeouts++;
        console.log(`Consecutive timeouts: ${window.consecutiveTimeouts}`);
        
        // Handle timeouts differently based on phase
        if (window.consecutiveTimeouts >= 5) { // Increased from 3 to 5
            if (currentPhase === TEST_PHASES.UPLOAD_WARMUP) {
                console.log(`${window.consecutiveTimeouts} consecutive timeouts during upload warmup, forcing very gentle parameter backoff`);
                // Force an extremely gentle parameter backoff for upload
                window.dispatchEvent(new CustomEvent('upload:force_backoff', {
                    detail: { backoffFactor: 0.9 } // Very gentle backoff to 90% of range (was 0.7)
                }));
                
                // Don't back off again for a while - reset counter to 3
                window.consecutiveTimeouts = 3;
            } else if (currentPhase === TEST_PHASES.DOWNLOAD_WARMUP) {
                console.log(`${window.consecutiveTimeouts} consecutive timeouts during download warmup, forcing parameter backoff`);
                // Force a parameter backoff for download
                window.dispatchEvent(new CustomEvent('download:force_backoff', {
                    detail: { backoffFactor: 0.5 } // Back off to 50% of range
                }));
            }
        }
    } else {
        // Reset consecutive timeouts counter on successful measurement
        window.consecutiveTimeouts = 0;
    }
    
    // Add data point to chart with timeout indicator
    addLatencyDataPoint(latencyChart, elapsedTime, latency, isTimeout);
    
    // Dispatch latency measurement event for adaptive upload streams
    window.dispatchEvent(new CustomEvent('latency:measurement', {
        detail: {
            latency: latency,
            phase: currentPhase,
            time: elapsedTime,
            isTimeout: isTimeout,
            consecutiveTimeouts: window.consecutiveTimeouts
        }
    }));
}

/**
 * Reset test data
 */
function resetTestData() {
    // Reset global latency variables
    window.latestLatencyMeasurement = 0;
    window.consecutiveTimeouts = 0;
    
    testData.baselineLatency = [];
    testData.downloadDiscoveryLatency = [];
    testData.downloadLatency = [];
    testData.uploadDiscoveryLatency = [];
    testData.uploadLatency = [];
    testData.bidirectionalLatency = [];
    testData.downloadThroughput = {
        discovery: [],
        download: [],
        bidirectional: []
    };
    testData.uploadThroughput = {
        discovery: [],
        upload: [],
        bidirectional: []
    };
    // Initialize with null values
    testData.optimalDownloadParams = null;
    testData.optimalUploadParams = null;
    testData.originalOptimalDownloadParams = null;
    testData.originalOptimalUploadParams = null;
    testData.baselineLatencyAvg = 0;
    
    // Clear global parameters
    window.optimalDownloadParams = null;
    window.optimalUploadParams = null;
    
    console.log('Test data reset complete');
}

/**
 * Clean up resources
 */
function cleanup() {
    console.log("Page unloading, cleaning up resources");
    
    // Stop the latency worker
    if (latencyWorker) {
        latencyWorker.terminate();
        latencyWorker = null;
    }
    
    // Stop throughput monitor
    stopThroughputMonitor();
    
    // Stop all streams
    StreamManager.terminateAllStreams();
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', init);