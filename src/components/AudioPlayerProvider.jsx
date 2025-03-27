import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Create context
const AudioPlayerContext = createContext();

// Custom hook for using the audio player context
export const useAudioPlayer = () => {
  return useContext(AudioPlayerContext);
};

export const AudioPlayerProvider = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [audioElement, setAudioElement] = useState(null);

  // Initialize audio element on component mount
  useEffect(() => {
    const audio = new Audio();
    setAudioElement(audio);

    // Set up event listeners
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });
    
    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });
    
    audio.addEventListener('play', () => {
      setIsPlaying(true);
    });

    // Cleanup event listeners
    return () => {
      audio.removeEventListener('ended', () => setIsPlaying(false));
      audio.removeEventListener('pause', () => setIsPlaying(false));
      audio.removeEventListener('play', () => setIsPlaying(true));
      audio.pause();
    };
  }, []);

  // Play a track
  const playTrack = (track) => {
    if (!audioElement) return;

    // If it's the same track, toggle play/pause
    if (currentTrack && currentTrack.id === track.id) {
      if (isPlaying) {
        audioElement.pause();
      } else {
        audioElement.play();
      }
      return;
    }

    // Load and play new track
    audioElement.src = track.audio_url;
    audioElement.play()
      .then(() => {
        setCurrentTrack(track);
        setIsPlaying(true);
      })
      .catch(error => {
        console.error('Error playing audio:', error);
      });
  };

  // Pause the current track
  const pauseTrack = () => {
    if (audioElement && isPlaying) {
      audioElement.pause();
    }
  };

  // Resume the current track
  const resumeTrack = () => {
    if (audioElement && !isPlaying && currentTrack) {
      audioElement.play()
        .catch(error => {
          console.error('Error resuming audio:', error);
        });
    }
  };

  // Stop the current track
  const stopTrack = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const value = {
    currentTrack,
    isPlaying,
    playTrack,
    pauseTrack,
    resumeTrack,
    stopTrack
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

AudioPlayerProvider.propTypes = {
  children: PropTypes.node.isRequired
};
