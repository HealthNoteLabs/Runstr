import { registerPlugin } from '@capacitor/core';

export interface AmberIntentResult {
  pubkey?: string;
  package?: string;
  signedEvent?: string;
  signature?: string;
  eventId?: string;
  error?: string;
}

export interface AmberInstallationResult {
  installed: boolean;
  foundApps?: number;
  packageFound?: boolean;
}

export interface AmberDebugResult {
  foundApps: number;
  launchAttempted?: boolean;
  launchError?: string;
}

export interface AmberIntentPlugin {
  getPublicKey(options: { permissions: string }): Promise<AmberIntentResult>;
  signEvent(options: { 
    event: string; 
    currentUser: string; 
    id: string; 
    package?: string;
  }): Promise<AmberIntentResult>;
  checkAmberInstalled(): Promise<AmberInstallationResult>;
  debugIntent(): Promise<AmberDebugResult>;
}

const AmberIntent = registerPlugin<AmberIntentPlugin>('AmberIntent');

export { AmberIntent };