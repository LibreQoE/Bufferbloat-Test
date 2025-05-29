/**
 * Stream Manager
 * Handles the creation, tracking, and termination of network streams
 */

class StreamManager {
    // Stream registry
    static streams = {
        download: new Map(),
        upload: new Map()
    };
    
    // Stream ID counter
    static nextStreamId = 1;
    
    /**
     * Generate a unique stream ID
     * @returns {string} A unique stream ID
     */
    static generateId() {
        return `stream-${Date.now()}-${this.nextStreamId++}`;
    }
    
    /**
     * Register a stream in the registry
     * @param {string} type - The stream type ('download' or 'upload')
     * @param {Object} stream - The stream object
     * @returns {string} The stream ID
     */
    static registerStream(type, stream) {
        const streamId = this.generateId();
        stream.id = streamId;
        stream.type = type;
        stream.createdAt = performance.now();
        stream.active = true;
        
        this.streams[type].set(streamId, stream);
        
        // Dispatch stream creation event
        this.dispatchStreamEvent('created', streamId, type);
        
        return streamId;
    }
    
    /**
     * Create a download stream
     * @param {Object} options - Stream options
     * @returns {string} The stream ID
     */
    static async createDownloadStream(options = {}) {
        const controller = new AbortController();
        const signal = controller.signal;
        
        const stream = {
            controller,
            bytesReceived: 0,
            options,
            readerCancelled: false
        };
        
        // Register stream before starting it
        const streamId = this.registerStream('download', stream);
        
        try {
            stream.promise = fetch('/download', {
                method: 'GET',
                signal,
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-store',
                    'X-Stream-ID': streamId,
                    'X-Priority': 'low'
                }
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                // Check if stream is still active before proceeding
                if (!stream.active) {
                    console.log(`Stream ${streamId} no longer active, aborting reader setup`);
                    return false;
                }
                
                const reader = response.body.getReader();
                stream.reader = reader;
                
                // Process the stream
                return this.processStream(stream, reader);
            }).catch(error => {
                // Only handle error if stream is still active
                if (stream.active) {
                    this.handleStreamError(stream, error);
                } else {
                    console.log(`Stream ${streamId} already terminated, skipping error handling`);
                }
            });
            
            return streamId;
        } catch (error) {
            // Only handle error if stream is still active
            if (stream.active) {
                this.handleStreamError(stream, error);
            } else {
                console.log(`Stream ${streamId} already terminated, skipping error handling`);
            }
            return null;
        }
    }
    
    /**
     * Create an upload stream
     * @param {Object} options - Stream options
     * @param {Array} dataChunks - Data chunks to upload
     * @returns {string} The stream ID
     */
    static async createUploadStream(options = {}, dataChunks = []) {
        console.log(`Creating upload stream with options:`, JSON.stringify(options));
        console.log(`Initial data chunks count: ${dataChunks.length}`);
        
        const stream = {
            bytesSent: 0,
            pendingUploads: 0,
            maxPendingUploads: options.pendingUploads || 1,
            uploadDelay: options.uploadDelay || 0,
            options,
            dataChunks,
            active: true
        };
        
        // Register stream before starting it
        const streamId = this.registerStream('upload', stream);
        
        try {
            // Start the upload process
            this.runUploadStream(stream);
            return streamId;
        } catch (error) {
            this.handleStreamError(stream, error);
            return null;
        }
    }
    
    /**
     * Run an upload stream
     * @param {Object} stream - The stream object
     */
    static async runUploadStream(stream) {
        // Keep track of pending uploads
        let pendingUploads = 0;
        let consecutiveErrors = 0;
        let lastUploadTime = performance.now();
        let noActivityDuration = 0;
        
        // Continue uploading while the stream is active
        while (stream.active) {
            const currentTime = performance.now();
            
            // Calculate time since last successful upload
            noActivityDuration = currentTime - lastUploadTime;
            
            // Check if we can start a new upload
            if (pendingUploads < stream.maxPendingUploads && stream.dataChunks.length > 0) {
                pendingUploads++;
                
                // Start a new upload
                this.uploadChunk(stream)
                    .then(() => {
                        pendingUploads--;
                        consecutiveErrors = 0; // Reset error counter on success
                        lastUploadTime = performance.now(); // Update last upload time
                    })
                    .catch(error => {
                        pendingUploads--;
                        if (error.name !== 'AbortError') {
                            console.error(`Upload error:`, error);
                            consecutiveErrors++;
                            
                            // If we have too many consecutive errors, add more chunks to ensure we keep trying
                            if (consecutiveErrors > 3 && stream.dataChunks.length < 5) {
                                console.log(`Adding more chunks to keep upload stream alive after errors`);
                                // Add more chunks if we're running low
                                this.addMoreUploadChunks(stream, 10);
                                // Reduce consecutive errors but don't reset completely
                                consecutiveErrors = 2;
                            }
                        }
                    });
            } else if (stream.dataChunks.length < 5) {
                // If we're running low on chunks, add more to keep the stream alive
                // This applies to both discovery and full test phases
                console.log(`Adding more chunks to keep upload stream alive (${stream.dataChunks.length} remaining)`);
                this.addMoreUploadChunks(stream, 10);
            }
            
            // If no upload activity for more than 300ms, force new chunks and uploads
            // More aggressive for discovery phase to ensure continuous upload
            const activityThreshold = stream.options.isDiscovery ? 300 : 500;
            if (noActivityDuration > activityThreshold && pendingUploads === 0) {
                console.log(`No upload activity for ${noActivityDuration.toFixed(0)}ms, forcing new chunks and uploads`);
                // Add more chunks to ensure we have something to upload
                // Add more chunks for discovery phase
                const chunkCount = stream.options.isDiscovery ? 30 : 20;
                this.addMoreUploadChunks(stream, chunkCount);
                // Reset the timer to prevent spamming
                lastUploadTime = performance.now();
            }
            
            // Add delay between upload attempts
            if (stream.uploadDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, stream.uploadDelay));
            } else {
                // Small delay to prevent tight loop
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // If no more data chunks and no pending uploads, replenish
            if (stream.dataChunks.length === 0 && pendingUploads === 0) {
                // For both discovery and full test phases, add more chunks to keep going
                console.log(`Replenishing chunks to continue upload saturation`);
                this.addMoreUploadChunks(stream, 20);
                
                // Reset the timer to prevent spamming
                lastUploadTime = performance.now();
            }
        }
    }
    
    /**
     * Upload a chunk of data
     * @param {Object} stream - The stream object
     * @returns {Promise} A promise that resolves when the upload is complete
     */
    static async uploadChunk(stream) {
        if (!stream.active || stream.dataChunks.length === 0) {
            return;
        }
        
        // Get a chunk to upload
        const chunk = stream.dataChunks[0];
        
        // Create a controller for this upload with a longer timeout (5 seconds)
        const controller = new AbortController();
        const signal = controller.signal;
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        try {
            // Log chunk size before upload
            const chunkSize = chunk.length;
            console.log(`Uploading chunk of size ${chunkSize} bytes (${Math.round(chunkSize/1024)}KB) for stream ${stream.id}`);
            
            // Log phase information
            const phaseInfo = stream.options.isDiscovery ? 'discovery' : 'full test';
            console.log(`Stream ${stream.id} is in ${phaseInfo} phase`);
            
            // Perform the upload with retry logic
            let retries = 0;
            const maxRetries = 2;
            let response = null;
            
            while (retries <= maxRetries) {
                try {
                    response = await fetch('/upload', {
                        method: 'POST',
                        signal,
                        headers: {
                            'Content-Type': 'application/octet-stream',
                            'X-Stream-ID': stream.id,
                            'X-Priority': 'low',
                            'X-Retry-Count': retries.toString()
                        },
                        body: chunk
                    });
                    
                    if (response.ok) {
                        break; // Success, exit retry loop
                    } else {
                        retries++;
                        if (retries <= maxRetries) {
                            console.log(`Retrying upload for stream ${stream.id} (attempt ${retries}/${maxRetries})`);
                            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
                        }
                    }
                } catch (fetchError) {
                    retries++;
                    if (retries <= maxRetries && fetchError.name !== 'AbortError') {
                        console.log(`Fetch error, retrying upload for stream ${stream.id} (attempt ${retries}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
                    } else {
                        throw fetchError; // Rethrow if max retries reached or if aborted
                    }
                }
            }
            
            // Clear the timeout
            clearTimeout(timeoutId);
            
            if (!response || !response.ok) {
                throw new Error(`HTTP error! Status: ${response ? response.status : 'unknown'}`);
            }
            
            // Update bytes sent
            const previousBytesSent = stream.bytesSent || 0;
            stream.bytesSent = (previousBytesSent + chunkSize);
            
            // Log bytes sent update
            console.log(`Stream ${stream.id} bytes sent updated: ${previousBytesSent} -> ${stream.bytesSent} (+${chunkSize})`);
            
            // Remove the chunk from the queue
            stream.dataChunks.shift();
            
            return response;
        } catch (error) {
            // Clear the timeout if it exists
            clearTimeout(timeoutId);
            
            if (error.name !== 'AbortError') {
                console.error(`Upload chunk error:`, error);
            }
            throw error;
        }
    }
    
    /**
     * Process a stream
     * @param {Object} stream - The stream object
     * @param {ReadableStreamDefaultReader} reader - The stream reader
     * @returns {Promise} A promise that resolves when the stream is done
     */
    static async processStream(stream, reader) {
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log(`Stream ${stream.id} complete`);
                    break;
                }
                
                // Process the chunk
                stream.bytesReceived += value.length;
                
                // If delay is needed for pacing
                if (stream.options.addDelay) {
                    // Use the specified chunkDelay or default to 10ms
                    const delayMs = stream.options.chunkDelay || 10;
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            
            // Mark reader as cancelled since it completed normally
            stream.readerCancelled = true;
            
            // Check if stream is already terminated to avoid double termination
            if (stream.active) {
                // Stream completed normally
                this.terminateStream(stream.id, stream.type);
            } else {
                console.log(`Stream ${stream.id} already terminated, skipping termination`);
            }
            return true;
        } catch (error) {
            // Handle stream processing error
            this.handleStreamError(stream, error);
            return false;
        }
    }
    
    /**
     * Handle stream error
     * @param {Object} stream - The stream object
     * @param {Error} error - The error object
     */
    static handleStreamError(stream, error) {
        if (error.name !== 'AbortError') {
            console.error(`Stream ${stream.id} error:`, error);
        }
        
        // Check if stream is already terminated to avoid double termination
        if (stream.active) {
            // Ensure stream is terminated
            this.terminateStream(stream.id, stream.type);
        } else {
            console.log(`Stream ${stream.id} already terminated, skipping error termination`);
        }
    }
    
    /**
     * Terminate a stream
     * @param {string} streamId - The stream ID
     * @param {string} type - The stream type ('download' or 'upload')
     * @returns {boolean} True if the stream was terminated, false otherwise
     */
    static async terminateStream(streamId, type) {
        const streamMap = this.streams[type];
        const stream = streamMap.get(streamId);
        
        if (!stream) return false;
        
        try {
            // Multiple termination mechanisms
            if (stream.controller) {
                stream.controller.abort();
                stream.controller = null;
            }
            
            if (stream.reader) {
                try {
                    // Check if the reader is already closed or cancelled
                    if (!stream.readerCancelled) {
                        await stream.reader.cancel();
                        stream.readerCancelled = true;
                    }
                } catch (e) {
                    // Suppress AbortError messages as they're expected when terminating streams
                    if (e.name !== 'AbortError') {
                        console.warn(`Error cancelling reader for stream ${streamId}:`, e);
                    }
                }
                stream.reader = null;
            }
            
            // Clear all references
            stream.active = false;
            stream.promise = null;
            
            // Remove from registry
            streamMap.delete(streamId);
            
            // Dispatch stream termination event
            this.dispatchStreamEvent('terminated', streamId, type);
            
            return true;
        } catch (error) {
            console.error(`Error terminating stream ${streamId}:`, error);
            
            // Force removal even if error occurs
            streamMap.delete(streamId);
            
            // Don't dispatch termination event again to avoid double events
            // The event was already dispatched in the try block
            
            return false;
        }
    }
    
    /**
     * Terminate all streams
     * @returns {Promise} A promise that resolves when all streams are terminated
     */
    static async terminateAllStreams() {
        console.log("Terminating all streams");
        
        const downloadPromises = Array.from(this.streams.download.keys())
            .map(id => this.terminateStream(id, 'download'));
            
        const uploadPromises = Array.from(this.streams.upload.keys())
            .map(id => this.terminateStream(id, 'upload'));
            
        await Promise.all([...downloadPromises, ...uploadPromises]);
        
        // Double-check and force cleanup if necessary
        if (this.streams.download.size > 0 || this.streams.upload.size > 0) {
            console.warn("Forcing stream registry reset");
            this.resetRegistry();
        }
        
        return true;
    }
    
    /**
     * Reset the stream registry
     */
    static resetRegistry() {
        this.streams.download.clear();
        this.streams.upload.clear();
        
        // Dispatch registry reset event
        window.dispatchEvent(new CustomEvent('stream:reset', {
            detail: {
                timestamp: performance.now()
            }
        }));
    }
    
    /**
     * Get active stream counts
     * @returns {Object} Object with download and upload counts
     */
    static getActiveStreamCounts() {
        return {
            download: this.streams.download.size,
            upload: this.streams.upload.size,
            total: this.streams.download.size + this.streams.upload.size
        };
    }
    
    /**
     * Add more chunks to an upload stream to keep it going
     * @param {Object} stream - The stream object
     * @param {number} count - Number of chunks to add
     */
    static addMoreUploadChunks(stream, count = 10) {
        const maxChunkSize = 65536; // 64KB max for crypto.getRandomValues
        
        // For discovery phase, use gradually increasing chunk sizes
        // For full test, use the maximum size
        if (stream.options.isDiscovery) {
            // Calculate appropriate chunk sizes based on how many chunks we've already sent
            // This helps continue the gradual ramp-up even when adding more chunks
            const initialChunkSize = 4 * 1024; // 4KB initial size
            const maxTargetChunkSize = 64 * 1024; // Max 64KB (crypto library limit)
            
            // Estimate how many chunks we've already processed based on bytes sent
            const bytesPerChunk = (initialChunkSize + maxTargetChunkSize) / 2; // Rough average
            const estimatedChunksProcessed = Math.floor(stream.bytesSent / bytesPerChunk) || 0;
            
            console.log(`Stream ${stream.id} estimated chunks processed: ${estimatedChunksProcessed}, bytes sent: ${stream.bytesSent}`);
            
            // Ensure we're adding enough chunks to keep the upload stream going
            // This is especially important for the discovery phase
            if (count < 10 && stream.options.isDiscovery) {
                count = 10; // Ensure we add at least 10 chunks for discovery phase
                console.log(`Increasing chunk count to ${count} to ensure continuous upload during discovery`);
            }
            
            for (let i = 0; i < count; i++) {
                // Calculate size for this chunk - gradually increase from initial to max
                // Use a logarithmic scale to start small and ramp up more slowly
                const chunkIndex = estimatedChunksProcessed + i;
                const progress = Math.min(1, chunkIndex / 30); // Cap at 1 after 30 chunks
                const scaleFactor = Math.pow(progress, 0.5); // Slower initial growth
                const targetChunkSize = Math.floor(initialChunkSize + scaleFactor * (maxTargetChunkSize - initialChunkSize));
                
                console.log(`Adding upload discovery chunk ${i+1}/${count} (index ${chunkIndex}): ${Math.round(targetChunkSize/1024)}KB`);
                
                const chunk = new Uint8Array(targetChunkSize);
                
                // Fill with random data in smaller segments if needed
                if (targetChunkSize <= maxChunkSize) {
                    // Can fill in one go
                    crypto.getRandomValues(chunk);
                } else {
                    // Need to fill in segments
                    for (let offset = 0; offset < targetChunkSize; offset += maxChunkSize) {
                        const length = Math.min(maxChunkSize, targetChunkSize - offset);
                        const tempChunk = new Uint8Array(length);
                        crypto.getRandomValues(tempChunk);
                        chunk.set(tempChunk, offset);
                    }
                }
                
                stream.dataChunks.push(chunk);
            }
        } else {
            // For full test, use fixed maximum size
            const targetChunkSize = 64 * 1024; // 64KB for full test
            
            for (let i = 0; i < count; i++) {
                const chunk = new Uint8Array(targetChunkSize);
                
                // Fill with random data in smaller segments if needed
                if (targetChunkSize <= maxChunkSize) {
                    // Can fill in one go
                    crypto.getRandomValues(chunk);
                } else {
                    // Need to fill in segments
                    for (let offset = 0; offset < targetChunkSize; offset += maxChunkSize) {
                        const length = Math.min(maxChunkSize, targetChunkSize - offset);
                        const tempChunk = new Uint8Array(length);
                        crypto.getRandomValues(tempChunk);
                        chunk.set(tempChunk, offset);
                    }
                }
                
                stream.dataChunks.push(chunk);
            }
        }
        
        console.log(`Added ${count} more chunks to upload stream ${stream.id}, now has ${stream.dataChunks.length} chunks`);
    }
    
    /**
     * Dispatch stream event
     * @param {string} eventType - The event type ('created' or 'terminated')
     * @param {string} streamId - The stream ID
     * @param {string} streamType - The stream type ('download' or 'upload')
     */
    static dispatchStreamEvent(eventType, streamId, streamType) {
        window.dispatchEvent(new CustomEvent('stream:lifecycle', {
            detail: {
                type: eventType,
                streamId,
                streamType,
                timestamp: performance.now()
            }
        }));
    }
    
    /**
     * Start download saturation
     * @param {boolean} isDiscovery - Whether this is a discovery phase
     * @param {number} fixedThroughput - Fixed throughput in Mbps (0 for auto)
     * @param {Object} params - Stream parameters
     * @returns {Promise} A promise that resolves when saturation is started
     */
    static async startDownloadSaturation(isDiscovery = false, fixedThroughput = 0, params = {}) {
        console.log(`Starting download saturation (${isDiscovery ? 'discovery' : 'full'} phase)`);
        
        // Log the full parameters received
        console.log(`Download saturation parameters received:`, JSON.stringify(params));
        
        // Get stream count from params or use default
        let streamCount;
        if (isDiscovery) {
            streamCount = params.streamCount || 1;
        } else {
            // For full test, use the parameters discovered during warmup
            streamCount = params.streamCount || 3;  // Default to 3 streams for better performance
            console.log(`Using discovered stream count for download: ${streamCount}`);
            console.log(`isDownloadPhase flag: ${params.isDownloadPhase}`);
            
            // Determine if this is for bidirectional phase by comparing core properties
            if (window.optimalDownloadParams) {
                const isBidirectional = !(params.streamCount === window.optimalDownloadParams.streamCount &&
                                         params.pendingUploads === window.optimalDownloadParams.pendingUploads &&
                                         params.isDownloadPhase === window.optimalDownloadParams.isDownloadPhase);
                console.log(`Is this for bidirectional phase? ${isBidirectional ? 'Yes' : 'No'}`);
            }
        }
        
        // Create specified number of download streams
        const streamPromises = [];
        for (let i = 0; i < streamCount; i++) {
            const options = {
                // Only add delay if explicitly requested in params
                // This ensures phase 3 (Download) and phase 6 (Bidirectional) behave consistently
                addDelay: params.addDelay || false,
                chunkDelay: params.chunkDelay || 10,
                chunkSize: 128 * 1024, // Use larger chunks to move more data
                isDiscovery: isDiscovery, // Pass the phase information
                // Preserve the isDownloadPhase flag exactly as it was in the original parameters
                // This is critical for consistent behavior between phases
                isDownloadPhase: params.isDownloadPhase
            };
            
            // Log the options being used for this download stream
            console.log(`Download stream options: isDownloadPhase=${options.isDownloadPhase}, addDelay=${options.addDelay}`);
            
            streamPromises.push(this.createDownloadStream(options));
            
            // Add a small delay between starting streams
            if (i < streamCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return Promise.all(streamPromises);
    }
    
    /**
     * Start upload saturation
     * @param {boolean} isDiscovery - Whether this is a discovery phase
     * @param {number} fixedThroughput - Fixed throughput in Mbps (0 for auto)
     * @param {Object} params - Stream parameters
     * @param {Array} dataChunks - Data chunks to upload
     * @returns {Promise} A promise that resolves when saturation is started
     */
    static async startUploadSaturation(isDiscovery = false, fixedThroughput = 0, params = {}, dataChunks = []) {
        console.log(`Starting upload saturation (${isDiscovery ? 'discovery' : 'full'} phase)`);
        console.log(`Upload parameters received:`, JSON.stringify(params));
        
        // Get parameters from params or use defaults
        // For full test, use more streams and pending uploads to better saturate the connection
        let streamCount, pendingUploads, uploadDelay, minDuration;
        
        if (isDiscovery) {
            streamCount = params.streamCount || 1;
            pendingUploads = params.pendingUploads || 1;
            uploadDelay = params.uploadDelay || 0; // Changed from 50 to 0 for better saturation
            minDuration = params.minDuration || 0; // Minimum duration for discovery phase
            
            // If minDuration is specified, pass it to the parameter discovery module
            if (minDuration > 0) {
                // Dispatch event to set minimum duration for parameter discovery
                window.dispatchEvent(new CustomEvent('upload:set_min_duration', {
                    detail: { minDuration }
                }));
                console.log(`Setting minimum upload discovery duration to ${minDuration/1000} seconds`);
            }
        } else {
            // For full test, use the EXACT parameters provided by the warmup phase
            // This is critical for consistent behavior between phases
            streamCount = params.streamCount;
            pendingUploads = params.pendingUploads;
            uploadDelay = params.uploadDelay !== undefined ? params.uploadDelay : 0;
            
            // Log the parameters in detail
            console.log(`Using upload parameters from warmup phase: streams=${streamCount}, pendingUploads=${pendingUploads}, uploadDelay=${uploadDelay}`);
            
            // Determine if this is for bidirectional phase by comparing core properties
            const isBidirectional = window.optimalUploadParams ?
                !(params.streamCount === window.optimalUploadParams.streamCount &&
                  params.pendingUploads === window.optimalUploadParams.pendingUploads) : true;
                  
            console.log(`Is this for bidirectional phase? ${isBidirectional ? 'Yes' : 'No'}`);
            
            // Validate that we have valid parameters
            if (!streamCount || !pendingUploads) {
                console.warn(`WARNING: Invalid upload parameters received. Using fallbacks.`);
                streamCount = streamCount || 2;  // Increased from 1 to 2 for better performance
                pendingUploads = pendingUploads || 2;  // Increased from 1 to 2 for better performance
            }
        }
        
        // Create data chunks if not provided
        if (dataChunks.length === 0) {
            // Create chunks with random data
            // crypto.getRandomValues can only handle up to 65536 bytes at once
            const maxChunkSize = 65536; // 64KB max for crypto.getRandomValues
            const chunksPerStream = isDiscovery ? 50 : 20; // More chunks for discovery to allow for gradual size increase and continuous upload
            
            // For discovery phase, start with smaller chunks and gradually increase size
            // For full test, use the maximum size
            let initialChunkSize, maxTargetChunkSize;
            
            if (isDiscovery) {
                // Start with small chunks (4KB) for discovery and gradually increase
                initialChunkSize = 4 * 1024; // 4KB initial size
                maxTargetChunkSize = 64 * 1024; // Max 64KB (crypto library limit)
                console.log(`Starting upload discovery with small chunks (${initialChunkSize/1024}KB) ramping up to ${maxTargetChunkSize/1024}KB`);
                
                // Create chunks with gradually increasing sizes
                for (let i = 0; i < chunksPerStream; i++) {
                    // Calculate size for this chunk - gradually increase from initial to max
                    // Use a logarithmic scale to start small and ramp up more slowly
                    const progress = i / (chunksPerStream - 1); // 0 to 1
                    const scaleFactor = Math.pow(progress, 0.5); // Slower initial growth
                    const targetChunkSize = Math.floor(initialChunkSize + scaleFactor * (maxTargetChunkSize - initialChunkSize));
                    
                    console.log(`Upload discovery chunk ${i+1}/${chunksPerStream}: ${Math.round(targetChunkSize/1024)}KB`);
                    
                    const chunk = new Uint8Array(targetChunkSize);
                    
                    // Fill with random data in smaller segments if needed
                    if (targetChunkSize <= maxChunkSize) {
                        // Can fill in one go
                        crypto.getRandomValues(chunk);
                    } else {
                        // Need to fill in segments
                        for (let offset = 0; offset < targetChunkSize; offset += maxChunkSize) {
                            const length = Math.min(maxChunkSize, targetChunkSize - offset);
                            const tempChunk = new Uint8Array(length);
                            crypto.getRandomValues(tempChunk);
                            chunk.set(tempChunk, offset);
                        }
                    }
                    
                    dataChunks.push(chunk);
                }
            } else {
                // For full test, use fixed maximum size
                const targetChunkSize = 64 * 1024; // 64KB for full test
                
                for (let i = 0; i < chunksPerStream; i++) {
                    const chunk = new Uint8Array(targetChunkSize);
                    
                    // Fill with random data in smaller segments if needed
                    if (targetChunkSize <= maxChunkSize) {
                        // Can fill in one go
                        crypto.getRandomValues(chunk);
                    } else {
                        // Need to fill in segments
                        for (let offset = 0; offset < targetChunkSize; offset += maxChunkSize) {
                            const length = Math.min(maxChunkSize, targetChunkSize - offset);
                            const tempChunk = new Uint8Array(length);
                            crypto.getRandomValues(tempChunk);
                            chunk.set(tempChunk, offset);
                        }
                    }
                    
                    dataChunks.push(chunk);
                }
            }
        }
        
        // Create specified number of upload streams
        const streamPromises = [];
        for (let i = 0; i < streamCount; i++) {
            const options = {
                pendingUploads,
                uploadDelay,
                isDiscovery
            };
            
            // Clone data chunks for each stream
            const streamChunks = [...dataChunks];
            
            streamPromises.push(this.createUploadStream(options, streamChunks));
            
            // Add a small delay between starting streams
            if (i < streamCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return Promise.all(streamPromises);
    }
    
    /**
     * Start bidirectional saturation
     * @param {number} downloadThroughput - Fixed download throughput in Mbps (0 for auto)
     * @param {number} uploadThroughput - Fixed upload throughput in Mbps (0 for auto)
     * @param {Object} downloadParams - Download stream parameters
     * @param {Object} uploadParams - Upload stream parameters
     * @returns {Promise} A promise that resolves when saturation is started
     */
    static async startBidirectionalSaturation(downloadThroughput = 0, uploadThroughput = 0, downloadParams = {}, uploadParams = {}) {
        console.log(`Starting bidirectional saturation`);
        
        // Use the parameters discovered in the warmup phases WITHOUT MODIFICATION
        console.log(`Using download parameters from warmup phase: ${JSON.stringify(downloadParams)}`);
        console.log(`Using upload parameters from warmup phase: ${JSON.stringify(uploadParams)}`);
        
        // Compare with the original optimal parameters
        console.log(`Original optimal download parameters: ${JSON.stringify(window.optimalDownloadParams)}`);
        console.log(`Original optimal upload parameters: ${JSON.stringify(window.optimalUploadParams)}`);
        
        // Check if the parameters match - but ignore additional properties that might be present
        // Extract only the core properties for comparison
        const downloadParamsCore = {
            streamCount: downloadParams.streamCount,
            pendingUploads: downloadParams.pendingUploads
        };
        
        const uploadParamsCore = {
            streamCount: uploadParams.streamCount,
            pendingUploads: uploadParams.pendingUploads,
            uploadDelay: uploadParams.uploadDelay || 0
        };
        
        const optimalDownloadParamsCore = window.optimalDownloadParams ? {
            streamCount: window.optimalDownloadParams.streamCount,
            pendingUploads: window.optimalDownloadParams.pendingUploads
        } : null;
        
        const optimalUploadParamsCore = window.optimalUploadParams ? {
            streamCount: window.optimalUploadParams.streamCount,
            pendingUploads: window.optimalUploadParams.pendingUploads,
            uploadDelay: window.optimalUploadParams.uploadDelay || 0
        } : null;
        
        // Compare only the core properties
        const downloadParamsMatch = optimalDownloadParamsCore ?
            JSON.stringify(downloadParamsCore) === JSON.stringify(optimalDownloadParamsCore) : false;
        const uploadParamsMatch = optimalUploadParamsCore ?
            JSON.stringify(uploadParamsCore) === JSON.stringify(optimalUploadParamsCore) : false;
        
        console.log(`Download parameters match (core properties): ${downloadParamsMatch}`);
        console.log(`Upload parameters match (core properties): ${uploadParamsMatch}`);
        
        // Log detailed parameter information for debugging
        console.log(`Download parameters details:`);
        console.log(`  - Stream count: ${downloadParams.streamCount}`);
        console.log(`  - Pending uploads: ${downloadParams.pendingUploads}`);
        console.log(`  - isDownloadPhase: ${downloadParams.isDownloadPhase}`);
        
        console.log(`Upload parameters details:`);
        console.log(`  - Stream count: ${uploadParams.streamCount}`);
        console.log(`  - Pending uploads: ${uploadParams.pendingUploads}`);
        console.log(`  - Upload delay: ${uploadParams.uploadDelay}`);
        
        // Start download saturation
        const downloadPromise = this.startDownloadSaturation(false, downloadThroughput, downloadParams);
        
        // Add a small delay between starting download and upload
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Start upload saturation
        const uploadPromise = this.startUploadSaturation(false, uploadThroughput, uploadParams);
        
        return Promise.all([downloadPromise, uploadPromise]);
    }
}

export default StreamManager;