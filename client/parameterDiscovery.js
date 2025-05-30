/**
 * Parameter Discovery
 * Implements a simplified approach to finding optimal parameters
 */

import StreamManager from './streamManager.js';

/**
 * Simple Parameter Discovery class
 * Uses a linear ramp-up approach with latency thresholds
 */
class SimpleParameterDiscovery {
    /**
     * Constructor
     * @param {string} type - The type of discovery ('download' or 'upload')
     * @param {number} baselineLatency - The baseline latency in ms
     */
    constructor(type, baselineLatency) {
        this.type = type; // 'download' or 'upload'
        this.baselineLatency = baselineLatency || 20; // Default to 20ms if not provided
        
        // For upload, use more tolerant thresholds
        if (type === 'upload') {
            this.latencyThreshold = Math.max(100, baselineLatency * 2.0); // 100% increase max, minimum 100ms for upload
            this.absoluteLatencyMax = Math.max(200, Math.min(400, baselineLatency * 3)); // Higher ceiling between 200-400ms for upload
            console.log(`Using more tolerant upload latency thresholds: threshold=${this.latencyThreshold.toFixed(2)}ms, max=${this.absoluteLatencyMax.toFixed(2)}ms`);
        } else {
            this.latencyThreshold = Math.max(75, baselineLatency * 1.75); // 75% increase max, minimum 75ms for download
            this.absoluteLatencyMax = Math.max(150, Math.min(250, baselineLatency * 2.5)); // Higher ceiling between 150-250ms for download
        }
        
        // Parameter ranges - increased for high-capacity connections
        this.minStreamCount = 1;
        this.maxStreamCount = type === 'upload' ? 16 : 24; // Higher stream count for gigabit connections
        this.currentStreamCount = 1;
        
        // For upload only
        this.minPendingUploads = 1;
        this.maxPendingUploads = 16; // Significantly increased for gigabit connections
        this.currentPendingUploads = 1;
        
        // State tracking
        this.measurements = [];
        this.stableParameters = {
            streamCount: 1,
            pendingUploads: 1
        };
        this.bestThroughput = 0;
        
        // Parameter history for visualization
        this.parameterHistory = [];
        this.stabilizationDelay = this.type === 'upload' ? 300 : 300; // 300ms for both upload and download for more parameter testing
        this.consecutiveStableMeasurements = 0;
        this.requiredStableMeasurements = this.type === 'upload' ? 2 : 3; // Fewer measurements for upload
        this.isComplete = false;
        this.resolvePromise = null;
        
        // Minimum duration for warmup phases
        this.startTime = performance.now();
        // Set minimum duration: 15 seconds for both upload and download
        this.minDuration = 15000;
        
        // Bind methods to this instance
        this.handleMeasurement = this.handleMeasurement.bind(this);
    }
    
    /**
     * Start the parameter discovery process
     * @returns {Promise} A promise that resolves when discovery is complete
     */
    async start() {
        console.log(`Starting simple ${this.type} parameter discovery`);
        console.log(`Baseline latency: ${this.baselineLatency.toFixed(2)} ms`);
        console.log(`Latency threshold: ${this.latencyThreshold.toFixed(2)} ms`);
        console.log(`Absolute latency max: ${this.absoluteLatencyMax.toFixed(2)} ms`);
        
        // Start with minimal parameters
        await this.applyParameters({
            streamCount: this.currentStreamCount,
            pendingUploads: this.currentPendingUploads
        });
        
        // Return a promise that resolves when discovery is complete
        return new Promise(resolve => {
            this.resolvePromise = resolve;
        });
    }
    
