// test-nip29-terminal.js
// Run with: node test-nip29-terminal.js

import { SimplePool } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import WebSocket from 'ws';

// Set WebSocket for Node.js environment
globalThis.WebSocket = WebSocket;

// Configure test data
const TEST_RELAYS = [
  'wss://groups.0xchat.com',
  'wss://relay.damus.io', 
  'wss://nos.lol'
];

// Test data - Using the correct naddr values from the app
const MESSI_CLUB_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59';
const RUNSTR_CLUB_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es';

// Create a pool with reasonable timeouts
const pool = new SimplePool({
  eoseSubTimeout: 10_000,
  getTimeout: 15_000,
  connectTimeout: 8_000
});

// Helper to color console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

// Helper function to parse naddr (similar to the app implementation for testing)
function parseNaddr(naddrString) {
  try {
    if (!naddrString) {
      console.error(`${colors.red}No naddr string provided to parseNaddr${colors.reset}`);
      return null;
    }
    
    console.log(`Attempting to parse naddr string: ${naddrString.substring(0, 30)}...`);
    
    // Decode the naddr string using nostr-tools NIP19 decoder
    const decodedData = nip19.decode(naddrString);
    console.log(`${colors.blue}Decoded naddr data:${colors.reset}`, JSON.stringify(decodedData, null, 2));
    
    if (!decodedData || !decodedData.data) {
      console.error(`${colors.red}Invalid naddr format - missing data after decoding${colors.reset}`);
      return null;
    }
    
    const { data } = decodedData;
    
    // Handle different data formats that might come from decode
    let naddrData;
    if (data.type === 'naddr') {
      // Handle case where decodedData.data itself has a 'type' property
      naddrData = data;
    } else if (data.kind && data.pubkey && data.identifier) {
      // Handle direct data format
      naddrData = data;
    } else {
      console.error(`${colors.red}Invalid naddr data structure:${colors.reset}`, data);
      return null;
    }
    
    const result = {
      kind: naddrData.kind,
      pubkey: naddrData.pubkey,
      identifier: naddrData.identifier,
      relays: naddrData.relays || []
    };
    
    console.log(`${colors.green}Successfully parsed naddr to:${colors.reset}`, result);
    return result;
  } catch (error) {
    console.error(`${colors.red}Error parsing naddr:${colors.reset}`, error);
    console.error(`${colors.red}Problematic naddr string:${colors.reset}`, naddrString);
    return null;
  }
}

