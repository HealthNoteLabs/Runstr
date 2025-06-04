import { useState, useEffect, useRef, useContext } from 'react';
import PropTypes from 'prop-types';
import { ndk, ndkReadyPromise } from '../lib/ndkSingleton';
import {
  fetchGroupMessages,
  subscribeToGroupMessages,
  sendGroupMessage,
} from '../utils/ndkGroups.js';
import { ensureRelays } from '../utils/relays.js';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { useProfileCache } from '../hooks/useProfileCache.js';
import { NostrContext } from '../contexts/NostrContext.tsx';

/**
 * ChatRoom – standalone component responsible for displaying and sending
 * NIP-29 chat messages for a given groupId (the `d` tag identifier).
 *
 * While NDK is still initialising or relays are not connected the component
 * shows an inline "Connecting …" notice but the surrounding UI remains
 * visible so navigation feels instant.
 */
export const ChatRoom = ({ groupId, naddrString, publicKey, relayHints: passedRelayHints }) => {
  console.log(`ChatRoom: Render (Phase 4). GroupId: ${groupId}, Naddr: ${naddrString ? naddrString.substring(0,15) : 'none'}, PassedRelayHints:`, passedRelayHints);
  const { ndkReady, relayCount, ndkError: ndkInitError } = useContext(NostrContext);
  const { fetchProfiles } = useProfileCache();

  const [messages, setMessages] = useState([]);
  const [messageAuthorProfiles, setMessageAuthorProfiles] = useState(new Map());
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [error, setError] = useState(null);

  const chatEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    if (groupId) {
      const cacheKey = `chatMessages_${groupId}`;
      const storedMessagesJson = localStorage.getItem(cacheKey);
      if (storedMessagesJson) {
        try {
          const rawEvents = JSON.parse(storedMessagesJson);
          if (Array.isArray(rawEvents) && rawEvents.length > 0) {
            const ndkMessages = rawEvents.map(rawEv => {
              if (rawEv instanceof NDKEvent) return rawEv;
              const ndkEventInstance = new NDKEvent(ndk);
              Object.assign(ndkEventInstance, rawEv);
              ndkEventInstance.id = rawEv.id;
              ndkEventInstance.sig = rawEv.sig; 
              return ndkEventInstance;
            });
            setMessages(ndkMessages.sort((a, b) => a.created_at - b.created_at));
            setIsLoadingChat(false);
          }
        } catch (e) {
          console.warn(`[ChatRoom] Failed to parse stored messages for groupId ${groupId}:`, e);
          localStorage.removeItem(cacheKey);
        }
      }
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) {
      console.log("ChatRoom: useEffect - no groupId, cannot load/subscribe.");
      setIsLoadingChat(false);
      setMessages([]);
      setError(null);
      return;
    }

    console.log(`ChatRoom: useEffect - GroupId: ${groupId}, NDKReady: ${ndkReady}, RelayCount: ${relayCount}, RelayHints: ${JSON.stringify(passedRelayHints)}`);
    
    let isActive = true;
    setIsLoadingChat(true);
    setError(null);

    const loadAndSubscribe = async () => {
      if (!isActive) return;

      try {
        console.log(`[ChatRoom] Phase 1 (useEffect): Ensuring relays for group ${groupId}:`, passedRelayHints);
        await ensureRelays(passedRelayHints || []); 
        
        await new Promise(resolve => setTimeout(resolve, 100)); 
        if (!isActive) return;

        console.log(`ChatRoom: Fetching initial messages for group ${groupId}`);
        const initialMessages = await fetchGroupMessages(groupId, { relays: passedRelayHints || [], limit: 50 });
        if (!isActive) return;

        console.log(`ChatRoom: Fetched ${initialMessages.length} initial messages.`);
        setMessages(prevMessages => {
          const messageMap = new Map();
          prevMessages.forEach(msg => {
            const key = msg.id || msg.tempId;
            if (key) messageMap.set(key, msg instanceof NDKEvent ? msg : new NDKEvent(ndk, msg));
          });
          initialMessages.forEach(msg => {
            const key = msg.id || msg.tempId;
            if (key) messageMap.set(key, msg);
          });
          return Array.from(messageMap.values()).sort((a, b) => a.created_at - b.created_at);
        });
        setIsLoadingChat(false);

        let subSinceTimestamp = Math.floor(Date.now() / 1000) - 3600;
        if (messages.length > 0 && messages[messages.length - 1]?.created_at) {
            subSinceTimestamp = messages[messages.length - 1].created_at; 
        }
        
        const sub = await subscribeToGroupMessages(
          groupId,
          (newEvent) => {
            if (!isActive) return;
            setMessages(prevMessages => {
              if (prevMessages.some((m) => m.id === newEvent.id)) return prevMessages;
              return [...prevMessages, newEvent].sort((a, b) => a.created_at - b.created_at);
            });
          },
          { relays: passedRelayHints || [], since: subSinceTimestamp }
        );
        
        if (isActive) {
            subscriptionRef.current = sub;
        }

      } catch (err) {
        if (!isActive) return;
        console.error(`ChatRoom: Error loading messages or subscribing for group ${groupId}:`, err);
        setError(err.message || 'Failed to load chat.');
        setIsLoadingChat(false);
      }
    };

    loadAndSubscribe();

    return () => {
      isActive = false;
      console.log(`ChatRoom: Cleaning up subscription for group ${groupId}`);
      if (subscriptionRef.current && typeof subscriptionRef.current.unsub === 'function') {
        subscriptionRef.current.unsub();
      }
      subscriptionRef.current = null;
    };
  }, [groupId, JSON.stringify(passedRelayHints)]); 

  useEffect(() => {
    if (groupId && messages.length > 0) {
      const cacheKey = `chatMessages_${groupId}`;
      try {
        const rawEventsToStore = messages.slice(0, 50).map(msg => {
            return msg instanceof NDKEvent ? msg.rawEvent() : msg;
        });
        localStorage.setItem(cacheKey, JSON.stringify(rawEventsToStore));
      } catch (e) {
        console.error(`[ChatRoom] Failed to save messages to localStorage for groupId ${groupId}:`, e);
      }
    }
  }, [messages, groupId]);

  useEffect(() => {
    const fetchAndSetProfiles = async () => {
        console.log('[ChatRoom] Profile fetch effect triggered. Checking NDK readiness via promise...');
        
        const isNdkActuallyReady = await ndkReadyPromise;
        console.log(`[ChatRoom] ndkReadyPromise resolved with: ${isNdkActuallyReady}`);

        if (!isNdkActuallyReady || messages.length === 0) {
          console.log(`[ChatRoom] Skipping profile fetch. NDK Ready (from promise): ${isNdkActuallyReady}, Messages Count: ${messages.length}`);
          return;
        }

        const pubkeysToProcess = Array.from(
          new Set(messages.map(msg => {
            return msg instanceof NDKEvent ? msg.pubkey : msg.pubkey;
          }))
        ).filter(pubkey => pubkey && !messageAuthorProfiles.has(pubkey));

        if (pubkeysToProcess.length === 0) {
          return;
        }

        console.log('[ChatRoom] Requesting profiles for pubkeys from useProfileCache:', pubkeysToProcess);

        try {
          const fetchedProfileData = await fetchProfiles(pubkeysToProcess);
          console.log('[ChatRoom] Received profiles from useProfileCache:', fetchedProfileData);

          if (fetchedProfileData.size > 0) {
            setMessageAuthorProfiles(prevProfiles => {
              const newProfiles = new Map(prevProfiles);
              let profilesActuallyAddedOrUpdated = false;
              fetchedProfileData.forEach((profile, pubkey) => {
                if (!newProfiles.has(pubkey) || JSON.stringify(newProfiles.get(pubkey)) !== JSON.stringify(profile)) {
                  newProfiles.set(pubkey, profile);
                  profilesActuallyAddedOrUpdated = true;
                }
              });

              if (profilesActuallyAddedOrUpdated) {
                console.log('[ChatRoom] Updating local messageAuthorProfiles state.');
                return newProfiles;
              }
              return prevProfiles; 
            });
          }
        } catch (err) {
          console.error("[ChatRoom] Error calling fetchProfiles from useProfileCache:", err);
        }
    };

    fetchAndSetProfiles();
  }, [messages, fetchProfiles]); 

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    // Ensure we have a signer attached on-demand if the user hasn't connected yet.
    if (!publicKey || !ndk.signer) {
      try {
        const { ensureSignerAttached } = await import('../contexts/NostrContext.tsx');
        const { pubkey, error: signerError } = await ensureSignerAttached();
        if (signerError || !pubkey) {
          setError(signerError || 'Unable to attach Nostr signer.');
          return;
        }
      } catch (attachErr) {
        console.error('ChatRoom: Failed to dynamically import ensureSignerAttached:', attachErr);
        setError('Unable to attach Nostr signer.');
        return;
      }
    }
    if (!groupId) { setError('Group ID not available to send message.'); return; }
    if (!messageText.trim()) return;
    setIsSending(true); setError(null);
    try {
      await ensureRelays(passedRelayHints);
      const sentEvent = await sendGroupMessage(groupId, messageText.trim());
      if (sentEvent) {
        setMessageText('');
      } else {
        throw new Error('Failed to send message event.');
      }
    } catch (err) {
      console.error('ChatRoom: error sending message', err);
      setError(err.message || 'Failed to send');
    } finally {
      setIsSending(false);
    }
  };

  const formatTs = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (ndkInitError) return <p className="error-message">Error initializing Nostr: {ndkInitError}</p>;
  
  const showConnectingMessage = isLoadingChat || (ndkReady === false && messages.length === 0 && !error && !ndkInitError);

  return (
    <div 
      className="chat-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100% - 40px)',
        maxHeight: '70vh',
        border: '1px solid #444',
        padding: '10px',
        boxSizing: 'border-box'
      }}
    >
      {error && <p className="error-message">Chat Error: {error}</p>}
      
      {ndkInitError && !error && <p className="error-message">Nostr Connection Error: {ndkInitError}</p>}
      
      {isLoadingChat && <p className="info-message">Loading messages...</p>}
      
      {!isLoadingChat && showConnectingMessage && messages.length === 0 && 
        <p className="info-message">Connecting to Nostr network for chat... (NDK Ready: {String(ndkReady)}, Relays: {relayCount})</p>
      }
      
      {!isLoadingChat && !showConnectingMessage && messages.length === 0 && !error && !ndkInitError &&
        <p>No messages yet. Start the conversation!</p>
      }

      <div 
        className="message-list"
        style={{
          flexGrow: 1, 
          overflowY: 'auto', 
          marginBottom: '10px',
          paddingRight: '5px'
        }}
      >
        {messages.map((evt) => {
          const raw = evt instanceof NDKEvent ? evt.rawEvent() : (evt.rawEvent ? evt.rawEvent() : evt);
          
          if (!raw || !raw.pubkey) {
            console.warn("Message object or pubkey is undefined, skipping rendering:", evt);
            return null; 
          }

          const authorProfile = messageAuthorProfiles.get(raw.pubkey);
          const displayName = authorProfile?.name || `${raw.pubkey.substring(0, 8)}…`;
          const avatarUrl = authorProfile?.picture;
          
          return (
            <div key={raw.id || JSON.stringify(raw)} className="message-item">
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={`${displayName}'s avatar`}
                  className="message-avatar"
                  onError={(e) => { e.target.style.display = 'none'; }}
                  loading="lazy"
                  width="40"
                  height="40"
                  style={{ borderRadius: '50%', marginRight: '10px', flexShrink: 0 }}
                />
              )}
              <div className="message-main-area">
                <p style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  <strong>{displayName}:</strong>{' '}
                  {raw.content.split(/(\s+)/).map((part, index) => {
                    if (part.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
                      return <img key={index} src={part} alt="Chat image" style={{ maxWidth: '100%', maxHeight: '200px', display: 'block', marginTop: '5px' }} loading="lazy" />;
                    }
                    if (part.match(/^https?:\/\/[^\s]+/)) {
                      return <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>;
                    }
                    return part; 
                  })}
                </p>
                <span className="timestamp">{formatTs(raw.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <form 
        onSubmit={handleSend} 
        className="message-input-form"
        style={{ display: 'flex', marginTop: 'auto' }}
      >
        <input 
          type="text" 
          value={messageText} 
          onChange={(e) => setMessageText(e.target.value)} 
          placeholder="Type your message…" 
          disabled={isSending || !groupId} 
          style={{ flexGrow: 1, marginRight: '5px' }}
        />
        <button 
          type="submit" 
          disabled={isSending || !groupId}
        >
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
};

ChatRoom.propTypes = {
  groupId: PropTypes.string.isRequired,
  naddrString: PropTypes.string,
  publicKey: PropTypes.string,
  relayHints: PropTypes.arrayOf(PropTypes.string)
};

export default ChatRoom; 