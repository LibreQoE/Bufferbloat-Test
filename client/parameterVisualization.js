/**
 * Parameter Visualization Module
 * Visualizes parameter testing during warmup phases
 */

/**
 * Create parameter visualization container
 * @returns {HTMLElement} The visualization container
 */
function createVisualizationContainer() {
    // Create main container with a table-like structure
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
    
    // Create download visualization area
    const downloadVizArea = document.createElement('div');
    downloadVizArea.className = 'param-viz-area';
    downloadSection.appendChild(downloadVizArea);
    
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
    
    // Create upload visualization area
    const uploadVizArea = document.createElement('div');
    uploadVizArea.className = 'param-viz-area';
    uploadSection.appendChild(uploadVizArea);
    
    // Create shared legend in a new row
    const legendRow = document.createElement('tr');
    table.appendChild(legendRow);
    
    const legendCell = document.createElement('td');
    legendCell.colSpan = 2;
    legendCell.style.textAlign = 'center';
    legendRow.appendChild(legendCell);
    
    const legend = document.createElement('div');
    legend.className = 'param-viz-legend';
    legend.innerHTML = `
        <div class="legend-item"><span class="legend-color" style="background-color: var(--primary);"></span> Throughput</div>
        <div class="legend-item"><span class="legend-color" style="background-color: var(--error);"></span> Latency</div>
        <div class="legend-item"><span class="legend-marker optimal"></span> Optimal Parameters</div>
    `;
    legendCell.appendChild(legend);
    
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
            opacity: 1;
            height: 200px;
            overflow: hidden;
        }
        
        /* Instead of hiding, we'll just dim the section when not active */
        .param-viz-section.hidden {
            opacity: 0.7;
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
        
        .param-viz-area {
            height: 120px;
            position: relative;
            background-color: rgba(0, 0, 0, 0.2); /* Darker background matching mockup */
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        
        .param-test {
            position: absolute;
            bottom: 0;
            width: 20px;
            background-color: var(--primary);
            border-radius: 2px 2px 0 0;
            transition: height 0.3s ease;
        }
        
        .param-test.optimal {
            border: 2px solid white;
            box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
        }
        
        .param-test-latency {
            position: absolute;
            width: 20px;
            height: 3px;
            background-color: var(--error);
        }
        
        .param-test-label {
            position: absolute;
            bottom: -20px;
            font-size: 10px;
            text-align: center;
            width: 20px;
            color: rgba(255, 255, 255, 0.7);
        }
        
        .param-viz-legend {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 5px;
            font-size: 14px;
            padding: 5px 0;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .legend-color {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
        
        .legend-marker.optimal {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid white;
            box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
            border-radius: 2px;
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
    
    // Get the appropriate section based on type
    const sectionId = type === 'download' ? 'downloadParameterViz' : 'uploadParameterViz';
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // Log parameter history for debugging
    console.log(`PARAMETER VISUALIZATION - ${type.toUpperCase()} - ${parameterHistory.length} entries:`);
    
    // Find the optimal parameters
    const optimalEntry = parameterHistory.find(entry => entry.isOptimal);
    if (optimalEntry) {
        console.log(`  - OPTIMAL PARAMETERS: streams=${optimalEntry.parameters.streamCount}, pending=${optimalEntry.parameters.pendingUploads}`);
        console.log(`    - Throughput: ${optimalEntry.throughput.toFixed(2)} Mbps, Latency: ${optimalEntry.latency.toFixed(2)} ms`);
    } else {
        console.log(`  - No optimal parameters marked yet`);
    }
    
    // Log all entries
    parameterHistory.forEach((entry, index) => {
        console.log(`  - Entry ${index+1}: streams=${entry.parameters.streamCount}, pending=${entry.parameters.pendingUploads}`);
        console.log(`    - Throughput: ${entry.throughput.toFixed(2)} Mbps, Latency: ${entry.latency.toFixed(2)} ms`);
        console.log(`    - Is optimal: ${entry.isOptimal ? 'YES' : 'no'}`);
    });
    
    // Ensure section is visible (not dimmed)
    section.classList.remove('hidden');
    
    // Make sure both sections are always visible
    const downloadSection = document.getElementById('downloadParameterViz');
    const uploadSection = document.getElementById('uploadParameterViz');
    
    if (downloadSection) downloadSection.style.display = 'block';
    if (uploadSection) uploadSection.style.display = 'block';
    
    // Get visualization area for the specific type only
    const vizArea = section.querySelector('.param-viz-area');
    if (!vizArea) return;
    
    // Clear only this specific visualization area
    vizArea.innerHTML = '';
    
    // If no data, show message
    if (!parameterHistory || parameterHistory.length === 0) {
        const message = document.createElement('div');
        message.className = 'param-viz-message';
        message.textContent = 'Testing parameters...';
        message.style.textAlign = 'center';
        message.style.padding = '50px 0';
        message.style.color = 'rgba(255, 255, 255, 0.7)';
        vizArea.appendChild(message);
        return;
    }
    
    // Find max throughput and latency for scaling
    let maxThroughput = 0;
    let maxLatency = 0;
    parameterHistory.forEach(entry => {
        maxThroughput = Math.max(maxThroughput, entry.throughput);
        maxLatency = Math.max(maxLatency, entry.latency);
    });
    
    // Add 20% headroom
    maxThroughput *= 1.2;
    maxLatency *= 1.2;
    
    // Calculate width based on number of entries
    const barWidth = Math.min(20, vizArea.clientWidth / parameterHistory.length);
    
    // Create bars for each parameter test
    parameterHistory.forEach((entry, index) => {
        // Create container for this test
        const testContainer = document.createElement('div');
        testContainer.className = 'param-test-container';
        testContainer.style.position = 'absolute';
        testContainer.style.bottom = '0';
        testContainer.style.left = `${index * barWidth}px`;
        testContainer.style.width = `${barWidth}px`;
        testContainer.style.height = '100%';
        
        // Create throughput bar
        const throughputBar = document.createElement('div');
        throughputBar.className = `param-test ${entry.isOptimal ? 'optimal' : ''}`;
        throughputBar.style.left = `${(barWidth - 10) / 2}px`; // Center in container
        throughputBar.style.height = `${(entry.throughput / maxThroughput) * 100}%`;
        
        // Create latency marker
        const latencyMarker = document.createElement('div');
        latencyMarker.className = 'param-test-latency';
        latencyMarker.style.left = `${(barWidth - 10) / 2}px`; // Center in container
        latencyMarker.style.bottom = `${(entry.latency / maxLatency) * 100}%`;
        
        // Create label
        const label = document.createElement('div');
        label.className = 'param-test-label';
        label.textContent = `${entry.parameters.streamCount}/${entry.parameters.pendingUploads}`;
        label.style.left = `${(barWidth - 20) / 2}px`; // Center in container
        
        // Add tooltip with details
        testContainer.title = `Streams: ${entry.parameters.streamCount}
Pending: ${entry.parameters.pendingUploads}
Throughput: ${entry.throughput.toFixed(2)} Mbps
Latency: ${entry.latency.toFixed(2)} ms
${entry.isOptimal ? '✓ OPTIMAL' : ''}`;
        
        // Add elements to container
        testContainer.appendChild(throughputBar);
        testContainer.appendChild(latencyMarker);
        testContainer.appendChild(label);
        vizArea.appendChild(testContainer);
    });
}

/**
 * Dim parameter visualization (not completely hide)
 * @param {string} type - The type of test ('download' or 'upload'), or null to dim both
 */
export function hideParameterVisualization(type = null) {
    // This function is now a no-op - we keep all visualizations visible at all times
    // and never clear their contents
    
    // Just for debugging
    console.log(`hideParameterVisualization called for type: ${type}, but ignoring to keep visualizations visible`);
    
    // We're intentionally not doing anything here to keep the visualizations visible
    return;
}

export default {
    initParameterVisualization,
    updateParameterVisualization,
    hideParameterVisualization
};