// Test 1: Verify naddr parsing
async function testNadprParsing() {
  console.log(`\n${colors.cyan}🧪 TEST 1: Verifying naddr parsing...${colors.reset}`);
  let successCount = 0;
  
  console.log(`\n${colors.magenta}Testing Messi Club naddr:${colors.reset}`);
  const messiResult = parseNaddr(MESSI_CLUB_NADDR);
  if (messiResult) {
    console.log(`${colors.green}✅ Messi Club naddr parsed successfully${colors.reset}`);
    successCount++;
  } else {
    console.log(`${colors.red}❌ Failed to parse Messi Club naddr${colors.reset}`);
  }
  
  console.log(`\n${colors.magenta}Testing RUNSTR Club naddr:${colors.reset}`);
  const runstrResult = parseNaddr(RUNSTR_CLUB_NADDR);
  if (runstrResult) {
    console.log(`${colors.green}✅ RUNSTR Club naddr parsed successfully${colors.reset}`);
    successCount++;
  } else {
    console.log(`${colors.red}❌ Failed to parse RUNSTR Club naddr${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}Naddr parsing result: ${successCount}/2 successful${colors.reset}`);
  return { success: successCount === 2, messiResult, runstrResult };
}

// Test 2: Check relay connectivity
async function testRelayConnectivity() {
  console.log(`\n${colors.cyan}🧪 TEST 2: Testing relay connectivity...${colors.reset}`);
  const results = {};
  
  for (const relay of TEST_RELAYS) {
    try {
      console.log(`Connecting to ${relay}...`);
      const conn = pool.ensureRelay(relay);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for connection
      
      if (conn && conn.status >= 1) {
        console.log(`${colors.green}✅ Connected to ${relay} (status: ${conn.status})${colors.reset}`);
        results[relay] = true;
      } else {
        console.log(`${colors.red}❌ Failed to connect to ${relay} properly${colors.reset}`);
        results[relay] = false;
      }
    } catch (error) {
      console.error(`${colors.red}❌ Error connecting to ${relay}:${colors.reset}`, error.message);
      results[relay] = false;
    }
  }
  
  const successCount = Object.values(results).filter(Boolean).length;
  console.log(`\n${colors.cyan}Relay connectivity results: ${successCount}/${TEST_RELAYS.length} successful${colors.reset}`);
  
  return { success: successCount > 0, results };
}

// Test 3: Fetch group metadata
async function testFetchGroupMetadata(parsedInfo, relays, groupName) {
  console.log(`\n${colors.magenta}Testing metadata fetch for ${groupName}...${colors.reset}`);
  
  try {
    // Add groups.0xchat.com as a primary relay
    const groupRelays = [...new Set([
      'wss://groups.0xchat.com',
      ...(relays || [])
    ])];
    
    const filter = {
      kinds: [parsedInfo.kind], // Typically 39000 for NIP-29 groups
      authors: [parsedInfo.pubkey],
      '#d': [parsedInfo.identifier]
    };
    
    console.log(`${colors.blue}Using filter:${colors.reset}`, filter);
    console.log(`${colors.blue}Using relays:${colors.reset}`, groupRelays);
    
    const events = await pool.list(groupRelays, [filter]);
    
    if (!events || events.length === 0) {
      console.log(`${colors.red}❌ No metadata found for ${groupName}${colors.reset}`);
      return { success: false };
    }
    
    // Sort by created_at in descending order to get the latest
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    
    // Parse the content which contains the group metadata
    let metadata;
    try {
      metadata = JSON.parse(latestEvent.content);
      console.log(`${colors.green}✅ Successfully parsed metadata for ${groupName}:${colors.reset}`, metadata);
      return { success: true, metadata, event: latestEvent };
    } catch (e) {
      console.error(`${colors.red}❌ Error parsing group metadata content:${colors.reset}`, e);
      return { success: false, error: e };
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error fetching group metadata:${colors.reset}`, error);
    return { success: false, error };
  }
}

// Test 4: Fetch group messages
async function testFetchGroupMessages(parsedInfo, relays, groupName) {
  console.log(`\n${colors.magenta}Testing message fetch for ${groupName}...${colors.reset}`);
  
  try {
    // Format the e-tag for NIP-29 group messages (kind:pubkey:identifier)
    const groupId = `${parsedInfo.kind}:${parsedInfo.pubkey}:${parsedInfo.identifier}`;
    
    // Primary relay for NIP-29
    const messageRelays = [...new Set([
      'wss://groups.0xchat.com',
      ...(relays || [])
    ])];
    
    const filter = {
      kinds: [39001], // NIP-29 kind for group messages
      '#e': [groupId],
      limit: 5
    };
    
    console.log(`${colors.blue}Using filter:${colors.reset}`, filter);
    console.log(`${colors.blue}Using relays:${colors.reset}`, messageRelays);
    
    const events = await pool.list(messageRelays, [filter]);
    
    if (!events || events.length === 0) {
      console.log(`${colors.yellow}⚠️ No messages found for ${groupName}${colors.reset}`);
      return { success: true, messageCount: 0 }; // Success with 0 messages
    }
    
    console.log(`${colors.green}✅ Found ${events.length} messages for ${groupName}${colors.reset}`);
    return { success: true, messageCount: events.length, messages: events };
  } catch (error) {
    console.error(`${colors.red}❌ Error fetching group messages:${colors.reset}`, error);
    return { success: false, error };
  }
}

// Main test function
async function runTests() {
  console.log(`${colors.cyan}🧪🧪 RUNSTR NIP-29 DIAGNOSTIC TEST 🧪🧪${colors.reset}`);
  console.log(`${colors.cyan}=======================================${colors.reset}`);
  
  try {
    // Test 1: Verify naddr parsing
    const parsingResult = await testNadprParsing();
    
    if (!parsingResult.success) {
      console.log(`${colors.red}❌ Failed naddr parsing test - stopping tests${colors.reset}`);
      return;
    }
    
    // Test 2: Check relay connectivity
    const connectivityResult = await testRelayConnectivity();
    
    if (!connectivityResult.success) {
      console.log(`${colors.red}❌ Failed relay connectivity test - could not connect to any relay${colors.reset}`);
      console.log(`${colors.yellow}⚠️ Continuing tests but they might fail...${colors.reset}`);
    }
    
    // Test 3A: Fetch Messi Club Metadata
    const messiMetadataResult = await testFetchGroupMetadata(
      parsingResult.messiResult,
      parsingResult.messiResult.relays,
      "Messi Run Club"
    );
    
    // Test 3B: Fetch RUNSTR Club Metadata
    const runstrMetadataResult = await testFetchGroupMetadata(
      parsingResult.runstrResult,
      parsingResult.runstrResult.relays,
      "RUNSTR Club"
    );
    
    // Test 4A: Fetch Messi Club Messages
    const messiMessagesResult = await testFetchGroupMessages(
      parsingResult.messiResult,
      parsingResult.messiResult.relays,
      "Messi Run Club"
    );
    
    // Test 4B: Fetch RUNSTR Club Messages
    const runstrMessagesResult = await testFetchGroupMessages(
      parsingResult.runstrResult,
      parsingResult.runstrResult.relays,
      "RUNSTR Club"
    );
    
    // Summary
    console.log(`\n${colors.cyan}📊 TEST RESULTS SUMMARY 📊${colors.reset}`);
    console.log(`${colors.cyan}=========================${colors.reset}`);
    console.log(`${colors.blue}1. naddr Parsing:${colors.reset} ${parsingResult.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
    console.log(`${colors.blue}2. Relay Connectivity:${colors.reset} ${connectivityResult.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
    console.log(`${colors.blue}3a. Messi Club Metadata:${colors.reset} ${messiMetadataResult.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
    console.log(`${colors.blue}3b. RUNSTR Club Metadata:${colors.reset} ${runstrMetadataResult.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
    console.log(`${colors.blue}4a. Messi Club Messages:${colors.reset} ${messiMessagesResult.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset} (${messiMessagesResult.messageCount || 0} messages)`);
    console.log(`${colors.blue}4b. RUNSTR Club Messages:${colors.reset} ${runstrMessagesResult.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset} (${runstrMessagesResult.messageCount || 0} messages)`);
    
    // Compare hardcoded info with actual metadata
    if (messiMetadataResult.success) {
      console.log(`\n${colors.cyan}📝 COMPARING HARDCODED VS ACTUAL METADATA 📝${colors.reset}`);
      console.log(`${colors.cyan}==========================================${colors.reset}`);
      
      const hardcodedMessi = {
        name: "Messi Run Club",
        description: "Join Messi's running community! Share your runs, get inspired, and connect with fellow runners.",
        tags: ["Football", "Running", "Community"]
      };
      
      const actualMessi = messiMetadataResult.metadata;
      
      console.log(`${colors.yellow}Messi Club - Hardcoded:${colors.reset}`);
      console.log(`- Name: ${hardcodedMessi.name}`);
      console.log(`- Description: ${hardcodedMessi.description}`);
      
      console.log(`\n${colors.yellow}Messi Club - Actual Metadata:${colors.reset}`);
      console.log(`- Name: ${actualMessi.name || 'N/A'}`);
      console.log(`- About: ${actualMessi.about || 'N/A'}`);
      
      if (hardcodedMessi.name !== actualMessi.name || hardcodedMessi.description !== actualMessi.about) {
        console.log(`\n${colors.red}⚠️ MISMATCH DETECTED: The hardcoded information doesn't match the actual metadata${colors.reset}`);
        console.log(`${colors.yellow}This may explain why the app is displaying placeholders instead of real data${colors.reset}`);
      } else {
        console.log(`\n${colors.green}✅ MATCH: The hardcoded information matches the actual metadata${colors.reset}`);
      }
    }
    
    // Final diagnosis
    console.log(`\n${colors.cyan}🔍 DIAGNOSIS 🔍${colors.reset}`);
    console.log(`${colors.cyan}================${colors.reset}`);
    
    let issues = [];
    
    if (!parsingResult.success) issues.push("naddr parsing is failing");
    if (!connectivityResult.success) issues.push("relay connectivity is failing");
    if (!messiMetadataResult.success || !runstrMetadataResult.success) issues.push("metadata fetching is failing");
    if (!messiMessagesResult.success || !runstrMessagesResult.success) issues.push("message fetching is failing");
    
    if (issues.length > 0) {
      console.log(`${colors.red}The following issues were detected:${colors.reset}`);
      issues.forEach(issue => console.log(`${colors.red}- ${issue}${colors.reset}`));
      
      console.log(`\n${colors.yellow}RECOMMENDATIONS:${colors.reset}`);
      console.log(`1. Check network connectivity in the mobile environment`);
      console.log(`2. Verify the authentication process is correctly storing the public key`);
      console.log(`3. Update the GroupDiscoveryScreen to better handle fetch failures`);
      console.log(`4. Improve error handling in the TeamDetail component`);
    } else {
      console.log(`${colors.green}All core NIP-29 functionality appears to be working properly.${colors.reset}`);
      console.log(`${colors.yellow}The issue might be related to:${colors.reset}`);
      console.log(`1. Authentication and user public key retrieval in the mobile environment`);
      console.log(`2. Navigation and URL parameter handling between screens`);
      console.log(`3. Mobile-specific UI rendering issues`);
    }
    
  } catch (error) {
    console.error(`${colors.red}Unexpected error during tests:${colors.reset}`, error);
  } finally {
    // Clean up pool connections
    pool.close(TEST_RELAYS);
    console.log(`\n${colors.cyan}Tests completed. Pool connections closed.${colors.reset}`);
  }
}

// Run the tests
runTests(); 