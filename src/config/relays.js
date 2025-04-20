/**
 * Default relays for RUNSTR application
 */
export const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.current.fyi',
  'wss://nos.lol',
  'wss://relay.snort.social'
];

/**
 * Special relays for running groups and group chat
 */
export const GROUP_RELAYS = [
  'wss://groups.0xchat.com',
  ...RELAYS
];

/**
 * Relays focused on running and fitness content
 */
export const RUNNING_FOCUSED_RELAYS = [
  'wss://feeds.nostr.band/running', // Running-specific content
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

/**
 * Different relay sets for different environments
 */
export const ENVIRONMENT_RELAYS = {
  development: [
    'wss://relay.damus.io',
    'wss://nos.lol'
  ],
  test: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band'
  ],
  production: RELAYS
};

/**
 * Get relays appropriate for the current environment
 * @returns {string[]} Array of relay URLs
 */
export const getEnvironmentRelays = () => {
  // Use a safe way to detect environment that works in browsers
  const env = typeof window !== 'undefined' && window.ENV 
    ? window.ENV 
    : 'development';
  return ENVIRONMENT_RELAYS[env] || RELAYS;
}; 