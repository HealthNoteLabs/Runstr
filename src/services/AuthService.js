/**
 * AuthService.js
 * Simplified authentication service using SimpleAmberAuth
 */

import SimpleAmberAuth from './SimpleAmberAuth.js';

/**
 * AuthService - Simple, unified authentication API
 */
export default class AuthService {
  /**
   * Login with Amber using simple Intent approach
   * @returns {Promise<string>} The user's public key
   */
  static async login() {
    console.log('[AuthService] Starting simple Amber login...');
    return await SimpleAmberAuth.login();
  }
  
  /**
   * Get the current user's public key
   * @returns {string|null} The public key or null if not authenticated
   */
  static getPublicKey() {
    return SimpleAmberAuth.getPublicKey();
  }
  
  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has a stored public key
   */
  static isAuthenticated() {
    return SimpleAmberAuth.isAuthenticated();
  }
  
  /**
   * Sign a Nostr event with Amber using simple Intent approach
   * @param {Object} event - The event to sign
   * @returns {Promise<Object>} The signed event
   */
  static async signEvent(event) {
    console.log('[AuthService] Signing event with simple Amber approach...');
    return await SimpleAmberAuth.signEvent(event);
  }
  
  /**
   * Logout - clear all authentication data
   */
  static logout() {
    SimpleAmberAuth.logout();
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