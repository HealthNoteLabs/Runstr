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
  const handleZapArtist = async (e) => {
    if (e) e.stopPropagation(); // Prevent parent element click events

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
      
      // First handle common LNURL formats
      if (lnurlString.toLowerCase().startsWith('lnurl')) {
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
          // Continue with the manual flow below
        }
      }
      
      // Determine endpoint from LNURL - handling various formats
      let lnurlEndpoint;
      
      // Handle URL formats (http, https)
      if (lnurlString.toLowerCase().startsWith('http')) {
        // Already a URL
        lnurlEndpoint = lnurlString;
      } 
      // Handle lightning addresses (user@domain.com)
      else if (lnurlString.includes('@')) {
        const [username, domain] = lnurlString.split('@');
        lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
      }
      // Any other URL format (might be a non-standard URL without protocol)
      else if (lnurlString.includes('.') && !lnurlString.toLowerCase().startsWith('lnurl')) {
        // Try to interpret as URL, assume https if no protocol specified
        if (lnurlString.includes('://')) {
          lnurlEndpoint = lnurlString;
        } else {
          lnurlEndpoint = `https://${lnurlString}`;
        }
      }
      // Try direct payment again as a last resort
      else {
        try {
          console.log('[WavlakeZap] Attempting direct payment with unknown format LNURL');
          await wallet.makePayment(lnurlString);
          console.log('[WavlakeZap] Direct payment successful');
          
          setZapStatus({ 
            loading: false, 
            success: true, 
            error: null 
          });
          
          setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
          return;
        } catch (lastResortError) {
          console.error('[WavlakeZap] Last resort payment failed:', lastResortError);
          throw new Error('Unrecognized LNURL format. Please try again later.');
        }
      }
      
      console.log('[WavlakeZap] Using LNURL endpoint:', lnurlEndpoint);
      
      // Request payment details from the LNURL endpoint
      console.log('[WavlakeZap] Requesting payment info from:', lnurlEndpoint);
      const response = await fetch(lnurlEndpoint);
      if (!response.ok) {
        throw new Error(`LNURL endpoint error: ${response.status} ${response.statusText}`);
      }
      
      // Parse the response
      const lnurlPayData = await response.json();
      console.log('[WavlakeZap] LNURL-pay metadata:', lnurlPayData);
      
      if (!lnurlPayData.callback) {
        console.error('[WavlakeZap] Invalid LNURL-pay response - missing callback URL:', lnurlPayData);
        throw new Error('Invalid LNURL-pay response: missing callback URL');
      }
      
      // Construct the callback URL
      const callbackUrl = new URL(lnurlPayData.callback);
      const amount = defaultZapAmount * 1000; // convert sats to millisats
      
      // Check amount against min/max limits
      if (
        amount < lnurlPayData.minSendable ||
        amount > lnurlPayData.maxSendable
      ) {
        throw new Error(
          `Amount must be between ${lnurlPayData.minSendable / 1000} and ${lnurlPayData.maxSendable / 1000} sats`
        );
      }
      
      // Add amount to callback URL
      callbackUrl.searchParams.append('amount', amount);
      
      // Add comment if allowed
      if (lnurlPayData.commentAllowed && lnurlPayData.commentAllowed > 0) {
        const comment = `Zap for ${currentTrack.title} by ${currentTrack.artist || 'Unknown Artist'} via RUNSTR app! ⚡️`;
        callbackUrl.searchParams.append('comment', comment);
      }
      
      console.log('[WavlakeZap] Callback URL:', callbackUrl.toString());
      
      // Request an invoice from the callback URL
      const invoiceResponse = await fetch(callbackUrl);
      if (!invoiceResponse.ok) {
        throw new Error(`Invoice request failed: ${invoiceResponse.status} ${invoiceResponse.statusText}`);
      }
      
      // Parse the invoice data to get the payment request
      const invoiceData = await invoiceResponse.json();
      console.log('[WavlakeZap] Invoice data:', invoiceData);
      
      if (!invoiceData.pr) {
        console.error('[WavlakeZap] Invalid LNURL-pay response - missing payment request:', invoiceData);
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }
      
      // Pay the invoice
      console.log('[WavlakeZap] Paying invoice...');
      await wallet.makePayment(invoiceData.pr);
      console.log('[WavlakeZap] Payment successful!');
      
      setZapStatus({ loading: false, success: true, error: null });
      setTimeout(() => setZapStatus({ loading: false, success: false, error: null }), 5000);
    } catch (error) {
      console.error('[WavlakeZap] Error during zap process:', error);
      setZapStatus({ 
        loading: false, 
        success: false, 
        error: error.message || 'Error processing payment. Please try again.' 
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