import { decode as decodeNip19 } from 'nostr-tools/nip19';

/**
 * Parse a NIP19 naddr string to extract group components
 * @param {string} naddrString - The naddr string to parse
 * @returns {Object|null} Parsed group data or null if invalid
 */
export const parseNaddr = (naddrString) => {
  try {
    if (!naddrString) {
      console.error('No naddr string provided to parseNaddr');
      return null;
    }
    
    console.log(`Attempting to parse naddr string: ${naddrString.substring(0, 30)}...`);
    
    // Decode the naddr string using nostr-tools NIP19 decoder
    const { type, data } = decodeNip19(naddrString);
    console.log('Decoded naddr data:', { type, data });
    
    if (type !== 'naddr' || !data) {
      console.error('Invalid naddr format - expected type "naddr"');
      return null;
    }
    
    const result = {
      kind: data.kind,
      pubkey: data.pubkey,
      identifier: data.identifier,
      relays: data.relays || []
    };
    
    console.log('Successfully parsed naddr to:', result);
    return result;
  } catch (error) {
    console.error('Error parsing naddr:', error);
    console.error('Problematic naddr string:', naddrString);
    return null;
  }
}; 