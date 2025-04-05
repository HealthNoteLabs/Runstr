import { useContext } from 'react';
import { AudioPlayerContext } from '../contexts/audioPlayerContext';

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  
  return context;
};
