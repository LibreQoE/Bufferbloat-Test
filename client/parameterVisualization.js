/**
 * Parameter Visualization Module
 * Visualizes parameter testing during warmup phases using Chart.js
 */

// Chart instances
let downloadChart = null;
let uploadChart = null;

/**
 * Create parameter visualization container
 * @returns {HTMLElement} The visualization container
 */
function createVisualizationContainer() {
    // Create main container
    const container = document.createElement('div');
    container.id = 'parameterVisualization';
    container.className = 'parameter-visualization';
    container.style.width = '100%';
    container.style.display = 'block';
    container.style.marginBottom = '20px';
    
    // Create a table for fixed layout
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '10px 0';
    container.appendChild(table);
    
    // Create a single row
    const row = document.createElement('tr');
    table.appendChild(row);
    
    // Create download cell (left)
    const downloadCell = document.createElement('td');
    downloadCell.style.width = '50%';
    downloadCell.style.verticalAlign = 'top';
    row.appendChild(downloadCell);
    
    // Create download section
    const downloadSection = document.createElement('div');
    downloadSection.id = 'downloadParameterViz';
    downloadSection.className = 'param-viz-section';
    downloadSection.style.width = '100%';
    downloadCell.appendChild(downloadSection);
    
    // Create download header
    const downloadHeader = document.createElement('div');
    downloadHeader.className = 'param-viz-header';
    downloadHeader.innerHTML = '<h3>Download Parameter Testing</h3>';
    downloadSection.appendChild(downloadHeader);
    
    // Create download chart canvas
    const downloadCanvas = document.createElement('canvas');
    downloadCanvas.id = 'downloadParameterChart';
    downloadCanvas.style.width = '100%';
    downloadCanvas.style.height = '200px';
    downloadSection.appendChild(downloadCanvas);
    
    // Create upload cell (right)
    const uploadCell = document.createElement('td');
    uploadCell.style.width = '50%';
    uploadCell.style.verticalAlign = 'top';
    row.appendChild(uploadCell);
    
    // Create upload section
    const uploadSection = document.createElement('div');
    uploadSection.id = 'uploadParameterViz';
    uploadSection.className = 'param-viz-section';
    uploadSection.style.width = '100%';
    uploadCell.appendChild(uploadSection);
    
    // Create upload header
    const uploadHeader = document.createElement('div');
    uploadHeader.className = 'param-viz-header';
    uploadHeader.innerHTML = '<h3>Upload Parameter Testing</h3>';
    uploadSection.appendChild(uploadHeader);
    
    // Create upload chart canvas
    const uploadCanvas = document.createElement('canvas');
    uploadCanvas.id = 'uploadParameterChart';
    uploadCanvas.style.width = '100%';
    uploadCanvas.style.height = '200px';
    uploadSection.appendChild(uploadCanvas);
    
    return container;
}

/**
 * Initialize parameter visualization
 */
export function initParameterVisualization() {
    // Create container if it doesn't exist
    let container = document.getElementById('parameterVisualization');
    if (!container) {
        container = createVisualizationContainer();
        
        // Insert after throughput chart container and before results container
        const throughputChartContainer = document.querySelector('.throughput-chart-container');
        const resultsContainer = document.getElementById('results');
        
        if (throughputChartContainer && throughputChartContainer.parentNode) {
            // Insert after throughput chart
            throughputChartContainer.parentNode.insertBefore(container, resultsContainer);
        } else {
            // Fallback to appending to test container
            const testContainer = document.querySelector('.test-container');
            if (testContainer) {
                testContainer.appendChild(container);
            }
        }
    }
    
    // Add CSS styles
    addVisualizationStyles();
    
    // Initialize charts
    initializeCharts();
}

/**
 * Initialize Chart.js charts for parameter visualization
 */
