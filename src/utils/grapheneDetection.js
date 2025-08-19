/**
 * Shared utility for detecting GrapheneOS
 * This ensures consistent GrapheneOS detection across the app
 */

/**
 * Detect if the current device is running GrapheneOS
 * @returns {boolean} True if GrapheneOS is detected
 */
export function isGrapheneOS() {
  // Check multiple indicators for GrapheneOS
  const userAgent = navigator.userAgent.toLowerCase();
  const isGrapheneUserAgent = userAgent.includes('grapheneos');
  const isGrapheneStored = localStorage.getItem('isGrapheneOS') === 'true';
  
  // Additional checks for GrapheneOS indicators
  // Vanadium is the default browser on GrapheneOS
  const hasGrapheneFeatures = window.location.protocol === 'https:' && 
                             (userAgent.includes('vanadium') || userAgent.includes('chromium'));
  
  const isDetected = isGrapheneUserAgent || isGrapheneStored || hasGrapheneFeatures;
  
  // Store the detection result for consistency
  if (isDetected && !isGrapheneStored) {
    localStorage.setItem('isGrapheneOS', 'true');
  }
  
  return isDetected;
}

/**
 * Get GPS accuracy threshold based on OS
 * GrapheneOS needs more lenient thresholds due to privacy features
 * @returns {number} Accuracy threshold in meters
 */
export function getAccuracyThreshold() {
  return isGrapheneOS() ? 50 : 20; // 50m for GrapheneOS, 20m for others
}

/**
 * Get minimum movement threshold based on OS
 * GrapheneOS needs more sensitive movement detection
 * @returns {number} Movement threshold in meters
 */
export function getMovementThreshold() {
  return isGrapheneOS() ? 0.1 : 0.5; // 0.1m for GrapheneOS, 0.5m for others
}

/**
 * Get GPS stall threshold based on OS
 * GrapheneOS may have longer gaps between updates
 * @returns {number} Stall threshold in milliseconds
 */
export function getGPSStallThreshold() {
  return isGrapheneOS() ? 45000 : 30000; // 45s for GrapheneOS, 30s for others
}