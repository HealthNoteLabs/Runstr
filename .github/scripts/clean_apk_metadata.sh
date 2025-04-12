#!/bin/bash

set -e # Exit immediately if a command exits with a non-zero status.

APK_PATH="$1"
APK_FILENAME=$(basename "$APK_PATH")
WORKING_DIR=$(dirname "$APK_PATH")
CLEANED_APK_PATH="${WORKING_DIR}/cleaned-${APK_FILENAME}"

if [ -z "$APK_PATH" ]; then
  echo "Usage: $0 <path_to_apk>"
  exit 1
fi

if [ ! -f "$APK_PATH" ]; then
  echo "Error: APK file not found at $APK_PATH"
  exit 1
fi

echo "Attempting to clean metadata from $APK_FILENAME..."

# Copy the original APK to a new file for modification
cp "$APK_PATH" "$CLEANED_APK_PATH"
echo "Created temporary copy at $CLEANED_APK_PATH"

# Attempt to delete apktool.yml from the copied archive
# Use || true because zip returns non-zero if the file doesn't exist, which is fine.
zip -d "$CLEANED_APK_PATH" apktool.yml || true

# Check if apktool.yml is still present (zip -d might fail silently on some systems/zip versions if file not found)
if unzip -l "$CLEANED_APK_PATH" | grep -q 'apktool\.yml'; then
  echo "Warning: Failed to remove apktool.yml using 'zip -d'. The file might still be present."
  # Optionally, exit 1 here if removal is critical
  # exit 1
else
  echo "✅ Successfully removed apktool.yml (if it existed)."
fi

echo "Cleaning process finished. Use the modified APK at: $CLEANED_APK_PATH"

# Output the path of the cleaned APK for potential use in subsequent steps
# echo "::set-output name=cleaned_apk_path::$CLEANED_APK_PATH" # Example for GitHub Actions
echo "cleaned_apk_path=${CLEANED_APK_PATH}" >> $GITHUB_OUTPUT

# For now, just replace the original path variable content if successful for simplicity in the calling script
# If the script running this expects the original $APK_PATH to be the cleaned one,
# we can mv cleaned-*.apk back to the original name. Let's keep it separate for now.

exit 0 