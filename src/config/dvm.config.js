/**
 * RUNSTR DVM Configuration
 */

// Set different API URLs based on environment
const apiUrls = {
  development: 'http://localhost:3000',
  test: 'http://localhost:3000',
  production: 'https://api.runstr.com' // Replace with the actual production URL
};

// Determine current environment
const environment = process.env.NODE_ENV || 'development';

// DVM Configuration
const dvmConfig = {
  apiUrl: apiUrls[environment],
  dvmPubkey: process.env.REACT_APP_DVM_PUBKEY || '', // Can be set via environment variable
  relays: [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol'
  ],
  defaultLimit: 10,
  defaultTimeframe: 7 * 24 * 60 * 60, // 7 days in seconds
  useHttpApi: true, // Set to false to use Nostr protocol exclusively
};

export default dvmConfig; 