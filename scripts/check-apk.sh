#!/bin/bash
# check-apk.sh - Tool to check APK files for problematic metadata and signature status
# Usage: ./check-apk.sh <path-to-apk>

set -e  # Exit on error

# Check for required tools
if ! command -v unzip >/dev/null; then
  echo "❌ Error: Required tool 'unzip' not found. Please install it."
  exit 1
fi

# Check if input file is provided
if [ $# -lt 1 ]; then
  echo "❌ Error: No APK file specified."
  echo "Usage: $0 <path-to-apk>"
  exit 1
fi

APK_FILE="$1"

# Check if the file exists and is an APK
if [ ! -f "$APK_FILE" ]; then
  echo "❌ Error: File '$APK_FILE' not found."
  exit 1
fi

echo "Analyzing APK: $APK_FILE"
echo "-------------------------"

# Check if it's a valid APK
if ! unzip -l "$APK_FILE" | grep -q "AndroidManifest.xml"; then
  echo "❌ Error: '$APK_FILE' does not appear to be a valid APK (no AndroidManifest.xml found)."
  exit 1
fi

echo "✅ Valid APK file detected"

# Create temporary working directory
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Check signature
echo ""
echo "Checking APK signature..."
if unzip -l "$APK_FILE" | grep -q "META-INF/.*\.RSA"; then
  echo "✅ APK appears to be signed (found .RSA files)"
  
  # Extract signature files for inspection
  unzip -q "$APK_FILE" "META-INF/*.RSA" -d "$TEMP_DIR" 2>/dev/null || true
  
  # Count signature files
  SIG_COUNT=$(find "$TEMP_DIR/META-INF" -name "*.RSA" | wc -l)
  echo "   Found $SIG_COUNT signature files"
else
  echo "⚠️ Warning: APK may not be properly signed (no .RSA files found)"
  echo "   Publishing may fail due to signature verification"
fi

# Check for YAML metadata
echo ""
echo "Checking for problematic YAML metadata..."

# Extract any YAML files for inspection
unzip -q "$APK_FILE" "*.yml" -d "$TEMP_DIR" 2>/dev/null || true
unzip -q "$APK_FILE" "META-INF/*.yml" -d "$TEMP_DIR" 2>/dev/null || true
unzip -q "$APK_FILE" "*.yaml" -d "$TEMP_DIR" 2>/dev/null || true

# Count YAML files
YAML_COUNT=$(find "$TEMP_DIR" -name "*.yml" -o -name "*.yaml" | wc -l)

if [ "$YAML_COUNT" -gt 0 ]; then
  echo "⚠️ Found $YAML_COUNT YAML files in the APK"
  
  # Check for the problematic tag
  PROBLEM_FILES=$(grep -l "!!brut.androlib.meta.MetaInfo" $(find "$TEMP_DIR" -name "*.yml" -o -name "*.yaml") 2>/dev/null || echo "")
  
  if [ -n "$PROBLEM_FILES" ]; then
    echo "❌ Found problematic '!!brut.androlib.meta.MetaInfo' tag in the following files:"
    echo "$PROBLEM_FILES" | sed "s|$TEMP_DIR/||g"
    echo ""
    echo "This will cause issues with Zapstore publishing. Clean the APK with scripts/clean-apk-metadata.sh"
  else
    echo "✅ No problematic YAML tags found in the files"
  fi
else
  echo "✅ No YAML files found in the APK"
fi

# Display size and other information
echo ""
echo "APK file information:"
SIZE=$(stat -c%s "$APK_FILE")
SIZE_MB=$(echo "scale=2; $SIZE/1048576" | bc)
echo "- Size: $SIZE_MB MB ($SIZE bytes)"
echo "- SHA256: $(sha256sum "$APK_FILE" | cut -d' ' -f1)"

# Clean up
echo ""
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo ""
echo "✅ APK analysis complete" 