#!/bin/bash
# clean-apk-metadata.sh - Tool to clean problematic metadata from APK files
# Usage: ./clean-apk-metadata.sh <path-to-apk>

set -e  # Exit on error

# Check for required tools
if ! command -v unzip >/dev/null || ! command -v zip >/dev/null; then
  echo "❌ Error: Required tools (zip/unzip) not found. Please install them."
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

# Quick check if file is a valid APK
if ! unzip -l "$APK_FILE" | grep -q "AndroidManifest.xml"; then
  echo "❌ Error: '$APK_FILE' does not appear to be a valid APK (no AndroidManifest.xml found)."
  exit 1
fi

echo "Processing APK: $APK_FILE"

# Create a backup of the original APK
BACKUP_FILE="${APK_FILE%.apk}_original.apk"
echo "Creating backup: $BACKUP_FILE"
cp "$APK_FILE" "$BACKUP_FILE"

# Create temporary working directory
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Extract APK contents
echo "Extracting APK contents..."
unzip -q "$APK_FILE" -d "$TEMP_DIR"

# Find and remove all YAML files
echo "Removing problematic metadata files..."
YAML_COUNT=0
for YAML_PATTERN in "*.yml" "*.yaml" "META-INF/*.yml" "META-INF/*.yaml" "apktool.yml"; do
  FOUND=$(find "$TEMP_DIR" -name "$YAML_PATTERN" -type f 2>/dev/null | wc -l)
  if [ "$FOUND" -gt 0 ]; then
    echo "  - Found $FOUND files matching pattern '$YAML_PATTERN'"
    find "$TEMP_DIR" -name "$YAML_PATTERN" -type f -delete
    YAML_COUNT=$((YAML_COUNT + FOUND))
  fi
done

if [ "$YAML_COUNT" -eq 0 ]; then
  echo "No YAML metadata files found in the APK."
  # Even if we didn't find anything, we'll still repackage to be thorough
fi

# Create a new APK without the YAML files
echo "Repackaging APK without metadata..."
CLEAN_APK="${APK_FILE%.apk}_clean.apk"
(cd "$TEMP_DIR" && zip -r -q "$CLEAN_APK" .)

# Verify the new APK is valid
if ! unzip -l "$CLEAN_APK" | grep -q "AndroidManifest.xml"; then
  echo "❌ Error: Repackaged APK appears to be invalid! Restoring from backup..."
  cp "$BACKUP_FILE" "$CLEAN_APK"
  echo "⚠️ Used original file as fallback. Something went wrong during repackaging."
else
  echo "✅ APK repackaged successfully without metadata."
  
  # Replace the original file with the clean version
  echo "Replacing original APK with clean version..."
  mv "$CLEAN_APK" "$APK_FILE"
fi

# Clean up
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo "✅ APK processing complete."
echo "Original backup saved as: $BACKUP_FILE"
echo "Cleaned APK saved as: $APK_FILE"
echo ""
echo "Note: If you need to sign the APK, please do so now as repackaging invalidates any existing signature." 