function initializeCharts() {
    // Initialize download parameter chart
    const downloadCtx = document.getElementById('downloadParameterChart');
    if (downloadCtx) {
        downloadChart = new Chart(downloadCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Throughput (Mbps)',
                        data: [],
                        backgroundColor: 'rgba(75, 192, 192, 0.7)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Latency (ms)',
                        data: [],
                        backgroundColor: 'rgba(255, 99, 132, 0.7)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: 'white',
                            usePointStyle: true,
                            generateLabels: function(chart) {
                                const defaultLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                
                                // Add custom legend items for optimal and causal
                                defaultLabels.push({
                                    text: 'Optimal Outcome',
                                    fillStyle: 'rgba(0, 200, 83, 0.9)',
                                    strokeStyle: 'rgba(255, 255, 255, 1)',
                                    lineWidth: 3,
                                    hidden: false,
                                    index: defaultLabels.length,
                                    fontColor: chart.options.plugins.legend.labels.color
                                });
                                
                                defaultLabels.push({
                                    text: 'Causal Parameters',
                                    fillStyle: 'rgba(33, 150, 243, 0.9)',
                                    strokeStyle: 'rgba(255, 215, 0, 1)',
                                    lineWidth: 3,
                                    hidden: false,
                                    index: defaultLabels.length + 1,
                                    fontColor: chart.options.plugins.legend.labels.color
                                });
                                
                                return defaultLabels;
                            }
                        },
                        onClick: function(e, legendItem, legend) {
                            // Only handle clicks on the default legend items
                            if (legendItem.index < 2) {
                                // Call the default handler for throughput and latency
                                Chart.defaults.plugins.legend.onClick(e, legendItem, legend);
                            }
                            // Ignore clicks on our custom legend items
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const streams = downloadChart.data.labels[index].split('/')[0];
                                const pending = downloadChart.data.labels[index].split('/')[1];
                                return `Streams: ${streams}, Pending: ${pending}`;
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                }
                                return label;
                            },
                            afterLabel: function(context) {
                                if (context.datasetIndex !== 0) return ''; // Only show for throughput bars
                                
                                const index = context.dataIndex;
                                const borderColor = context.dataset.borderColor[index];
                                
                                if (borderColor === 'rgba(255, 255, 255, 1)') {
                                    return '✓ OPTIMAL OUTCOME';
                                } else if (borderColor === 'rgba(255, 215, 0, 1)') {
                                    return '⚙️ CAUSAL PARAMETERS';
                                } else {
                                    return '';
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Throughput (Mbps)',
                            color: 'white'
                        },
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Latency (ms)',
                            color: 'white'
                        },
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }
    
    // Initialize upload parameter chart
    const uploadCtx = document.getElementById('uploadParameterChart');
    if (uploadCtx) {
        uploadChart = new Chart(uploadCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Throughput (Mbps)',
                        data: [],
                        backgroundColor: 'rgba(75, 192, 192, 0.7)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Latency (ms)',
                        data: [],
                        backgroundColor: 'rgba(255, 99, 132, 0.7)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: 'white',
                            usePointStyle: true,
                            generateLabels: function(chart) {
                                const defaultLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                
                                // Add custom legend items for optimal and causal
                                defaultLabels.push({
                                    text: 'Optimal Outcome',
                                    fillStyle: 'rgba(0, 200, 83, 0.9)',
                                    strokeStyle: 'rgba(255, 255, 255, 1)',
                                    lineWidth: 3,
                                    hidden: false,
                                    index: defaultLabels.length,
                                    fontColor: chart.options.plugins.legend.labels.color
                                });
                                
                                defaultLabels.push({
                                    text: 'Causal Parameters',
                                    fillStyle: 'rgba(33, 150, 243, 0.9)',
                                    strokeStyle: 'rgba(255, 215, 0, 1)',
                                    lineWidth: 3,
                                    hidden: false,
                                    index: defaultLabels.length + 1,
                                    fontColor: chart.options.plugins.legend.labels.color
                                });
                                
                                return defaultLabels;
                            }
                        },
                        onClick: function(e, legendItem, legend) {
                            // Only handle clicks on the default legend items
                            if (legendItem.index < 2) {
                                // Call the default handler for throughput and latency
                                Chart.defaults.plugins.legend.onClick(e, legendItem, legend);
                            }
                            // Ignore clicks on our custom legend items
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const streams = uploadChart.data.labels[index].split('/')[0];
                                const pending = uploadChart.data.labels[index].split('/')[1];
                                return `Streams: ${streams}, Pending: ${pending}`;
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                }
                                return label;
                            },
                            afterLabel: function(context) {
                                if (context.datasetIndex !== 0) return ''; // Only show for throughput bars
                                
                                const index = context.dataIndex;
                                const borderColor = context.dataset.borderColor[index];
                                
                                if (borderColor === 'rgba(255, 255, 255, 1)') {
                                    return '✓ OPTIMAL OUTCOME';
                                } else if (borderColor === 'rgba(255, 215, 0, 1)') {
                                    return '⚙️ CAUSAL PARAMETERS';
                                } else {
                                    return '';
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Throughput (Mbps)',
                            color: 'white'
                        },
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Latency (ms)',
                            color: 'white'
                        },
                        ticks: {
                            color: 'white'
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }
}

/**
 * Add visualization styles
 */
