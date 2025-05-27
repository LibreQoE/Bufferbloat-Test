/**
 * UI Module
 * Handles user interface interactions and updates
 */

// Test phases
const TEST_PHASES = {
    IDLE: 'idle',
    BASELINE: 'baseline',
    DOWNLOAD: 'download',
    UPLOAD: 'upload',
    BIDIRECTIONAL: 'bidirectional',
    COMPLETE: 'complete'
};

// Phase durations in seconds
const PHASE_DURATIONS = {
    [TEST_PHASES.BASELINE]: 5,
    [TEST_PHASES.DOWNLOAD]: 10,
    [TEST_PHASES.UPLOAD]: 10,
    [TEST_PHASES.BIDIRECTIONAL]: 5
};

// Total test duration in seconds
const TOTAL_TEST_DURATION = 30;

// UI elements
let startButton;
let progressBar;
let currentPhaseElement;
let phaseLabels;

// State
let currentPhase = TEST_PHASES.IDLE;
let testStartTime = 0;
let progressTimer = null;

/**
 * Initialize the UI
 */
function initUI() {
    // Get UI elements
    startButton = document.getElementById('startTest');
    progressBar = document.querySelector('.progress-fill');
    currentPhaseElement = document.getElementById('currentPhase');
    phaseLabels = {
        baseline: document.querySelector('.label.baseline'),
        download: document.querySelector('.label.download'),
        upload: document.querySelector('.label.upload'),
        bidirectional: document.querySelector('.label.cooldown') // Reuse the cooldown label element
    };
    
    // Add event listener to start button
    if (startButton) {
        startButton.addEventListener('click', onStartButtonClick);
    }
}

/**
 * Handle start button click
 */
function onStartButtonClick() {
    // Disable the button during the test
    startButton.disabled = true;
    
    // Hide any previous results
    document.getElementById('results').classList.add('hidden');
    
    // Notify that the test is starting
    const startEvent = new CustomEvent('test:start');
    window.dispatchEvent(startEvent);
}

/**
 * Start the test UI updates
 */
function startTestUI() {
    // Reset state
    testStartTime = performance.now();
    currentPhase = TEST_PHASES.BASELINE;
    
    // Start progress updates
    progressTimer = setInterval(updateProgress, 100);
    
    // Update UI for baseline phase
    updatePhaseUI(TEST_PHASES.BASELINE);
}

/**
 * Update the test progress
 */
function updateProgress() {
    const elapsedSeconds = (performance.now() - testStartTime) / 1000;
    const progressPercent = Math.min(100, (elapsedSeconds / TOTAL_TEST_DURATION) * 100);
    
    // Update progress bar
    progressBar.style.width = `${progressPercent}%`;
    
    // Check if we need to transition to the next phase
    checkPhaseTransition(elapsedSeconds);
    
    // Check if the test is complete
    if (elapsedSeconds >= TOTAL_TEST_DURATION) {
        completeTest();
    }
}

/**
 * Check if we need to transition to the next test phase
 * @param {number} elapsedSeconds - Elapsed time in seconds
 */
function checkPhaseTransition(elapsedSeconds) {
    if (currentPhase === TEST_PHASES.BASELINE && elapsedSeconds >= PHASE_DURATIONS[TEST_PHASES.BASELINE]) {
        currentPhase = TEST_PHASES.DOWNLOAD;
        updatePhaseUI(TEST_PHASES.DOWNLOAD);
        notifyPhaseChange(TEST_PHASES.DOWNLOAD);
    } else if (currentPhase === TEST_PHASES.DOWNLOAD && 
               elapsedSeconds >= (PHASE_DURATIONS[TEST_PHASES.BASELINE] + PHASE_DURATIONS[TEST_PHASES.DOWNLOAD])) {
        currentPhase = TEST_PHASES.UPLOAD;
        updatePhaseUI(TEST_PHASES.UPLOAD);
        notifyPhaseChange(TEST_PHASES.UPLOAD);
    } else if (currentPhase === TEST_PHASES.UPLOAD &&
               elapsedSeconds >= (PHASE_DURATIONS[TEST_PHASES.BASELINE] +
                                 PHASE_DURATIONS[TEST_PHASES.DOWNLOAD] +
                                 PHASE_DURATIONS[TEST_PHASES.UPLOAD])) {
        currentPhase = TEST_PHASES.BIDIRECTIONAL;
        updatePhaseUI(TEST_PHASES.BIDIRECTIONAL);
        notifyPhaseChange(TEST_PHASES.BIDIRECTIONAL);
    }
}

/**
 * Update the UI for a new phase
 * @param {string} phase - The new phase
 */
function updatePhaseUI(phase) {
    // Update phase labels
    Object.keys(phaseLabels).forEach(key => {
        phaseLabels[key].classList.remove('active');
    });
    
    if (phaseLabels[phase]) {
        phaseLabels[phase].classList.add('active');
    }
    
    // Update current phase text
    switch (phase) {
        case TEST_PHASES.BASELINE:
            currentPhaseElement.textContent = 'Measuring baseline latency...';
            break;
        case TEST_PHASES.DOWNLOAD:
            currentPhaseElement.textContent = 'Testing download saturation...';
            break;
        case TEST_PHASES.UPLOAD:
            currentPhaseElement.textContent = 'Testing upload saturation...';
            break;
        case TEST_PHASES.BIDIRECTIONAL:
            currentPhaseElement.textContent = 'Testing bidirectional saturation...';
            break;
        case TEST_PHASES.COMPLETE:
            currentPhaseElement.textContent = 'Test complete!';
            break;
        default:
            currentPhaseElement.textContent = 'Ready to start';
    }
}

/**
 * Notify that the phase has changed
 * @param {string} phase - The new phase
 */
function notifyPhaseChange(phase) {
    const event = new CustomEvent('test:phaseChange', { detail: { phase } });
    window.dispatchEvent(event);
}

/**
 * Complete the test
 */
function completeTest() {
    // Stop progress updates
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
    
    // Update UI
    currentPhase = TEST_PHASES.COMPLETE;
    updatePhaseUI(TEST_PHASES.COMPLETE);
    progressBar.style.width = '100%';
    startButton.disabled = false;
    
    // Notify that the test is complete
    const completeEvent = new CustomEvent('test:complete');
    window.dispatchEvent(completeEvent);
}

/**
 * Get the current test phase
 * @returns {string} The current phase
 */
function getCurrentPhase() {
    return currentPhase;
}

/**
 * Get the elapsed time since the test started
 * @returns {number} Elapsed time in seconds
 */
function getElapsedTime() {
    if (testStartTime === 0) return 0;
    return (performance.now() - testStartTime) / 1000;
}

export { 
    initUI, 
    startTestUI, 
    TEST_PHASES, 
    PHASE_DURATIONS,
    getCurrentPhase,
    getElapsedTime
};