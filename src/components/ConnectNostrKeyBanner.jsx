import { useContext } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from '../contexts/NostrContext.jsx';

/**
 * Simple banner or inline button that asks the user to connect with Amber.
 * This app uses Amber-only authentication for enhanced security.
 *
 * Usage:
 *   <ConnectNostrKeyBanner />
 *   <ConnectNostrKeyBanner inline />
 */
const ConnectNostrKeyBanner = ({ inline = false }) => {
  const { publicKey, signerAvailable, connectSigner } = useContext(NostrContext);

  if (publicKey && signerAvailable) return null; // Already connected

  const isConnecting = false; // We'll implement this state later if needed

  const label = 'Connect with Amber';

  return (
    <div
      className={inline ? 'nostr-connect-inline' : 'nostr-connect-banner'}
      style={{
        display: 'flex',
        justifyContent: inline ? 'flex-start' : 'center',
        alignItems: 'center',
        margin: inline ? '4px 0' : '12px 0',
      }}
    >
      <div className="flex flex-col items-center">
        <button
          onClick={connectSigner}
          disabled={isConnecting}
          className="bg-primary hover:bg-primary-hover text-text-primary px-4 py-2 rounded border-none cursor-pointer disabled:opacity-50 font-medium"
        >
          {isConnecting ? 'Connecting…' : label}
        </button>
        {!inline && (
          <p className="text-xs text-text-muted mt-2 text-center max-w-xs">
            This app uses Amber for secure Nostr authentication. Install Amber from GitHub if you haven't already.
          </p>
        )}
      </div>
    </div>
  );
};

ConnectNostrKeyBanner.propTypes = {
  inline: PropTypes.bool,
};

export default ConnectNostrKeyBanner; 