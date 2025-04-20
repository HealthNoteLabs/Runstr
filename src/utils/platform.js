import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

/**
 * Check if running on a native platform (Android/iOS)
 * @returns {boolean} True if running on a native platform
 */
export const isNativePlatform = !Capacitor.isPluginAvailable('Device') ? false : Capacitor.getPlatform() !== 'web';

/**
 * Get the current platform
 * @returns {string} The platform (android, ios, web)
 */
export const getPlatform = () => Capacitor.getPlatform();

/**
 * Check if running on Android
 * @returns {boolean} True if running on Android
 */
export const isAndroid = getPlatform() === 'android';

/**
 * Check if running on iOS
 * @returns {boolean} True if running on iOS
 */
export const isIOS = getPlatform() === 'ios';

/**
 * Check if running in mobile web browser
 * @returns {boolean} True if on a mobile browser
 */
export const isMobileBrowser = () => {
  if (isNativePlatform) return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Check for common mobile user agent patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent);
};

/**
 * Check if the app is running in a mobile context (native or mobile browser)
 * @returns {boolean} True if on mobile (native or browser)
 */
export const isMobileContext = () => isNativePlatform || isMobileBrowser();

/**
 * Get device information (async import to reduce bundle size)
 * @returns {Promise<Object>} Device information
 */
export const getDeviceInfo = async () => {
  if (!Capacitor.isPluginAvailable('Device')) {
    return {
      isVirtual: false,
      manufacturer: 'web',
      model: 'browser',
      operatingSystem: navigator.platform,
      osVersion: navigator.userAgent,
      platform: 'web',
      webViewVersion: navigator.appVersion,
    };
  }
  
  try {
    return await Device.getInfo();
  } catch (error) {
    console.error('Error getting device info:', error);
    return null;
  }
};

/**
 * Get the battery info (async import to reduce bundle size)
 * @returns {Promise<Object>} Battery information
 */
export const getBatteryInfo = async () => {
  if (isNativePlatform) {
    try {
      const { Device } = await import('@capacitor/device');
      return Device.getBatteryInfo();
    } catch (error) {
      console.error('Error getting battery info:', error);
      return { batteryLevel: 1.0, isCharging: false };
    }
  }
  
  // Fallback using Battery API if available in browser
  if (navigator.getBattery) {
    try {
      const battery = await navigator.getBattery();
      return {
        batteryLevel: battery.level,
        isCharging: battery.charging
      };
    } catch (error) {
      console.error('Error getting browser battery info:', error);
    }
  }
  
  // Default fallback
  return { batteryLevel: 1.0, isCharging: true };
};

/**
 * Trigger haptic feedback (vibration)
 * @param {string} type - Feedback type ('light', 'medium', 'heavy', 'success', 'error')
 * @returns {Promise<void>}
 */
export const vibrate = async (type = 'medium') => {
  if (isNativePlatform) {
    try {
      const { Haptics } = await import('@capacitor/haptics');
      
      switch (type) {
        case 'light':
          await Haptics.impact({ style: 'light' });
          break;
        case 'medium':
          await Haptics.impact({ style: 'medium' });
          break;
        case 'heavy':
          await Haptics.impact({ style: 'heavy' });
          break;
        case 'success':
          await Haptics.notification({ type: 'success' });
          break;
        case 'error':
          await Haptics.notification({ type: 'error' });
          break;
        case 'warning':
          await Haptics.notification({ type: 'warning' });
          break;
        default:
          await Haptics.impact({ style: 'medium' });
      }
    } catch (error) {
      console.error('Error triggering haptic feedback:', error);
    }
  } else if (navigator.vibrate) {
    // Fallback to Web Vibration API
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate([30, 30, 30]);
          break;
        case 'success':
          navigator.vibrate([20, 50, 100]);
          break;
        case 'error':
          navigator.vibrate([100, 30, 100, 30, 100]);
          break;
        case 'warning':
          navigator.vibrate([50, 30, 50]);
          break;
        default:
          navigator.vibrate(20);
      }
    } catch (error) {
      console.error('Error using Web Vibration API:', error);
    }
  }
};

/**
 * Show a native toast message
 * @param {string} message - Message to display
 * @param {string} duration - 'short' or 'long'
 * @returns {Promise<void>}
 */
