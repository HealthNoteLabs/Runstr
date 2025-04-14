import { useContext } from 'react';
import { AudioPlayerContext } from '../contexts/AudioPlayerContext';

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error(
      'useAudioPlayer must be used within an AudioPlayerProvider'
    );
  }
  return context;
}
