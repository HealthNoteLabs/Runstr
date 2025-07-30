#!/bin/bash

# Test script for zapstore CLI
# This script helps verify the CLI works before running the full workflow

echo "=== Testing Zapstore CLI ==="

# Check if zapstore is installed
if ! command -v zapstore &> /dev/null; then
    echo "❌ zapstore CLI not found. Installing..."
    
    # Download latest CLI
    curl -L https://cdn.zapstore.dev/latest/zapstore-linux -o zapstore
    chmod +x zapstore
    sudo mv zapstore /usr/local/bin/ || mv zapstore ~/.local/bin/
    
    # Try to update to latest
    yes | zapstore install zapstore || echo "Self-update failed, continuing..."
fi

# Check version
echo "Zapstore CLI version:"
zapstore --version

# Test basic functionality
echo ""
echo "Testing basic CLI functionality..."
zapstore --help | head -10

echo ""
echo "✅ Zapstore CLI test completed"
echo ""
echo "To test publish (requires NSEC secret):"
echo "  zapstore publish runstr --verbose --debug-network -a your-app.apk -v 1.0.0" 