    /**
     * Handle a measurement
     * @param {Object} measurement - The measurement object
     * @param {number} measurement.throughput - The throughput in Mbps
     * @param {number} measurement.latency - The latency in ms
     */
    handleMeasurement(measurement) {
        if (this.isComplete) return;
        
        console.log(`Measurement: ${measurement.throughput.toFixed(2)} Mbps, ${measurement.latency.toFixed(2)} ms`);
        
        // Store measurement
        this.measurements.push({
            ...measurement,
            parameters: {
                streamCount: this.currentStreamCount,
                pendingUploads: this.currentPendingUploads
            },
            timestamp: performance.now()
        });
        
        // Record parameter test results for visualization
        this.parameterHistory.push({
            timestamp: performance.now(),
            parameters: {
                streamCount: this.currentStreamCount,
                pendingUploads: this.currentPendingUploads
            },
            throughput: measurement.throughput,
            latency: measurement.latency,
            isOptimal: false // Will be updated when optimal parameters are found
        });
        
        // Check if latency exceeds threshold
        const exceedsLatencyThreshold = measurement.latency > this.latencyThreshold;
        const exceedsAbsoluteMax = measurement.latency > this.absoluteLatencyMax;
        
        // For upload, we need to be VERY tolerant of latency spikes
        if (this.type === 'upload') {
            // Only consider it exceeded if we have multiple consecutive high latency measurements
            if (exceedsLatencyThreshold) {
                console.log(`Upload latency threshold exceeded: ${measurement.latency.toFixed(2)} ms > ${this.latencyThreshold.toFixed(2)} ms`);
                this.consecutiveHighLatency = (this.consecutiveHighLatency || 0) + 1;
                console.log(`Consecutive high latency measurements: ${this.consecutiveHighLatency}`);
                
                // Back off more quickly for very high latency (likely low-capacity connection)
                if (exceedsAbsoluteMax || (this.consecutiveHighLatency >= 3 && exceedsLatencyThreshold)) {
                    console.log(`High latency detected (${measurement.latency.toFixed(2)} ms), backing off parameters`);
                    
                    // For very high latency, back off more aggressively
                    if (measurement.latency > this.absoluteLatencyMax * 1.5) {
                        console.log(`Very high latency detected, backing off more aggressively`);
                        
                        // Back off both parameters simultaneously for very high latency
                        if (this.currentPendingUploads > 1) {
                            this.currentPendingUploads = Math.max(1, Math.floor(this.currentPendingUploads * 0.75));
                            console.log(`Aggressively backing off pending uploads to ${this.currentPendingUploads}`);
                        }
                        
                        if (this.currentStreamCount > 1) {
                            this.currentStreamCount = Math.max(1, Math.floor(this.currentStreamCount * 0.75));
                            console.log(`Aggressively backing off stream count to ${this.currentStreamCount}`);
                        }
                    } else {
                        // Standard backoff - only one parameter at a time
                        if (this.currentPendingUploads > 1 && Math.random() < 0.5) {
                            this.currentPendingUploads--;
                            console.log(`Backing off pending uploads to ${this.currentPendingUploads}`);
                        } else if (this.currentStreamCount > 1) {
                            this.currentStreamCount--;
                            console.log(`Backing off stream count to ${this.currentStreamCount}`);
                        } else {
                            console.log(`Already at minimum parameters, not backing off further`);
                        }
                    }
                    
                    // Reset counter but not all the way to zero
                    this.consecutiveHighLatency = 2;
                    return;
                }
            } else {
                // Reduce counter on normal latency but don't reset completely
                if (this.consecutiveHighLatency > 0) {
                    this.consecutiveHighLatency--;
                }
            }
        } else {
            // For download, use a more tolerant approach similar to upload
            if (exceedsLatencyThreshold) {
                console.log(`Download latency threshold exceeded: ${measurement.latency.toFixed(2)} ms > ${this.latencyThreshold.toFixed(2)} ms`);
                this.consecutiveHighLatency = (this.consecutiveHighLatency || 0) + 1;
                console.log(`Consecutive high latency measurements: ${this.consecutiveHighLatency}`);
                
                // Back off more quickly for very high latency (likely low-capacity connection)
                if (exceedsAbsoluteMax || this.consecutiveHighLatency >= 3) {
                    console.log(`High latency detected (${measurement.latency.toFixed(2)} ms), backing off parameters`);
                    
                    // For very high latency, back off more aggressively
                    if (measurement.latency > this.absoluteLatencyMax * 1.5) {
                        console.log(`Very high latency detected, backing off more aggressively`);
                        
                        // Back off both parameters simultaneously for very high latency
                        if (this.currentPendingUploads > 1) {
                            this.currentPendingUploads = Math.max(1, Math.floor(this.currentPendingUploads * 0.75));
                            console.log(`Aggressively backing off pending uploads to ${this.currentPendingUploads}`);
                        }
                        
                        if (this.currentStreamCount > 1) {
                            this.currentStreamCount = Math.max(1, Math.floor(this.currentStreamCount * 0.75));
                            console.log(`Aggressively backing off stream count to ${this.currentStreamCount}`);
                        }
                    } else {
                        // Standard backoff - only one parameter at a time
                        if (this.currentPendingUploads > 1 && Math.random() < 0.5) {
                            this.currentPendingUploads--;
                            console.log(`Backing off pending uploads to ${this.currentPendingUploads}`);
                        } else if (this.currentStreamCount > 1) {
                            this.currentStreamCount--;
                            console.log(`Backing off stream count to ${this.currentStreamCount}`);
                        } else {
                            console.log(`Already at minimum parameters, not backing off further`);
                        }
                    }
                    
                    // Reset counter but not all the way to zero
                    this.consecutiveHighLatency = 1;
                    return;
                }
            } else {
                // Reduce counter on normal latency but don't reset completely
                if (this.consecutiveHighLatency > 0) {
                    this.consecutiveHighLatency--;
                }
            }
        }
        
        // Initialize parameters on first measurement, but don't mark as optimal yet
        if (this.measurements.length === 1) {
            this.bestThroughput = measurement.throughput;
            this.bestLatency = measurement.latency;
            this.stableParameters = {
                streamCount: this.currentStreamCount,
                pendingUploads: this.currentPendingUploads
            };
            console.log(`Initial throughput: ${this.bestThroughput.toFixed(2)} Mbps, latency: ${this.bestLatency.toFixed(2)} ms with parameters:`, this.stableParameters);
            this.consecutiveStableMeasurements = 0;
            
            // Don't mark first measurement as optimal automatically
            // We'll evaluate it against other measurements as they come in
        }
        // Check if this measurement is better than previous best
        // We want to balance throughput and latency
        else {
            // Consider all measurements for optimal parameters for both upload and download
            const elapsedTime = performance.now() - this.startTime;
            const minTimeForOptimal = 0; // 0 seconds for both upload and download
            
            if (elapsedTime >= minTimeForOptimal) {
                // Calculate a score that balances throughput and latency
                // Higher throughput is better, lower latency is better
                const latencyWeight = this.type === 'upload' ? 0.3 : 0.5; // More weight on latency for download
                const throughputWeight = 1 - latencyWeight;
                
                // Normalize latency (lower is better)
                const normalizedLatency = Math.max(0, 1 - (measurement.latency / this.latencyThreshold));
                
                // Calculate current score (higher is better)
                const currentScore = (throughputWeight * measurement.throughput) +
                                    (latencyWeight * normalizedLatency * this.bestThroughput);
                
                // Calculate previous best score
                const previousBestLatency = this.bestLatency || this.baselineLatency;
                const normalizedPreviousBestLatency = Math.max(0, 1 - (previousBestLatency / this.latencyThreshold));
                const previousBestScore = (throughputWeight * this.bestThroughput) +
                                         (latencyWeight * normalizedPreviousBestLatency * this.bestThroughput);
                
                // Detailed scoring breakdown
                console.log(`SCORING BREAKDOWN:`);
                console.log(`  - Latency weight: ${latencyWeight.toFixed(2)}, Throughput weight: ${throughputWeight.toFixed(2)}`);
                console.log(`  - Current latency: ${measurement.latency.toFixed(2)}ms, normalized: ${normalizedLatency.toFixed(2)}`);
                console.log(`  - Previous latency: ${previousBestLatency.toFixed(2)}ms, normalized: ${normalizedPreviousBestLatency.toFixed(2)}`);
                console.log(`  - Current throughput: ${measurement.throughput.toFixed(2)} Mbps`);
                console.log(`  - Previous throughput: ${this.bestThroughput.toFixed(2)} Mbps`);
                console.log(`  - Current score components: throughput=${(throughputWeight * measurement.throughput).toFixed(2)}, latency=${(latencyWeight * normalizedLatency * this.bestThroughput).toFixed(2)}`);
                console.log(`  - Previous score components: throughput=${(throughputWeight * this.bestThroughput).toFixed(2)}, latency=${(latencyWeight * normalizedPreviousBestLatency * this.bestThroughput).toFixed(2)}`);
                
                console.log(`Current score: ${currentScore.toFixed(2)}, Previous best: ${previousBestScore.toFixed(2)}`);
                console.log(`Current throughput: ${measurement.throughput.toFixed(2)} Mbps, latency: ${measurement.latency.toFixed(2)} ms`);
                console.log(`Previous best throughput: ${this.bestThroughput.toFixed(2)} Mbps, latency: ${(this.bestLatency || this.baselineLatency).toFixed(2)} ms`);
                
                // For download, be more aggressive in updating optimal parameters
                // For upload, be more conservative
                const shouldUpdateByScore = this.type === 'download'
                    ? (currentScore >= previousBestScore * 0.95)
                    : (currentScore > previousBestScore);
                
                const shouldUpdateByThroughput = this.type === 'download'
                    ? (measurement.throughput > this.bestThroughput * 1.1)
                    : (measurement.throughput > this.bestThroughput * 1.2);
                
                const shouldUpdate = shouldUpdateByScore || shouldUpdateByThroughput;
                
                // Log the decision criteria
                console.log(`UPDATE DECISION CRITERIA:`);
                console.log(`  - Should update by score: ${shouldUpdateByScore}`);
                console.log(`    - Current score: ${currentScore.toFixed(2)}`);
                console.log(`    - Previous best score: ${previousBestScore.toFixed(2)}`);
                console.log(`    - Score threshold: ${(this.type === 'download' ? previousBestScore * 0.95 : previousBestScore).toFixed(2)}`);
                console.log(`  - Should update by throughput: ${shouldUpdateByThroughput}`);
                console.log(`    - Current throughput: ${measurement.throughput.toFixed(2)} Mbps`);
                console.log(`    - Previous best throughput: ${this.bestThroughput.toFixed(2)} Mbps`);
                console.log(`    - Throughput threshold: ${(this.type === 'download' ? this.bestThroughput * 1.1 : this.bestThroughput * 1.2).toFixed(2)} Mbps`);
                console.log(`  - Final decision: ${shouldUpdate ? 'UPDATE' : 'DO NOT UPDATE'}`);
                
                if (shouldUpdate) {
                    this.bestThroughput = measurement.throughput;
                    this.bestLatency = measurement.latency;
                    this.stableParameters = {
                        streamCount: this.currentStreamCount,
                        pendingUploads: this.currentPendingUploads
                    };
                    this.consecutiveStableMeasurements = 0;
                    
                    console.log(`New best parameters found with score ${currentScore.toFixed(2)}: throughput=${this.bestThroughput.toFixed(2)} Mbps, latency=${this.bestLatency.toFixed(2)} ms`);
                    console.log(`New parameters:`, this.stableParameters);
                    
                    // Mark this entry as the current optimal in history
                    this.parameterHistory.forEach(entry => entry.isOptimal = false);
                    if (this.parameterHistory.length > 0) {
                        this.parameterHistory[this.parameterHistory.length - 1].isOptimal = true;
                    }
                } else if (measurement.throughput > this.bestThroughput) {
                    console.log(`Higher throughput found (${measurement.throughput.toFixed(2)} Mbps), but score (${currentScore.toFixed(2)}) is not better than previous best (${previousBestScore.toFixed(2)})`);
                    
                    // Still record in parameter history but don't mark as optimal
                    if (this.parameterHistory.length > 0) {
                        this.parameterHistory[this.parameterHistory.length - 1].isHigherThroughput = true;
                    }
                } else {
                    this.consecutiveStableMeasurements++;
                }
            } else {
                console.log(`Measurement received at ${(elapsedTime/1000).toFixed(1)}s`);
                
                // Initialize best values if not set
                if (!this.bestThroughput) {
                    this.bestThroughput = measurement.throughput;
                    this.bestLatency = measurement.latency;
                }
                
                this.consecutiveStableMeasurements++;
            }
        }
        
        // If throughput hasn't improved for several measurements, we may have plateaued
        if (this.consecutiveStableMeasurements >= this.requiredStableMeasurements) {
            console.log(`Throughput plateaued at ${this.bestThroughput.toFixed(2)} Mbps`);
            
            // For upload, check if we've reached the minimum duration
            if (this.type === 'upload') {
                const elapsedTime = performance.now() - this.startTime;
                if (elapsedTime < this.minDuration) {
                    console.log(`Upload throughput plateaued, but continuing for minimum duration. Elapsed: ${(elapsedTime/1000).toFixed(1)}s, Min: ${(this.minDuration/1000).toFixed(1)}s`);
                    // Reset consecutive measurements counter to continue parameter exploration
                    this.consecutiveStableMeasurements = 1;
                } else if (this.currentStreamCount >= this.maxStreamCount || this.currentPendingUploads >= this.maxPendingUploads) {
                    // Only complete if we've reached max parameters AND minimum duration
                    console.log(`Upload throughput plateaued, max parameters reached, and minimum duration elapsed`);
                    this.completeDiscovery();
                    return;
                }
            } else if (this.currentStreamCount >= this.maxStreamCount) {
                // For download, complete if we've reached max parameters
                this.completeDiscovery();
                return;
            }
        }
        
        // Gradually increase parameters
        this.increaseParameters();
    }
    
