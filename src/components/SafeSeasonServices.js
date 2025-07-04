/**
 * Safe wrappers for season services that handle errors gracefully
 * This prevents localStorage or service failures from crashing the UI
 */

// Safe localStorage check
const isLocalStorageAvailable = () => {
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    console.warn('[SafeSeasonServices] localStorage not available:', e);
    return false;
  }
};

// Safe season pass service wrapper
export const safeSeasonPassService = {
  getParticipantCount: () => {
    try {
      if (!isLocalStorageAvailable()) {
        console.warn('[SafeSeasonServices] localStorage unavailable, returning 0 participants');
        return 0;
      }
      
      // Dynamic import to handle missing service
      const seasonPassService = require('../services/seasonPassService').default;
      return seasonPassService.getParticipantCount();
    } catch (err) {
      console.error('[SafeSeasonServices] Error getting participant count:', err);
      return 0; // Safe fallback
    }
  },

  isParticipant: (pubkey) => {
    try {
      if (!pubkey || !isLocalStorageAvailable()) {
        return false;
      }
      
      const seasonPassService = require('../services/seasonPassService').default;
      return seasonPassService.isParticipant(pubkey);
    } catch (err) {
      console.error('[SafeSeasonServices] Error checking participant status:', err);
      return false; // Safe fallback
    }
  }
};

// Safe season pass payment service wrapper
export const safeSeasonPassPaymentService = {
  hasSeasonPass: (pubkey) => {
    try {
      if (!pubkey) {
        return false;
      }
      
      const seasonPassPaymentService = require('../services/seasonPassPaymentService').default;
      return seasonPassPaymentService.hasSeasonPass(pubkey);
    } catch (err) {
      console.error('[SafeSeasonServices] Error checking season pass:', err);
      return false; // Safe fallback
    }
  },

  getParticipantCount: () => {
    try {
      const seasonPassPaymentService = require('../services/seasonPassPaymentService').default;
      return seasonPassPaymentService.getParticipantCount();
    } catch (err) {
      console.error('[SafeSeasonServices] Error getting payment participant count:', err);
      return 0; // Safe fallback
    }
  },

  getSeasonDetails: () => {
    try {
      const seasonPassPaymentService = require('../services/seasonPassPaymentService').default;
      return seasonPassPaymentService.getSeasonDetails();
    } catch (err) {
      console.error('[SafeSeasonServices] Error getting season details:', err);
      return {
        passPrice: 10000,
        title: 'RUNSTR Season 1',
        startUtc: '2025-07-11T00:00:00Z',
        endUtc: '2025-10-11T23:59:59Z'
      }; // Safe fallback
    }
  }
};

// Safe modal component wrapper
export const SafeModalWrapper = ({ children, fallback = null, componentName = 'Modal' }) => {
  try {
    return children;
  } catch (err) {
    console.error(`[SafeSeasonServices] Error rendering ${componentName}:`, err);
    return fallback || (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-md">
        Unable to load {componentName}. Please refresh the page.
      </div>
    );
  }
}; 