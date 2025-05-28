import { useState, useContext, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from '../contexts/NostrContext';
import { registerPlugin } from '@capacitor/core';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

// Optional battery-optimisation plugin is loaded at runtime so tests / web build won't fail if it's absent
const ensureBatteryWhitelist = async () => {
  try {
    const platform = navigator.userAgent.toLowerCase().includes('android') ? 'android' : 'other';
    if (platform !== 'android') return;
    const { BatteryOptimization } = await import('@capawesome-team/capacitor-android-battery-optimization');
    if (!BatteryOptimization?.isIgnoringBatteryOptimizations) return;

    const status = await BatteryOptimization.isIgnoringBatteryOptimizations();
    if (!status?.value) {
      await BatteryOptimization.requestIgnoreBatteryOptimizations();
    }
  } catch (err) {
    // Gracefully ignore if plugin not available (e.g. web / test env)
    console.warn('Battery optimisation plugin not available or failed', err?.message || err);
  }
};

export const PermissionDialog = ({ onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState('');
  const { requestNostrPermissions, isAmberAvailable, connectionError } = useContext(NostrContext);
  
  const handleContinue = async () => {
    setIsProcessing(true);
    setError('');
    
    try {
      // Step 1: Request Nostr permissions
      setCurrentStep('Requesting Nostr permissions...');
      
      // This will show the Amber Signer dialog or browser extension
      if (window.nostr || isAmberAvailable) {
        const nostrSuccess = await requestNostrPermissions();
        if (!nostrSuccess) {
          console.warn('Failed to get Nostr permissions');
          
          // Show specific error message
          if (connectionError) {
            setError(connectionError);
          } else if (Platform.OS === 'android' && isAmberAvailable) {
            setError('Failed to connect to Amber. Please make sure Amber is open and try again.');
          } else {
            setError('Failed to get Nostr permissions. Please try again.');
          }
          
          setIsProcessing(false);
          return;
        }
      }
      
      // Step 2: Request location permissions
      setCurrentStep('Requesting location permissions...');
      
      // Request location permissions immediately after Amber permissions
      try {
        // Create a temporary watcher to trigger permission request
        // Use a unique ID for this temporary watcher
        const tempWatcherId = 'permissionRequest_' + Date.now();
        
        // Request location permissions using BackgroundGeolocation
        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            id: tempWatcherId,
            backgroundMessage: 'Runstr tracks your runs in the background',
            backgroundTitle: 'Runstr is active',
            requestPermissions: true,
            stale: false,
            distanceFilter: 10,
            foregroundService: true
          },
          (location, error) => {
            if (error) {
              console.error('Location permission error:', error);
              return;
            }
            console.log('Location permissions granted:', location);
          }
        );
        
        // Immediately remove the watcher as we only needed it for permissions
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
        
        // Step 3: Mark permissions as granted
        setCurrentStep('Setting up...');
        localStorage.setItem('permissionsGranted', 'true');
        
        // Success - close dialog
        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        console.error('Error requesting location permissions:', error);
        setError('Failed to get location permissions. Please check your device settings.');
      }
    } catch (error) {
      console.error('Error in permission flow:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
      setCurrentStep('');
    }
  };
  
  const getButtonText = () => {
    if (isProcessing) {
      return currentStep || 'Processing...';
    }
    
    if (Platform.OS === 'android' && isAmberAvailable) {
      return 'Connect with Amber';
    } else if (window.nostr) {
      return 'Connect with Nostr Extension';
    } else {
      return 'Continue';
    }
  };
  
  // Check if we should show connection status
  const showConnectionStatus = Platform.OS === 'android' && isAmberAvailable;
  const amberState = showConnectionStatus ? AmberAuth.getConnectionState() : null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-[#1a222e] rounded-lg p-6 m-4 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Welcome to Runstr!</h2>
        
        <p className="text-gray-300 mb-6">
          Runstr needs a few permissions to work properly:
        </p>
        
        <ul className="list-disc list-inside text-gray-400 mb-6 space-y-2">
          <li>
            <strong>Nostr Key Access:</strong> To save and share your running activities
            {showConnectionStatus && amberState && (
              <div className="ml-6 mt-1 text-sm">
                {amberState.isConnected ? (
                  <span className="text-green-500">✓ Amber connected</span>
                ) : (
                  <span className="text-gray-500">○ Not connected</span>
                )}
              </div>
            )}
          </li>
          <li>
            <strong>Location Access:</strong> To track your runs and calculate distance
          </li>
        </ul>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <button
          onClick={handleContinue}
          disabled={isProcessing}
          className={`w-full py-3 rounded-lg font-semibold transition-colors ${
            isProcessing 
              ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {getButtonText()}
        </button>
        
        {showConnectionStatus && amberState && !amberState.isConnected && !isProcessing && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            Make sure Amber is installed and open before continuing
          </p>
        )}
      </div>
    </div>
  );
};

PermissionDialog.propTypes = {
  onSuccess: PropTypes.func
}; 