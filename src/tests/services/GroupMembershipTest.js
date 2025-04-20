// GroupMembershipTest.js
// A simple test script to verify the GroupMembershipManager functionality

import groupMembershipManager from '../services/GroupMembershipManager';
import { getUserPublicKey } from '../utils/nostrClient';

// Sample group from your codebase - Messi Run Club
const TEST_GROUP_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59';

// Test function
async function testGroupMembership() {
  try {
    console.log("=== Testing GroupMembershipManager ===");
    
    // Get current user's public key
    const userPubkey = await getUserPublicKey();
    if (!userPubkey) {
      console.error("No user public key available - must be authenticated");
      return;
    }
    
    console.log(`User pubkey: ${userPubkey}`);
    
    // Parse the naddr to verify it works
    const groupInfo = groupMembershipManager.parseNaddr(TEST_GROUP_NADDR);
    console.log("Parsed group info:", groupInfo);
    
    if (!groupInfo) {
      console.error("Failed to parse test group naddr");
      return;
    }
    
    const groupId = groupMembershipManager.getGroupId(groupInfo);
    console.log(`Group ID: ${groupId}`);
    
    // Test relays
    const relays = groupMembershipManager.getGroupRelays(groupInfo);
    console.log(`Will check ${relays.length} relays:`, relays);
    
    // Check cached membership first (if any)
    console.log("Checking cache first...");
    const cachedStatus = groupMembershipManager.membershipCache.has(groupId) && 
      groupMembershipManager.membershipCache.get(groupId).has(userPubkey);
    console.log(`Cached membership status: ${cachedStatus ? 'Member' : 'Not in cache'}`);
    
    // Check membership with the new manager
    console.log("Checking membership status (this may take a moment)...");
    console.time('membershipCheck');
    const isMember = await groupMembershipManager.hasJoinedGroup(TEST_GROUP_NADDR, userPubkey);
    console.timeEnd('membershipCheck');
    
    console.log(`\nMembership result: ${isMember ? '✓ Member' : '✗ Not a member'}`);
    
    // Verify cache was updated
    const newCachedStatus = groupMembershipManager.membershipCache.has(groupId) && 
      groupMembershipManager.membershipCache.get(groupId).has(userPubkey);
    console.log(`Updated cached status: ${newCachedStatus ? 'In cache as member' : 'Not in cache'}`);
    
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

// Export for use in browser console or component
export { testGroupMembership };

// Auto-run if this file is loaded directly (for testing in browser console)
if (typeof window !== 'undefined') {
  window.testGroupMembership = testGroupMembership;
  console.log("Test function available as window.testGroupMembership()");
} 