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
    const { baselineLatency, downloadLatency, uploadLatency, cooldownLatency, downloadThroughput, uploadThroughput } = testData;
    
    // Calculate latency statistics for each phase
    const baselineStats = calculateStats(baselineLatency);
    const downloadStats = calculateStats(downloadLatency);
    const uploadStats = calculateStats(uploadLatency);
    const cooldownStats = calculateStats(cooldownLatency);
    
    // Calculate throughput statistics
    const downloadThroughputStats = calculateStats(downloadThroughput);
    const uploadThroughputStats = calculateStats(uploadThroughput);
    
    // Calculate additional latency under load using average values
    const downloadLatencyIncrease = downloadStats.average - baselineStats.average;
    const uploadLatencyIncrease = uploadStats.average - baselineStats.average;
    const maxLatencyIncrease = Math.max(downloadLatencyIncrease, uploadLatencyIncrease);
    
    console.log(`Baseline average: ${baselineStats.average.toFixed(1)} ms`);
    console.log(`Download average: ${downloadStats.average.toFixed(1)} ms, increase: ${downloadLatencyIncrease.toFixed(1)} ms`);
    console.log(`Upload average: ${uploadStats.average.toFixed(1)} ms, increase: ${uploadLatencyIncrease.toFixed(1)} ms`);
    
    // Determine the grades for download and upload
    const downloadGrade = determineGrade(downloadLatencyIncrease);
    const uploadGrade = determineGrade(uploadLatencyIncrease);
    
    console.log(`Download grade: ${downloadGrade.grade}, Upload grade: ${uploadGrade.grade}`);
    
    // Final grade is the lower (worse) of the two grades
    // Compare the grades by their position in the GRADE_THRESHOLDS array
    const downloadGradeIndex = GRADE_THRESHOLDS.findIndex(g => g.grade === downloadGrade.grade);
    const uploadGradeIndex = GRADE_THRESHOLDS.findIndex(g => g.grade === uploadGrade.grade);
    const finalGrade = downloadGradeIndex >= uploadGradeIndex ? downloadGrade : uploadGrade;
    
    console.log(`Final grade: ${finalGrade.grade}`);
    
    // Display the results
    displayGrade(finalGrade);
    displayLatencyStats(baselineStats, downloadStats, uploadStats, cooldownStats);
    displayThroughputStats(downloadThroughputStats, uploadThroughputStats);
    displayAdditionalLatency(maxLatencyIncrease);
    
    // Show the results container
    document.getElementById('results').classList.remove('hidden');
}

/**
 * Display the final grade
 * @param {Object} gradeInfo - Object containing grade and CSS class
 */
function displayGrade(gradeInfo) {
    const gradeElement = document.getElementById('finalGrade');
    gradeElement.textContent = gradeInfo.grade;
    gradeElement.className = 'grade ' + gradeInfo.cssClass;
}

/**
 * Display latency statistics
 * @param {Object} baselineStats - Baseline latency statistics
 * @param {Object} downloadStats - Download latency statistics
 * @param {Object} uploadStats - Upload latency statistics
 * @param {Object} cooldownStats - Cooldown latency statistics
 */
function displayLatencyStats(baselineStats, downloadStats, uploadStats, cooldownStats) {
    const tbody = document.querySelector('#latencyStats tbody');
    tbody.innerHTML = '';
    
    // Add rows for each phase
    addStatsRow(tbody, 'Baseline', baselineStats);
    addStatsRow(tbody, 'Download', downloadStats);
    addStatsRow(tbody, 'Upload', uploadStats);
    addStatsRow(tbody, 'Cooldown', cooldownStats);
}

/**
 * Display throughput statistics
 * @param {Object} downloadStats - Download throughput statistics
 * @param {Object} uploadStats - Upload throughput statistics
 */
function displayThroughputStats(downloadStats, uploadStats) {
    const tbody = document.querySelector('#throughputStats tbody');
    tbody.innerHTML = '';
    
    // Add rows for download and upload
    addStatsRow(tbody, 'Download', downloadStats);
    addStatsRow(tbody, 'Upload', uploadStats);
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
    
    // Add the statistics cells
    addStatCell(row, stats.median.toFixed(1));
    addStatCell(row, stats.average.toFixed(1));
    addStatCell(row, stats.p25.toFixed(1));
    addStatCell(row, stats.p75.toFixed(1));
    addStatCell(row, stats.p95.toFixed(1));
    
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
 * Display the additional latency under load
 * @param {number} additionalLatency - The additional latency in ms
 */
function displayAdditionalLatency(additionalLatency) {
    const element = document.getElementById('additionalLatency');
    element.textContent = `${additionalLatency.toFixed(1)} ms`;
    
    // Add color coding based on the grade
    const grade = determineGrade(additionalLatency);
    element.className = 'stat-value ' + grade.cssClass;
}

export { analyzeAndDisplayResults };