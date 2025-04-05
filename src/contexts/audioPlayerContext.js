import { createContext } from 'react';

export const AudioPlayerContext = createContext(null);

export const initialState = {
  currentTrack: null,
  isPlaying: false,
  volume: 1,
  progress: 0,
  duration: 0,
  queue: []
};

export function audioReducer(state, action) {
  switch (action.type) {
    case 'SET_TRACK':
      return { ...state, currentTrack: action.payload, progress: 0 };
    case 'PLAY':
      return { ...state, isPlaying: true };
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
    default:
      return state;
  }
}
