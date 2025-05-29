/**
 * Xoshiro256** PRNG Implementation
 * Based on https://gitgud.io/anglekh/prng-xoshiro
 * 
 * This is a fast, high-quality pseudo-random number generator
 * that is much more efficient than cryptographically secure RNGs.
 */

// State variables for the PRNG
let state0 = 0;
let state1 = 0;
let state2 = 0;
let state3 = 0;

/**
 * Initialize the PRNG with a seed
 * @param {number} seed - The seed value
 */
function seedXoshiro(seed) {
    // Use a simple hash of the seed to initialize all state variables
    state0 = murmurHash3(seed);
    state1 = murmurHash3(state0);
    state2 = murmurHash3(state1);
    state3 = murmurHash3(state2);
    
    // Ensure at least one state is non-zero
    if (state0 === 0 && state1 === 0 && state2 === 0 && state3 === 0) {
        state0 = 1;
    }
    
    // Warm up the generator
    for (let i = 0; i < 20; i++) {
        nextXoshiro();
    }
}

/**
 * Generate the next random 32-bit integer
 * @returns {number} A random 32-bit integer
 */
function nextXoshiro() {
    // xoshiro256** algorithm
    const result = rotl(state1 * 5, 7) * 9;
    
    const t = state1 << 17;
    
    state2 ^= state0;
    state3 ^= state1;
    state1 ^= state2;
    state0 ^= state3;
    
    state2 ^= t;
    state3 = rotl(state3, 45);
    
    // Return as a positive integer
    return result >>> 0;
}

/**
 * Generate a random number between 0 and 1
 * @returns {number} A random floating-point number between 0 and 1
 */
function randomFloat() {
    // Convert 32-bit integer to float between 0 and 1
    return nextXoshiro() / 4294967296;
}

/**
 * Fill an array with random bytes
 * @param {Uint8Array} array - The array to fill
 */
function fillRandomBytes(array) {
    for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(randomFloat() * 256);
    }
}

/**
 * Rotate left operation
 * @param {number} x - The value to rotate
 * @param {number} k - The number of bits to rotate by
 * @returns {number} The rotated value
 */
function rotl(x, k) {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * Simple MurmurHash3 implementation for seeding
 * @param {number} h - The value to hash
 * @returns {number} The hashed value
 */
function murmurHash3(h) {
    h = ((h >>> 16) ^ h) * 0x85ebca6b;
    h = ((h >>> 13) ^ h) * 0xc2b2ae35;
    return (h >>> 16) ^ h;
}

/**
 * Initialize the PRNG with a cryptographically secure seed
 */
function initWithCryptoSeed() {
    // Create a cryptographically secure seed
    const cryptoArray = new Uint32Array(1);
    crypto.getRandomValues(cryptoArray);
    
    // Seed the PRNG with this secure seed
    seedXoshiro(cryptoArray[0]);
    
    console.log("Xoshiro PRNG initialized with crypto seed");
}

// Export the functions
export {
    seedXoshiro,
    nextXoshiro,
    randomFloat,
    fillRandomBytes,
    initWithCryptoSeed
};