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
    
    // Try multiple approaches in order of preference
    // First try the native deep link approach which should work
    try {
      console.log('[AuthService] Attempting NativeAmberAuth (deep links)...');
      return await NativeAmberAuth.login();
    } catch (error) {
      console.log('[AuthService] NativeAmberAuth failed, trying AmberIntentService...', error.message);
      try {
        return await AmberIntentService.login();
      } catch (error2) {
        console.log('[AuthService] AmberIntentService failed, trying SimpleAmberAuth...', error2.message);
        try {
          return await SimpleAmberAuth.login();
        } catch (error3) {
          console.log('[AuthService] SimpleAmberAuth failed, trying DirectAmberAuth...', error3.message);
          try {
            return await DirectAmberAuth.login();
          } catch (error4) {
            console.log('[AuthService] DirectAmberAuth failed, trying SimpleAmberService...', error4.message);
            return await SimpleAmberService.login();
          }
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