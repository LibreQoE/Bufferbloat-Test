/**
 * Saturation Module
 * Handles download and upload saturation tests
 */

// Configuration
const THROUGHPUT_INTERVAL = 200; // ms
const CONCURRENT_STREAMS = 4; // Keep at 4 to avoid hitting browser connection limits
const UPLOAD_CHUNK_SIZE = 64 * 1024; // Keep at 64KB due to crypto.getRandomValues() limitation
const UPLOAD_CHUNKS_PER_REQUEST = 4; // Send multiple chunks per request to achieve higher throughput

// State variables
let downloadStreams = [];
let uploadStreams = [];
let downloadThroughputData = [];
let uploadThroughputData = [];
let throughputTimer = null;
let bytesReceived = new Array(CONCURRENT_STREAMS).fill(0);
let bytesSent = new Array(CONCURRENT_STREAMS).fill(0);
let lastMeasurementTime = 0;

/**
 * Start the download saturation test
 * @returns {Promise} Resolves when the test is started
 */
async function startDownloadSaturation() {
    // Reset state
    stopAllStreams();
    downloadThroughputData = [];
    bytesReceived = new Array(CONCURRENT_STREAMS).fill(0);
    
    // Start throughput measurement
    lastMeasurementTime = performance.now();
    throughputTimer = setInterval(measureDownloadThroughput, THROUGHPUT_INTERVAL);
    
    // Start concurrent download streams
    for (let i = 0; i < CONCURRENT_STREAMS; i++) {
        const streamIndex = i;
        const controller = new AbortController();
        const signal = controller.signal;
        
        downloadStreams[i] = {
            controller: controller,
            promise: fetch('/download', {
                method: 'GET',
                signal: signal,
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-store'
                }
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                const reader = response.body.getReader();
                
                // Process the stream
                return readStream(reader, chunk => {
                    bytesReceived[streamIndex] += chunk.length;
                });
            }).catch(error => {
                if (error.name !== 'AbortError') {
                    console.error(`Download stream ${streamIndex} error:`, error);
                }
            })
        };
    }
    
    return Promise.resolve();
}

/**
 * Start the upload saturation test
 * @returns {Promise} Resolves when the test is started
 */
async function startUploadSaturation() {
    console.log("Starting upload saturation test");
    
    // Reset state
    stopAllStreams();
    uploadThroughputData = [];
    bytesSent = new Array(CONCURRENT_STREAMS).fill(0);
    
    // Start throughput measurement
    lastMeasurementTime = performance.now();
    throughputTimer = setInterval(measureUploadThroughput, THROUGHPUT_INTERVAL);
    
    // Create multiple chunks of random data (respecting the 64KB limit of crypto.getRandomValues)
    const uploadChunks = [];
    for (let i = 0; i < UPLOAD_CHUNKS_PER_REQUEST; i++) {
        const chunk = new Uint8Array(UPLOAD_CHUNK_SIZE);
        crypto.getRandomValues(chunk);
        uploadChunks.push(chunk);
    }
    
    const totalBytes = UPLOAD_CHUNK_SIZE * UPLOAD_CHUNKS_PER_REQUEST;
    console.log(`Created ${UPLOAD_CHUNKS_PER_REQUEST} upload chunks of ${UPLOAD_CHUNK_SIZE} bytes each (total: ${totalBytes} bytes)`);
    
    // Start concurrent upload streams
    const promises = [];
    for (let i = 0; i < CONCURRENT_STREAMS; i++) {
        // Slight delay between starting streams to prevent initial congestion
        await new Promise(resolve => setTimeout(resolve, 50));
        promises.push(runUploadStream(i, uploadChunks));
    }
    
    // Keep the upload running in the background
    Promise.all(promises).catch(err => {
        console.error("Upload stream error:", err);
    });
    
    return Promise.resolve();
}

/**
 * Start a single upload stream
 * @param {number} streamIndex - The index of the stream
 * @param {Uint8Array} data - The data to upload
 */
/**
 * Run a continuous upload stream
 * @param {number} streamIndex - The index of the stream
 * @param {Uint8Array} data - The data to upload
 * @returns {Promise} - A promise that resolves when the stream is stopped
 */
