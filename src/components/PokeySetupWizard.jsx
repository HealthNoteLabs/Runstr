/**
 * PokeySetupWizard
 * 
 * A step-by-step wizard to guide users through setting up Pokey
 * push notifications for real-time Nostr event notifications.
 */

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import EventNotificationService from '../services/EventNotificationService';
import { useNostr } from '../hooks/useNostr';

const PokeySetupWizard = ({ isOpen, onClose, onComplete }) => {
  const { publicKey, ndkReady } = useNostr();
  const [currentStep, setCurrentStep] = useState(1);
  const [pokeyStatus, setPokeyStatus] = useState(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [setupError, setSetupError] = useState(null);

  const totalSteps = 4;

  // Check Pokey status when wizard opens
  useEffect(() => {
    if (isOpen) {
      checkPokeyStatus();
    }
  }, [isOpen]);

  const checkPokeyStatus = async () => {
    try {
      const status = EventNotificationService.getPokeyStatus();
      setPokeyStatus(status);
      
      // If already enabled, skip to final step
      if (status.enabled) {
        setCurrentStep(4);
      }
    } catch (error) {
      console.warn('[PokeySetupWizard] Error checking status:', error);
      setPokeyStatus({ enabled: false, error: error.message });
    }
  };

  const handleTestConnection = async () => {
    if (!publicKey || !ndkReady) {
      setSetupError('Please ensure your Nostr account is connected first.');
      return;
    }

    setIsTestingConnection(true);
    setSetupError(null);

    try {
      // Enable Pokey notifications
      await EventNotificationService.enablePokeyNotifications(
        publicKey, 
        (notification) => {
          console.log('[PokeySetupWizard] Test notification received:', notification);
        }
      );
      
      // Check status after enabling
      const status = EventNotificationService.getPokeyStatus();
      setPokeyStatus(status);
      
      if (status.enabled) {
        setCurrentStep(4); // Success step
        if (onComplete) {
          onComplete(true);
        }
      } else {
        setSetupError('Pokey connection test failed. Please check your setup.');
      }
    } catch (error) {
      setSetupError(`Setup failed: ${error.message}`);
      setPokeyStatus({ enabled: false, error: error.message });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setSetupError(null);
    setPokeyStatus(null);
    if (onClose) {
      onClose();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h3>Welcome to Pokey Setup</h3>
            <p>
              Pokey enables real-time push notifications for your Nostr events, 
              replacing the need for constant polling and improving battery life.
            </p>
            <div className="benefits-list">
              <h4>Benefits:</h4>
              <ul>
                <li>✓ Instant notifications when team members request to join events</li>
                <li>✓ Reduced battery drain (no more 30-second polling)</li>
                <li>✓ Works even when Runstr is closed</li>
                <li>✓ Open source and privacy-focused</li>
              </ul>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h3>Install Pokey</h3>
            <p>First, you need to install Pokey on your Android device.</p>
            <div className="installation-options">
              <h4>Download Options:</h4>
              <div className="download-links">
                <a 
                  href="https://github.com/KoalaSat/pokey/releases" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="download-link"
                >
                  📱 GitHub Releases (APK)
                </a>
                <a 
                  href="https://apt.izzysoft.de/fdroid/index/apk/com.koalasat.pokey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="download-link"
                >
                  🤖 IzzyOnDroid F-Droid
                </a>
                <a 
                  href="https://zap.store/download" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="download-link"
                >
                  ⚡ Zap.Store
                </a>
              </div>
            </div>
            <div className="installation-note">
              <p><strong>Note:</strong> After installing, open Pokey and configure it with your Nostr relays and account.</p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h3>Configure Pokey</h3>
            <p>Configure Pokey with your Nostr account and relays:</p>
            <div className="configuration-steps">
              <ol>
                <li>Open Pokey app</li>
                <li>Add your Nostr account (same as Runstr)</li>
                <li>Configure the same relays you use in Runstr</li>
                <li>Enable notifications for the event types you want</li>
                <li>Return to this wizard and test the connection</li>
              </ol>
            </div>
            
            {publicKey && (
              <div className="account-info">
                <p><strong>Your Nostr Public Key:</strong></p>
                <code className="pubkey-display">{publicKey.slice(0, 16)}...{publicKey.slice(-16)}</code>
                <p className="help-text">Use this key when configuring Pokey</p>
              </div>
            )}
            
            <div className="test-section">
              <Button 
                onClick={handleTestConnection}
                disabled={isTestingConnection || !publicKey || !ndkReady}
                variant="default"
                size="default"
              >
                {isTestingConnection ? 'Testing Connection...' : 'Test Pokey Connection'}
              </Button>
              
              {setupError && (
                <div className="error-message">
                  <p>⚠️ {setupError}</p>
                </div>
              )}
              
              {pokeyStatus && !pokeyStatus.enabled && (
                <div className="status-message">
                  <p>📱 Pokey Status: Not connected</p>
                  <p className="help-text">Make sure Pokey is installed and configured with your Nostr account.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h3>🎉 Setup Complete!</h3>
            <p>Pokey notifications are now active for your Runstr account.</p>
            
            {pokeyStatus && (
              <div className="success-info">
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">Status:</span>
                    <span className="status-value success">✓ Active</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Active Listeners:</span>
                    <span className="status-value">{pokeyStatus.serviceStatus?.totalListeners || 0}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Supported Events:</span>
                    <span className="status-value">{pokeyStatus.serviceStatus?.supportedKinds?.length || 0}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="next-steps">
              <h4>What's Next:</h4>
              <ul>
                <li>You'll receive real-time notifications for team events</li>
                <li>Battery usage will be reduced (no more polling)</li>
                <li>Notifications work even when Runstr is closed</li>
                <li>You can disable Pokey anytime in Settings</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pokey-wizard-overlay">
      <div className="pokey-wizard-modal">
        <div className="wizard-header">
          <h2>Pokey Push Notifications Setup</h2>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>
        </div>
        
        <div className="wizard-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          <span className="progress-text">Step {currentStep} of {totalSteps}</span>
        </div>
        
        <div className="wizard-content">
          {renderStepContent()}
        </div>
        
        <div className="wizard-actions">
          {currentStep > 1 && currentStep < 4 && (
            <Button 
              onClick={handlePrevious} 
              variant="outline"
              size="default"
            >
              Previous
            </Button>
          )}
          
          {currentStep < 3 && (
            <Button 
              onClick={handleNext} 
              variant="default"
              size="default"
            >
              Next
            </Button>
          )}
          
          {currentStep === 4 && (
            <Button 
              onClick={handleClose} 
              variant="default"
              size="default"
            >
              Finish
            </Button>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .pokey-wizard-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        
        .pokey-wizard-modal {
          background: #1a1a1a;
          border-radius: 12px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          border: 1px solid #333;
        }
        
        .wizard-header {
          padding: 1.5rem;
          border-bottom: 1px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .wizard-header h2 {
          margin: 0;
          color: #fff;
          font-size: 1.25rem;
        }
        
        .close-button {
          background: none;
          border: none;
          color: #999;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }
        
        .close-button:hover {
          background: #333;
          color: #fff;
        }
        
        .wizard-progress {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #333;
        }
        
        .progress-bar {
          width: 100%;
          height: 4px;
          background: #333;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }
        
        .progress-fill {
          height: 100%;
          background: #007acc;
          transition: width 0.3s ease;
        }
        
        .progress-text {
          color: #999;
          font-size: 0.875rem;
        }
        
        .wizard-content {
          flex: 1;
          padding: 1.5rem;
          overflow-y: auto;
        }
        
        .step-content h3 {
          color: #fff;
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
        }
        
        .step-content h4 {
          color: #fff;
          margin: 1rem 0 0.5rem 0;
          font-size: 1rem;
        }
        
        .step-content p {
          color: #ccc;
          line-height: 1.5;
          margin-bottom: 1rem;
        }
        
        .benefits-list ul {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0;
        }
        
        .benefits-list li {
          color: #ccc;
          padding: 0.25rem 0;
        }
        
        .download-links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin: 0.5rem 0;
        }
        
        .download-link {
          color: #007acc;
          text-decoration: none;
          padding: 0.5rem;
          border: 1px solid #333;
          border-radius: 6px;
          background: #222;
          transition: background 0.2s;
        }
        
        .download-link:hover {
          background: #333;
        }
        
        .installation-note {
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 6px;
          padding: 1rem;
          margin-top: 1rem;
        }
        
        .configuration-steps ol {
          color: #ccc;
          padding-left: 1.5rem;
        }
        
        .configuration-steps li {
          margin-bottom: 0.5rem;
        }
        
        .account-info {
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 6px;
          padding: 1rem;
          margin: 1rem 0;
        }
        
        .pubkey-display {
          background: #333;
          padding: 0.5rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
          color: #fff;
          display: block;
          margin: 0.5rem 0;
          word-break: break-all;
        }
        
        .help-text {
          color: #999;
          font-size: 0.875rem;
          margin: 0.5rem 0 0 0;
        }
        
        .test-section {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #333;
        }
        
        .error-message {
          background: #3a1a1a;
          border: 1px solid #664444;
          border-radius: 6px;
          padding: 1rem;
          margin-top: 1rem;
          color: #ffaaaa;
        }
        
        .status-message {
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 6px;
          padding: 1rem;
          margin-top: 1rem;
        }
        
        .success-info {
          background: #1a3a1a;
          border: 1px solid #446644;
          border-radius: 6px;
          padding: 1rem;
          margin: 1rem 0;
        }
        
        .status-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin: 1rem 0;
        }
        
        .status-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .status-label {
          color: #999;
          font-size: 0.875rem;
        }
        
        .status-value {
          color: #fff;
          font-weight: 500;
        }
        
        .status-value.success {
          color: #4ade80;
        }
        
        .next-steps ul {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0;
        }
        
        .next-steps li {
          color: #ccc;
          padding: 0.25rem 0;
        }
        
        .wizard-actions {
          padding: 1.5rem;
          border-top: 1px solid #333;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
        }
        
        .wizard-actions button {
          flex: 1;
        }
        
        @media (max-width: 640px) {
          .pokey-wizard-modal {
            margin: 0.5rem;
            max-height: 95vh;
          }
          
          .status-grid {
            grid-template-columns: 1fr;
          }
          
          .wizard-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default PokeySetupWizard;