import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Haptic feedback utility service
 * Provides centralized haptic feedback management with graceful fallbacks
 */

// Check if haptics are available and enabled
let hapticsEnabled = true;
let hapticsAvailable = true;

// Initialize haptics availability check
const checkHapticsAvailability = async () => {
  try {
    // Try a basic vibration to test availability
    await Haptics.vibrate({ duration: 10 });
    hapticsAvailable = true;
  } catch (error) {
    console.log('Haptics not available on this device:', error);
    hapticsAvailable = false;
  }
};

// Initialize on module load
checkHapticsAvailability();

/**
 * Set haptics enabled/disabled globally
 * @param {boolean} enabled - Whether haptics should be enabled
 */
export const setHapticsEnabled = (enabled) => {
  hapticsEnabled = enabled;
};

/**
 * Get current haptics enabled state
 * @returns {boolean} Whether haptics are enabled
 */
export const getHapticsEnabled = () => {
  return hapticsEnabled && hapticsAvailable;
};

/**
 * Base haptic function with error handling
 * @param {Function} hapticFunction - The haptic function to execute
 * @param {string} fallbackMessage - Optional console message for debugging
 */
const executeHaptic = async (hapticFunction, fallbackMessage = '') => {
  if (!getHapticsEnabled()) return;
  
  try {
    await hapticFunction();
  } catch (error) {
    if (fallbackMessage) {
      console.log(`Haptic feedback unavailable: ${fallbackMessage}`, error);
    }
  }
};

/**
 * Light haptic feedback for general button presses
 */
export const triggerLightHaptic = async () => {
  await executeHaptic(
    () => Haptics.impact({ style: ImpactStyle.Light }),
    'Light haptic'
  );
};

/**
 * Medium haptic feedback for important actions
 */
export const triggerMediumHaptic = async () => {
  await executeHaptic(
    () => Haptics.impact({ style: ImpactStyle.Medium }),
    'Medium haptic'
  );
};

/**
 * Heavy haptic feedback for critical actions
 */
export const triggerHeavyHaptic = async () => {
  await executeHaptic(
    () => Haptics.impact({ style: ImpactStyle.Heavy }),
    'Heavy haptic'
  );
};

/**
 * Basic vibration fallback (works on all Android devices)
 * @param {number} duration - Vibration duration in milliseconds (default: 50)
 */
export const triggerVibration = async (duration = 50) => {
  await executeHaptic(
    () => Haptics.vibrate({ duration }),
    `Vibration ${duration}ms`
  );
};

/**
 * Selection start haptic (for UI selections)
 */
export const triggerSelectionStart = async () => {
  await executeHaptic(
    () => Haptics.selectionStart(),
    'Selection start'
  );
};

/**
 * Selection changed haptic (for UI selections)
 */
export const triggerSelectionChanged = async () => {
  await executeHaptic(
    () => Haptics.selectionChanged(),
    'Selection changed'
  );
};

/**
 * Selection end haptic (for UI selections)
 */
export const triggerSelectionEnd = async () => {
  await executeHaptic(
    () => Haptics.selectionEnd(),
    'Selection end'
  );
};

// Convenience functions for common app actions

/**
 * Haptic feedback for general button presses
 */
export const triggerButtonPress = async () => {
  // On Android, impact styles may not work, so fallback to vibration
  if (hapticsAvailable) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Fallback to basic vibration for Android
      await triggerVibration(30);
    }
  }
};

/**
 * Haptic feedback for starting a run (stronger feedback)
 */
export const triggerRunStart = async () => {
  if (hapticsAvailable) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Fallback to longer vibration for Android
      await triggerVibration(100);
    }
  }
};

/**
 * Haptic feedback for stopping a run
 */
export const triggerRunStop = async () => {
  if (hapticsAvailable) {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Fallback to medium vibration for Android
      await triggerVibration(75);
    }
  }
};

/**
 * Haptic feedback for successful actions
 */
export const triggerSuccess = async () => {
  if (hapticsAvailable) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Two short vibrations for success
      await triggerVibration(25);
      setTimeout(() => triggerVibration(25), 100);
    }
  }
};

/**
 * Haptic feedback for error states
 */
export const triggerError = async () => {
  if (hapticsAvailable) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Three short vibrations for error
      await triggerVibration(50);
      setTimeout(() => triggerVibration(50), 150);
      setTimeout(() => triggerVibration(50), 300);
    }
  }
};

/**
 * Haptic feedback for pausing/resuming runs
 */
export const triggerRunPause = async () => {
  await triggerMediumHaptic();
};

/**
 * Initialize haptics settings from localStorage
 */
export const initializeHaptics = () => {
  const storedSetting = localStorage.getItem('hapticsEnabled');
  if (storedSetting !== null) {
    setHapticsEnabled(storedSetting === 'true');
  }
};

/**
 * Save haptics setting to localStorage
 * @param {boolean} enabled - Whether haptics should be enabled
 */
export const saveHapticsSettings = (enabled) => {
  setHapticsEnabled(enabled);
  localStorage.setItem('hapticsEnabled', enabled.toString());
};

/**
 * Update haptics setting (for use with settings context)
 * @param {boolean} enabled - Whether haptics should be enabled
 */
export const updateHapticsFromSettings = (enabled) => {
  setHapticsEnabled(enabled);
};

// Auto-initialize on import
initializeHaptics();