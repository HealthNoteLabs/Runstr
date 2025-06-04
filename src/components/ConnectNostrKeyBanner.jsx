import { useContext } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from '../contexts/NostrContext.tsx';

/**
 * Simple banner or inline button that asks the user to connect their Nostr key.
 * It adapts its label based on the detected signerType and listens to status updates.
 *
 * Usage:
 *   <ConnectNostrKeyBanner />
 *   <ConnectNostrKeyBanner inline />
 */
const ConnectNostrKeyBanner = ({ inline = false }) => {
  const { status, signerType, connectSigner } = useContext(NostrContext);

  if (status === 'ready') return null; // Already connected

  const isConnecting = status === 'connecting';

  let label = 'Connect Nostr Key';
  if (signerType === 'amber') label = 'Connect Amber Signer';
  else if (signerType === 'extension') label = 'Connect Nostr Extension';
  else if (signerType === 'privateKey') label = 'Load Saved Key';

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
      <button
        onClick={connectSigner}
        disabled={isConnecting}
        style={{
          background: '#3b82f6',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {isConnecting ? 'Connecting…' : label}
      </button>
    </div>
  );
};

ConnectNostrKeyBanner.propTypes = {
  inline: PropTypes.bool,
};

export default ConnectNostrKeyBanner; 