export const showToast = async (message, duration = 'short') => {
  if (isNativePlatform) {
    try {
      const { Toast } = await import('@capacitor/toast');
      await Toast.show({
        text: message,
        duration: duration === 'short' ? 'short' : 'long'
      });
    } catch (error) {
      console.error('Error showing toast:', error);
      // Fallback to alert
      alert(message);
    }
  } else {
    // Simple web fallback for toast
    const toast = document.createElement('div');
    toast.className = 'web-toast';
    toast.textContent = message;
    
    // Create and append style if it doesn't exist
    if (!document.getElementById('web-toast-style')) {
      const style = document.createElement('style');
      style.id = 'web-toast-style';
      style.textContent = `
        .web-toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 12px 20px;
          border-radius: 20px;
          font-size: 14px;
          z-index: 10000;
          transition: opacity 0.3s, transform 0.3s;
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        .web-toast.visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Show toast with animation
    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);
    
    // Hide and remove after duration
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, duration === 'short' ? 2000 : 3500);
  }
};

/**
 * Show a native dialog
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string[]} options.buttonLabels - Button labels
 * @returns {Promise<number>} Index of the button clicked
 */
export const showDialog = async ({ title, message, buttonLabels = ['OK'] }) => {
  if (isNativePlatform) {
    try {
      const { Dialog } = await import('@capacitor/dialog');
      
      if (buttonLabels.length === 1) {
        // Alert dialog
        await Dialog.alert({
          title,
          message
        });
        return 0;
      } else if (buttonLabels.length === 2) {
        // Confirm dialog
        const { value } = await Dialog.confirm({
          title,
          message,
          okButtonTitle: buttonLabels[0],
          cancelButtonTitle: buttonLabels[1]
        });
        return value ? 0 : 1;
      } else {
        // Prompt dialog with no input field (we just ignore the inputText)
        const { promptRaw } = Dialog;
        if (promptRaw) {
          const result = await promptRaw({
            title,
            message,
            okButtonTitle: buttonLabels[0],
            cancelButtonTitle: buttonLabels[1],
            inputPlaceholder: '',
            inputText: ''
          });
          return result.buttonIndex;
        } else {
          // Fallback to confirm
          const { value } = await Dialog.confirm({
            title,
            message,
            okButtonTitle: buttonLabels[0],
            cancelButtonTitle: buttonLabels[1] || 'Cancel'
          });
          return value ? 0 : 1;
        }
      }
    } catch (error) {
      console.error('Error showing dialog:', error);
    }
  }
  
  // Web fallback
  if (buttonLabels.length === 1) {
    alert(`${title}\n\n${message}`);
    return 0;
  } else if (buttonLabels.length === 2) {
    return confirm(`${title}\n\n${message}`) ? 0 : 1;
  } else {
    // Poor fallback for multiple buttons
    const response = prompt(`${title}\n\n${message}\n\nOptions: ${buttonLabels.join(', ')}\n\nType the number of your choice (1-${buttonLabels.length})`);
    const index = parseInt(response, 10);
    return isNaN(index) ? -1 : Math.max(0, Math.min(buttonLabels.length - 1, index - 1));
  }
};

/**
 * Open app settings
 * @returns {Promise<void>}
 */
export const openAppSettings = async () => {
  if (isNativePlatform) {
    try {
      const { App } = await import('@capacitor/app');
      await App.openSettings();
    } catch (error) {
      console.error('Error opening app settings:', error);
    }
  }
};

/**
 * Get network status with fallback to navigator.onLine for web
 * @returns {Promise<Object>} Network status
 */
export const getNetworkStatus = async () => {
  if (!Capacitor.isPluginAvailable('Network')) {
    return {
      connected: navigator.onLine,
      connectionType: navigator.onLine ? 'wifi' : 'none'
    };
  }
  
  try {
    const { Network } = await import('@capacitor/network');
    return await Network.getStatus();
  } catch (error) {
    console.error('Error getting network status:', error);
    return {
      connected: navigator.onLine,
      connectionType: navigator.onLine ? 'unknown' : 'none'
    };
  }
};

/**
 * Register a callback for network status changes
 * @param {Function} callback - Callback function to be called when network status changes
 * @returns {Function} - Cleanup function to remove the listener
 */
export const onNetworkStatusChange = async (callback) => {
  if (!Capacitor.isPluginAvailable('Network')) {
    // Use browser events for web
    window.addEventListener('online', () => callback({ connected: true, connectionType: 'wifi' }));
    window.addEventListener('offline', () => callback({ connected: false, connectionType: 'none' }));
    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
    };
  }
  
  try {
    const { Network } = await import('@capacitor/network');
    await Network.addListener('networkStatusChange', callback);
    return () => {
      Network.removeAllListeners();
    };
  } catch (error) {
    console.error('Error setting up network listener:', error);
    return () => {};
  }
};

// Export default for ease of use
export default {
  isNativePlatform,
  isAndroid,
  isIOS,
  isMobileBrowser,
  isMobileContext,
  getPlatform,
  getDeviceInfo,
  getBatteryInfo,
  vibrate,
  showToast,
  showDialog,
  openAppSettings,
  getNetworkStatus,
  onNetworkStatusChange
}; 