import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostr } from '../../hooks/useNostr';
import {
  prepareNip101eTeamEventTemplate,
  getTeamUUID,
  getTeamCaptain,
  TeamData,
} from '../../services/nostr/NostrTeamsService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { awaitNDKReady, ndk as ndkSingleton } from '../../lib/ndkSingleton';
import { ensureSignerAttached } from '../../contexts/NostrContext';

interface CreateTeamFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateTeamForm: React.FC<CreateTeamFormProps> = ({ isOpen, onClose }) => {
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [teamImage, setTeamImage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Form-specific errors

  // Detailed debug state for ndkSingleton and actions
  const [debugSingletonRelays, setDebugSingletonRelays] = useState(0);
  const [debugSingletonSignerSet, setDebugSingletonSignerSet] = useState(false);
  const [debugLastAction, setDebugLastAction] = useState('Modal Initialized');
  
  const {
    ndk: ndkFromContext,
    publicKey,
    ndkReady: ndkReadyFromContext,
    ndkError: ndkErrorFromContext,
    reInitializeNostrSystem, // From NostrContext
  } = useNostr();
  const navigate = useNavigate();

  const contextNdkSignerStatus = ndkFromContext?.signer ? 'Available' : 'NOT Available';

  // Function to update all debug information
  const updateAllDebugInfo = useCallback(() => {
    setDebugSingletonRelays(ndkSingleton.pool?.stats()?.connected ?? 0);
    setDebugSingletonSignerSet(!!ndkSingleton.signer);
    console.log('[CreateTeamForm] Debug info refreshed.');
  }, []);

  // Effect to initialize and refresh debug info when modal opens or relevant context changes
  useEffect(() => {
    if (isOpen) {
      setError(null); // Clear previous form errors
      setDebugLastAction('Modal Opened / Context Changed');
      updateAllDebugInfo();
    } else {
      // Reset form fields when modal is closed
      setTeamName('');
      setTeamDescription('');
      setTeamImage('');
      setIsPublic(true);
      setError(null);
      setIsLoading(false);
      setDebugLastAction('Modal Closed');
    }
  }, [isOpen, updateAllDebugInfo, publicKey, ndkReadyFromContext, ndkErrorFromContext]); // Re-check if context values change

  const handleForceSingletonConnect = async () => {
    setIsLoading(true);
    setDebugLastAction('Attempting: ndkSingleton.connect()...');
    setError(null);
    try {
      await ndkSingleton.connect();
      setDebugLastAction('Finished: ndkSingleton.connect().');
    } catch (err: any) {
      console.error('Error directly connecting ndkSingleton:', err);
      setDebugLastAction(`Error: ndkSingleton.connect(): ${err.message}`);
      setError(`Singleton Connect Error: ${err.message}`);
    } finally {
      updateAllDebugInfo();
      setIsLoading(false);
    }
  };

  const handleForceSingletonSignerAttach = async () => {
    setIsLoading(true);
    setDebugLastAction('Attempting: ensureSignerAttached() for Singleton...');
    setError(null);
    try {
      const signerResult = await ensureSignerAttached(); // This should target ndkSingleton
      if (signerResult.error) {
        setDebugLastAction(`Error: ensureSignerAttached(): ${signerResult.error}`);
        setError(`Singleton Signer Attach Error: ${signerResult.error}`);
      } else {
        setDebugLastAction(`Finished: ensureSignerAttached(). Pubkey: ${signerResult.pubkey?.substring(0,10)}...`);
      }
    } catch (err: any) {
      console.error('Error attaching signer to ndkSingleton:', err);
      setDebugLastAction(`Exception: ensureSignerAttached(): ${err.message}`);
      setError(`Singleton Signer Attach Exception: ${err.message}`);
    } finally {
      updateAllDebugInfo();
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setDebugLastAction('Submit: Initiated');
    updateAllDebugInfo(); 

    let ndkToUse = null;
    let finalError = 'NDK/Signer not ready.'; // Default error

    // Check 1: Context NDK
    if (ndkReadyFromContext && ndkFromContext?.signer && publicKey) {
      ndkToUse = ndkFromContext;
      setDebugLastAction('Submit: Using NDK from Context.');
      console.log('Submit: Using NDK from context.');
    } else {
      setDebugLastAction('Submit: Context NDK insufficient. Checking Singleton NDK.');
      console.log('Submit: Context NDK not ready/signer missing. Checking ndkSingleton direct status.');
      // Check 2: Singleton NDK direct status
      if ((ndkSingleton.pool?.stats()?.connected ?? 0) > 0 && ndkSingleton.signer && publicKey) {
        ndkToUse = ndkSingleton;
        setDebugLastAction('Submit: Using direct ndkSingleton (was already ready).');
        console.log('Submit: Using ndkSingleton directly as it was ready.');
      } else {
        setDebugLastAction('Submit: Singleton NDK not ready. Attempting forced init...');
        console.log('Submit: ndkSingleton not ready/signer missing. Attempting forced connect & signer attach.');
        // Check 3: Force init Singleton NDK
        await handleForceSingletonConnect();
        await handleForceSingletonSignerAttach();
        updateAllDebugInfo(); // Refresh after attempts
        if ((ndkSingleton.pool?.stats()?.connected ?? 0) > 0 && ndkSingleton.signer && publicKey) {
          ndkToUse = ndkSingleton;
          setDebugLastAction('Submit: Used ndkSingleton after forced init.');
          console.log('Submit: Using ndkSingleton after forced re-initialization.');
        } else {
          finalError = 'Critical: NDK/Signer STILL not available after forced attempts. Check console & relay config.';
          setDebugLastAction('Submit: Forced init of Singleton FAILED.');
          console.log('Submit: Forced re-initialization of ndkSingleton failed.');
        }
      }
    }

    if (!ndkToUse || !publicKey || !ndkToUse.signer) {
      setError(finalError);
      setIsLoading(false);
      return;
    }
    if (!teamName.trim()) {
      setError('Team name is required.');
      setIsLoading(false);
      return;
    }

    setDebugLastAction('Submit: Preparing NIP-101e event...');
    const teamData: TeamData = { name: teamName, description: teamDescription, isPublic, image: teamImage.trim() || undefined };
    const teamEventTemplate = prepareNip101eTeamEventTemplate(teamData, publicKey);
    if (!teamEventTemplate) {
      setError('Internal Error: Failed to prepare team event template.');
      setIsLoading(false); return;
    }

    try {
      const ndkTeamEvent = new NDKEvent(ndkToUse, teamEventTemplate);
      setDebugLastAction('Submit: Signing event with selected NDK...');
      await ndkTeamEvent.sign(); 
      setDebugLastAction('Submit: Publishing event...');
      const teamPublishedRelays = await ndkTeamEvent.publish();
      console.log('NIP-101e Team event published to relays:', teamPublishedRelays);
      if (teamPublishedRelays.size > 0) {
        setDebugLastAction('Submit: PUBLISHED SUCCESSFULLY! Navigating...');
        const newTeamUUID = getTeamUUID(ndkTeamEvent.rawEvent());
        const captain = getTeamCaptain(ndkTeamEvent.rawEvent());
        onClose(); 
        if (newTeamUUID && captain) {
          navigate(`/teams/${captain}/${newTeamUUID}`);
        } else {
          console.error("Critical: Failed to get UUID/captain from published event, though publish reported success.");
          navigate('/teams'); 
        }
      } else {
        setError('Event was signed but FAILED to publish to any relays. Check relays or NDK logs.');
        setDebugLastAction('Submit: Publish to relays FAILED.');
      }
    } catch (err: any) {
      console.error('Error during sign/publish NIP-101e team:', err);
      setError(`Sign/Publish Error: ${err.message}`);
      setDebugLastAction(`Submit: Exception during sign/publish: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const canSubmit = (ndkReadyFromContext && ndkFromContext?.signer && publicKey) || (debugSingletonRelays > 0 && debugSingletonSignerSet && publicKey);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="bg-gray-800 text-white rounded-lg shadow-xl p-5 w-full max-w-lg mx-auto" style={{maxHeight: '95vh', overflowY: 'auto'}}>
        {/* Enhanced Debug UI Panel */}
        <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#374151', border: '1px solid #4B5563', borderRadius: '5px', fontSize: '0.75rem', lineHeight: '1.4' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '5px', color: '#D1D5DB', fontSize: '0.875rem' }}>DEBUGGER PANEL</h4>
          <p>Context NDK Ready: <b style={{color: ndkReadyFromContext? '#6EE7B7' : '#FCA5A5'}}>{ndkReadyFromContext ? 'YES' : 'NO'}</b></p>
          <p>Context Pubkey: <b style={{color: publicKey? '#6EE7B7' : '#FCA5A5'}}>{publicKey?.substring(0,10) || 'N/A'}...</b></p>
          <p>Context NDK Signer: <b style={{color: ndkFromContext?.signer? '#6EE7B7' : '#FCA5A5'}}>{contextNdkSignerStatus}</b></p>
          <p style={{color: ndkErrorFromContext? '#FCA5A5' : 'inherit'}}>Context NDK Error: <b>{ndkErrorFromContext || 'None'}</b></p>
          <hr style={{marginBlock: '6px', borderColor: '#4B5563'}} />
          <p>Singleton Relays Connected: <b style={{color: debugSingletonRelays > 0 ? '#6EE7B7' : '#FCA5A5'}}>{debugSingletonRelays}</b></p>
          <p>Singleton Has Signer: <b style={{color: debugSingletonSignerSet? '#6EE7B7' : '#FCA5A5'}}>{debugSingletonSignerSet ? 'YES' : 'NO'}</b></p>
          <hr style={{marginBlock: '6px', borderColor: '#4B5563'}} />
          <p style={{color: error ? '#FCA5A5' : 'inherit'}}>Form Error Message: <b>{error || 'None'}</b></p>
          <p>Last Debug Action: <b style={{color: '#93C5FD'}}>{debugLastAction}</b></p>
          <div style={{marginTop: '10px', display:'flex', flexWrap:'wrap', gap:'5px'}}>
            {typeof reInitializeNostrSystem === 'function' && (
              <button onClick={() => { setError(null); setDebugLastAction('Attempt: Context Re-Init'); reInitializeNostrSystem(); setTimeout(updateAllDebugInfo, 700); }} style={{ padding: '5px 8px', backgroundColor: '#F59E0B', color: 'black', borderRadius: '4px', border: 'none', fontSize: '0.7rem' }} disabled={isLoading}>
                Retry Context Init
              </button>
            )}
            <button onClick={handleForceSingletonConnect} style={{ padding: '5px 8px', backgroundColor: '#10B981', color: 'white', borderRadius: '4px', border: 'none', fontSize: '0.7rem' }} disabled={isLoading}>
              Connect Singleton Relays
            </button>
            <button onClick={handleForceSingletonSignerAttach} style={{ padding: '5px 8px', backgroundColor: '#EF4444', color: 'white', borderRadius: '4px', border: 'none', fontSize: '0.7rem' }} disabled={isLoading}>
              Attach Signer to Singleton
            </button>
            <button onClick={() => {setDebugLastAction('UI Refresh Clicked'); updateAllDebugInfo();}} style={{ padding: '5px 8px', backgroundColor: '#60A5FA', color: 'white', borderRadius: '4px', border: 'none', fontSize: '0.7rem' }} disabled={isLoading}>
              Refresh Debug UI
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Create New Team</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-semibold" aria-label="Close modal">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="teamNameModal" className="block text-sm font-medium text-gray-300 mb-1">Team Name</label>
            <input type="text" id="teamNameModal" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" required />
          </div>
          <div className="mb-4">
            <label htmlFor="teamDescriptionModal" className="block text-sm font-medium text-gray-300 mb-1">Team Description</label>
            <textarea id="teamDescriptionModal" value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} rows={3} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"></textarea>
          </div>
          <div className="mb-4">
            <label htmlFor="teamImageModal" className="block text-sm font-medium text-gray-300 mb-1">Team Image URL (Optional)</label>
            <input type="url" id="teamImageModal" value={teamImage} onChange={(e) => setTeamImage(e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="https://example.com/image.png" />
          </div>
          <div className="mb-6">
            <label className="flex items-center">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-500 rounded bg-gray-700 focus:ring-blue-500" />
              <span className="ml-2 text-sm text-gray-300">Publicly visible team</span>
            </label>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-700/50 text-red-200 border border-red-600 rounded-md"><p>{error}</p></div>
          )}
          <div className="flex justify-end space-x-3 mt-4">
             <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-md transition duration-150 ease-in-out">Cancel</button>
            <button type="submit" 
              disabled={isLoading || !canSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out">
              {isLoading ? 'Processing...' : 'Create Team'}
            </button>
          </div>
          {!isLoading && !canSubmit && (
            <p className="text-xs text-yellow-400 mt-3 text-center">
              NDK/Signer not fully ready. Use debug panel buttons or check connection.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateTeamForm; 