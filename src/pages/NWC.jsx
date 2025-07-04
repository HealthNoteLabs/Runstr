import { NWCWalletConnector } from '../components/NWCWalletConnector';
import { WalletDebugger } from '../components/WalletDebugger';

export const NWC = () => {
  return (
    <div className="nwc-wallet-page">
      {/* Header Card */}
      <div className="wallet-option nwc-header-card">
        <h2>⚡ Lightning Wallet (NWC)</h2>
        <p className="nwc-description">
          Connect your Lightning wallet using Nostr Wallet Connect (NWC). Send zaps and make instant Bitcoin payments 
          directly through your preferred Lightning wallet with global reach and instant settlement.
        </p>
      </div>

      <NWCWalletConnector />

      {/* Debug Component */}
      <WalletDebugger />

      {/* Features Info Card */}
      <div className="wallet-option nwc-features-card">
        <h3>⚡ Lightning Wallet Features</h3>
        <ul className="features-list">
          <li>🚀 Instant global payments</li>
          <li>💰 Ultra-low transaction fees</li>
          <li>🔗 Direct wallet integration via NWC</li>
          <li>⚡ Send/receive zaps in social feeds</li>
          <li>🌍 Compatible with any Lightning wallet</li>
          <li>🔒 Non-custodial wallet connection</li>
        </ul>
      </div>
    </div>
  );
};
