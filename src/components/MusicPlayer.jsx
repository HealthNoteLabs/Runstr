import { useState, useEffect } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import styles from '../assets/styles/AudioPlayer.module.css';

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
  
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  // Reset error when track changes
  useEffect(() => {
    setErrorMessage('');
    setShowErrorMessage(false);
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
      <div className={styles.title}>
        <p>Selected Playlist: {playlist?.title || 'Unknown'}</p>
        <p>Selected Track: {currentTrack.title}</p>
      </div>
      <div className={styles.controls}>
        <button onClick={playPrevious} className={styles.controlButton}>
          <div className="icon-container">
            <div className="icon-prev"></div>
            <span className={styles.buttonText}>Previous</span>
          </div>
        </button>
        <button onClick={safeTogglePlay} className={styles.controlButton}>
          <div className="icon-container">
            {isPlaying ? 
              <>
                <div className="icon-pause"></div>
                <span className={styles.buttonText}>Pause</span>
              </> : 
              <>
                <div className="icon-play"></div>
                <span className={styles.buttonText}>Play</span>
              </>
            }
          </div>
        </button>
        <button onClick={playNext} className={styles.controlButton}>
          <div className="icon-container">
            <div className="icon-next"></div>
            <span className={styles.buttonText}>Next</span>
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