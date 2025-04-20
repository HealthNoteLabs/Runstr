import WebSocket from 'ws';
import { nip19 } from 'nostr-tools';
import process from 'process';

// Test configuration
const TEST_RELAYS = [
  'wss://groups.0xchat.com',
  'wss://relay.damus.io',
  'wss://nos.lol'
];

// Test data - Using correct naddr values from GroupDiscoveryScreen.js
const MESSI_CLUB_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59';
const RUNSTR_CLUB_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es';

// Test cases
async function testNaddrParsing() {
  console.log('🧪 Testing naddr parsing...');
  try {
    const messiClubData = nip19.decode(MESSI_CLUB_NADDR);
    const runstrClubData = nip19.decode(RUNSTR_CLUB_NADDR);
    
    if (messiClubData && runstrClubData) {
      console.log('✅ Successfully parsed both club naddrs');
      console.log('Messi Club Data:', JSON.stringify(messiClubData.data, null, 2));
      console.log('RUNSTR Club Data:', JSON.stringify(runstrClubData.data, null, 2));
      return true;
    } else {
      console.log('❌ Failed to parse one or both club naddrs');
      return false;
    }
  } catch (error) {
    console.error('❌ Error parsing naddrs:', error.message);
    return false;
  }
}

async function testRelayConnections() {
  console.log('🧪 Testing relay connections...');
  let successCount = 0;
  
  const connectionPromises = TEST_RELAYS.map(async (relay) => {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(relay);
        
        ws.on('open', () => {
          console.log(`✅ Successfully connected to ${relay}`);
          ws.close();
          successCount++;
          resolve();
        });
        
        ws.on('error', (error) => {
          console.error(`❌ Failed to connect to ${relay}:`, error.message);
          resolve();
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.error(`❌ Connection timeout for ${relay}`);
            ws.close();
            resolve();
          }
        }, 5000);
      } catch (error) {
        console.error(`❌ Error creating WebSocket for ${relay}:`, error.message);
        resolve();
      }
    });
  });
  
  await Promise.all(connectionPromises);
  return successCount > 0;
}

async function testGroupMetadata() {
  console.log('🧪 Testing group metadata fetch...');
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(TEST_RELAYS[0]); // Using 0xchat groups relay
      let receivedMetadata = false;
      
      ws.on('open', () => {
        const { data } = nip19.decode(MESSI_CLUB_NADDR);
        const filter = {
          kinds: [data.kind],
          authors: [data.pubkey],
          '#d': [data.identifier]
        };
        
        ws.send(JSON.stringify(['REQ', 'metadata', filter]));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message[0] === 'EVENT' && message[1] === 'metadata') {
          console.log('✅ Successfully received group metadata');
          console.log('Metadata:', JSON.stringify(message[2], null, 2));
          receivedMetadata = true;
          ws.close();
          resolve(true);
        }
      });
      
      ws.on('error', (error) => {
        console.error('❌ Error fetching metadata:', error.message);
        ws.close();
        resolve(false);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!receivedMetadata) {
          console.error('❌ Metadata fetch timeout');
          ws.close();
          resolve(false);
        }
      }, 10000);
    } catch (error) {
      console.error('❌ Error in metadata test:', error.message);
      resolve(false);
    }
  });
}

async function testGroupMessages() {
  console.log('🧪 Testing group messages fetch...');
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(TEST_RELAYS[0]); // Using 0xchat groups relay
      let messageCount = 0;
      
      ws.on('open', () => {
        const { data } = nip19.decode(MESSI_CLUB_NADDR);
        const filter = {
          kinds: [39001], // Using correct kind for group messages
          '#e': [data.identifier], // Using 'e' tag for group reference
          limit: 10
        };
        
        console.log('Requesting messages with filter:', JSON.stringify(filter, null, 2));
        ws.send(JSON.stringify(['REQ', 'messages', filter]));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message[0] === 'EVENT') {
          messageCount++;
          if (messageCount === 1) {
            console.log('✅ Successfully received group messages');
            console.log('First message:', JSON.stringify(message[2], null, 2));
            ws.close();
            resolve(true);
          }
        } else if (message[0] === 'EOSE') {
          if (messageCount === 0) {
            console.log('ℹ️ No messages found in the group');
            ws.close();
            resolve(true); // Consider this a pass since we got EOSE
          }
        }
      });
      
      ws.on('error', (error) => {
        console.error('❌ Error fetching messages:', error.message);
        ws.close();
        resolve(false);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (messageCount === 0) {
          console.error('❌ Messages fetch timeout');
          ws.close();
          resolve(false);
        }
      }, 10000);
    } catch (error) {
      console.error('❌ Error in messages test:', error.message);
      resolve(false);
    }
  });
}

async function runTests() {
  console.log('🚀 Starting NIP-29 implementation tests...\n');
  
  const testResults = await Promise.all([
    testNaddrParsing(),
    testRelayConnections(),
    testGroupMetadata(),
    testGroupMessages()
  ]);
  
  const passedTests = testResults.filter(result => result).length;
  const totalTests = testResults.length;
  
  console.log('\n📊 Test Summary:');
  console.log(`Passed: ${passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('\n✨ All tests passed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the logs above.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Fatal error running tests:', error);
  process.exit(1);
}); 