    /**
     * Increase parameters
     */
    async increaseParameters() {
        // Allow network to stabilize before changing parameters
        await new Promise(resolve => setTimeout(resolve, this.stabilizationDelay));
        
        if (this.type === 'download') {
            // For download, use a more gradual approach similar to upload
            // This will result in more parameter combinations being tested
            let paramChanged = false;
            
            // Track how many measurements we've had with current parameters
            this.measurementsWithCurrentParams = (this.measurementsWithCurrentParams || 0) + 1;
            
            // Only change parameters after at least 2 measurements with current settings
            if (this.measurementsWithCurrentParams >= 2) {
                console.log(`Had ${this.measurementsWithCurrentParams} measurements with current parameters, considering parameter changes`);
                
                // For download, we primarily focus on stream count
                if (this.currentStreamCount < this.maxStreamCount) {
                    // Increase by 1 for more gradual ramp-up (instead of 2)
                    this.currentStreamCount++;
                    console.log(`Increasing stream count to ${this.currentStreamCount}`);
                    paramChanged = true;
                }
                // Also experiment with pending uploads for download too
                else if (this.currentPendingUploads < 3) { // Limited pending uploads for download
                    this.currentPendingUploads++;
                    console.log(`Increasing pending uploads to ${this.currentPendingUploads}`);
                    paramChanged = true;
                }
                
                // Reset the counter if we changed parameters
                if (paramChanged) {
                    this.measurementsWithCurrentParams = 0;
                }
                // If we couldn't change any parameters, we've reached the max
                else {
                    console.log(`Reached maximum parameters`);
                    
                    // Check if we've reached the minimum duration for download
                    const elapsedTime = performance.now() - this.startTime;
                    if (elapsedTime < this.minDuration) {
                        console.log(`Download reached max parameters, but continuing for minimum duration. Elapsed: ${(elapsedTime/1000).toFixed(1)}s, Min: ${(this.minDuration/1000).toFixed(1)}s`);
                        
                        // Keep current parameters but don't complete yet
                        paramChanged = true;
                        
                        // Schedule a check to complete after minimum duration
                        const remainingTime = this.minDuration - elapsedTime;
                        setTimeout(() => {
                            if (!this.isComplete) {
                                console.log(`Minimum download discovery duration reached after max parameters`);
                                this.completeDiscovery();
                            }
                        }, remainingTime);
                    } else {
                        // We've reached max parameters and minimum duration, so complete
                        this.completeDiscovery();
                        return;
                    }
                }
            } else {
                console.log(`Only ${this.measurementsWithCurrentParams} measurements with current parameters, not changing yet`);
                // Don't change parameters yet, but still apply them to ensure consistency
                paramChanged = true;
            }
            
            // If we've reached at least 4 streams, consider it good enough
            if (this.currentStreamCount >= 4) {
                console.log(`Reached sufficient parameters for download: streams=${this.currentStreamCount}`);
                // Update best parameters if we haven't found better ones yet
                if (!this.bestThroughput || this.bestThroughput <= 0) {
                    this.stableParameters = {
                        streamCount: this.currentStreamCount,
                        pendingUploads: this.currentPendingUploads
                    };
                    console.log(`Setting stable parameters to current values:`, this.stableParameters);
                }
            }
        } else if (this.type === 'upload') {
            // For upload, use a more gradual approach - focus on pending uploads first
            // before increasing stream count
            let paramChanged = false;
            
            // Track how many measurements we've had with current parameters
            this.measurementsWithCurrentParams = (this.measurementsWithCurrentParams || 0) + 1;
            
            // Only change parameters after at least 2 measurements with current settings
            // This allows for faster parameter exploration while still giving time for the network to stabilize
            if (this.measurementsWithCurrentParams >= 2) {
                console.log(`Had ${this.measurementsWithCurrentParams} measurements with current parameters, considering parameter changes`);
                
                // First focus on increasing pending uploads before adding more streams
                // This is more efficient and less likely to cause connection issues
                if (this.currentPendingUploads < this.maxPendingUploads) {
                    // Increase by 1 for more gradual ramp-up
                    this.currentPendingUploads++;
                    console.log(`Increasing pending uploads to ${this.currentPendingUploads}`);
                    paramChanged = true;
                }
                // Increase stream count after we've increased pending uploads a bit
                // Less restrictive to allow for faster parameter exploration
                else if (this.currentStreamCount < this.maxStreamCount && this.currentPendingUploads >= 2) {
                    this.currentStreamCount++;
                    console.log(`Increasing stream count to ${this.currentStreamCount}`);
                    paramChanged = true;
                }
                
                // Reset the counter if we changed parameters
                if (paramChanged) {
                    this.measurementsWithCurrentParams = 0;
                }
                // If we couldn't change any parameters, we've reached the max
                else {
                    console.log(`Reached maximum parameters`);
                    
                    // Check if we've reached the minimum duration for upload
                    const elapsedTime = performance.now() - this.startTime;
                    if (elapsedTime < this.minDuration) {
                        console.log(`Upload reached max parameters, but continuing for minimum duration. Elapsed: ${(elapsedTime/1000).toFixed(1)}s, Min: ${(this.minDuration/1000).toFixed(1)}s`);
                        
                        // Keep current parameters but don't complete yet
                        // This will maintain traffic until minimum duration is reached
                        paramChanged = true;
                        
                        // Schedule a check to complete after minimum duration
                        const remainingTime = this.minDuration - elapsedTime;
                        setTimeout(() => {
                            if (!this.isComplete) {
                                console.log(`Minimum upload discovery duration reached after max parameters`);
                                this.completeDiscovery();
                            }
                        }, remainingTime);
                    } else {
                        // We've reached max parameters and minimum duration, so complete
                        this.completeDiscovery();
                        return;
                    }
                }
            } else {
                console.log(`Only ${this.measurementsWithCurrentParams} measurements with current parameters, not changing yet`);
                // Don't change parameters yet, but still apply them to ensure consistency
                paramChanged = true;
            }
            
            // For high-capacity connections, we need higher parameters to be considered "sufficient"
            // Only consider it sufficient if we've reached at least 8 streams or 8 pending uploads
            if (this.currentStreamCount >= 8 || this.currentPendingUploads >= 8) {
                console.log(`Reached sufficient parameters for upload on high-capacity connection: streams=${this.currentStreamCount}, pendingUploads=${this.currentPendingUploads}`);
                // Update best parameters if we haven't found better ones yet
                if (!this.bestThroughput || this.bestThroughput <= 0) {
                    this.stableParameters = {
                        streamCount: this.currentStreamCount,
                        pendingUploads: this.currentPendingUploads
                    };
                    console.log(`Setting stable parameters to current values:`, this.stableParameters);
                }
            }
        }
        
        // Apply new parameters
        await this.applyParameters({
            streamCount: this.currentStreamCount,
            pendingUploads: this.currentPendingUploads
        });
    }
    
