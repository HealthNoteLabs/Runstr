const path = require('path');
const WebSocket = require('ws');
const { nip19 } = require('nostr-tools');
const NDK = require('@nostr-dev-kit/ndk').default;
const { NostrContext } = require('../src/contexts/NostrContext.tsx'); // Assuming NostrContext is the main export now

// Require modules directly at the top, relying on esbuild-register
const { fetchGroupMetadataByNaddr, fetchGroupMessages } = require('../src/utils/ndkGroups.js');

// --- Configuration ---
const TARGET_NADDR = 'naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es'; // #RUNSTR group naddr

// --- Main Execution ---
(async () => {
    console.log('--- Starting NIP-29 Debug Script ---');
    console.log(`Target Group Naddr: ${TARGET_NADDR.substring(0, 20)}...`);

    try {
        // Modules are already required above
        console.log('\n--- 1. Modules Loaded (required above) ---');

        // 2. Initialize NDK
        console.log('\n--- 2. Initializing NDK ---');
        // TEMPORARILY OVERRIDE RELAYS for broader search
        const tempRelays = [
          'wss://relay.damus.io',
          'wss://nos.lol',
          'wss://relay.nostr.band',
          'wss://relay.snort.social',
          'wss://purplepag.es',
          'wss://nostr.wine',
          'wss://nostr-pub.wellorder.net',
          'wss://relay.nostr.info',
          'wss://offchain.pub',
          'wss://relay.primal.net',
          'wss://groups.0xchat.com/' 
        ];
        console.log('TEMPORARY: Overriding NDK relays for testing:', tempRelays);
        ndk.explicitRelayUrls = tempRelays; // Set relays on the imported ndk instance

        // Call the imported initNdk function
        const initResult = await initNdk(); 
        const connected = initResult?.connected;
        const signerPubkey = initResult?.pubkey;
        console.log(`NDK Initialization Result: Connected=${connected}, Signer Pubkey=${signerPubkey || 'None'}`);
        if (!connected) {
            console.error('>>> NDK failed to connect or initNdk did not return expected result. Aborting script.');
            process.exit(1);
        }
        console.log('NDK initialized successfully.');

        // 3. Fetch Group Metadata
        console.log(`\n--- 3. Fetching Metadata for ${TARGET_NADDR.substring(0, 20)}... ---`);
        const metadataEvent = await fetchGroupMetadataByNaddr(TARGET_NADDR);

        if (!metadataEvent) {
            console.error('>>> Failed to fetch group metadata.');
            process.exit(1);
        }
        console.log('Group Metadata Event Found:');
        // Using console.dir for better object inspection
        console.dir(metadataEvent, { depth: null });

        // 4. Extract Group ID and Fetch Messages
        console.log('\n--- 4. Fetching Messages ---');
        // Extract the 'd' tag (identifier) - assuming it's present from successful metadata fetch
        const dTag = metadataEvent.tags?.find(t => t[0] === 'd');
        const groupId = dTag ? dTag[1] : null;

        if (!groupId) {
            console.error('>>> Could not extract group ID (\'d\' tag) from metadata event.');
            process.exit(1);
        }
        console.log(`Extracted Group ID: ${groupId}`);

        const messages = await fetchGroupMessages(groupId, 10); // Fetch last 10 messages

        if (!messages || messages.length === 0) {
            console.warn('>>> No messages found for this group (or fetch failed).');
        } else {
            console.log(`Found ${messages.length} messages:`);
            messages.forEach((msg, index) => {
                // Access NDKEvent properties correctly
                console.log(`  [${index + 1}] ${new Date(msg.created_at * 1000).toISOString()} - ${msg.pubkey.substring(0, 8)}...: ${msg.content}`);
            });
        }

    } catch (error) {
        console.error('\n--- SCRIPT ERROR ---');
        console.error(error);
        process.exit(1);
    }

    console.log('\n--- Script Finished Successfully ---');
    process.exit(0); // Ensure clean exit

})(); 