// testNip29Improvements.js
// A test script to validate our improvements to the NIP-29 implementation

import { 
  hasJoinedGroup, 
  parseNaddr,
  getUserPublicKey 
} from '../utils/nostrClient';
import groupMembershipManager from '../services/GroupMembershipManager';
import groupChatManager from '../services/GroupChatManager';
import { SimplePool } from 'nostr-tools';

// Sample Nostr groups for testing
const TEST_GROUPS = {
  MESSI_CLUB: 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59',
  RUNSTR_CLUB: 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es'
};

// Display which methods are being tested
console.log("NIP-29 Improvements Test Script");
console.log("===============================");

// Add diagnostic SimplePool initialization at the top
console.log("Testing nostr-tools availability");

// Test direct SimplePool initialization
try {
  console.log("Testing direct SimplePool initialization");
  const testPool = new SimplePool();
  console.log("SimplePool initialized successfully");
  console.log("pool.list is a function:", typeof testPool.list === 'function');
  console.log("pool.sub is a function:", typeof testPool.sub === 'function');
} catch (e) {
  console.error("Error initializing SimplePool:", e.message);
}

// --- Test 1: Membership Verification Comparison ---
async function testMembershipVerification() {
  try {
    console.log("\n🧪 Test 1: Membership Verification Comparison");
    
    const pubkey = await getUserPublicKey();
    if (!pubkey) {
      console.error("❌ No user public key available - must be authenticated");
      return false;
    }
    
    console.log(`👤 Using pubkey: ${pubkey}`);
    
    // Test for each group
    for (const [groupName, naddr] of Object.entries(TEST_GROUPS)) {
      console.log(`\n📋 Testing membership for ${groupName}:`);
      
      // Parse group info
      const groupInfo = parseNaddr(naddr);
      if (!groupInfo) {
        console.error(`❌ Failed to parse naddr for ${groupName}`);
        continue;
      }
      
      console.log(`🔍 Group ID: ${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`);
      
      // Method 1: Original hasJoinedGroup
      console.log("\n1️⃣ Testing original hasJoinedGroup method...");
      console.time('originalMethod');
      try {
        const isMemberOriginal = await hasJoinedGroup(naddr);
        console.timeEnd('originalMethod');
        console.log(`   Result: ${isMemberOriginal ? '✅ Member' : '❌ Not a member'}`);
      } catch (error) {
        console.timeEnd('originalMethod');
        console.error(`   ❌ Error in original method: ${error.message}`);
      }
      
      // Method 2: New GroupMembershipManager - Cached check
      console.log("\n2️⃣ Testing new GroupMembershipManager (cached)...");
      console.time('newMethodCached');
      try {
        const isMemberNew = await groupMembershipManager.hasJoinedGroup(naddr, pubkey);
        console.timeEnd('newMethodCached');
        console.log(`   Result: ${isMemberNew ? '✅ Member' : '❌ Not a member'}`);
        
        // Check what's in the cache now
        const groupId = groupMembershipManager.getGroupId(groupInfo);
        const inCache = groupMembershipManager.membershipCache.has(groupId) &&
          groupMembershipManager.membershipCache.get(groupId).has(pubkey);
        console.log(`   Cache status: ${inCache ? '✅ In cache' : '❌ Not in cache'}`);
      } catch (error) {
        console.timeEnd('newMethodCached');
        console.error(`   ❌ Error in new method (cached): ${error.message}`);
      }
      
      // Method 3: New GroupMembershipManager - Force refresh
      console.log("\n3️⃣ Testing new GroupMembershipManager (force refresh)...");
      console.time('newMethodForced');
      try {
        const isMemberForced = await groupMembershipManager.hasJoinedGroup(naddr, pubkey, true);
        console.timeEnd('newMethodForced');
        console.log(`   Result: ${isMemberForced ? '✅ Member' : '❌ Not a member'}`);
      } catch (error) {
        console.timeEnd('newMethodForced');
        console.error(`   ❌ Error in new method (forced): ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    return false;
  }
}

// --- Test 2: Chat Messages Fetching Comparison ---
async function testChatMessagesFetching() {
  try {
    console.log("\n🧪 Test 2: Chat Messages Fetching Comparison");
    
    // Verify that the GroupChatManager has a properly initialized pool
    console.log("\n📋 Checking GroupChatManager pool initialization:");
    if (groupChatManager.pool) {
      console.log(`   ✅ Pool exists: ${!!groupChatManager.pool}`);
      console.log(`   ✅ pool.list is a function: ${typeof groupChatManager.pool.list === 'function'}`);
      console.log(`   ✅ pool.sub is a function: ${typeof groupChatManager.pool.sub === 'function'}`);
      
      // Try direct initialization to compare
      console.log("\n📋 Comparing with direct pool initialization:");
      const directPool = new SimplePool();
      console.log(`   Direct pool exists: ${!!directPool}`);
      console.log(`   Direct pool.list is a function: ${typeof directPool.list === 'function'}`);
      console.log(`   Direct pool.sub is a function: ${typeof directPool.sub === 'function'}`);
    } else {
      console.log(`   ❌ Pool does not exist`);
    }
    
    // Test the ensurePool method
    console.log("\n📋 Testing ensurePool method:");
    try {
      const pool = groupChatManager.ensurePool();
      console.log(`   ✅ ensurePool returned a pool: ${!!pool}`);
      console.log(`   ✅ Returned pool.list is a function: ${typeof pool.list === 'function'}`);
    } catch (e) {
      console.error(`   ❌ ensurePool failed: ${e.message}`);
    }
    
    // Test direct WebSocket fallback
    console.log("\n📋 Testing direct WebSocket fallback:");
    try {
      // Test WebSocket fallback directly - just to confirm WebSocket is working
      const ws = new WebSocket('wss://relay.damus.io');
      ws.onopen = () => {
        console.log(`   ✅ WebSocket connection established`);
        ws.close();
      };
      ws.onerror = (error) => {
        console.log(`   ❌ WebSocket error: ${error}`);
      };
    } catch (e) {
      console.error(`   ❌ WebSocket initialization failed: ${e.message}`);
    }
    
    // Test for each group
    for (const [groupName, naddr] of Object.entries(TEST_GROUPS)) {
      console.log(`\n📋 Testing message fetching for ${groupName}:`);
      
      // Method 1: Check cached messages
      console.log("\n1️⃣ Checking for cached messages...");
      const cachedMessages = groupChatManager.getCachedMessages(naddr);
      console.log(`   Found ${cachedMessages.length} cached messages`);
      
      // Method 2: Fetch fresh messages
      console.log("\n2️⃣ Fetching fresh messages with GroupChatManager...");
      console.time('newMessageFetch');
      try {
        // Create a new instance of the pool directly to test
        const testPool = new SimplePool();
        console.log(`   Direct SimplePool test - has list method: ${typeof testPool.list === 'function'}`);
        
        // Now try the actual fetch
        const messages = await groupChatManager.fetchGroupMessages(naddr, 20);
        console.timeEnd('newMessageFetch');
        console.log(`   Fetched ${messages.length} messages`);
        
        if (messages.length > 0) {
          const firstMsg = messages[0];
          console.log(`   First message: ${firstMsg.content.slice(0, 30)}... by ${firstMsg.pubkey.slice(0, 8)}`);
          console.log(`   First message timestamp: ${new Date(firstMsg.created_at * 1000).toLocaleString()}`);
        }
      } catch (error) {
        console.timeEnd('newMessageFetch');
        console.error(`   ❌ Error fetching messages: ${error.message}`);
        console.error(`   Error stack: ${error.stack}`);
      }
      
      // Method 3: Test the fallback mechanism directly
      console.log("\n3️⃣ Testing fallback mechanism manually...");
      try {
        const groupInfo = parseNaddr(naddr);
        if (groupInfo) {
          const groupId = `${groupInfo.kind}:${groupInfo.pubkey}:${groupInfo.identifier}`;
          const relays = ['wss://groups.0xchat.com', 'wss://relay.damus.io'];
          
          console.log(`   Attempting direct fetchGroupMessages from nostrClient`);
          const { fetchGroupMessages } = await import('../utils/nostrClient');
          const fallbackMessages = await fetchGroupMessages(groupId, relays);
          console.log(`   Fallback fetch returned ${fallbackMessages.length} messages`);
        }
      } catch (error) {
        console.error(`   ❌ Error in fallback test: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    return false;
  }
}

// --- Run all tests ---
async function runAllTests() {
  console.log("\n📡 Running all NIP-29 improvement tests...\n");
  
  // Set up user context for the chat manager
  const pubkey = await getUserPublicKey();
  if (pubkey) {
    groupChatManager.setUserContext(pubkey);
  }
  
  // Run test 1: Membership verification
  const test1Result = await testMembershipVerification();
  
  // Run test 2: Chat messages fetching
  const test2Result = await testChatMessagesFetching();
  
  // Final results
  console.log("\n=========================");
  console.log("🏁 Test Results Summary:");
  console.log(`   Membership Verification: ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Chat Messages Fetching: ${test2Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log("=========================");
}

// Export for use in browser console or in app
export { runAllTests, testMembershipVerification, testChatMessagesFetching };

// Auto-run if this file is loaded directly
if (typeof window !== 'undefined') {
  window.testNip29 = {
    runAllTests,
    testMembershipVerification,
    testChatMessagesFetching
  };
  console.log("Test functions available as window.testNip29");
}

// Log instructions for manual testing
console.log("\n📋 To run tests manually in console:");
console.log("   window.testNip29.runAllTests()");
console.log("   window.testNip29.testMembershipVerification()");
console.log("   window.testNip29.testChatMessagesFetching()"); 