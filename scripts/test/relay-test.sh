#!/bin/bash

echo "===== NOSTR RELAY CONNECTIVITY TEST ====="
echo "Testing relay connections..."

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# List of popular Nostr relays to test
RELAYS=(
  "wss://relay.damus.io"
  "wss://nos.lol"
  "wss://relay.nostr.band"
  "wss://relay.snort.social"
  "wss://relay.current.fyi"
  "wss://nostr.wine"
  "wss://eden.nostr.land"
  "wss://e.nos.lol"
)

# Function to test if we can connect to a relay
test_relay() {
  local relay=$1
  # Try to establish a WebSocket connection and see if it responds
  if command -v websocat &> /dev/null; then
    # If websocat is available, use it
    echo -n "Testing $relay: "
    if timeout 5s websocat --no-close $relay > /dev/null 2>&1 <<< '["REQ", "test", {"kinds":[1], "limit":1}]'; then
      echo -e "${GREEN}✓ Connected${NC}"
      return 0
    else
      echo -e "${RED}✗ Failed${NC}"
      return 1
    fi
  elif command -v wscat &> /dev/null; then
    # If wscat is available, use it
    echo -n "Testing $relay: "
    if timeout 5s wscat -c $relay > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Connected${NC}"
      return 0
    else
      echo -e "${RED}✗ Failed${NC}"
      return 1
    fi
  else
    # Fall back to curl to at least check if the host is reachable
    echo -n "Testing $relay (basic check): "
    # Extract host from WebSocket URL
    local host=$(echo $relay | sed 's|wss://||' | sed 's|/.*||')
    if curl --connect-timeout 5 -s "https://$host" > /dev/null; then
      echo -e "${YELLOW}? Host reachable but can't verify WebSocket${NC}"
      echo -e "${YELLOW}Please install websocat or wscat for proper WebSocket testing${NC}"
      return 2
    else
      echo -e "${RED}✗ Host unreachable${NC}"
      return 1
    fi
  fi
}

# Track successful connections
SUCCESSFUL=0
TOTAL=${#RELAYS[@]}

# Test each relay
for relay in "${RELAYS[@]}"; do
  if test_relay "$relay"; then
    SUCCESSFUL=$((SUCCESSFUL + 1))
  fi
done

echo ""
echo "===== TEST SUMMARY ====="
echo "Successfully connected to $SUCCESSFUL out of $TOTAL relays"

if [ $SUCCESSFUL -eq 0 ]; then
  echo -e "${RED}No successful connections. Check your internet connection or firewall settings.${NC}"
  exit 1
elif [ $SUCCESSFUL -lt $TOTAL ]; then
  echo -e "${YELLOW}Some relays are not available. This is normal and your app should still work.${NC}"
else
  echo -e "${GREEN}All relays are accessible! Your network connection looks good.${NC}"
fi

# Installation instructions for better WebSocket testing
if ! command -v websocat &> /dev/null && ! command -v wscat &> /dev/null; then
  echo ""
  echo "===== INSTALLATION SUGGESTIONS ====="
  echo "For better testing, consider installing a WebSocket client:"
  echo "Option 1: npm install -g wscat"
  echo "Option 2: cargo install websocat"
fi

echo ""
echo "Next step: Run hashtag-test.js to test fetching running-related posts" 