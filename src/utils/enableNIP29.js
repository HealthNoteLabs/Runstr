/**
 * NIP29 Feature Enable Utility
 * 
 * This utility script helps users enable NIP29 functionality.
 * It can be imported and called from the console or used as a utility function.
 */

/**
 * Enable NIP29 functionality in the app
 * @param {boolean} enabled - Whether to enable or disable NIP29 (default: true)
 * @returns {boolean} Success status
 */
export function enableNIP29(enabled = true) {
  try {
    // Set the feature flag in localStorage
    localStorage.setItem('nostr_groups_enabled', enabled ? 'true' : 'false');
    
    console.log(`NIP29 functionality ${enabled ? 'enabled' : 'disabled'}.`);
    console.log('Please refresh the page for changes to take effect.');
    
    return true;
  } catch (error) {
    console.error('Error enabling NIP29:', error);
    return false;
  }
}

/**
 * Check if NIP29 is enabled
 * @returns {boolean} Whether NIP29 is enabled
 */
export function isNIP29Enabled() {
  return localStorage.getItem('nostr_groups_enabled') === 'true';
}

// Export a default function for easier use in console
export default function toggleNIP29() {
  const currentStatus = isNIP29Enabled();
  return enableNIP29(!currentStatus);
}

// Provide usage instructions when the file is loaded
console.log(`
NIP29 Utility loaded.
Usage:
  - Check status: isNIP29Enabled()
  - Enable: enableNIP29(true)
  - Disable: enableNIP29(false)
  - Toggle: toggleNIP29()
`); 