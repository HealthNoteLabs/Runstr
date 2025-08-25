/**
 * AuthService.js
 * Authentication service using proper Android Intent-based Amber integration
 */

import AmberIntentService from './AmberIntentService.js';
import SimpleAmberService from './SimpleAmberService.js';
import SimpleAmberAuth from './SimpleAmberAuth.js';
import DirectAmberAuth from './DirectAmberAuth.js';
import NativeAmberAuth from './NativeAmberAuth.js';

/**
 * AuthService - Simple, unified authentication API
 */
export default class AuthService {
  /**
   * Login with Amber using proper Android Intent approach
   * @returns {Promise<string>} The user's public key
   */
  static async login() {
    console.log('[AuthService] Starting Amber login...');
    
    // Try native deep link approach first (this should work)
    try {
      console.log('[AuthService] Attempting NativeAmberAuth (deep links)...');
      return await NativeAmberAuth.login();
    } catch (error) {
      console.log('[AuthService] NativeAmberAuth failed:', error.message);
      
      // Try the plugin approaches as backup
      try {
        console.log('[AuthService] Trying AmberIntentService...');
        return await AmberIntentService.login();
      } catch (error2) {
        console.log('[AuthService] AmberIntentService failed:', error2.message);
        
        try {
          console.log('[AuthService] Trying SimpleAmberAuth...');
          return await SimpleAmberAuth.login();
        } catch (error3) {
          console.log('[AuthService] All automatic methods failed:', error3.message);
          throw new Error('Amber authentication failed. Please ensure Amber is installed and try again.');
        }
      }
    }
  }
  
  /**
   * Get the current user's public key
   * @returns {string|null} The public key or null if not authenticated
   */
  static getPublicKey() {
    return AmberIntentService.getPublicKey();
  }
  
  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has a stored public key
   */
  static isAuthenticated() {
    return AmberIntentService.isAuthenticated();
  }
  
  /**
   * Sign a Nostr event with Amber using proper Android Intent approach
   * @param {Object} event - The event to sign
   * @returns {Promise<Object>} The signed event
   */
  static async signEvent(event) {
    console.log('[AuthService] Signing event with Intent-based Amber approach...');
    return await AmberIntentService.signEvent(event);
  }
  
  /**
   * Logout - clear all authentication data
   */
  static logout() {
    AmberIntentService.logout();
    console.log('[AuthService] User logged out');
  }
  
  /**
   * Get the storage key used for the public key (for migration purposes)
   * @returns {string} The storage key
   */
  static getStorageKey() {
    return 'runstr_user_pubkey';
  }
}