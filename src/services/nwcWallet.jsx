import { getPublicKey } from 'nostr-tools';
import { webln } from '@getalby/sdk';
import { RELAYS } from '../utils/nostr';

export class NWCWallet {
  constructor() {
    this.secretKey = null;
    this.pubKey = null;
    this.relayUrl = null;
    this.walletPubKey = null;
  }

  async connect(connectionString) {
    try {
      const url = new URL(connectionString);

      if (url.protocol !== 'nostr+walletconnect:') {
        throw new Error('Invalid NWC URL protocol');
      }

      // Generate random bytes for secret key
      this.secretKey = new Uint8Array(32);
      crypto.getRandomValues(this.secretKey);
      this.pubKey = getPublicKey(this.secretKey);

      const params = new URLSearchParams(url.pathname);
      this.relayUrl = params.get('relay');
      this.walletPubKey = params.get('pubkey');

      if (!this.relayUrl || !this.walletPubKey) {
        throw new Error('Missing required NWC parameters');
      }

      // Initialize WebLN provider
      this.provider = new webln.NostrWebLNProvider({
        nostrWalletConnectUrl: connectionString
      });

      await this.provider.enable();
      return true;
    } catch (error) {
      console.error('NWC connection error:', error);
      throw error;
    }
  }

  async makePayment(paymentRequest) {
    try {
      if (!this.provider) {
        throw new Error('Wallet not connected');
      }

      const response = await this.provider.sendPayment(paymentRequest);
      return response;
    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  }

  async getBalance() {
    try {
      if (!this.provider) {
        throw new Error('Wallet not connected');
      }

      const response = await this.provider.getBalance();
      return response.balance;
    } catch (error) {
      console.error('Get balance error:', error);
      throw error;
    }
  }

  async generateZapInvoice(pubkey, amount = null, content = '') {
    try {
      if (!this.provider) {
        throw new Error('Wallet not connected');
      }

      // Use provided amount or get default from preferences
      let zapAmount = amount;
      if (!zapAmount) {
        try {
          // Use preference storage instead of localStorage following mobile refactoring
          const { Preferences } = await import('@capacitor/preferences');
          const { value } = await Preferences.get({ key: 'defaultZapAmount' });
          zapAmount = value ? parseInt(value, 10) : 1000;
        } catch (error) {
          // Fallback to default
          zapAmount = 1000;
          console.error('Error getting default zap amount:', error);
        }
      }

      const zapRequest = {
        kind: 9734,
        content: content,
        tags: [
          ['p', pubkey],
          ['amount', zapAmount.toString()],
          ['relays', ...RELAYS]
        ],
        created_at: Math.floor(Date.now() / 1000)
      };

      const signedZapRequest = await window.nostr.signEvent(zapRequest);
      const encodedZapRequest = btoa(JSON.stringify(signedZapRequest));

      const invoice = await this.provider.makeInvoice({
        amount: zapAmount,
        defaultMemo: `Zap for ${pubkey}`,
        zapRequest: encodedZapRequest
      });

      return invoice;
    } catch (error) {
      console.error('Generate zap invoice error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.provider) {
        await this.provider.disable();
      }
      this.provider = null;
      this.secretKey = null;
      this.pubKey = null;
      this.relayUrl = null;
      this.walletPubKey = null;
    } catch (error) {
      console.error('Disconnect error:', error);
      throw error;
    }
  }
}
