// Daily step storage utilities for localStorage management

// Get today's date string for storage keys
export const getTodayKey = () => {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
};

// Get date string for a specific date
export const getDateKey = (date) => {
  return date.toISOString().split('T')[0];
};

// Save daily steps for a specific date
export const saveDailySteps = (dateString, steps) => {
  localStorage.setItem(`dailySteps_${dateString}`, steps.toString());
  localStorage.setItem('dailyStepsLastReset', dateString);
};

// Load daily steps for a specific date
export const loadDailySteps = (dateString) => {
  const stored = localStorage.getItem(`dailySteps_${dateString}`);
  return stored ? parseInt(stored, 10) : 0;
};

// Get all daily step records for a date range
export const getStepHistory = (days = 7) => {
  const history = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = getDateKey(date);
    const steps = loadDailySteps(dateString);
    
    history.push({
      date: dateString,
      steps,
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: i === 0
    });
  }
  
  return history.reverse(); // Oldest first
};

// Get weekly totals for the current week
export const getWeeklySteps = () => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  
  let totalSteps = 0;
  const dailyBreakdown = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateString = getDateKey(date);
    const steps = loadDailySteps(dateString);
    
    totalSteps += steps;
    dailyBreakdown.push({
      date: dateString,
      steps,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: date.toDateString() === today.toDateString()
    });
  }
  
  return {
    totalSteps,
    dailyBreakdown,
    weekStarting: getDateKey(startOfWeek)
  };
};

// Get monthly totals for the current month
export const getMonthlySteps = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  let totalSteps = 0;
  const dailyBreakdown = [];
  
  for (let date = new Date(startOfMonth); date <= endOfMonth; date.setDate(date.getDate() + 1)) {
    const dateString = getDateKey(date);
    const steps = loadDailySteps(dateString);
    
    totalSteps += steps;
    if (steps > 0 || date.toDateString() === today.toDateString()) {
      dailyBreakdown.push({
        date: dateString,
        steps,
        dayOfMonth: date.getDate(),
        isToday: date.toDateString() === today.toDateString()
      });
    }
  }
  
  return {
    totalSteps,
    dailyBreakdown,
    monthName: today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    daysInMonth: endOfMonth.getDate()
  };
};

// Clean up old step data (keep last N days)
export const cleanupOldData = (keepDays = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);
  const cutoffString = getDateKey(cutoffDate);
  
  // Get all localStorage keys that match our pattern
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('dailySteps_')) {
      const dateString = key.replace('dailySteps_', '');
      if (dateString < cutoffString) {
        keysToRemove.push(key);
      }
    }
  }
  
  // Remove old entries
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Cleaned up old step data: ${key}`);
  });
  
  return keysToRemove.length;
};

// Get step goal from settings
export const getDailyStepGoal = () => {
  const stored = localStorage.getItem('dailyStepGoal');
  return stored ? parseInt(stored, 10) : 10000;
};

// Set daily step goal
export const setDailyStepGoal = (goal) => {
  localStorage.setItem('dailyStepGoal', goal.toString());
};

// Check if always-on step counter is enabled
export const isAlwaysOnEnabled = () => {
  return localStorage.getItem('alwaysOnStepCounter') === 'true' && 
         localStorage.getItem('usePedometer') === 'true';
};

// Export step data for backup/sharing
export const exportStepData = (days = 30) => {
  const history = getStepHistory(days);
  const goal = getDailyStepGoal();
  
  return {
    exportDate: new Date().toISOString(),
    dailyGoal: goal,
    stepHistory: history,
    summary: {
      totalDays: history.length,
      totalSteps: history.reduce((sum, day) => sum + day.steps, 0),
      averageSteps: Math.round(history.reduce((sum, day) => sum + day.steps, 0) / history.length),
      goalAchievedDays: history.filter(day => day.steps >= goal).length
    }
  };
};

// Import step data from backup
export const importStepData = (exportedData) => {
  if (!exportedData || !exportedData.stepHistory) {
    throw new Error('Invalid step data format');
  }
  
  let importedCount = 0;
  
  exportedData.stepHistory.forEach(day => {
    if (day.date && typeof day.steps === 'number') {
      saveDailySteps(day.date, day.steps);
      importedCount++;
    }
  });
  
  // Import goal if available
  if (exportedData.dailyGoal) {
    setDailyStepGoal(exportedData.dailyGoal);
  }
  
  return importedCount;
};

// Debug utility for troubleshooting the always-on step counter
export const getStepCounterDebugInfo = () => {
  const todayKey = getTodayKey();
  const isEnabled = isAlwaysOnEnabled();
  
  // Import the service dynamically to avoid circular dependencies
  let serviceInfo = null;
  try {
    // This will only work if the service is already loaded
    if (window.dailyStepCounter || (typeof require !== 'undefined')) {
      const { dailyStepCounter } = require('../services/DailyStepCounterService');
      const stepData = dailyStepCounter.getDailySteps();
      serviceInfo = {
        isRunning: dailyStepCounter.isRunning,
        isPausedForSpeed: dailyStepCounter.isPausedForSpeed,
        isGpsActive: dailyStepCounter.isGpsActive,
        lastStepTime: dailyStepCounter.lastStepTime,
        speedHistoryLength: dailyStepCounter.speedHistory?.length || 0,
        serviceHealth: stepData.serviceHealth
      };
    }
  } catch (error) {
    console.warn('Could not access daily step counter service:', error);
  }
  
  return {
    timestamp: new Date().toISOString(),
    todayKey,
    settings: {
      alwaysOnEnabled: localStorage.getItem('alwaysOnStepCounter') === 'true',
      pedometerEnabled: localStorage.getItem('usePedometer') === 'true',
      isEnabled,
      dailyGoal: getDailyStepGoal()
    },
    storage: {
      todaySteps: loadDailySteps(todayKey),
      lastResetDate: localStorage.getItem('dailyStepsLastReset'),
      recentHistory: getStepHistory(3)
    },
    service: serviceInfo,
    browser: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      deviceMemory: navigator.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
    },
    permissions: {
      // Note: These would need to be checked with proper permission APIs
      // This is just a placeholder for future enhancement
      activityRecognition: 'unknown',
      locationServices: 'unknown'
    }
  };
};

// Console-friendly debug function
export const debugStepCounter = () => {
  const info = getStepCounterDebugInfo();
  
  console.group('🚶 Always-On Step Counter Debug Info');
  console.log('📅 Date:', info.todayKey);
  console.log('⚙️ Settings:', info.settings);
  console.log('💾 Storage:', info.storage);
  console.log('🔧 Service:', info.service || 'Service not available');
  console.log('🌐 Browser:', info.browser);
  console.groupEnd();
  
  // Check for common issues
  const issues = [];
  if (!info.settings.alwaysOnEnabled) {
    issues.push('❌ Always-on step counter is disabled in settings');
  }
  if (!info.settings.pedometerEnabled) {
    issues.push('❌ Pedometer is disabled in settings');
  }
  if (info.service && !info.service.isRunning) {
    issues.push('⚠️ Service is not running');
  }
  if (info.service && !info.service.serviceHealth?.pedometerListening) {
    issues.push('⚠️ Pedometer sensor is not connected');
  }
  if (info.service && info.service.isPausedForSpeed) {
    issues.push('⏸️ Service is paused due to high speed detection');
  }
  
  if (issues.length > 0) {
    console.group('🚨 Potential Issues Detected');
    issues.forEach(issue => console.log(issue));
    console.groupEnd();
  } else {
    console.log('✅ No obvious issues detected');
  }
  
  return info;
}; 