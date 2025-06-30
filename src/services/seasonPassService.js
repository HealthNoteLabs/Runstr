import { SEASON_1_CONFIG } from '../config/seasonConfig.js';

/**
 * Season Pass Service
 * Handles participant registration, tracking, and local storage management
 * for RUNSTR Season 1.
 */

// LocalStorage keys from config
const { storageKeys } = SEASON_1_CONFIG;

/**
 * Initialize participant storage structure if it doesn't exist
 */
function initializeStorage() {
  try {
    if (!localStorage.getItem(storageKeys.participants)) {
      localStorage.setItem(storageKeys.participants, JSON.stringify([]));
    }
    if (!localStorage.getItem(storageKeys.lastUpdated)) {
      localStorage.setItem(storageKeys.lastUpdated, new Date().toISOString());
    }
  } catch (error) {
    console.error('[SeasonPassService] Failed to initialize storage:', error);
  }
}

/**
 * Register a user as a season participant after successful payment
 * @param {string} userPubkey - User's nostr public key
 * @param {object} paymentDetails - Payment transaction details
 * @returns {object} Registration result
 */
export async function registerForSeason(userPubkey, paymentDetails = {}) {
  try {
    if (!userPubkey) {
      return { success: false, error: 'User pubkey is required' };
    }

    initializeStorage();

    // Check if already registered
    if (isParticipant(userPubkey)) {
      return { success: false, error: 'User is already registered for Season 1' };
    }

    // Get current participants
    const participants = getParticipantList();
    
    // Create participant record
    const participantRecord = {
      pubkey: userPubkey,
      registeredAt: new Date().toISOString(),
      seasonId: SEASON_1_CONFIG.id,
      paymentAmount: SEASON_1_CONFIG.seasonPassPrice,
      paymentDetails: {
        txid: paymentDetails.txid || null,
        invoice: paymentDetails.invoice || null,
        paidAt: paymentDetails.paidAt || new Date().toISOString(),
        ...paymentDetails
      },
      status: 'active'
    };

    // Add to participants list
    participants.push(participantRecord);
    
    // Update storage
    localStorage.setItem(storageKeys.participants, JSON.stringify(participants));
    localStorage.setItem(storageKeys.lastUpdated, new Date().toISOString());
    
    // Set user status
    setUserParticipantStatus(userPubkey, true);

    console.log(`[SeasonPassService] Registered participant: ${userPubkey}`);
    
    return { 
      success: true, 
      participant: participantRecord,
      totalParticipants: participants.length
    };

  } catch (error) {
    console.error('[SeasonPassService] Registration failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user is a registered participant
 * @param {string} userPubkey - User's nostr public key
 * @returns {boolean} True if user is a participant
 */
export function isParticipant(userPubkey) {
  try {
    if (!userPubkey) return false;
    
    initializeStorage();
    
    // Quick check from user status cache
    const userStatus = localStorage.getItem(`${storageKeys.userStatus}_${userPubkey}`);
    if (userStatus !== null) {
      return userStatus === 'true';
    }

    // Fallback to participant list lookup
    const participants = getParticipantList();
    const isRegistered = participants.some(p => p.pubkey === userPubkey && p.status === 'active');
    
    // Cache the result
    setUserParticipantStatus(userPubkey, isRegistered);
    
    return isRegistered;
  } catch (error) {
    console.error('[SeasonPassService] Error checking participant status:', error);
    return false;
  }
}

/**
 * Get all registered participants
 * @returns {Array} List of participant records
 */
export function getParticipantList() {
  try {
    initializeStorage();
    const stored = localStorage.getItem(storageKeys.participants);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[SeasonPassService] Error getting participant list:', error);
    return [];
  }
}

/**
 * Get list of participant pubkeys only (for filtering)
 * @returns {Array} Array of pubkey strings
 */
export function getParticipantPubkeys() {
  try {
    const participants = getParticipantList();
    return participants
      .filter(p => p.status === 'active')
      .map(p => p.pubkey);
  } catch (error) {
    console.error('[SeasonPassService] Error getting participant pubkeys:', error);
    return [];
  }
}

/**
 * Get season progress for a specific user
 * @param {string} userPubkey - User's nostr public key
 * @returns {object} Progress information
 */
export function getSeasonProgress(userPubkey) {
  try {
    if (!isParticipant(userPubkey)) {
      return { 
        isParticipant: false, 
        error: 'User is not a season participant' 
      };
    }

    const participants = getParticipantList();
    const participant = participants.find(p => p.pubkey === userPubkey);
    
    if (!participant) {
      return { 
        isParticipant: false, 
        error: 'Participant record not found' 
      };
    }

    const now = new Date();
    const seasonStart = new Date(SEASON_1_CONFIG.startDate);
    const seasonEnd = new Date(SEASON_1_CONFIG.endDate);
    const registeredDate = new Date(participant.registeredAt);

    return {
      isParticipant: true,
      seasonId: SEASON_1_CONFIG.id,
      seasonName: SEASON_1_CONFIG.name,
      registeredAt: participant.registeredAt,
      daysRegistered: Math.floor((now - registeredDate) / (1000 * 60 * 60 * 24)),
      seasonProgress: {
        started: now >= seasonStart,
        ended: now > seasonEnd,
        daysRemaining: Math.max(0, Math.ceil((seasonEnd - now) / (1000 * 60 * 60 * 24))),
        totalDays: Math.ceil((seasonEnd - seasonStart) / (1000 * 60 * 60 * 24))
      },
      participant
    };
  } catch (error) {
    console.error('[SeasonPassService] Error getting season progress:', error);
    return { isParticipant: false, error: error.message };
  }
}

/**
 * Set user participant status in cache
 * @param {string} userPubkey - User's nostr public key
 * @param {boolean} isParticipant - Participant status
 */
function setUserParticipantStatus(userPubkey, isParticipant) {
  try {
    localStorage.setItem(`${storageKeys.userStatus}_${userPubkey}`, isParticipant.toString());
  } catch (error) {
    console.error('[SeasonPassService] Error setting user status:', error);
  }
}

/**
 * Get season statistics
 * @returns {object} Season statistics
 */
export function getSeasonStats() {
  try {
    const participants = getParticipantList();
    const activeParticipants = participants.filter(p => p.status === 'active');
    
    const now = new Date();
    const seasonStart = new Date(SEASON_1_CONFIG.startDate);
    const seasonEnd = new Date(SEASON_1_CONFIG.endDate);

    return {
      totalParticipants: activeParticipants.length,
      totalRevenue: activeParticipants.length * SEASON_1_CONFIG.seasonPassPrice,
      seasonStatus: now < seasonStart ? 'upcoming' : now > seasonEnd ? 'ended' : 'active',
      daysRemaining: Math.max(0, Math.ceil((seasonEnd - now) / (1000 * 60 * 60 * 24))),
      lastUpdated: localStorage.getItem(storageKeys.lastUpdated)
    };
  } catch (error) {
    console.error('[SeasonPassService] Error getting season stats:', error);
    return {
      totalParticipants: 0,
      totalRevenue: 0,
      seasonStatus: 'unknown',
      daysRemaining: 0,
      lastUpdated: null
    };
  }
}

/**
 * Clear all season data (for testing/reset)
 * WARNING: This will remove all participant data
 */
export function clearSeasonData() {
  try {
    localStorage.removeItem(storageKeys.participants);
    localStorage.removeItem(storageKeys.lastUpdated);
    
    // Clear all user status cache entries
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(storageKeys.userStatus)) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[SeasonPassService] Season data cleared');
    return { success: true };
  } catch (error) {
    console.error('[SeasonPassService] Error clearing season data:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Export/backup participant data
 * @returns {object} Exportable participant data
 */
export function exportParticipantData() {
  try {
    return {
      seasonId: SEASON_1_CONFIG.id,
      exportedAt: new Date().toISOString(),
      participants: getParticipantList(),
      stats: getSeasonStats()
    };
  } catch (error) {
    console.error('[SeasonPassService] Error exporting data:', error);
    return null;
  }
}

// Initialize storage on module load
initializeStorage();

export default {
  registerForSeason,
  isParticipant,
  getParticipantList,
  getParticipantPubkeys,
  getSeasonProgress,
  getSeasonStats,
  clearSeasonData,
  exportParticipantData
}; 