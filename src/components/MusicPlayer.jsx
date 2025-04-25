import { useState, useEffect, useContext } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import styles from '../assets/styles/AudioPlayer.module.css';
import { NostrContext } from '../contexts/NostrContext';
import { useAuth } from '../hooks/useAuth';
import { getLnurlForTrack } from '../utils/wavlake';

export function MusicPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrevious,
    skipToTrack,
    playlist,
    currentTrackIndex
  } = useAudioPlayer();
  
  const { defaultZapAmount } = useContext(NostrContext);
  const { wallet } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [zapStatus, setZapStatus] = useState({ loading: false, success: false, error: null });

  // Reset error when track changes
  useEffect(() => {
    setErrorMessage('');
    setShowErrorMessage(false);
    setZapStatus({ loading: false, success: false, error: null });
  }, [currentTrack]);

  // Error handling function
  const handlePlaybackError = (error) => {
    console.error('Playback error:', error);
    const message = typeof error === 'string' ? error : 'Error playing track';
    setErrorMessage(message);
    setShowErrorMessage(true);
    // Hide error after 5 seconds
    setTimeout(() => setShowErrorMessage(false), 5000);
  };

  // Attempt to play and catch errors
  const safeTogglePlay = () => {
    try {
      togglePlayPause();
    } catch (error) {
      handlePlaybackError(error);
    }
  };

  // Handle zap function - sends Bitcoin to the artist
  const handleZapArtist = async () => {
    if (!currentTrack) return;
    if (!wallet || !wallet.isEnabled()) {
      setZapStatus({ 
        loading: false, 
        success: false, 
        error: 'Wallet not connected. Please connect a Lightning wallet in your settings.' 
      });
      
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
      return;
    }
    
    try {
      setZapStatus({ loading: true, success: false, error: null });

      // Get the LNURL for the current track
      const lnurlString = await getLnurlForTrack(currentTrack.id);
      console.log('[WavlakeZap] Got LNURL for track:', lnurlString);
      
      // LNURL Pay Flow - Follow the standard LNURL-pay protocol
      
      // 1. First decode the bech32 encoded LNURL to get the actual URL
      // For bech32 encoded LNURLs, attempt direct payment first as some wallets handle this
      if (lnurlString.startsWith('lnurl')) {
        try {
          console.log('[WavlakeZap] Attempting direct payment with LNURL string');
          // Try direct payment with the wallet - many wallet implementations can handle this
          await wallet.makePayment(lnurlString);
          console.log('[WavlakeZap] Direct payment successful');
          
          setZapStatus({ 
            loading: false, 
            success: true, 
            error: null 
          });
          
          setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
          return;
        } catch (directError) {
          console.error('[WavlakeZap] Direct payment failed, falling back to manual flow:', directError);
          // Continue with the manual flow below by attempting to decode the LNURL
          // This is a simple implementation - in production you'd use a proper bech32 decoder
        }
      }
      
      // 2. Determine endpoint from LNURL
      let lnurlEndpoint;
      if (lnurlString.startsWith('http')) {
        // Already a URL
        lnurlEndpoint = lnurlString;
      } else if (lnurlString.startsWith('lnurl')) {
        // In a real implementation, you'd use a proper bech32 decoder here
        // For now, we'll signal that we need a proper implementation
        throw new Error('LNURL processing requires a bech32 decoder');
      } else {
        throw new Error('Invalid LNURL format');
      }
      
      // 3. Request payment details from the LNURL endpoint
      console.log('[WavlakeZap] Requesting payment info from:', lnurlEndpoint);
      const response = await fetch(lnurlEndpoint);
      if (!response.ok) {
        throw new Error(`LNURL endpoint error: ${response.status} ${response.statusText}`);
      }
      
      // 4. Parse the response
      const lnurlPayData = await response.json();
      console.log('[WavlakeZap] LNURL-pay metadata:', lnurlPayData);
      
      if (!lnurlPayData.callback) {
        console.error('[WavlakeZap] Invalid LNURL-pay response - missing callback URL:', lnurlPayData);
        throw new Error('Invalid LNURL-pay response: missing callback URL');
      }
      
      // 5. Construct the callback URL
      const callbackUrl = new URL(lnurlPayData.callback);
      const amount = defaultZapAmount * 1000; // convert sats to millisats
      
      // 6. Check amount against min/max limits
      if (
        amount < lnurlPayData.minSendable ||
        amount > lnurlPayData.maxSendable
      ) {
        throw new Error(
          `Amount must be between ${lnurlPayData.minSendable / 1000} and ${lnurlPayData.maxSendable / 1000} sats`
        );
      }
      
      // 7. Add amount to callback URL
      callbackUrl.searchParams.append('amount', amount);
      
      // 8. Add comment if allowed
      if (lnurlPayData.commentAllowed && lnurlPayData.commentAllowed > 0) {
        const comment = `Zap for ${currentTrack.title} by ${currentTrack.artist || 'Unknown Artist'} via RUNSTR app! ⚡️`;
        callbackUrl.searchParams.append('comment', comment);
      }
      
      console.log('[WavlakeZap] Callback URL:', callbackUrl.toString());
      
      // 9. Request an invoice from the callback URL
      const invoiceResponse = await fetch(callbackUrl);
      if (!invoiceResponse.ok) {
        throw new Error(`Invoice request failed: ${invoiceResponse.status} ${invoiceResponse.statusText}`);
      }
      
      // 10. Parse the invoice data
      const invoiceData = await invoiceResponse.json();
      console.log('[WavlakeZap] Invoice data:', invoiceData);
      
      if (!invoiceData.pr) {
        console.error('[WavlakeZap] Invalid LNURL-pay response - missing payment request:', invoiceData);
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }
      
      // 11. Pay the invoice
      console.log('[WavlakeZap] Paying invoice...');
      await wallet.makePayment(invoiceData.pr);
      console.log('[WavlakeZap] Payment successful!');
      
      setZapStatus({ 
        loading: false, 
        success: true, 
        error: null 
      });
      
      // Clear success message after a few seconds
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
    } catch (error) {
      console.error('[WavlakeZap] Error zapping artist:', error);
      setZapStatus({ 
        loading: false, 
        success: false, 
        error: typeof error === 'string' ? error : error.message || 'Failed to zap artist.' 
      });
      
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
    }
  };

  if (!currentTrack) return null;

  // Calculate upcoming tracks (next 3 tracks after current one)
  const getUpcomingTracks = () => {
    if (!playlist || !playlist.tracks) return [];
    
    const upcomingTracks = [];
    const totalTracks = playlist.tracks.length;
    
    // Get up to 3 upcoming tracks
    for (let i = 1; i <= 3; i++) {
      const nextIndex = (currentTrackIndex + i) % totalTracks;
      if (nextIndex !== currentTrackIndex) { // Avoid adding current track if playlist has only one track
        upcomingTracks.push({
          ...playlist.tracks[nextIndex],
          position: nextIndex + 1, // 1-based position for display
          index: nextIndex // Actual index in the playlist for skipping
        });
      }
    }
    
    return upcomingTracks;
  };
  
  const upcomingTracks = getUpcomingTracks();

  // Handle click on an upcoming track
  const handleTrackClick = (trackIndex) => {
    skipToTrack(trackIndex);
  };

  return (
    <div className={styles.container}>
      {/* Error message display */}
      {showErrorMessage && errorMessage && (
        <div className={styles.errorMessage}>
          {errorMessage}
        </div>
      )}
      
      {/* Zap status messages */}
      {zapStatus.loading && (
        <div className={styles.zapMessage}>
          Sending {defaultZapAmount} sats to {currentTrack.artist || 'the artist'}...
        </div>
      )}
      {zapStatus.success && (
        <div className={styles.zapSuccess}>
          Successfully sent {defaultZapAmount} sats to {currentTrack.artist || 'the artist'}! ⚡️
        </div>
      )}
      {zapStatus.error && (
        <div className={styles.zapError}>
          {zapStatus.error}
        </div>
      )}
      
      <div className={styles.title}>
        <p>Selected Playlist: {playlist?.title || 'Unknown'}</p>
      </div>
      <div className={styles.controls}>
        <button onClick={playPrevious} className={styles.controlButton}>
          <div className="icon-container">
            <div className="icon-prev"></div>
          </div>
        </button>
        <button onClick={safeTogglePlay} className={styles.controlButton}>
          <div className="icon-container">
            {isPlaying ? 
              <div className="icon-pause"></div> : 
              <div className="icon-play"></div>
            }
          </div>
        </button>
        <button onClick={playNext} className={styles.controlButton}>
          <div className="icon-container">
            <div className="icon-next"></div>
          </div>
        </button>
        <button onClick={handleZapArtist} className={`${styles.controlButton} ${styles.zapButton}`} disabled={zapStatus.loading}>
          <div className="icon-container">
            <div className="icon-zap">⚡</div>
          </div>
        </button>
      </div>
      <div className={styles.nowPlaying}>
        <p>Now playing: {currentTrack.title} - {currentTrack.artist || 'Unknown Artist'}</p>
      </div>
      
      {/* Upcoming tracks section */}
      {upcomingTracks.length > 0 && (
        <div className={styles.upcomingTracks}>
          <h3>Coming Up Next:</h3>
          <ul className={styles.tracksList}>
            {upcomingTracks.map((track, index) => (
              <li 
                key={index} 
                className={styles.trackItem}
                onClick={() => handleTrackClick(track.index)}
              >
                <span className={styles.trackNumber}>{track.position}.</span>
                <span className={styles.trackTitle}>{track.title}</span>
                <span className={styles.trackArtist}>{track.artist || 'Unknown Artist'}</span>
                <span className={styles.playIcon}>
                  <div className="mini-icon-play"></div>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 