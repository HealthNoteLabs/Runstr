import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Create the context
const ActivityTypeContext = createContext(null);

// Custom hook to use the activity type context
export const useActivityType = () => {
  const context = useContext(ActivityTypeContext);
  if (!context) {
    console.error('useActivityType must be used within an ActivityTypeProvider');
    // Return a fallback with default values
    return {
      activityType: 'run',
      setActivityType: () => console.warn('ActivityType not initialized'),
      getActivityTypeLabel: () => 'Run'
    };
  }
  return context;
};

// Provider component
export const ActivityTypeProvider = ({ children }) => {
  const [activityType, setActivityType] = useState(() => {
    try {
      return localStorage.getItem('activityType') || 'run';
    } catch (error) {
      console.error('Error loading activity type:', error);
      return 'run';
    }
  });

  // Update local storage when activity type changes
  useEffect(() => {
    try {
      localStorage.setItem('activityType', activityType);
    } catch (error) {
      console.error('Error saving activity type:', error);
    }
  }, [activityType]);

  // Helper function to get capitalized label for the activity type
  const getActivityTypeLabel = (type = activityType) => {
    const label = type || 'run';
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const value = {
    activityType,
    setActivityType,
    getActivityTypeLabel
  };

  return (
    <ActivityTypeContext.Provider value={value}>
      {children}
    </ActivityTypeContext.Provider>
  );
};

ActivityTypeProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 