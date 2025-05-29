/**
 * Results Module
 * Handles the analysis and display of test results
 */

// Constants for grading
const GRADE_THRESHOLDS = [
    { threshold: 5, grade: 'A+', class: 'a-plus' },
    { threshold: 30, grade: 'A', class: 'a' },
    { threshold: 60, grade: 'B', class: 'b' },
    { threshold: 200, grade: 'C', class: 'c' },
    { threshold: 400, grade: 'D', class: 'd' },
    { threshold: Infinity, grade: 'F', class: 'f' }
];

/**
 * Calculate percentile from an array of values
 * @param {Array} values - Array of numeric values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} The calculated percentile value
 */
function calculatePercentile(values, percentile) {
    if (!values || values.length === 0) return 0;
    
    // Sort the values
    const sorted = [...values].sort((a, b) => a - b);
    
    // Calculate the index
    const index = (percentile / 100) * (sorted.length - 1);
    
    // If index is an integer, return the value at that index
    if (Number.isInteger(index)) {
        return sorted[index];
    }
    
    // Otherwise, interpolate between the two nearest values
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const weight = index - lowerIndex;
    
    return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

/**
 * Calculate statistics for an array of values
 * @param {Array} values - Array of numeric values
 * @returns {Object} Object containing statistics
 */
function calculateStats(values) {
    if (!values || values.length === 0) {
        return {
            median: 0,
            average: 0,
            p25: 0,
            p75: 0,
            p95: 0
        };
    }
    
    // Calculate average
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    
    // Calculate percentiles
    const median = calculatePercentile(values, 50);
    const p25 = calculatePercentile(values, 25);
    const p75 = calculatePercentile(values, 75);
    const p95 = calculatePercentile(values, 95);
    
    return {
        median: median,
        average: average,
        p25: p25,
        p75: p75,
        p95: p95
    };
}

/**
 * Determine the bufferbloat grade based on latency increase
 * @param {number} latencyIncrease - The increase in latency under load (ms)
 * @returns {Object} Object containing grade and CSS class
 */
function determineGrade(latencyIncrease) {
    for (const { threshold, grade, class: cssClass } of GRADE_THRESHOLDS) {
        if (latencyIncrease < threshold) {
            return { grade, cssClass };
        }
    }
    
    // Default to F if no threshold matches (shouldn't happen due to Infinity threshold)
    return { grade: 'F', cssClass: 'f' };
}

/**
 * Analyze test results and display them
 * @param {Object} testData - Object containing test data
 */
function analyzeAndDisplayResults(testData) {
    const {
        baselineLatency,
        downloadWarmupLatency,
        downloadLatency,
        uploadWarmupLatency,
        uploadLatency,
        bidirectionalLatency,
        downloadThroughput,
        uploadThroughput
    } = testData;
    
    // Calculate latency statistics for each phase
    const baselineStats = calculateStats(baselineLatency);
    const downloadWarmupStats = calculateStats(downloadWarmupLatency);
    const downloadStats = calculateStats(downloadLatency);
    const uploadWarmupStats = calculateStats(uploadWarmupLatency);
    const uploadStats = calculateStats(uploadLatency);
    const bidirectionalStats = calculateStats(bidirectionalLatency);
    
    // Calculate throughput statistics for download phase
    const downloadThroughputStats = calculateStats(
        Array.isArray(downloadThroughput) ?
        downloadThroughput :
        (downloadThroughput.download || [])
    );
    
    // Calculate throughput statistics for upload phase
    // Filter out zero values which can skew the median calculation
    const uploadData = Array.isArray(uploadThroughput) ?
        uploadThroughput :
        (uploadThroughput.upload || []);
    
    // Filter out zero or near-zero values that would skew the median
    const filteredUploadData = uploadData.filter(value => value > 0.1);
    
    // Use filtered data if available, otherwise use original data
    const uploadThroughputStats = calculateStats(
        filteredUploadData.length > 0 ? filteredUploadData : uploadData
    );
    
    // Calculate throughput statistics for bidirectional phase
    const bidiDownloadThroughputStats = calculateStats(
        Array.isArray(downloadThroughput) ?
        downloadThroughput :
        (downloadThroughput.bidirectional || [])
    );
    
    const bidiUploadData = Array.isArray(uploadThroughput) ?
        uploadThroughput :
        (uploadThroughput.bidirectional || []);
    
    // Filter out zero values for bidirectional upload
    const filteredBidiUploadData = bidiUploadData.filter(value => value > 0.1);
    
    // Use filtered data if available, otherwise use original data
    const bidiUploadThroughputStats = calculateStats(
        filteredBidiUploadData.length > 0 ? filteredBidiUploadData : bidiUploadData
    );
    
    // Calculate additional latency under load using average values
    // Use only the full test phases (not warmup) for grading
    const downloadLatencyIncrease = downloadStats.average - baselineStats.average;
    const uploadLatencyIncrease = uploadStats.average - baselineStats.average;
    const bidirectionalLatencyIncrease = bidirectionalStats.average - baselineStats.average;
    
    console.log(`Baseline average: ${baselineStats.average.toFixed(1)} ms`);
    console.log(`Download average: ${downloadStats.average.toFixed(1)} ms, increase: ${downloadLatencyIncrease.toFixed(1)} ms`);
    console.log(`Upload average: ${uploadStats.average.toFixed(1)} ms, increase: ${uploadLatencyIncrease.toFixed(1)} ms`);
    console.log(`Bidirectional average: ${bidirectionalStats.average.toFixed(1)} ms, increase: ${bidirectionalLatencyIncrease.toFixed(1)} ms`);
    
    // Determine the grades for each phase
    const downloadGrade = determineGrade(downloadLatencyIncrease);
    const uploadGrade = determineGrade(uploadLatencyIncrease);
    const bidirectionalGrade = determineGrade(bidirectionalLatencyIncrease);
    
    console.log(`Download grade: ${downloadGrade.grade}, Upload grade: ${uploadGrade.grade}, Bidirectional grade: ${bidirectionalGrade.grade}`);
    
    // Display the results
    displayGrades(downloadGrade, uploadGrade, bidirectionalGrade);
    displayLatencyStats(
        baselineStats,
        downloadWarmupStats,
        downloadStats,
        uploadWarmupStats,
        uploadStats,
        bidirectionalStats
    );
    displayThroughputStats(
        downloadThroughputStats,
        uploadThroughputStats,
        bidiDownloadThroughputStats,
        bidiUploadThroughputStats
    );
    displayAdditionalLatencies(downloadLatencyIncrease, uploadLatencyIncrease, bidirectionalLatencyIncrease);
    
    // Show the results container
    document.getElementById('results').classList.remove('hidden');
}

/**
 * Display grades for each phase
 * @param {Object} downloadGrade - Download grade info
 * @param {Object} uploadGrade - Upload grade info
 * @param {Object} bidirectionalGrade - Bidirectional grade info
 */
function displayGrades(downloadGrade, uploadGrade, bidirectionalGrade) {
    // Display download grade
    const downloadGradeElement = document.getElementById('downloadGrade');
    downloadGradeElement.textContent = downloadGrade.grade;
    downloadGradeElement.className = 'grade ' + downloadGrade.cssClass;
    
    // Add approved image for A or A+ grades
    const downloadGradeBox = downloadGradeElement.closest('.grade-box');
    let downloadApprovedImg = downloadGradeBox.querySelector('.approved-img');
    if (['a', 'a-plus'].includes(downloadGrade.cssClass)) {
        if (!downloadApprovedImg) {
            downloadApprovedImg = document.createElement('img');
            downloadApprovedImg.src = 'approved.png';
            downloadApprovedImg.alt = 'Approved';
            downloadApprovedImg.className = 'approved-img';
            downloadGradeBox.appendChild(downloadApprovedImg);
        }
    } else if (downloadApprovedImg) {
        downloadApprovedImg.remove();
    }
    
    // Display upload grade
    const uploadGradeElement = document.getElementById('uploadGrade');
    uploadGradeElement.textContent = uploadGrade.grade;
    uploadGradeElement.className = 'grade ' + uploadGrade.cssClass;
    
    // Add approved image for A or A+ grades
    const uploadGradeBox = uploadGradeElement.closest('.grade-box');
    let uploadApprovedImg = uploadGradeBox.querySelector('.approved-img');
    if (['a', 'a-plus'].includes(uploadGrade.cssClass)) {
        if (!uploadApprovedImg) {
            uploadApprovedImg = document.createElement('img');
            uploadApprovedImg.src = 'approved.png';
            uploadApprovedImg.alt = 'Approved';
            uploadApprovedImg.className = 'approved-img';
            uploadGradeBox.appendChild(uploadApprovedImg);
        }
    } else if (uploadApprovedImg) {
        uploadApprovedImg.remove();
    }
    
    // Display bidirectional grade
    const bidirectionalGradeElement = document.getElementById('bidirectionalGrade');
    bidirectionalGradeElement.textContent = bidirectionalGrade.grade;
    bidirectionalGradeElement.className = 'grade ' + bidirectionalGrade.cssClass;
    
    // Add approved image for A or A+ grades
    const bidirectionalGradeBox = bidirectionalGradeElement.closest('.grade-box');
    let bidirectionalApprovedImg = bidirectionalGradeBox.querySelector('.approved-img');
    if (['a', 'a-plus'].includes(bidirectionalGrade.cssClass)) {
        if (!bidirectionalApprovedImg) {
            bidirectionalApprovedImg = document.createElement('img');
            bidirectionalApprovedImg.src = 'approved.png';
            bidirectionalApprovedImg.alt = 'Approved';
            bidirectionalApprovedImg.className = 'approved-img';
            bidirectionalGradeBox.appendChild(bidirectionalApprovedImg);
        }
    } else if (bidirectionalApprovedImg) {
        bidirectionalApprovedImg.remove();
    }
}

/**
 * Display latency statistics
 * @param {Object} baselineStats - Baseline latency statistics
 * @param {Object} downloadWarmupStats - Download warmup latency statistics
 * @param {Object} downloadStats - Download latency statistics
 * @param {Object} uploadWarmupStats - Upload warmup latency statistics
 * @param {Object} uploadStats - Upload latency statistics
 * @param {Object} bidirectionalStats - Bidirectional latency statistics
 */
function displayLatencyStats(
    baselineStats,
    downloadWarmupStats,
    downloadStats,
    uploadWarmupStats,
    uploadStats,
    bidirectionalStats
) {
    const tbody = document.querySelector('#latencyStats tbody');
    tbody.innerHTML = '';
    
    // Add rows for each phase, omitting warmup phases
    addStatsRow(tbody, 'Baseline', baselineStats);
    addStatsRow(tbody, 'Download', downloadStats);
    addStatsRow(tbody, 'Upload', uploadStats);
    addStatsRow(tbody, 'Bidirectional', bidirectionalStats);
}

/**
 * Display throughput statistics
 * @param {Object} downloadStats - Download throughput statistics
 * @param {Object} uploadStats - Upload throughput statistics
 * @param {Object} bidiDownloadStats - Bidirectional download throughput statistics
 * @param {Object} bidiUploadStats - Bidirectional upload throughput statistics
 */
function displayThroughputStats(downloadStats, uploadStats, bidiDownloadStats, bidiUploadStats) {
    const tbody = document.querySelector('#throughputStats tbody');
    tbody.innerHTML = '';
    
    // Add rows for standalone download and upload phases
    addThroughputStatsRow(tbody, 'Download', downloadStats);
    addThroughputStatsRow(tbody, 'Upload', uploadStats);
    
    // Add rows for bidirectional download and upload
    addThroughputStatsRow(tbody, 'Bidi Download', bidiDownloadStats);
    addThroughputStatsRow(tbody, 'Bidi Upload', bidiUploadStats);
}

/**
 * Add a row to the throughput statistics table (with fewer columns)
 * @param {HTMLElement} tbody - The table body element
 * @param {string} label - The row label
 * @param {Object} stats - The statistics object
 */
function addThroughputStatsRow(tbody, label, stats) {
    const row = document.createElement('tr');
    
    // Add the label cell
    const labelCell = document.createElement('td');
    labelCell.textContent = label;
    row.appendChild(labelCell);
    
    // Add only Median, Average, and 75th % columns
    addStatCell(row, formatStatValue(stats.median));
    addStatCell(row, formatStatValue(stats.average));
    addStatCell(row, formatStatValue(stats.p75));
    
    tbody.appendChild(row);
}

/**
 * Add a row to a statistics table
 * @param {HTMLElement} tbody - The table body element
 * @param {string} label - The row label
 * @param {Object} stats - The statistics object
 */
function addStatsRow(tbody, label, stats) {
    const row = document.createElement('tr');
    
    // Add the label cell
    const labelCell = document.createElement('td');
    labelCell.textContent = label;
    row.appendChild(labelCell);
    
    // Add the statistics cells with more compact formatting for mobile
    // For small values, show 1 decimal place; for larger values, round to nearest integer
    addStatCell(row, formatStatValue(stats.median));
    addStatCell(row, formatStatValue(stats.average));
    addStatCell(row, formatStatValue(stats.p25));
    addStatCell(row, formatStatValue(stats.p75));
    addStatCell(row, formatStatValue(stats.p95));
    
    tbody.appendChild(row);
}

/**
 * Add a cell to a statistics row
 * @param {HTMLElement} row - The table row element
 * @param {string} value - The cell value
 */
function addStatCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    row.appendChild(cell);
}

