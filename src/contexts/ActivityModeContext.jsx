import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Define activity types as constants
export const ACTIVITY_TYPES = {
  RUN: 'run',
  WALK: 'walk',
  CYCLE: 'cycle'
};

// Create the context
const ActivityModeContext = createContext(null);

// Custom hook to use the activity mode context
export const useActivityMode = () => {
  const context = useContext(ActivityModeContext);
  if (!context) {
    console.error('useActivityMode must be used within an ActivityModeProvider');
    // Return fallback object to prevent crashes
    return {
      mode: ACTIVITY_TYPES.RUN,
      setMode: () => console.warn('ActivityMode not initialized'),
      getActivityText: () => 'Run'
    };
  }
  return context;
};

// Provider component
export const ActivityModeProvider = ({ children }) => {
  // Initialize state from localStorage or default to 'run'
  const [mode, setMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem('activityMode');
      return savedMode && Object.values(ACTIVITY_TYPES).includes(savedMode) 
        ? savedMode 
        : ACTIVITY_TYPES.RUN;
    } catch (error) {
      console.error('Error initializing activity mode state:', error);
      return ACTIVITY_TYPES.RUN;
    }
  });

  // Save mode to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('activityMode', mode);
    } catch (error) {
      console.error('Error saving activity mode:', error);
    }
  }, [mode]);

  // Utility function to get the appropriate text based on current mode
  const getActivityText = (type) => {
    switch (type) {
      case 'start':
        return `Start ${mode === ACTIVITY_TYPES.RUN ? 'Run' : mode === ACTIVITY_TYPES.WALK ? 'Walk' : 'Cycle'}`;
      case 'header':
        return `${mode === ACTIVITY_TYPES.RUN ? 'Run' : mode === ACTIVITY_TYPES.WALK ? 'Walk' : 'Cycle'} with Nostr`;
      case 'recent':
        return `Recent ${mode === ACTIVITY_TYPES.RUN ? 'Runs' : mode === ACTIVITY_TYPES.WALK ? 'Walks' : 'Cycles'}`;
      case 'history':
        return `${mode === ACTIVITY_TYPES.RUN ? 'Run' : mode === ACTIVITY_TYPES.WALK ? 'Walk' : 'Cycle'} History`;
      default:
        return mode === ACTIVITY_TYPES.RUN ? 'Run' : mode === ACTIVITY_TYPES.WALK ? 'Walk' : 'Cycle';
    }
  };

  // Provide both the state and methods
  const value = {
    mode,
    setMode,
    getActivityText
  };

  return (
    <ActivityModeContext.Provider value={value}>
      {children}
    </ActivityModeContext.Provider>
  );
};

ActivityModeProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 