    /**
     * Apply parameters
     * @param {Object} parameters - The parameters to apply
     */
    async applyParameters(parameters) {
        console.log(`Applying parameters:`, parameters);
        
        // Dispatch event to apply parameters
        window.dispatchEvent(new CustomEvent(`${this.type}:apply_params`, {
            detail: {
                params: parameters
            }
        }));
        
        // Allow network to stabilize after applying parameters
        await new Promise(resolve => setTimeout(resolve, this.stabilizationDelay));
    }
    
    /**
     * Complete the discovery process
     */
    completeDiscovery() {
        if (this.isComplete) return;
        
        // Check if minimum duration has elapsed for both upload and download
        const elapsedTime = performance.now() - this.startTime;
        if (elapsedTime < this.minDuration) {
            const remainingTime = this.minDuration - elapsedTime;
            console.log(`${this.type} discovery would complete, but enforcing minimum duration. Remaining time: ${(remainingTime/1000).toFixed(1)}s`);
            
            // Schedule completion after the remaining time
            setTimeout(() => {
                console.log(`Minimum ${this.type} discovery duration reached, now completing discovery`);
                this.finalizeDiscovery();
            }, remainingTime);
            
            return;
        }
        
        // If we've reached here, proceed with completing discovery
        this.finalizeDiscovery();
    }
    
