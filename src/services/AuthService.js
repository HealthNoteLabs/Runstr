/**
 * AuthService.js
 * Authentication service using proper Android Intent-based Amber integration
 */

import AmberIntentService from './AmberIntentService.js';

/**
 * AuthService - Simple, unified authentication API
 */
export default class AuthService {
  /**
   * Login with Amber using proper Android Intent approach
   * @returns {Promise<string>} The user's public key
   */
  static async login() {
    console.log('[AuthService] Starting Intent-based Amber login...');
    return await AmberIntentService.login();
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