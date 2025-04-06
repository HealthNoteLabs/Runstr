import { createContext } from 'react';

// Create the Nostr context with default values
export const NostrContext = createContext({
  publicKey: null,
  isNostrReady: false,
  isAmberAvailable: false,
  isLoading: false,
  error: null,
  requestNostrPermissions: async () => false,
  signEvent: async () => {},
  defaultZapAmount: 1000,
  updateDefaultZapAmount: () => {},
  resetError: () => {}
});
