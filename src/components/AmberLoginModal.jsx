/**
 * AmberLoginModal.jsx
 * Simple, clean login modal for Amber authentication
 * 
 * Replaces the complex PermissionDialog with a focused auth experience
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import AuthService from '../services/AuthService';

export const AmberLoginModal = ({ onSuccess, onCancel }) => {
  const [isLogging, setIsLogging] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setIsLogging(true);
    setError(null);
    
    try {
      const pubkey = await AuthService.login();
      
      if (pubkey) {
        console.log('[AmberLoginModal] Successfully authenticated:', pubkey.substring(0, 8) + '...');
        onSuccess(pubkey);
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (err) {
      console.error('[AmberLoginModal] Login error:', err);
      
      // User-friendly error messages
      let errorMessage = 'Authentication failed. Please try again.';
      if (err.message.includes('not found') || err.message.includes('Activity not found')) {
        errorMessage = 'Amber app not found. Please install Amber and try again.';
      } else if (err.message.includes('timeout') || err.message.includes('timed out')) {
        errorMessage = 'Authentication timed out. Please make sure Amber is running and try again.';
      } else if (err.message.includes('cancelled')) {
        errorMessage = 'Authentication was cancelled.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-primary rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to Runstr</h2>
          <p className="text-text-secondary">Sign in with Amber to start tracking your runs</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-error-light border border-error rounded-lg p-3 mb-4">
            <p className="text-error text-sm text-center">{error}</p>
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={isLogging}
          className={`
            w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200
            ${isLogging 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95'
            }
          `}
        >
          {isLogging ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Connecting to Amber...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Login with Amber
            </div>
          )}
        </button>

        {/* Info Text */}
        <div className="mt-4 text-center">
          <p className="text-text-secondary text-sm mb-2">
            Amber is a secure Nostr key manager for Android
          </p>
          <a 
            href="https://github.com/greenart7c3/Amber" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary text-sm hover:underline"
          >
            Don't have Amber? Install it here
          </a>
        </div>

        {/* Cancel Button */}
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isLogging}
            className="w-full mt-3 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

AmberLoginModal.propTypes = {
  onSuccess: PropTypes.func.isRequired,
  onCancel: PropTypes.func
};

export default AmberLoginModal;