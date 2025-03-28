import { createContext } from 'react';

// Create the Nostr context with default values
export const NostrContext = createContext({
  publicKey: null,
  isNostrReady: false,
  requestNostrPermissions: async () => false,
  defaultZapAmount: 1000,
  updateDefaultZapAmount: () => {}
});
