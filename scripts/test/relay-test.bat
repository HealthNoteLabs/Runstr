@echo off
echo ===== NOSTR RELAY CONNECTIVITY TEST =====
echo Testing relay connections...
echo.

REM Default relays to test
set RELAYS=wss://relay.damus.io wss://nos.lol wss://relay.nostr.band wss://relay.snort.social wss://relay.current.fyi wss://nostr.wine wss://eden.nostr.land wss://e.nos.lol

set SUCCESSFUL=0
set TOTAL=8

echo Testing relay connections using Node.js...
echo.

for %%r in (%RELAYS%) do (
    echo Testing %%r...
    node -e "const WebSocket = require('ws'); const ws = new WebSocket('%%r'); let connected = false; ws.on('open', () => { console.log('✓ Connected'); connected = true; ws.close(); }); ws.on('error', () => { console.log('✗ Failed'); ws.close(); }); setTimeout(() => { if (!connected) { console.log('✗ Timed out'); ws.close(); } }, 5000);"
    echo.
)

echo.
echo ===== TEST SUMMARY =====
echo Running the connection tests completed. 
echo If some relays failed, this is normal - your app should still work with multiple relays.
echo.
echo Next step: Run npm run test-hashtag to test fetching running-related posts 