/**
 * Display the additional latencies under load for each phase
 * @param {number} downloadLatencyIncrease - Download latency increase in ms
 * @param {number} uploadLatencyIncrease - Upload latency increase in ms
 * @param {number} bidirectionalLatencyIncrease - Bidirectional latency increase in ms
 */
function displayAdditionalLatencies(downloadLatencyIncrease, uploadLatencyIncrease, bidirectionalLatencyIncrease) {
    // Display download latency increase
    const downloadElement = document.getElementById('downloadLatencyIncrease');
    downloadElement.textContent = `${downloadLatencyIncrease.toFixed(1)} ms`;
    const downloadGrade = determineGrade(downloadLatencyIncrease);
    downloadElement.className = 'stat-value ' + downloadGrade.cssClass;
    
    // Display upload latency increase
    const uploadElement = document.getElementById('uploadLatencyIncrease');
    uploadElement.textContent = `${uploadLatencyIncrease.toFixed(1)} ms`;
    const uploadGrade = determineGrade(uploadLatencyIncrease);
    uploadElement.className = 'stat-value ' + uploadGrade.cssClass;
    
    // Display bidirectional latency increase
    const bidirectionalElement = document.getElementById('bidirectionalLatencyIncrease');
    bidirectionalElement.textContent = `${bidirectionalLatencyIncrease.toFixed(1)} ms`;
    const bidirectionalGrade = determineGrade(bidirectionalLatencyIncrease);
    bidirectionalElement.className = 'stat-value ' + bidirectionalGrade.cssClass;
}

/**
 * Format a statistical value for display, optimizing for mobile screens
 * @param {number} value - The value to format
 * @returns {string} The formatted value
 */
function formatStatValue(value) {
    // For values under 10, show one decimal place
    // For values 10 and above, round to nearest integer
    if (value < 10) {
        return value.toFixed(1);
    } else {
        return Math.round(value).toString();
    }
}

export { analyzeAndDisplayResults };