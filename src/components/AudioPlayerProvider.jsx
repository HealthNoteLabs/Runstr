import { useReducer, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { AudioContext } from '../contexts/audioContext';
import { audioReducer } from '../contexts/audioReducer';
import { initialState } from '../contexts/audioContext';
import { wavlakeApi } from '../services/wavlakeApi';

const createAudioInstance = () => {
  if (typeof window !== 'undefined') {
    return new Audio();
  }
  return null;
};

export function AudioPlayerProvider({ children }) {
  const [state, dispatch] = useReducer(audioReducer, initialState);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = createAudioInstance();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playTrack = useCallback(
    async (track) => {
      if (!audioRef.current) return;

      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const streamData = await wavlakeApi.getStreamUrl(track.id);

        audioRef.current.src = streamData.url;
        audioRef.current.volume = state.volume;

        dispatch({ type: 'SET_TRACK', payload: track });
        audioRef.current
          .play()
          .then(() => dispatch({ type: 'PLAY' }))
          .catch((error) =>
            dispatch({ type: 'SET_ERROR', payload: error.message })
          );
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.volume]
  );

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !state.currentTrack) return;

    if (state.isPlaying) {
      audioRef.current.pause();
      dispatch({ type: 'PAUSE' });
    } else {
      audioRef.current
        .play()
        .then(() => dispatch({ type: 'PLAY' }))
        .catch((error) =>
          dispatch({ type: 'SET_ERROR', payload: error.message })
        );
    }
  }, [state.isPlaying, state.currentTrack]);

  const setVolume = useCallback((volume) => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    dispatch({ type: 'SET_VOLUME', payload: volume });
  }, []);

  const seek = useCallback((time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    dispatch({ type: 'SET_PROGRESS', payload: time });
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;

    const handleTimeUpdate = () => {
      dispatch({
        type: 'SET_PROGRESS',
        payload: audioRef.current.currentTime
      });

      // Report progress to Wavlake API
      if (state.currentTrack) {
        wavlakeApi
          .reportProgress(
            state.currentTrack.id,
            audioRef.current.currentTime,
            audioRef.current.duration
          )
          .catch(console.error);
      }
    };

    const handleLoadedMetadata = () => {
      dispatch({
        type: 'SET_DURATION',
        payload: audioRef.current.duration
      });
    };

    const handleEnded = () => {
      dispatch({ type: 'PAUSE' });
      if (state.queue.length > 0) {
        const nextTrack = state.queue[0];
        dispatch({ type: 'REMOVE_FROM_QUEUE', payload: nextTrack.id });
        playTrack(nextTrack);
      }
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener(
          'loadedmetadata',
          handleLoadedMetadata
        );
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, [state.currentTrack, state.queue, playTrack]);

  const value = {
    ...state,
    playTrack,
    togglePlay,
    setVolume,
    seek,
    dispatch
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}

AudioPlayerProvider.propTypes = {
  children: PropTypes.node.isRequired
};
