#!/bin/bash
# ./scripts/update-gradle-version.sh

# Updates version information in android/gradle.properties

set -e # Exit immediately if a command exits with a non-zero status.

NEW_VERSION_NAME=$1
PROPERTIES_FILE="android/gradle.properties" # Target the file in the android directory

echo "Updating $PROPERTIES_FILE to version $NEW_VERSION_NAME"

# Check if PROPERTIES_FILE exists, create if not
if [ ! -f "$PROPERTIES_FILE" ]; then
  echo "Warning: $PROPERTIES_FILE not found! Creating it."
  mkdir -p android # Ensure directory exists
  touch "$PROPERTIES_FILE"
  # Add a default systemProp if desired, or leave empty
  # echo 'org.gradle.jvmargs=-Xmx1536m' >> "$PROPERTIES_FILE"
fi

# Check if NEW_VERSION_NAME is provided
if [ -z "$NEW_VERSION_NAME" ]; then
  echo "Error: New version name (semantic version) not provided as the first argument."
  exit 1
fi

# Use specific property names for RUNSTR
PROP_VERSION_NAME="runstrVersionName"
PROP_VERSION_CODE="runstrVersionCode"

# Update or add runstrVersionName
if grep -q "^${PROP_VERSION_NAME}=" "$PROPERTIES_FILE"; then
  sed -i "s/^${PROP_VERSION_NAME}=.*/${PROP_VERSION_NAME}=$NEW_VERSION_NAME/" "$PROPERTIES_FILE"
  echo "Updated ${PROP_VERSION_NAME} to $NEW_VERSION_NAME"
else
  echo "Adding ${PROP_VERSION_NAME}=$NEW_VERSION_NAME to $PROPERTIES_FILE."
  echo "${PROP_VERSION_NAME}=$NEW_VERSION_NAME" >> "$PROPERTIES_FILE"
fi

# Read current versionCode, increment it, and update or add runstrVersionCode
if grep -q "^${PROP_VERSION_CODE}=" "$PROPERTIES_FILE"; then
  CURRENT_VERSION_CODE=$(grep "^${PROP_VERSION_CODE}=" "$PROPERTIES_FILE" | cut -d'=' -f2)
  if [[ -z "$CURRENT_VERSION_CODE" || ! "$CURRENT_VERSION_CODE" =~ ^[0-9]+$ ]]; then
    echo "Warning: ${PROP_VERSION_CODE} found but is not a valid integer in $PROPERTIES_FILE. Resetting to 1. Value: '$CURRENT_VERSION_CODE'"
    NEW_VERSION_CODE=1
    sed -i "s/^${PROP_VERSION_CODE}=.*/${PROP_VERSION_CODE}=$NEW_VERSION_CODE/" "$PROPERTIES_FILE"
  else
    NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
    echo "Incrementing ${PROP_VERSION_CODE} from $CURRENT_VERSION_CODE to $NEW_VERSION_CODE"
    sed -i "s/^${PROP_VERSION_CODE}=.*/${PROP_VERSION_CODE}=$NEW_VERSION_CODE/" "$PROPERTIES_FILE"
  fi
else
  echo "Warning: ${PROP_VERSION_CODE} not found in $PROPERTIES_FILE. Initializing to 1."
  NEW_VERSION_CODE=1
  echo "${PROP_VERSION_CODE}=$NEW_VERSION_CODE" >> "$PROPERTIES_FILE"
fi

echo "Successfully updated $PROPERTIES_FILE with ${PROP_VERSION_NAME}=$NEW_VERSION_NAME and ${PROP_VERSION_CODE}=$NEW_VERSION_CODE"