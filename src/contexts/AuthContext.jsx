import { createContext } from 'react';

export const AuthContext = createContext({
  profile: null,
  setProfile: () => {},
  wallet: null,
  setWallet: () => {}
});
