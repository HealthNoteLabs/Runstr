import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { getLnurlForTrack } from '../utils/wavlake';
import PropTypes from 'prop-types';

export const FloatingMusicPlayer = () => {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrevious
  } = useAudioPlayer();
  
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [zapStatus, setZapStatus] = useState({ loading: false, success: false, error: null });
  const navigate = useNavigate();
  
  // For progress tracking (simplified for this implementation)
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef(null);
  
  useEffect(() => {
    // Simulate progress updates when playing
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        setProgress(prev => (prev >= 100 ? 0 : prev + 0.5));
      }, 1000);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }
    
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying]);

  if (!currentTrack) return <span></span>;

  // Handle zap function - sends Bitcoin to the artist
  const handleZapArtist = async (e) => {
    if (e) e.stopPropagation(); // Prevent expanding/collapsing the player
    
    if (!currentTrack) return;
    if (!wallet || !wallet.isEnabled()) {
      setZapStatus({ 
        loading: false, 
        success: false, 
        error: 'Wallet not connected' 
      });
      
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 3000);
      return;
    }
    
    try {
      setZapStatus({ loading: true, success: false, error: null });

      // Get the LNURL for the current track
      const lnurlString = await getLnurlForTrack(currentTrack.id);
      console.log('[WavlakeZap] Got LNURL for track:', lnurlString);
      
      // LNURL Pay Flow - Similar to Nostr zaps but simplified for Wavlake
      
      // 1. First decode the bech32 encoded LNURL to get the actual URL
      // Note: In a real implementation, you should use a proper bech32 decoder
      // For this example, assuming lnurlString is already a valid URL or LNURL
      let lnurlEndpoint;
      if (lnurlString.startsWith('http')) {
        // Already a URL (less common but possible)
        lnurlEndpoint = lnurlString;
      } else if (lnurlString.startsWith('lnurl')) {
        // Try to decode the LNURL (very basic approach)
        try {
          // This is a simplified approach - in a real app use bech32 library
          // Most wallets already have built-in LNURL handling, but we're implementing the flow here
          // const decoded = lnurlString.toLowerCase().replace('lnurl', '');
          // In a real implementation: const decoded = bech32.decode(lnurlString, 1023);
          // For now, we're assuming it's either already a URL or will be handled by wallet
          console.log('[WavlakeZap] This is a bech32 LNURL, would need proper decoding');
          // For this POC, if it's a bech32 LNURL, we'll try using it directly with the wallet
          // Most wallet implementations can handle this
          const result = await wallet.makePayment(lnurlString);
          console.log('[WavlakeZap] Payment result:', result);
          
          setZapStatus({ loading: false, success: true, error: null });
          setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 3000);
          return;
        } catch (decodeError) {
          console.error('[WavlakeZap] Error decoding LNURL:', decodeError);
          throw new Error('Invalid LNURL format');
        }
      } else {
        throw new Error('Invalid LNURL format');
      }
      
      // 2. Make a request to the LNURL service endpoint
      console.log('[WavlakeZap] Requesting payment info from:', lnurlEndpoint);
      const response = await fetch(lnurlEndpoint);
      if (!response.ok) {
        throw new Error(`LNURL endpoint error: ${response.status} ${response.statusText}`);
      }
      
      // 3. Parse the response to get the callback URL and other parameters
      const lnurlPayData = await response.json();
      console.log('[WavlakeZap] LNURL-pay metadata:', lnurlPayData);
      
      if (!lnurlPayData.callback) {
        console.error('[WavlakeZap] Invalid LNURL-pay response - missing callback URL:', lnurlPayData);
        throw new Error('Invalid LNURL-pay response: missing callback URL');
      }
      
      // 4. Construct the callback URL with amount
      const callbackUrl = new URL(lnurlPayData.callback);
      const amount = defaultZapAmount * 1000; // convert sats to millisats
      
      // Check if amount is within min/max bounds
      if (
        amount < lnurlPayData.minSendable ||
        amount > lnurlPayData.maxSendable
      ) {
        throw new Error(
          `Amount must be between ${lnurlPayData.minSendable / 1000} and ${lnurlPayData.maxSendable / 1000} sats`
        );
      }
      
      callbackUrl.searchParams.append('amount', amount);
      
      // Add comment if allowed
      if (lnurlPayData.commentAllowed && lnurlPayData.commentAllowed > 0) {
        const comment = `Zap for ${currentTrack.title} by ${currentTrack.artist || 'Unknown Artist'} via RUNSTR app! ⚡️`;
        callbackUrl.searchParams.append('comment', comment);
      }
      
      console.log('[WavlakeZap] Callback URL:', callbackUrl.toString());
      
      // 5. Request an invoice from the callback URL
      const invoiceResponse = await fetch(callbackUrl);
      if (!invoiceResponse.ok) {
        throw new Error(`Invoice request failed: ${invoiceResponse.status} ${invoiceResponse.statusText}`);
      }
      
      // 6. Parse the invoice data to get the payment request
      const invoiceData = await invoiceResponse.json();
      console.log('[WavlakeZap] Invoice data:', invoiceData);
      
      if (!invoiceData.pr) {
        console.error('[WavlakeZap] Invalid LNURL-pay response - missing payment request:', invoiceData);
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }
      
      // 7. Pay the invoice
      console.log('[WavlakeZap] Paying invoice...');
      await wallet.makePayment(invoiceData.pr);
      console.log('[WavlakeZap] Payment successful!');
      
      setZapStatus({ 
        loading: false, 
        success: true, 
        error: null 
      });
      
      // Clear success message after a few seconds
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 3000);
    } catch (error) {
      console.error('[WavlakeZap] Error zapping artist:', error);
      setZapStatus({ 
        loading: false, 
        success: false, 
        error: typeof error === 'string' ? error : error.message || 'Failed to zap' 
      });
      
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 3000);
    }
  };

  // Custom Progress Bar Component
  const ProgressBar = ({ value }) => (
    <div className="relative w-full h-1 bg-gray-700 rounded-full cursor-pointer">
      <div 
        className="absolute top-0 left-0 h-full rounded-full bg-[#646cff]" 
        style={{ width: `${value}%` }}
      />
    </div>
  );
  
  ProgressBar.propTypes = {
    value: PropTypes.number.isRequired
  };
  
  // Format time (simplified as we don't have actual duration)
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed z-50 left-1/2 top-4 transform -translate-x-1/2 w-full max-w-md px-2">
      {expanded ? (
        <div className="rounded-xl shadow-lg border border-gray-700 bg-[#1a222e]/95 backdrop-blur-md p-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-gray-800 overflow-hidden flex items-center justify-center border border-gray-700">
              {currentTrack.artwork ? (
                <img 
                  src={currentTrack.artwork} 
                  alt="cover art" 
                  className="object-cover w-full h-full" 
                />
              ) : (
                <div className="text-gray-400 text-lg">♪</div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base text-white truncate">
                {currentTrack.title}
              </div>
              <div className="text-sm text-gray-400 truncate">
                {currentTrack.artist || 'Unknown Artist'}
              </div>
            </div>
            
            <button 
              onClick={() => setExpanded(false)} 
              className="text-[#646cff] hover:text-[#535bf2] bg-transparent border-none p-2 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
          
          <div className="mt-4 flex flex-col gap-2">
            <ProgressBar value={progress} />
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{formatTime(Math.floor(progress * 3))}</span>
              <span>{formatTime(300)}</span>
            </div>
          </div>
          
          <div className="flex justify-center items-center gap-6 mt-3">
            <button 
              onClick={playPrevious} 
              className="text-[#646cff] hover:text-[#535bf2] bg-transparent border-none p-2 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            
            <button 
              onClick={togglePlayPause} 
              className="bg-[#646cff] hover:bg-[#535bf2] text-white w-12 h-12 rounded-full flex items-center justify-center"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              )}
            </button>
            
            <button 
              onClick={playNext} 
              className="text-[#646cff] hover:text-[#535bf2] bg-transparent border-none p-2 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
            
            <button 
              onClick={handleZapArtist} 
              className="bg-[#646cff] hover:bg-[#535bf2] text-white p-2 rounded-full"
              disabled={zapStatus.loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          </div>
          
          {zapStatus.loading && <p className="text-xs text-blue-400 mt-3 text-center">Sending {defaultZapAmount} sats...</p>}
          {zapStatus.success && <p className="text-xs text-green-400 mt-3 text-center">Zap sent! ⚡️</p>}
          {zapStatus.error && <p className="text-xs text-red-400 mt-3 text-center">{zapStatus.error}</p>}
          
          <div className="flex justify-between items-center mt-3">
            <button onClick={() => navigate('/music')} className="text-xs text-[#646cff]">
              Go to Music
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="flex items-center bg-[#1a222e]/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-gray-700 cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }} 
            className="text-[#646cff] bg-transparent border-none p-1 rounded-full mr-2"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            )}
          </button>
          
          <span className="flex-1 text-sm text-white truncate">
            {currentTrack.title}
          </span>
          
          {!zapStatus.loading && !zapStatus.success && !zapStatus.error && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleZapArtist();
              }}
              className="ml-2 text-[#646cff] hover:text-[#535bf2] bg-transparent border-none p-1 rounded-full"
              title="Zap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}
          
          {zapStatus.loading && <span className="ml-2 text-xs text-blue-400">⚡</span>}
          {zapStatus.success && <span className="ml-2 text-xs text-green-400">⚡</span>}
          {zapStatus.error && <span className="ml-2 text-xs text-red-400">⚡</span>}
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="ml-1 text-[#646cff] hover:text-[#535bf2] bg-transparent border-none p-1 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}; 