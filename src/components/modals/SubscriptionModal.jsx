import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { QRCodeSVG } from 'qrcode.react';
import monthlySubscriptionService from '../../services/monthlySubscriptionService';
import { useNostr } from '../../hooks/useNostr';

const SubscriptionModal = ({ open, onClose, onSubscriptionSuccess }) => {
  const { publicKey } = useNostr();
  const [selectedTier, setSelectedTier] = useState(null);
  const [invoice, setInvoice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('tier-selection'); // 'tier-selection' | 'generating' | 'payment' | 'verifying' | 'success'
  const [debugInfo, setDebugInfo] = useState([]);
  const [showDebug, setShowDebug] = useState(false);

  const tiers = monthlySubscriptionService.getAllTiers();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open && !selectedTier) {
      setStep('tier-selection');
      setInvoice('');
      setError(null);
      setDebugInfo([]);
      setShowDebug(false);
    } else if (!open) {
      // Reset everything when modal closes
      setStep('tier-selection');
      setSelectedTier(null);
      setInvoice('');
      setError(null);
      setDebugInfo([]);
      setShowDebug(false);
    }
  }, [open, selectedTier]);

  const addDebugInfo = (info) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev, `${timestamp}: ${info}`]);
  };

  const handleTierSelection = (tier) => {
    setSelectedTier(tier);
    setError(null);
    if (publicKey) {
      generateInvoice(tier);
    } else {
      setError('No public key available. Please connect your Nostr account.');
    }
  };

  const generateInvoice = async (tier) => {
    if (!publicKey) {
      setError('No public key available. Please connect your Nostr account.');
      addDebugInfo('❌ No public key available');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('generating');
    setDebugInfo([]); // Clear previous debug info
    
    addDebugInfo('🔄 Starting subscription invoice generation...');
    addDebugInfo(`👤 User pubkey: ${publicKey.substring(0, 16)}...`);
    addDebugInfo(`📊 Selected tier: ${tier}`);

    try {
      addDebugInfo('💰 Calling monthlySubscriptionService...');
      const result = await monthlySubscriptionService.generateSubscriptionInvoice(publicKey, tier);
      
      addDebugInfo(`📋 Service result: ${JSON.stringify({
        success: result.success,
        hasInvoice: !!result.invoice,
        errorPreview: result.error?.substring(0, 100)
      })}`);
      
      if (result.success && result.invoice) {
        addDebugInfo('✅ Invoice generated successfully');
        addDebugInfo(`🧾 Invoice preview: ${result.invoice.substring(0, 50)}...`);
        setInvoice(result.invoice);
        setStep('payment');
      } else {
        addDebugInfo(`❌ Invoice generation failed: ${result.error}`);
        setError(result.error || 'Failed to generate payment invoice');
        setStep('payment'); // Allow retry and modal close
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate payment invoice';
      addDebugInfo(`💥 Exception thrown: ${errorMsg}`);
      setError(errorMsg);
      setStep('payment'); // Allow retry and modal close
    } finally {
      setIsGenerating(false);
      addDebugInfo('🏁 Invoice generation completed');
    }
  };

  const handleCopyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(invoice);
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Invoice copied to clipboard');
      } else {
        alert('Invoice copied to clipboard');
      }
    } catch {
      alert('Failed to copy invoice');
    }
  };

  const handlePaymentConfirmation = async () => {
    if (!publicKey) {
      setError('No public key available');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setStep('verifying');

    try {
      const result = await monthlySubscriptionService.verifyPaymentAndPublishReceipt(publicKey);
      
      if (result.success) {
        setStep('success');
        
        // Show success message
        if (window.Android && window.Android.showToast) {
          window.Android.showToast(`Welcome to RUNSTR ${selectedTier === 'captain' ? 'Captain' : 'Member'}! 🎉`);
        }
        
        // Call success callback after a brief delay to show success message
        setTimeout(() => {
          onSubscriptionSuccess();
          onClose();
        }, 2000);
      } else {
        setError(result.error || 'Failed to verify payment');
        setStep('payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify payment');
      setStep('payment');
    } finally {
      setIsVerifying(false);
    }
  };

  const deepLinks = [
    { name: 'Zeus', url: `zeusln://lightning?invoice=${invoice}` },
    { name: 'Phoenix', url: `phoenix://invoice?url=${invoice}` },
    { name: 'CoinOS', url: `https://coinos.io/lightning/invoice/${invoice}` },
  ];

  const getModalContent = () => {
    switch (step) {
      case 'tier-selection':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Choose Your Subscription
              </h3>
              <p className="text-sm text-text-secondary">
                Select a tier to unlock automatic rewards and features
              </p>
            </div>

            <div className="space-y-3">
              {/* Member Tier */}
              <div 
                onClick={() => handleTierSelection('member')}
                className="border border-border-secondary rounded-lg p-4 cursor-pointer hover:border-primary hover:bg-bg-tertiary/50 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-text-primary">{tiers.MEMBER.name}</h4>
                  <span className="text-primary font-bold">{tiers.MEMBER.price.toLocaleString()} sats/month</span>
                </div>
                <ul className="text-sm text-text-secondary space-y-1">
                  {tiers.MEMBER.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-400 mr-2">•</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Captain Tier */}
              <div 
                onClick={() => handleTierSelection('captain')}
                className="border-2 border-primary rounded-lg p-4 cursor-pointer hover:bg-primary/5 transition-all relative"
              >
                <div className="absolute -top-2 left-4 bg-primary text-bg-primary text-xs px-2 py-1 rounded">
                  RECOMMENDED
                </div>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-text-primary">{tiers.CAPTAIN.name}</h4>
                  <span className="text-primary font-bold">{tiers.CAPTAIN.price.toLocaleString()} sats/month</span>
                </div>
                <ul className="text-sm text-text-secondary space-y-1">
                  {tiers.CAPTAIN.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-400 mr-2">•</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-xs text-text-muted text-center mt-4">
              Monthly subscription • Cancel anytime • Automatic rewards
            </div>
          </div>
        );

      case 'generating':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-text-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-text-secondary">
              Generating your {selectedTier === 'captain' ? 'Captain' : 'Member'} subscription invoice...
            </p>
          </div>
        );

      case 'payment':
        const tierConfig = monthlySubscriptionService.getSubscriptionTier(selectedTier);
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {tierConfig.name} Subscription - {tierConfig.price.toLocaleString()} sats/month
              </h3>
              <p className="text-sm text-text-secondary mb-1">
                Monthly subscription with automatic rewards
              </p>
              <p className="text-xs text-text-muted">
                Expires 30 days from payment • Automatic daily rewards
              </p>
            </div>

            <div className="flex justify-center">
              <QRCodeSVG value={invoice} size={220} bgColor="#1f2937" fgColor="#fff" />
            </div>

            <div className="space-y-2">
              <p 
                className="break-all text-xs bg-bg-tertiary p-2 rounded-md select-all cursor-pointer border border-border-secondary" 
                onClick={handleCopyInvoice}
              >
                {invoice}
              </p>
              <button 
                onClick={handleCopyInvoice} 
                className="w-full bg-bg-tertiary hover:bg-bg-primary text-text-primary text-sm py-2 rounded-md border border-border-secondary"
              >
                📋 Copy Invoice
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {deepLinks.map(dl => (
                <a 
                  key={dl.name} 
                  href={dl.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-center text-xs bg-primary text-text-primary hover:bg-primary/80 py-2 rounded-md"
                >
                  {dl.name}
                </a>
              ))}
            </div>

            <button 
              onClick={handlePaymentConfirmation}
              disabled={isVerifying}
              className="w-full bg-text-primary text-bg-primary hover:bg-text-secondary py-3 rounded-md font-semibold disabled:opacity-50"
            >
              {isVerifying ? 'Verifying Payment...' : '✅ I have paid'}
            </button>

            <button 
              onClick={() => setStep('tier-selection')}
              className="w-full bg-bg-tertiary hover:bg-bg-primary text-text-secondary text-sm py-2 rounded-md border border-border-secondary"
            >
              ← Change Tier
            </button>
          </div>
        );

      case 'verifying':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-text-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-text-secondary">Verifying your payment...</p>
            <p className="text-xs text-text-muted">Publishing subscription receipt to Nostr...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-3xl">🎉</span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Welcome, {selectedTier === 'captain' ? 'Captain' : 'Member'}!
              </h3>
              <p className="text-text-secondary">
                Your subscription is active and ready for rewards!
              </p>
              <p className="text-xs text-text-muted mt-2">
                Complete daily streaks to earn automatic rewards
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    switch (step) {
      case 'tier-selection':
        return 'RUNSTR Subscription';
      case 'generating':
      case 'payment':
        return `${selectedTier === 'captain' ? 'Captain' : 'Member'} Subscription`;
      case 'verifying':
        return 'Processing Payment';
      case 'success':
        return 'Subscription Active!';
      default:
        return 'RUNSTR Subscription';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />

        <div className="relative bg-bg-secondary text-text-primary p-6 rounded-lg shadow-xl w-full max-w-sm mx-auto space-y-4 z-10 border border-border-secondary">
          <div className="flex justify-between items-center">
            <Dialog.Title className="text-lg font-semibold">
              {getModalTitle()}
            </Dialog.Title>
            <button 
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary"
              disabled={step === 'verifying'}
            >
              ✕
            </button>
          </div>

          {getModalContent()}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-md">
              {error}
              {step === 'payment' && (
                <button 
                  onClick={() => generateInvoice(selectedTier)}
                  className="ml-2 underline hover:no-underline"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {/* Debug Panel */}
          {debugInfo.length > 0 && (
            <div className="border-t border-border-secondary pt-4">
              <button 
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-2 mb-2"
              >
                <span>🔍 Debug Info ({debugInfo.length} events)</span>
                <span className={`transform transition-transform ${showDebug ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              
              {showDebug && (
                <div className="bg-bg-tertiary border border-border-secondary rounded-md p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-mono space-y-1">
                    {debugInfo.map((info, index) => (
                      <div key={index} className="text-text-secondary break-all">
                        {info}
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => navigator.clipboard?.writeText(debugInfo.join('\n'))}
                    className="text-xs text-primary hover:text-primary/80 mt-2"
                  >
                    📋 Copy Debug Log
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default SubscriptionModal;