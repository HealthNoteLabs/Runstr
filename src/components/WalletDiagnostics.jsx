import { useState, useContext } from 'react';
import { WalletContext, CONNECTION_STATES } from '../contexts/WalletContext';
import './WalletDiagnostics.css';

export const WalletDiagnostics = () => {
  const { wallet, connectionState } = useContext(WalletContext);
  const [diagnosticResults, setDiagnosticResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Derive isConnected from connectionState
  const isConnected = connectionState === CONNECTION_STATES.CONNECTED;
  
  const runDiagnostics = async () => {
    setIsRunning(true);
    const results = [];
    
    // Test 1: Basic connection (from context)
    results.push({
      test: 'Wallet Connection (Context)',
      status: isConnected ? 'PASS' : 'FAIL',
      details: isConnected ? 'Wallet is connected via context' : 'Wallet is NOT connected via context'
    });
    
    if (wallet) {
      // Test 1b: Active connection check if context isConnected is false
      if (!isConnected) {
        try {
          const activeCheck = await wallet.checkConnection();
          results.push({
            test: 'Wallet Connection (Active Check)',
            status: activeCheck ? 'PASS' : 'FAIL',
            details: activeCheck ? 'Wallet actively connected now' : 'Active connection check failed'
          });
        } catch (error) {
          results.push({
            test: 'Wallet Connection (Active Check)',
            status: 'ERROR',
            details: `Active check error: ${error.message}`
          });
        }
      }
      
      // Test 2: Check connection method
      try {
        const connectionCheck = await wallet.checkConnection();
        results.push({
          test: 'Connection Check',
          status: connectionCheck ? 'PASS' : 'FAIL',
          details: connectionCheck ? 'Connection verified' : 'Connection check failed'
        });
      } catch (error) {
        results.push({
          test: 'Connection Check',
          status: 'ERROR',
          details: error.message
        });
      }
      
      // Test 3: Get balance
      try {
        const balance = await wallet.getBalance();
        results.push({
          test: 'Balance Check',
          status: 'PASS',
          details: `Balance: ${balance} sats`
        });
      } catch (error) {
        results.push({
          test: 'Balance Check',
          status: 'ERROR',
          details: error.message
        });
      }
      
      // Test 4: Generate test invoice
      try {
        const invoice = await wallet.generateInvoice(1, 'Diagnostic test');
        results.push({
          test: 'Invoice Generation',
          status: 'PASS',
          details: 'Successfully generated test invoice'
        });
      } catch (error) {
        results.push({
          test: 'Invoice Generation',
          status: 'ERROR',
          details: error.message
        });
      }
      
      // Test 5: Check zap support
      if (wallet.generateZapInvoice) {
        results.push({
          test: 'Zap Support',
          status: 'PASS',
          details: 'Wallet supports direct zap generation'
        });
      } else {
        results.push({
          test: 'Zap Support',
          status: 'INFO',
          details: 'Wallet uses LNURL fallback for zaps'
        });
      }
    }
    
    setDiagnosticResults(results);
    setIsRunning(false);
  };
  
  const enableDebugMode = () => {
    localStorage.setItem('debugZaps', 'true');
    alert('Zap debug mode enabled. Check browser console for detailed logs.');
  };
  
  const disableDebugMode = () => {
    localStorage.removeItem('debugZaps');
    alert('Zap debug mode disabled.');
  };
  
  return (
    <div className="wallet-diagnostics">
      <h3>Wallet Diagnostics</h3>
      <p className="diagnostic-note">Run these tests if you suspect issues with your wallet connection or zap functionality. Ensure your wallet is unlocked and responsive.</p>
      
      <div className="diagnostic-actions">
        <button 
          onClick={runDiagnostics} 
          disabled={isRunning || !wallet}
          className="run-diagnostics-btn"
        >
          {isRunning ? 'Running...' : 'Run Diagnostics'}
        </button>
        
        <button 
          onClick={enableDebugMode}
          className="debug-mode-btn"
        >
          Enable Zap Debug Mode
        </button>
        
        <button 
          onClick={disableDebugMode}
          className="debug-mode-btn"
        >
          Disable Debug Mode
        </button>
      </div>
      
      {diagnosticResults.length > 0 && (
        <div className="diagnostic-results">
          <h4>Results:</h4>
          {diagnosticResults.map((result, index) => (
            <div 
              key={index} 
              className={`diagnostic-result ${result.status.toLowerCase()}`}
            >
              <span className="test-name">{result.test}:</span>
              <span className={`status ${result.status.toLowerCase()}`}>{result.status}</span>
              <span className="details">{result.details}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="diagnostic-info">
        <p><strong>Tips for troubleshooting zap issues:</strong></p>
        <ul>
          <li>Make sure your wallet is connected (check the NWC tab)</li>
          <li>Ensure you have sufficient balance</li>
          <li>Try disconnecting and reconnecting your wallet</li>
          <li>Enable debug mode and check the browser console for detailed logs</li>
          <li>Some wallet providers may not support NIP-57 zaps</li>
        </ul>
      </div>
    </div>
  );
}; 