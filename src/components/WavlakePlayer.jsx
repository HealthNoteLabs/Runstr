import PropTypes from 'prop-types';
import { useState } from 'react';
import { useAudioPlayer } from './AudioPlayerProvider';

export const WavlakePlayer = () => {
  const { currentTrack, isPlaying, pauseTrack, resumeTrack } = useAudioPlayer();
  const [isMinimized, setIsMinimized] = useState(true);

  // Toggle player visibility
  const togglePlayer = () => {
    setIsMinimized(!isMinimized);
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    if (currentTrack) {
      if (isPlaying) {
        pauseTrack();
      } else {
        resumeTrack();
      }
    }
  };

  if (!currentTrack) return null;

  return (
    <div className={`wavlake-player ${isMinimized ? 'minimized' : 'expanded'}`}>
      <div className="player-controls">
        <button 
          className="toggle-play-button"
          onClick={togglePlayPause}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        
        <div className="track-info">
          <div className="track-title">{currentTrack.title || 'Unknown'}</div>
          <div className="track-artist">{currentTrack.artist || 'Unknown Artist'}</div>
        </div>
        
        <button 
          className="toggle-player-button"
          onClick={togglePlayer}
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>
    </div>
  );
};

WavlakePlayer.propTypes = {
  track: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    artwork: PropTypes.string
  }).isRequired,
  onEnded: PropTypes.func
};
