import { useState, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from '../contexts/NostrContext';
import { useActivityType } from '../contexts/ActivityTypeContext';
import { registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
const StepCounter = registerPlugin('StepCounter');

export const PermissionDialog = ({ onContinue, onCancel }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { requestNostrPermissions } = useContext(NostrContext);
  const { getActivityTypeLabel, activityType } = useActivityType();
  const activityLabel = getActivityTypeLabel();
  const activityLabelLower = activityLabel.toLowerCase();
  const isWalkMode = activityType === 'walk';

  const handleContinue = async () => {
    setIsProcessing(true);
    
    try {
      // Request Nostr permissions
      await requestNostrPermissions();
      
      // Request appropriate tracking permissions based on activity type
      if (isWalkMode) {
        // For walking, request step counter permission
        try {
          // Try to start step counter to trigger permission request
          await StepCounter.startTracking();
          // Stop it immediately after permission is granted
          await StepCounter.stopTracking();
        } catch (error) {
          console.error('Error requesting step counter permission:', error);
          // Continue anyway, as the step counter might not be available on all devices
        }
      }
      
      // Always request location permissions as they're needed for both modes
      try {
        await BackgroundGeolocation.requestPermissions();
      } catch (error) {
        console.error('Error requesting location permissions:', error);
        setIsProcessing(false);
        return; // Don't proceed if location permission is denied
      }
      
      // All permissions granted, proceed
      setIsVisible(false);
      if (onContinue) onContinue();
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setIsVisible(false);
    if (onCancel) onCancel();
  };

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
          <p>This allows us to accurately track your {activityLabelLower}s, measure your distance, calculate your pace, and map your routes. Your location data is stored ONLY on your device and is never sold or shared with third parties.</p>
        </div>
        
        <div className="permission-item">
          <h4>2. Amber Signer Trust</h4>
          <p>The app requires basic permission in Amber Signer when prompted. This secure connection lets you safely share your {activityLabelLower}s on Nostr only when YOU choose to do so. Only minimal permissions are needed - you don&apos;t need to grant full trust.</p>
        </div>
        
        <p>We do not harvest or sell your data. Your privacy is our priority - all tracking information remains on your device unless you explicitly choose to share it.</p>
        
        <p>Without these permissions, key features like complete {activityLabelLower} tracking, route mapping, and optional social sharing won&apos;t be available.</p>
        
        <p className="permission-footer">Ready to {activityLabelLower} with Nostr?</p>
        
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