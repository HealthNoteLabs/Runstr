import { useContext } from 'react';
import { NostrContext } from './NostrContext';

export const useNostr = () => {
  const context = useContext(NostrContext);
  
  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  
  return context;
}; 