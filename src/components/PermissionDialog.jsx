import { useState, useContext, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from '../contexts/NostrContext';
import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

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

export const PermissionDialog = ({ onContinue, onCancel }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { requestNostrPermissions } = useContext(NostrContext);

  const handleContinue = async () => {
    setIsProcessing(true);
    
    try {
      // This will show the Amber Signer dialog
      if (window.nostr) {
        const nostrSuccess = await requestNostrPermissions();
        if (!nostrSuccess) {
          console.warn('Failed to get Nostr permissions');
        }
      }
      
      // Request location permissions immediately after Amber permissions
      try {
        // Request location permissions using BackgroundGeolocation
        await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Tracking your runs',
            backgroundTitle: 'Runstr',
            requestPermissions: true,
            distanceFilter: 10,
            highAccuracy: true,
            staleLocationThreshold: 30000,
            id: 'initialPermissionRequest'
          },
          (location, error) => {
            if (error) {
              console.warn('Location permission error:', error);
              return;
            }
            
            // Successfully got location, clean up this temporary watcher
            BackgroundGeolocation.removeWatcher({
              id: 'initialPermissionRequest'
            });
          }
        );
      } catch (locationError) {
        console.warn('Error requesting location permissions:', locationError);
      }
      
      // Request Notification permissions (Android 13+)
      try {
        if (Capacitor.getPlatform() === 'android') {
          const notificationPermStatus = await LocalNotifications.requestPermissions();
          console.log('Notification permission status:', notificationPermStatus.display);
          if (notificationPermStatus.display !== 'granted') {
            console.warn('Notification permission not granted. Foreground service notifications might not display.');
            // Optionally inform the user further, but don't block app usage solely for this.
          }
        }
      } catch (notifError) {
        console.warn('Error requesting notification permissions:', notifError);
      }
      
      // Ask user to whitelist the app from battery optimisations (GrapheneOS & Android)
      await ensureBatteryWhitelist();
      
      // Mark dialog as completed regardless of results
      localStorage.setItem('permissionsGranted', 'true');
      setIsVisible(false);
      if (onContinue) onContinue();
    } catch (error) {
      console.error('Error during permission request:', error);
      alert('There was an error requesting permissions. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleCancel = useCallback(() => {
    setIsVisible(false);
    if (onCancel) onCancel();
  }, [onCancel]);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) handleCancel();
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [handleCancel]);

  if (!isVisible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content permission-dialog">
        <h3>Welcome to Runstr!</h3>
        
        <p>This privacy-focused app keeps your data private and under your control.</p>
        
        <p>To use the app, we need these permissions:</p>
        
        <div className="permission-item">
          <h4>1. Location Access</h4>
          <p>This allows us to accurately track your runs, measure your distance, calculate your pace, and map your routes. Your location data is stored ONLY on your device and is never sold or shared with third parties.</p>
        </div>
        
        <div className="permission-item">
          <h4>2. Amber Signer Trust</h4>
          <p>The app requires basic permission in Amber Signer when prompted. This secure connection lets you safely share your runs on Nostr only when YOU choose to do so. Only minimal permissions are needed - you don&apos;t need to grant full trust.</p>
        </div>
        
        <p>We do not harvest or sell your data. Your privacy is our priority - all tracking information remains on your device unless you explicitly choose to share it.</p>
        
        <p>Without these permissions, key features like complete run tracking, route mapping, and optional social sharing won&apos;t be available.</p>
        
        <p className="permission-footer">Ready to run with Nostr?</p>
        
        <div className="modal-buttons">
          <button 
            className="primary-btn" 
            onClick={handleContinue}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Continue'}
          </button>
          <button 
            className="secondary-btn" 
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

PermissionDialog.propTypes = {
  onContinue: PropTypes.func,
  onCancel: PropTypes.func
}; 