    /**
     * Finalize the discovery process after all checks
     */
    /**
     * Get parameter history
     * @returns {Array} The parameter history
     */
    getParameterHistory() {
        return this.parameterHistory;
    }
    
    /**
     * Finalize the discovery process after all checks
     * Using end-of-phase parameter selection with look-back approach
     */
    finalizeDiscovery() {
        if (this.isComplete) return;
        
        console.log(`Finalizing discovery with end-of-phase look-back approach`);
        
        // Only proceed if we have measurements
        if (this.measurements.length > 0) {
            // Calculate scores for all measurements
            const latencyWeight = this.type === 'upload' ? 0.3 : 0.5; // More weight on latency for download
            const throughputWeight = 1 - latencyWeight;
            
            // Find the measurement with the best score (balancing throughput and latency)
            let bestMeasurementIndex = 0;
            let bestScore = -Infinity;
            let scores = [];
            
            console.log(`END-OF-PHASE PARAMETER SELECTION - Evaluating ${this.measurements.length} measurements:`);
            console.log(`  - Latency weight: ${latencyWeight.toFixed(2)}, Throughput weight: ${throughputWeight.toFixed(2)}`);
            console.log(`  - Latency threshold: ${this.latencyThreshold.toFixed(2)} ms`);
            
            // Calculate scores for all measurements
            for (let i = 0; i < this.measurements.length; i++) {
                const measurement = this.measurements[i];
                
                // Normalize latency (lower is better)
                const normalizedLatency = Math.max(0, 1 - (measurement.latency / this.latencyThreshold));
                
                // Calculate score (higher is better)
                const score = (throughputWeight * measurement.throughput) +
                             (latencyWeight * normalizedLatency * measurement.throughput);
                
                scores.push({
                    index: i,
                    score: score,
                    measurement: measurement
                });
                
                console.log(`  - Measurement ${i}: streams=${measurement.parameters.streamCount}, pending=${measurement.parameters.pendingUploads}`);
                console.log(`    - Throughput: ${measurement.throughput.toFixed(2)} Mbps, Latency: ${measurement.latency.toFixed(2)} ms`);
                console.log(`    - Normalized latency: ${normalizedLatency.toFixed(2)}`);
                console.log(`    - Score: ${score.toFixed(2)} (throughput component: ${(throughputWeight * measurement.throughput).toFixed(2)}, latency component: ${(latencyWeight * normalizedLatency * measurement.throughput).toFixed(2)})`);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMeasurementIndex = i;
                    console.log(`    - NEW BEST SCORE: ${score.toFixed(2)}`);
                }
            }
            
            // Get the best measurement
            const bestMeasurement = this.measurements[bestMeasurementIndex];
            
            // Look back one position to find the causal parameters
            // (with bounds checking)
            let causalMeasurementIndex = bestMeasurementIndex - 1;
            let causalMeasurement;
            
            if (causalMeasurementIndex >= 0) {
                causalMeasurement = this.measurements[causalMeasurementIndex];
                console.log(`LOOK-BACK: Using parameters from measurement ${causalMeasurementIndex} that likely caused optimal outcome in measurement ${bestMeasurementIndex}`);
                console.log(`  - Causal parameters: streams=${causalMeasurement.parameters.streamCount}, pending=${causalMeasurement.parameters.pendingUploads}`);
                console.log(`  - Resulted in: throughput=${bestMeasurement.throughput.toFixed(2)} Mbps, latency=${bestMeasurement.latency.toFixed(2)} ms`);
                
                // Use the causal parameters
                this.stableParameters = {
                    streamCount: causalMeasurement.parameters.streamCount,
                    pendingUploads: causalMeasurement.parameters.pendingUploads,
                    uploadDelay: 0
                };
                
                // Store the best outcome for reference
                this.bestThroughput = bestMeasurement.throughput;
                this.bestLatency = bestMeasurement.latency;
            } else {
                // If best measurement is the first one, use its parameters
                console.log(`Best measurement is the first one, using its parameters directly`);
                this.stableParameters = {
                    streamCount: bestMeasurement.parameters.streamCount,
                    pendingUploads: bestMeasurement.parameters.pendingUploads,
                    uploadDelay: 0
                };
                
                this.bestThroughput = bestMeasurement.throughput;
                this.bestLatency = bestMeasurement.latency;
            }
            
            console.log(`Selected parameters: streams=${this.stableParameters.streamCount}, pending=${this.stableParameters.pendingUploads}`);
            console.log(`Best outcome: throughput=${this.bestThroughput.toFixed(2)} Mbps, latency=${this.bestLatency.toFixed(2)} ms`);
            
            // Update parameter history visualization
            // Mark both the optimal outcome and the causal parameters
            this.parameterHistory.forEach(entry => {
                entry.isOptimal = false;
                entry.causedOptimal = false;
            });
            
            // Find and mark the entry with the best outcome
            const bestOutcomeEntry = this.parameterHistory.find(entry =>
                Math.abs(entry.throughput - bestMeasurement.throughput) < 0.1 &&
                Math.abs(entry.latency - bestMeasurement.latency) < 1
            );
            
            if (bestOutcomeEntry) {
                bestOutcomeEntry.isOptimal = true;
                console.log(`Marked entry with best outcome in history: throughput=${bestOutcomeEntry.throughput.toFixed(2)}, latency=${bestOutcomeEntry.latency.toFixed(2)}`);
            }
            
            // Find and mark the entry with the causal parameters
            if (causalMeasurement) {
                const causalEntry = this.parameterHistory.find(entry =>
                    entry.parameters.streamCount === causalMeasurement.parameters.streamCount &&
                    entry.parameters.pendingUploads === causalMeasurement.parameters.pendingUploads
                );
                
                if (causalEntry) {
                    causalEntry.causedOptimal = true;
                    console.log(`Marked causal parameter set in history: streams=${causalEntry.parameters.streamCount}, pendingUploads=${causalEntry.parameters.pendingUploads}`);
                }
            }
        } else {
            console.log(`No measurements available, using default parameters`);
            this.stableParameters = {
                streamCount: this.type === 'upload' ? 2 : 3,
                pendingUploads: this.type === 'upload' ? 2 : 1,
                uploadDelay: 0
            };
        }
        
