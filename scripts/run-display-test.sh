#!/bin/bash
echo "Running Run Display Consistency Test..."
echo ""
node scripts/test-display-consistency.js
echo ""
if [ $? -eq 0 ]; then
  echo "Test PASSED!"
else
  echo "Test FAILED!"
fi
read -p "Press Enter to continue..." 