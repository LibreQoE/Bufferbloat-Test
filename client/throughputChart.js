/**
 * Throughput Chart Module
 * Handles the throughput chart visualization using Chart.js
 */

// Chart configuration
const THROUGHPUT_CHART_CONFIG = {
    type: 'line',
    data: {
        datasets: [{
            label: 'Download (Mbps)',
            data: [],
            borderColor: 'rgba(46, 204, 113, 1)',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.2,
            yAxisID: 'y'
        }, {
            label: 'Upload (Mbps)',
            data: [],
            borderColor: 'rgba(231, 76, 60, 1)',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.2,
            yAxisID: 'y'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                title: {
                    display: true,
                    text: 'Time (seconds)',
                    color: '#ffffff'
                },
                min: 0,
                max: 30,
                ticks: {
                    color: '#ffffff',
                    stepSize: 5
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Throughput (Mbps)',
                    color: '#ffffff'
                },
                min: 0,
                ticks: {
                    color: '#ffffff'
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    title: function(tooltipItems) {
                        return `Time: ${tooltipItems[0].parsed.x.toFixed(1)}s`;
                    },
                    label: function(context) {
                        return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} Mbps`;
                    }
                }
            },
            annotation: {
                annotations: {
                    baselineRegion: {
                        type: 'box',
                        xMin: 0,
                        xMax: 5,
                        yMin: 0,
                        yMax: 'max',
                        backgroundColor: 'rgba(52, 152, 219, 0.2)',
                        borderColor: 'rgba(52, 152, 219, 0.4)',
                        borderWidth: 1,
                        drawTime: 'beforeDatasetsDraw',
                        label: {
                            display: false
                        }
                    },
                    downloadRegion: {
                        type: 'box',
                        xMin: 5,
                        xMax: 15,
                        yMin: 0,
                        yMax: 'max',
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        borderColor: 'rgba(46, 204, 113, 0.4)',
                        borderWidth: 1,
                        drawTime: 'beforeDatasetsDraw',
                        label: {
                            display: false
                        }
                    },
                    uploadRegion: {
                        type: 'box',
                        xMin: 15,
                        xMax: 25,
                        yMin: 0,
                        yMax: 'max',
                        backgroundColor: 'rgba(231, 76, 60, 0.2)',
                        borderColor: 'rgba(231, 76, 60, 0.4)',
                        borderWidth: 1,
                        drawTime: 'beforeDatasetsDraw',
                        label: {
                            display: false
                        }
                    },
                    bidirectionalRegion: {
                        type: 'box',
                        xMin: 25,
                        xMax: 30,
                        yMin: 0,
                        yMax: 'max',
                        backgroundColor: 'rgba(156, 39, 176, 0.2)',
                        borderColor: 'rgba(156, 39, 176, 0.4)',
                        borderWidth: 1,
                        drawTime: 'beforeDatasetsDraw',
                        label: {
                            display: false
                        }
                    }
                }
            }
        }
    }
};

/**
 * Create and initialize the throughput chart
 * @param {string} canvasId - The ID of the canvas element
 * @returns {Object} The Chart.js instance
 */
function createThroughputChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element with ID '${canvasId}' not found`);
        return null;
    }
    
    // Create the chart
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, THROUGHPUT_CHART_CONFIG);
    
    return chart;
}

/**
 * Reset the chart data
 * @param {Object} chart - The Chart.js instance
 */
function resetThroughputChart(chart) {
    if (!chart) return;
    
    chart.data.datasets[0].data = []; // Download
    chart.data.datasets[1].data = []; // Upload
    chart.update();
}

/**
 * Add a download throughput data point to the chart
 * @param {Object} chart - The Chart.js instance
 * @param {number} seconds - The time in seconds
 * @param {number} throughput - The throughput value in Mbps
 */
function addDownloadThroughputDataPoint(chart, seconds, throughput) {
    if (!chart) return;
    
    chart.data.datasets[0].data.push({
        x: seconds,
        y: throughput
    });
    
    updateThroughputChartScale(chart);
    chart.update();
}

/**
 * Add an upload throughput data point to the chart
 * @param {Object} chart - The Chart.js instance
 * @param {number} seconds - The time in seconds
 * @param {number} throughput - The throughput value in Mbps
 */
function addUploadThroughputDataPoint(chart, seconds, throughput) {
    if (!chart) return;
    
    chart.data.datasets[1].data.push({
        x: seconds,
        y: throughput
    });
    
    updateThroughputChartScale(chart);
    chart.update();
}

/**
 * Update the throughput chart with all collected data
 * @param {Object} chart - The Chart.js instance
 * @param {Array} downloadData - Array of download throughput measurements
 * @param {Array} uploadData - Array of upload throughput measurements
 * @param {number} testDuration - Total test duration in seconds
 */
function updateThroughputChart(chart, downloadData, uploadData, testDuration = 30) {
    if (!chart) return;
    
    // Instead of redrawing the chart with resampled data, we'll preserve the existing data
    // and just update the chart configuration
    
    // Update chart options to ensure proper display
    chart.options.scales.x.min = 0;
    chart.options.scales.x.max = 30;
    
    // Update the chart
    chart.update();
    
    updateThroughputChartScale(chart);
    chart.update();
}

/**
 * Update the y-axis scale based on the data
 * @param {Object} chart - The Chart.js instance
 */
function updateThroughputChartScale(chart) {
    if (!chart) return;
    
    // Find the maximum throughput value
    let maxThroughput = 0;
    
    chart.data.datasets.forEach(dataset => {
        const datasetMax = Math.max(...dataset.data.map(point => point.y), 0);
        maxThroughput = Math.max(maxThroughput, datasetMax);
    });
    
    // Set a reasonable max value (round up to nearest 100)
    if (maxThroughput > 0) {
        chart.options.scales.y.max = Math.ceil(maxThroughput / 100) * 100;
    } else {
        chart.options.scales.y.max = 100; // Default max
    }
}

export { 
    createThroughputChart, 
    resetThroughputChart, 
    addDownloadThroughputDataPoint, 
    addUploadThroughputDataPoint,
    updateThroughputChart
};