        // Ensure we have at least the minimum parameters
        if (!this.stableParameters || this.stableParameters.streamCount < this.minStreamCount) {
            this.stableParameters = {
                streamCount: this.minStreamCount,
                pendingUploads: this.minPendingUploads
            };
            console.log(`Using minimum parameters:`, this.stableParameters);
        }
        
        // For upload, ensure we have reasonable minimum values but don't force high values
        // This allows the parameter discovery to find appropriate values for all connection speeds
        if (this.type === 'upload') {
            this.stableParameters.streamCount = Math.max(1, this.stableParameters.streamCount);
            this.stableParameters.pendingUploads = Math.max(1, this.stableParameters.pendingUploads);
            console.log(`Ensuring reasonable upload parameters: streams=${this.stableParameters.streamCount}, pendingUploads=${this.stableParameters.pendingUploads}`);
        }
        
        // Ensure we have an optimal parameter set marked in the history
        const hasOptimalMarked = this.parameterHistory.some(entry => entry.isOptimal);
        if (!hasOptimalMarked && this.parameterHistory.length > 0) {
            // Find the entry that most closely matches our final parameters
            let bestMatch = this.parameterHistory[0];
            let bestMatchScore = Number.MAX_VALUE;
            
            for (const entry of this.parameterHistory) {
                const streamDiff = Math.abs(entry.parameters.streamCount - this.stableParameters.streamCount);
                const pendingDiff = Math.abs(entry.parameters.pendingUploads - this.stableParameters.pendingUploads);
                const score = streamDiff + pendingDiff;
                
                if (score < bestMatchScore) {
                    bestMatchScore = score;
                    bestMatch = entry;
                }
            }
            
            // Mark this entry as optimal
            this.parameterHistory.forEach(entry => entry.isOptimal = false);
            bestMatch.isOptimal = true;
            console.log(`Marked closest parameter set as optimal in history: streams=${bestMatch.parameters.streamCount}, pendingUploads=${bestMatch.parameters.pendingUploads}`);
        }
        
