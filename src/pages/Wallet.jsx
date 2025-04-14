import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';

export const Wallet = () => {
  const navigate = useNavigate();
  const { defaultZapAmount, updateDefaultZapAmount } = useContext(NostrContext);
  const [zapAmountInput, setZapAmountInput] = useState(defaultZapAmount.toString());

  // Redirect to NWC page on component mount
  useEffect(() => {
    // Show message and redirect
    const redirectTimer = setTimeout(() => {
      navigate('/nwc');
    }, 3000);
    
    return () => clearTimeout(redirectTimer);
  }, [navigate]);

  // Set the zapAmountInput whenever defaultZapAmount changes
  useEffect(() => {
    setZapAmountInput(defaultZapAmount.toString());
  }, [defaultZapAmount]);

  const handleUpdateZapAmount = () => {
    if (zapAmountInput && parseInt(zapAmountInput, 10) > 0) {
      updateDefaultZapAmount(parseInt(zapAmountInput, 10));
    }
  };

  return (
    <div className="wallet-container">
      <div className="redirect-message">
        <h2>Lightning Wallet</h2>
        <p>The Cashu wallet has been removed. You will be redirected to the Bitcoin Connect page.</p>
        <p>You can use your connected Bitcoin wallet for zaps and donations.</p>
        <button onClick={() => navigate('/nwc')}>Go to Bitcoin Connect Now</button>
      </div>

      <div className="zap-settings-section">
        <h3>Zap Settings</h3>
        <div className="zap-amount-setting">
          <label htmlFor="defaultZapAmount">Default Zap Amount (sats):</label>
          <div className="input-with-button">
            <input
              id="defaultZapAmount"
              type="number"
              min="1"
              value={zapAmountInput}
              onChange={(e) => setZapAmountInput(e.target.value)}
              placeholder="Default zap amount in sats"
            />
            <button 
              onClick={handleUpdateZapAmount} 
              disabled={!zapAmountInput || parseInt(zapAmountInput, 10) <= 0}
              className="save-button"
            >
              Save
            </button>
          </div>
          <p className="current-setting">Current default: {defaultZapAmount} sats</p>
        </div>
      </div>
    </div>
  );
};
