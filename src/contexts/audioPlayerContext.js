import { createContext } from 'react';

export const AudioPlayerContext = createContext(null);

// Repeat mode constants
export const REPEAT_MODES = {
  NONE: 'none',
  PLAYLIST: 'playlist', 
  TRACK: 'track'
};

export const initialState = {
  currentTrack: null,
  isPlaying: false,
  volume: 1,
  progress: 0,
  duration: 0,
  queue: [],
  shuffleMode: false,
  repeatMode: REPEAT_MODES.NONE,
  trackStartTime: 0 // To track when the current song started playing
};

export function audioReducer(state, action) {
  switch (action.type) {
    case 'SET_TRACK':
      return { 
        ...state, 
        currentTrack: action.payload, 
        progress: 0,
        trackStartTime: Date.now() 
      };
    case 'PLAY':
      return { 
        ...state, 
        isPlaying: true,
        // If we're starting from the beginning, update the track start time
        trackStartTime: state.progress === 0 ? Date.now() : state.trackStartTime
      };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'ADD_TO_QUEUE':
      return { ...state, queue: [...state.queue, action.payload] };
    case 'REMOVE_FROM_QUEUE':
      return {
        ...state,
        queue: state.queue.filter((track) => track.id !== action.payload)
      };
    case 'CLEAR_QUEUE':
      return { ...state, queue: [] };
    case 'TOGGLE_SHUFFLE':
      return { ...state, shuffleMode: !state.shuffleMode };
    case 'SET_REPEAT_MODE':
      return { ...state, repeatMode: action.payload };
    case 'UPDATE_TRACK_START_TIME':
      return { ...state, trackStartTime: action.payload };
    default:
      return state;
  }
}