        console.log(`Parameter discovery complete`);
        console.log(`Optimal parameters:`, this.stableParameters);
        console.log(`Best throughput: ${this.bestThroughput.toFixed(2)} Mbps`);
        console.log(`Best latency: ${this.bestLatency.toFixed(2)} ms`);
        console.log(`FINAL SELECTION SUMMARY:`);
        console.log(`  - Stream count: ${this.stableParameters.streamCount}`);
        console.log(`  - Pending uploads: ${this.stableParameters.pendingUploads}`);
        console.log(`  - Throughput: ${this.bestThroughput.toFixed(2)} Mbps`);
        console.log(`  - Latency: ${this.bestLatency.toFixed(2)} ms`);
        console.log(`  - Latency threshold: ${this.latencyThreshold.toFixed(2)} ms`);
        console.log(`  - Absolute latency max: ${this.absoluteLatencyMax.toFixed(2)} ms`);
        
        this.isComplete = true;
        
        // Ensure we have valid parameters to return
        if (!this.stableParameters || !this.stableParameters.streamCount || !this.stableParameters.pendingUploads) {
            console.log(`WARNING: Invalid stable parameters detected, using reasonable fallback values`);
            this.stableParameters = {
                streamCount: this.type === 'upload' ? 2 : 3,
                pendingUploads: this.type === 'upload' ? 2 : 1,
                uploadDelay: 0
            };
            console.log(`Using reasonable fallback parameters that work for all speeds: ${JSON.stringify(this.stableParameters)}`);
        }
        
        // Resolve the promise with the optimal parameters
        if (this.resolvePromise) {
            console.log(`Resolving parameter discovery with final parameters: ${JSON.stringify(this.stableParameters)}`);
            this.resolvePromise(this.stableParameters);
        }
    }
    
    /**
     * Force backoff in case of timeouts or other issues
     * @param {number} backoffFactor - Factor to back off by (0-1)
     */
    forceBackoff(backoffFactor = 0.5) {
        if (this.isComplete) return;
        
        // For upload, use an extremely gentle backoff
        if (this.type === 'upload') {
            // Use a very gentle backoff factor for upload
            const gentleBackoffFactor = Math.min(0.9, backoffFactor + 0.4);
            console.log(`Forcing extremely gentle upload parameter backoff with factor ${gentleBackoffFactor}`);
            
            // Calculate new stream count - ensure we keep at least 3 streams for upload
            const newStreamCount = Math.max(
                3, // Minimum 3 streams for upload
                Math.ceil(this.currentStreamCount * gentleBackoffFactor)
            );
            
            // Calculate new pending uploads - ensure we keep at least 3 pending uploads
            const newPendingUploads = Math.max(
                3, // Minimum 3 pending uploads
                Math.ceil(this.currentPendingUploads * gentleBackoffFactor)
            );
            
            // Schedule automatic recovery after 3 seconds
            setTimeout(() => {
                if (this.type === 'upload' && !this.isComplete) {
                    console.log('Gradually increasing parameters after backoff');
                    
                    // Only increase one parameter at a time
                    if (Math.random() < 0.5 && this.currentStreamCount < this.maxStreamCount) {
                        this.currentStreamCount++;
                        console.log(`Increasing stream count to ${this.currentStreamCount}`);
                    } else if (this.currentPendingUploads < this.maxPendingUploads) {
                        this.currentPendingUploads++;
                        console.log(`Increasing pending uploads to ${this.currentPendingUploads}`);
                    }
                    
                    // Apply the new parameters
                    this.applyParameters({
                        streamCount: this.currentStreamCount,
                        pendingUploads: this.currentPendingUploads
                    });
                }
            }, 3000); // Wait 3 seconds before starting recovery
            
            console.log(`Very gently backing off upload to stream count: ${newStreamCount}, pending uploads: ${newPendingUploads}`);
            
            // Only back off one parameter at a time, not both
            if (Math.random() < 0.5 && this.currentPendingUploads > newPendingUploads) {
                this.currentPendingUploads = newPendingUploads;
                console.log(`Backing off only pending uploads to ${this.currentPendingUploads}`);
            } else if (this.currentStreamCount > newStreamCount) {
                this.currentStreamCount = newStreamCount;
                console.log(`Backing off only stream count to ${this.currentStreamCount}`);
            } else {
                // If both parameters are already at minimum, don't back off at all
                console.log(`Already at minimum parameters, not backing off further`);
            }
        } else {
            // For download, use a more gentle approach similar to upload
            const gentleBackoffFactor = Math.min(0.8, backoffFactor + 0.3);
            console.log(`Forcing gentler download parameter backoff with factor ${gentleBackoffFactor}`);
            
            // Calculate new stream count - ensure we keep at least 1 stream for download
            const newStreamCount = Math.max(
                1, // Minimum 1 stream for download
                Math.ceil(this.currentStreamCount * gentleBackoffFactor)
            );
            
            // Calculate new pending uploads - ensure we keep at least 1 pending upload
            const newPendingUploads = Math.max(
                1, // Minimum 1 pending upload
                Math.ceil(this.currentPendingUploads * gentleBackoffFactor)
            );
            
            console.log(`Gently backing off download to stream count: ${newStreamCount}, pending uploads: ${newPendingUploads}`);
            
            // Only back off one parameter at a time, not both
            if (Math.random() < 0.5 && this.currentPendingUploads > newPendingUploads) {
                this.currentPendingUploads = newPendingUploads;
                console.log(`Backing off only pending uploads to ${this.currentPendingUploads}`);
            } else if (this.currentStreamCount > newStreamCount) {
                this.currentStreamCount = newStreamCount;
                console.log(`Backing off only stream count to ${this.currentStreamCount}`);
            } else {
                // If both parameters are already at minimum, don't back off at all
                console.log(`Already at minimum parameters, not backing off further`);
            }
            
            // Schedule automatic recovery after 3 seconds
            setTimeout(() => {
                if (this.type === 'download' && !this.isComplete) {
                    console.log('Gradually increasing parameters after download backoff');
                    
                    // Only increase one parameter at a time
                    if (Math.random() < 0.5 && this.currentStreamCount < this.maxStreamCount) {
                        this.currentStreamCount++;
                        console.log(`Increasing stream count to ${this.currentStreamCount}`);
                    } else if (this.currentPendingUploads < 3) { // Limited pending uploads for download
                        this.currentPendingUploads++;
                        console.log(`Increasing pending uploads to ${this.currentPendingUploads}`);
                    }
                    
                    // Apply the new parameters
                    this.applyParameters({
                        streamCount: this.currentStreamCount,
                        pendingUploads: this.currentPendingUploads
                    });
                }
            }, 3000); // Wait 3 seconds before starting recovery
        }
        
        // Apply new parameters
        this.applyParameters({
            streamCount: this.currentStreamCount,
            pendingUploads: this.currentPendingUploads
        });
    }
}