async function runUploadStream(streamIndex, dataChunks) {
    const controller = new AbortController();
    
    const totalBytes = dataChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    console.log(`Starting upload stream ${streamIndex} with ${dataChunks.length} chunks (${totalBytes} bytes total)`);
    
    // Create a stream object to track this upload
    uploadStreams[streamIndex] = {
        controller: controller,
        active: true
    };
    
    // Keep uploading until stopped
    let uploadCount = 0;
    while (uploadStreams[streamIndex]?.active) {
        try {
            // Combine all chunks into one blob for this request
            const combinedBlob = new Blob(dataChunks, { type: 'application/octet-stream' });
            
            const startTime = performance.now();
            
            const response = await fetch('/upload', {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: combinedBlob
            });
            
            const endTime = performance.now();
            const requestTime = endTime - startTime;
            
            if (response.ok) {
                // Update bytes sent counter
                bytesSent[streamIndex] += totalBytes;
                uploadCount++;
                
                if (uploadCount % 5 === 0) {
                    console.log(`Upload stream ${streamIndex}: ${uploadCount} requests sent (${uploadCount * totalBytes} bytes), last took ${requestTime.toFixed(2)}ms`);
                }
                
                // Adaptive delay - shorter delay for slower uploads, no delay for fast uploads
                if (requestTime < 20) {
                    // No delay for very fast uploads to maximize throughput
                    continue;
                } else if (requestTime < 100) {
                    // Short delay for moderately fast uploads
                    await new Promise(resolve => setTimeout(resolve, 5));
                } else {
                    // Longer delay for slow uploads to prevent overwhelming
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            } else {
                console.error(`Upload error: ${response.status}`);
                // Longer delay on error
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error(`Upload stream ${streamIndex} error:`, error);
                // Delay after error
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                break;
            }
        }
    }
    
    console.log(`Upload stream ${streamIndex} stopped after sending ${uploadCount} requests (${uploadCount * totalBytes} bytes)`);
}

/**
 * Stop all active streams
 */
function stopAllStreams() {
    // Stop download streams
    downloadStreams.forEach(stream => {
        if (stream && stream.controller) {
            stream.controller.abort();
        }
    });
    downloadStreams = [];
    
    // Stop upload streams
    uploadStreams.forEach(stream => {
        if (stream) {
            stream.active = false;
            if (stream.controller) {
                stream.controller.abort();
            }
        }
    });
    uploadStreams = [];
    
    // Stop throughput measurement
    if (throughputTimer) {
        clearInterval(throughputTimer);
        throughputTimer = null;
    }
}

/**
 * Measure download throughput
 */
function measureDownloadThroughput() {
    const now = performance.now();
    const elapsedSeconds = (now - lastMeasurementTime) / 1000;
    lastMeasurementTime = now;
    
    if (elapsedSeconds <= 0) return;
    
    // Calculate total bytes received across all streams
    const totalBytes = bytesReceived.reduce((sum, bytes) => sum + bytes, 0);
    
    // Reset byte counters for next measurement
    bytesReceived = new Array(CONCURRENT_STREAMS).fill(0);
    
    // Calculate throughput in Mbps (megabits per second)
    const throughputMbps = (totalBytes * 8) / (elapsedSeconds * 1000000);
    
    // Store the measurement
    downloadThroughputData.push(throughputMbps);
}

/**
 * Measure upload throughput
 */
function measureUploadThroughput() {
    const now = performance.now();
    const elapsedSeconds = (now - lastMeasurementTime) / 1000;
    lastMeasurementTime = now;
    
    if (elapsedSeconds <= 0) return;
    
    // Calculate total bytes sent across all streams
    const totalBytes = bytesSent.reduce((sum, bytes) => sum + bytes, 0);
    
    console.log(`Upload throughput measurement: ${totalBytes} bytes in ${elapsedSeconds.toFixed(3)}s`);
    
    // Reset byte counters for next measurement
    bytesSent = new Array(CONCURRENT_STREAMS).fill(0);
    
    // Calculate throughput in Mbps (megabits per second)
    const throughputMbps = (totalBytes * 8) / (elapsedSeconds * 1000000);
    console.log(`Upload throughput: ${throughputMbps.toFixed(2)} Mbps`);
    
    // Store the measurement
    uploadThroughputData.push(throughputMbps);
}

/**
 * Read a stream and process chunks
 * @param {ReadableStreamDefaultReader} reader - The stream reader
 * @param {Function} processChunk - Function to process each chunk
 * @returns {Promise} Resolves when the stream is fully read
 */
async function readStream(reader, processChunk) {
    try {
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }
            
            processChunk(value);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Stream reading error:', error);
        }
    }
}

/**
 * Get the download throughput data
 * @returns {Array} Array of throughput measurements in Mbps
 */
function getDownloadThroughputData() {
    return [...downloadThroughputData];
}

/**
 * Get the upload throughput data
 * @returns {Array} Array of throughput measurements in Mbps
 */
function getUploadThroughputData() {
    return [...uploadThroughputData];
}

export {
    startDownloadSaturation,
    startUploadSaturation,
    stopAllStreams,
    getDownloadThroughputData,
    getUploadThroughputData
};