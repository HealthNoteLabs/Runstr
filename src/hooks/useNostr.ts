import { useContext } from 'react';
import { NostrContext, NostrContextType } from '../contexts/NostrContext.tsx'; // Assuming NostrContext will be .tsx and export NostrContextType

/**
 * Hook to access the NostrContext
 * @returns {NostrContextType} The Nostr context values
 */
export function useNostr(): NostrContextType {
  const context = useContext(NostrContext);
  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
}

export default useNostr; 