/**
 * Initialize parameter discovery
 * @param {string} type - The type of discovery ('download' or 'upload')
 * @param {number} baselineLatency - The baseline latency in ms
 * @returns {Promise} A promise that resolves with the optimal parameters
 */
export function initDiscovery(type, baselineLatency) {
    // Create discovery instance
    const discovery = new SimpleParameterDiscovery(type, baselineLatency);
    
    // Store discovery instance globally for event handling
    window.currentDiscovery = discovery;
    
    // Set up event listener for force backoff
    window.addEventListener(`${type}:force_backoff`, (event) => {
        const backoffFactor = event.detail?.backoffFactor || 0.5;
        discovery.forceBackoff(backoffFactor);
    });
    
    // Set up event listener for minimum duration (upload only)
    if (type === 'upload') {
        window.addEventListener('upload:set_min_duration', (event) => {
            const minDuration = event.detail?.minDuration || 0;
            if (minDuration > 0) {
                discovery.minDuration = minDuration;
                console.log(`Parameter discovery minimum duration set to ${minDuration/1000} seconds`);
            }
        });
    }
    
    // Start discovery process with error handling
    return discovery.start().catch(error => {
        console.error(`Parameter discovery for ${type} failed:`, error);
        // Return reasonable default parameters that work for all connection speeds
        const defaultParams = {
            streamCount: type === 'upload' ? 2 : 3,
            pendingUploads: type === 'upload' ? 2 : 1,
            uploadDelay: 0
        };
        console.log(`Returning reasonable default parameters due to discovery failure: ${JSON.stringify(defaultParams)}`);
        return defaultParams;
    });
}

/**
 * Handle measurement for current discovery
 * @param {Object} measurement - The measurement object
 */
export function handleMeasurement(measurement) {
    if (window.currentDiscovery) {
        window.currentDiscovery.handleMeasurement(measurement);
    }
}

/**
 * Check if discovery is in progress
 * @returns {boolean} True if discovery is in progress
 */
export function isDiscoveryInProgress() {
    return window.currentDiscovery && !window.currentDiscovery.isComplete;
}

/**
 * Get best parameters from discovery
 * @returns {Object} The best parameters
 */
export function getBestParameters() {
    if (window.currentDiscovery) {
        // Make sure we return a deep copy to avoid reference issues
        const params = window.currentDiscovery.stableParameters;
        if (params) {
            console.log(`getBestParameters returning:`, JSON.stringify(params));
            return { ...params };
        }
    }
    console.log(`getBestParameters returning null - no current discovery or parameters`);
    return null;
}

/**
 * Get parameter history from discovery
 * @returns {Array} The parameter history
 */
export function getParameterHistory() {
    if (window.currentDiscovery) {
        return window.currentDiscovery.getParameterHistory();
    }
    return [];
}

export default {
    initDiscovery,
    handleMeasurement,
    isDiscoveryInProgress,
    getBestParameters,
    getParameterHistory
};