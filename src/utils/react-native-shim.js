// Shim for React Native Platform and Linking APIs

// Platform detection
export const Platform = {
  OS: 'web',
  select: (options) => {
    if (options.web) return options.web;
    if (options.default) return options.default;
    return undefined;
  }
};

// Basic Linking implementation for web
export const Linking = {
  canOpenURL: async (url) => {
    // In a web context, we can't reliably check if a URL scheme is installed
    // Always return false for special schemes in web mode
    if (url.startsWith('nostrsigner:')) return false;
    return true;
  },
  
  openURL: async (url) => {
    // For web, we'll just try to open the URL in a new tab
    // This won't work for custom schemes but is a fallback
    window.open(url, '_blank');
    return true;
  },
  
  addEventListener: () => {
    // We can't really listen for deep links in web context
    // Return a no-op removal function
    return {
      remove: () => {}
    };
  }
};

// Export a default object for compatibility
export default {
  Platform,
  Linking
}; 