function addVisualizationStyles() {
    // Check if styles already exist
    if (document.getElementById('paramVizStyles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'paramVizStyles';
    styleEl.textContent = `
        .parameter-visualization {
            margin: 15px 0 25px 0;
            overflow: hidden;
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 10px;
        }
        
        .param-viz-section {
            background-color: var(--secondary);
            border-radius: 8px;
            padding: 15px;
            height: 250px;
            overflow: hidden;
        }
        
        .param-viz-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .param-viz-header h3 {
            margin: 0;
            font-size: 18px;
            color: #6b9bd1; /* Blue color matching the mockup */
            font-weight: normal;
        }
    `;
    document.head.appendChild(styleEl);
}

/**
 * Update parameter visualization with new data
 * @param {Array} parameterHistory - The parameter history data
 * @param {string} type - The type of test ('download' or 'upload')
 */
export function updateParameterVisualization(parameterHistory, type) {
    const container = document.getElementById('parameterVisualization');
    if (!container) return;
    
    // Log parameter history for debugging
    console.log(`PARAMETER VISUALIZATION - ${type.toUpperCase()} - ${parameterHistory.length} entries:`);
    
    // Find the optimal outcome and causal parameters
    const optimalEntry = parameterHistory.find(entry => entry.isOptimal);
    const causalEntry = parameterHistory.find(entry => entry.causedOptimal);
    
    if (optimalEntry) {
        console.log(`  - OPTIMAL OUTCOME: streams=${optimalEntry.parameters.streamCount}, pending=${optimalEntry.parameters.pendingUploads}`);
        console.log(`    - Throughput: ${optimalEntry.throughput.toFixed(2)} Mbps, Latency: ${optimalEntry.latency.toFixed(2)} ms`);
    } else {
        console.log(`  - No optimal outcome marked yet`);
    }
    
    if (causalEntry) {
        console.log(`  - CAUSAL PARAMETERS: streams=${causalEntry.parameters.streamCount}, pending=${causalEntry.parameters.pendingUploads}`);
        console.log(`    - Throughput: ${causalEntry.throughput.toFixed(2)} Mbps, Latency: ${causalEntry.latency.toFixed(2)} ms`);
    }
    
    // Log all entries
    parameterHistory.forEach((entry, index) => {
        console.log(`  - Entry ${index+1}: streams=${entry.parameters.streamCount}, pending=${entry.parameters.pendingUploads}`);
        console.log(`    - Throughput: ${entry.throughput.toFixed(2)} Mbps, Latency: ${entry.latency.toFixed(2)} ms`);
        console.log(`    - Is optimal outcome: ${entry.isOptimal ? 'YES' : 'no'}`);
        console.log(`    - Caused optimal outcome: ${entry.causedOptimal ? 'YES' : 'no'}`);
    });
    
    // Get the appropriate chart based on type
    const chart = type === 'download' ? downloadChart : uploadChart;
    if (!chart) return;
    
    // IMPORTANT: Only update the chart for the specified type
    // This prevents the Upload test from clearing the Download chart
    
    // Clear existing data for THIS CHART ONLY
    chart.data.labels = [];
    chart.data.datasets[0].data = []; // Throughput
    chart.data.datasets[1].data = []; // Latency
    
    // If no data, show empty chart
    if (!parameterHistory || parameterHistory.length === 0) {
        chart.update();
        return;
    }
    
    // Prepare data for Chart.js
    const labels = [];
    const throughputData = [];
    const latencyData = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Process each parameter entry
    parameterHistory.forEach((entry) => {
        // Create label from stream count and pending uploads
        labels.push(`${entry.parameters.streamCount}/${entry.parameters.pendingUploads}`);
        
        // Add throughput and latency data
        throughputData.push(entry.throughput);
        latencyData.push(entry.latency);
        
        // Set colors based on entry type
        if (entry.isOptimal) {
            // Highlight optimal outcome with bright green and white border
            backgroundColors.push('rgba(0, 200, 83, 0.9)');
            borderColors.push('rgba(255, 255, 255, 1)');
        } else if (entry.causedOptimal) {
            // Highlight causal parameters with bright blue and gold border
            backgroundColors.push('rgba(33, 150, 243, 0.9)');
            borderColors.push('rgba(255, 215, 0, 1)');
        } else {
            // Regular entries
            backgroundColors.push('rgba(75, 192, 192, 0.7)');
            borderColors.push('rgba(75, 192, 192, 1)');
        }
    });
    
    // Update chart data
    chart.data.labels = labels;
    chart.data.datasets[0].data = throughputData;
    chart.data.datasets[1].data = latencyData;
    
    // Update background colors for throughput bars
    chart.data.datasets[0].backgroundColor = backgroundColors;
    chart.data.datasets[0].borderColor = borderColors;
    
    // Add border width for special entries
    chart.data.datasets[0].borderWidth = borderColors.map(color =>
        color === 'rgba(255, 255, 255, 1)' || color === 'rgba(255, 215, 0, 1)' ? 3 : 1
    );
    
    // Update the chart
    chart.update();
}

/**
 * No-op function that maintains API compatibility
 * We no longer hide parameter visualizations - they stay visible throughout the test
 * @param {string} type - The type of test ('download' or 'upload'), or null for both
 */
export function hideParameterVisualization(type = null) {
    console.log(`hideParameterVisualization called for type: ${type}, but we keep visualizations visible now`);
    // This function intentionally does nothing - we keep all visualizations visible
    return;
}

export default {
    initParameterVisualization,
    updateParameterVisualization,
    hideParameterVisualization
};