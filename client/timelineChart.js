/**
 * Timeline Chart Module
 * Handles the latency chart visualization using Chart.js
 */

// Chart configuration
const CHART_CONFIG = {
    type: 'line',
    data: {
        datasets: [{
            label: 'Latency (ms)',
            data: [],
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 3,
            pointRadius: 1,
            pointHoverRadius: 3,
            tension: 0.2
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
                    text: 'Latency (ms)',
                    color: '#ffffff'
                },
                min: 0,
                suggestedMax: 100,
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
                        return `Latency: ${context.parsed.y.toFixed(1)} ms`;
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
                            display: true,
                            content: 'Baseline',
                            position: 'start',
                            color: 'rgba(52, 152, 219, 1)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
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
                            display: true,
                            content: 'Download',
                            position: 'start',
                            color: 'rgba(46, 204, 113, 1)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
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
                            display: true,
                            content: 'Upload',
                            position: 'start',
                            color: 'rgba(231, 76, 60, 1)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    cooldownRegion: {
                        type: 'box',
                        xMin: 25,
                        xMax: 30,
                        yMin: 0,
                        yMax: 'max',
                        backgroundColor: 'rgba(243, 156, 18, 0.2)',
                        borderColor: 'rgba(243, 156, 18, 0.4)',
                        borderWidth: 1,
                        drawTime: 'beforeDatasetsDraw',
                        label: {
                            display: true,
                            content: 'Cooldown',
                            position: 'start',
                            color: 'rgba(243, 156, 18, 1)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    }
                }
            }
        }
    }
};

/**
 * Create and initialize the latency chart
 * @param {string} canvasId - The ID of the canvas element
 * @returns {Object} The Chart.js instance
 */
function createLatencyChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element with ID '${canvasId}' not found`);
        return null;
    }
    
    // Create the chart
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, CHART_CONFIG);
    
    return chart;
}

/**
 * Reset the chart data
 * @param {Object} chart - The Chart.js instance
 */
function resetChart(chart) {
    if (!chart) return;
    
    chart.data.datasets[0].data = [];
    chart.update();
}

/**
 * Add a data point to the chart
 * @param {Object} chart - The Chart.js instance
 * @param {number} seconds - The time in seconds
 * @param {number} latency - The latency value in ms
 */
function addLatencyDataPoint(chart, seconds, latency) {
    if (!chart) return;
    
    chart.data.datasets[0].data.push({
        x: seconds,
        y: latency
    });
    
    // Adjust y-axis scale if needed
    const maxLatency = Math.max(...chart.data.datasets[0].data.map(point => point.y));
    if (maxLatency > chart.options.scales.y.suggestedMax) {
        chart.options.scales.y.suggestedMax = Math.ceil(maxLatency / 100) * 100;
    }
    
    chart.update();
}

export { createLatencyChart, resetChart, addLatencyDataPoint };