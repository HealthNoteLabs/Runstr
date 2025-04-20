// Wavlake API service for interacting with Wavlake API endpoints
// This includes functionality for fetching content and handling LNURL payments

const WAVLAKE_API_BASE_URL = 'https://wavlake.com/api/v1';
const WAVLAKE_APP_ID = import.meta.env.VITE_WAVLAKE_APP_ID || 'runstr-app'; // This should be obtained from Wavlake

/**
 * Base fetch function with headers and error handling
 */
const fetchWithHeaders = async (endpoint, options = {}) => {
  try {
    const url = `${WAVLAKE_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

/**
 * Get stream URL for a track
 */
const getStreamUrl = async (trackId) => {
  if (!trackId) throw new Error('Track ID is required');
  
  try {
    // This would be replaced with an actual endpoint that returns the stream URL
    // For now we just construct the URL based on the track ID
    return {
      url: `${WAVLAKE_API_BASE_URL}/stream/track/${trackId}`
    };
  } catch (error) {
    console.error('Error getting stream URL:', error);
    throw error;
  }
};

/**
 * Get LNURL for making a Bitcoin payment to the content creator
 * @param {string} contentId - ID of the content (track, album, etc.)
 * @returns {Promise<object>} - Object containing the LNURL
 */
const getLnurlForContent = async (contentId) => {
  if (!contentId) throw new Error('Content ID is required');
  
  try {
    const data = await fetchWithHeaders(
      `/lnurl?contentId=${contentId}&appId=${WAVLAKE_APP_ID}`
    );
    
    if (!data || !data.lnurl) {
      throw new Error('Invalid LNURL response from Wavlake API');
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching LNURL:', error);
    throw error;
  }
};

/**
 * Process an LNURL payment using a connected Lightning wallet
 * @param {string} lnurl - The LNURL string for the payment
 * @param {object} walletProvider - Lightning wallet provider (e.g., NWCWallet instance)
 * @param {number} amount - Amount in sats to pay (optional, depends on the LNURL)
 * @returns {Promise<object>} - Payment response
 */
const processLnurlPayment = async (lnurl, walletProvider, amount = null) => {
  if (!lnurl) throw new Error('LNURL is required');
  if (!walletProvider) throw new Error('Wallet provider is required');
  
  try {
    // First we need to call the LNURL to get the callback
    const response = await fetch(lnurl);
    if (!response.ok) throw new Error('Failed to process LNURL');
    
    const lnurlData = await response.json();
    
    // Check if this is a valid LNURL-pay response
    if (!lnurlData.callback || lnurlData.tag !== 'payRequest') {
      throw new Error('Invalid LNURL-pay response');
    }
    
    // Determine the amount to send
    let payAmount = amount;
    if (!payAmount && lnurlData.minSendable && lnurlData.maxSendable) {
      // Use minimum if no specific amount is provided
      payAmount = Math.ceil(lnurlData.minSendable / 1000); // Convert msats to sats
    }
    
    if (!payAmount) {
      throw new Error('Payment amount is required');
    }
    
    // Build the payment request URL
    const callbackUrl = new URL(lnurlData.callback);
    callbackUrl.searchParams.append('amount', payAmount * 1000); // Convert to msats
    
    // Get the payment request (invoice)
    const invoiceResponse = await fetch(callbackUrl.toString());
    if (!invoiceResponse.ok) throw new Error('Failed to generate invoice');
    
    const invoiceData = await invoiceResponse.json();
    if (!invoiceData.pr) throw new Error('No payment request in response');
    
    // Make the payment with the wallet
    const paymentResponse = await walletProvider.makePayment(invoiceData.pr);
    
    return {
      success: true,
      paymentHash: paymentResponse.preimage || paymentResponse.paymentHash,
      amount: payAmount
    };
  } catch (error) {
    console.error('Error processing LNURL payment:', error);
    throw error;
  }
};

/**
 * Get trending tracks with optional filtering
 */
const getTrendingTracks = async ({ genre = null, days = 7, limit = 40 } = {}) => {
  try {
    let endpoint = `/content/rankings?sort=sats&days=${days}&limit=${limit}`;
    if (genre) {
      endpoint += `&genre=${encodeURIComponent(genre)}`;
    }
    
    const data = await fetchWithHeaders(endpoint);
    return { tracks: Array.isArray(data) ? data : [] };
  } catch (error) {
    console.error('Error fetching trending tracks:', error);
    throw error;
  }
};

/**
 * Search for tracks
 */
const searchTracks = async (term) => {
  if (!term) return { tracks: [] };
  
  try {
    const data = await fetchWithHeaders(
      `/content/search?term=${encodeURIComponent(term)}`
    );
    
    // Filter to only include tracks from search results
    const tracks = Array.isArray(data) 
      ? data.filter(item => item.type === 'track')
      : [];
      
    return { tracks };
  } catch (error) {
    console.error('Error searching tracks:', error);
    throw error;
  }
};

// Export the API methods
export const wavlakeApi = {
  getStreamUrl,
  getLnurlForContent,
  processLnurlPayment,
  getTrendingTracks,
  searchTracks
}; 