import { useState } from 'react';
import PropTypes from 'prop-types';
import { TipArtistButton } from './TipArtistButton';
import '../assets/styles/TrackListItem.css';

export function TrackListItem({ track, onPlay, wallet, position, isPlaying }) {
  const [showTipButton, setShowTipButton] = useState(false);
  
  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(track);
    }
  };
  
  const handleMouseEnter = () => {
    setShowTipButton(true);
  };
  
  const handleMouseLeave = () => {
    setShowTipButton(false);
  };
  
  return (
    <div 
      className={`track-list-item ${isPlaying ? 'playing' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="track-number">{position || '-'}</div>
      
      <div className="track-play">
        <button 
          className="play-button" 
          onClick={handlePlayClick}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>
      
      <div className="track-artwork">
        {track.albumArtUrl && (
          <img 
            src={track.albumArtUrl} 
            alt={`${track.title} artwork`} 
            className="artwork-thumbnail"
          />
        )}
      </div>
      
      <div className="track-info">
        <div className="track-title">{track.title}</div>
        <div className="track-artist">{track.artist}</div>
      </div>
      
      <div className="track-actions">
        {showTipButton && wallet && (
          <TipArtistButton 
            track={track} 
            wallet={wallet} 
            customAmounts={[1000, 2100, 5000]}
          />
        )}
      </div>
    </div>
  );
}

TrackListItem.propTypes = {
  track: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    artist: PropTypes.string,
    albumArtUrl: PropTypes.string
  }).isRequired,
  onPlay: PropTypes.func,
  wallet: PropTypes.object,
  position: PropTypes.number,
  isPlaying: PropTypes.bool
}; 