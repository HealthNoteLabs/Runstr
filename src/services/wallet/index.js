import { AlbyWallet } from '../albyWallet';
import { NDKWalletProvider, useNDKWallet } from '../../contexts/NDKWalletContext';
import { useWallet, CONNECTION_STATES } from '../../hooks/useWallet';
import {
  initWalletService,
  connectWallet,
  softDisconnectWallet,
  hardDisconnectWallet,
  checkWalletConnection,
  getWalletInstance,
  getConnectionState,
  subscribeToConnectionChanges,
  getWalletAPI
} from './WalletPersistenceService';

export { 
  AlbyWallet,
  NDKWalletProvider,
  useNDKWallet,
  useWallet,
  CONNECTION_STATES,
  initWalletService,
  connectWallet,
  softDisconnectWallet,
  hardDisconnectWallet,
  checkWalletConnection,
  getWalletInstance,
  getConnectionState,
  subscribeToConnectionChanges,
  getWalletAPI
}; 