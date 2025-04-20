import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import * as storage from '../utils/storage';
import { isNativePlatform, showToast } from '../utils/platform';

// Create context
const MobileStorageContext = createContext(null);

/**
 * Custom hook to use the mobile storage context
 * @returns {Object} Storage methods and state
 */
export const useMobileStorage = () => {
  const context = useContext(MobileStorageContext);
  if (context === null) {
    throw new Error('useMobileStorage must be used within a MobileStorageProvider');
  }
  return context;
};

/**
 * Provider component for mobile storage
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Provider component
 */
export const MobileStorageProvider = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);

  // Initialize storage and migrate from localStorage if needed
  useEffect(() => {
    const setupStorage = async () => {
      try {
        // Initialize the storage cache
        await storage.initStorageCache();
        
        // Check if migration is needed (only on native platform)
        if (isNativePlatform) {
          const migrationStatus = await storage.migrateFromLocalStorage();
          setMigrationComplete(migrationStatus);
        } else {
          // Web platform doesn't need migration
          setMigrationComplete(true);
        }
        
        setIsReady(true);
      } catch (error) {
        console.error('Error setting up storage:', error);
        // Even on error, mark as ready but with potential limitations
        setIsReady(true);
      }
    };

    setupStorage();
  }, []);

  // Storage interface methods
  const getItem = async (key, defaultValue = null) => {
    try {
      const value = await storage.getItem(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return defaultValue;
    }
  };

  const getItemSync = (key, defaultValue = null) => {
    try {
      const value = storage.getItemSync(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      console.error(`Error getting item ${key} synchronously:`, error);
      return defaultValue;
    }
  };

  const getJSON = async (key, defaultValue = null) => {
    try {
      return await storage.getJSON(key, defaultValue);
    } catch (error) {
      console.error(`Error getting JSON for ${key}:`, error);
      return defaultValue;
    }
  };

  const setItem = async (key, value) => {
    try {
      await storage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting item ${key}:`, error);
      if (isNativePlatform) {
        showToast('Error saving data');
      }
      return false;
    }
  };

  const setItemSync = (key, value) => {
    try {
      storage.setItemSync(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting item ${key} synchronously:`, error);
      return false;
    }
  };

  const removeItem = async (key) => {
    try {
      await storage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing item ${key}:`, error);
      return false;
    }
  };

  const removeItemSync = (key) => {
    try {
      storage.removeItemSync(key);
      return true;
    } catch (error) {
      console.error(`Error removing item ${key} synchronously:`, error);
      return false;
    }
  };

  const clear = async () => {
    try {
      await storage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  };

  const getAllKeys = async () => {
    try {
      return await storage.keys();
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  };

  // Export the context value
  const contextValue = {
    isReady,
    migrationComplete,
    getItem,
    getItemSync,
    getJSON,
    setItem,
    setItemSync,
    removeItem,
    removeItemSync,
    clear,
    getAllKeys,
  };

  return (
    <MobileStorageContext.Provider value={contextValue}>
      {children}
    </MobileStorageContext.Provider>
  );
};

MobileStorageProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default MobileStorageContext; 