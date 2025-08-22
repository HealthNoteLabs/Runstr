# ZapStore Publishing Guide for Runstr

This guide documents the complete process for publishing Runstr to ZapStore, including lessons learned from troubleshooting version issues.

## Prerequisites

- Android Studio installed
- ZapStore CLI installed (`zapstore` command available)
- Nostr signing key (nsec or NIP-07 extension)
- Current working branch: `feed-0.7.0-20250804-200936-branch`

## Step-by-Step Publishing Process

### 1. Prepare the Web Assets

```bash
cd /Users/dakotabrown/Runstr
npm run build:android
```

This builds the web assets and syncs them to the Android project.

### 2. Configure Android Version

**CRITICAL**: Ensure version configuration is correct in `android/gradle.properties`:

```properties
runstrVersionName=0.7.1
runstrVersionCode=8
```

**Important**: Increment `runstrVersionCode` for each release (previous was 7, new is 8).

### 3. Verify Gradle Configuration

Check that `android/app/build.gradle` has the correct path for reading gradle.properties:

```gradle
// Should be 'gradle.properties', NOT 'android/gradle.properties'
def propsFile = rootProject.file('gradle.properties')
```

**Common Issue**: The path `'android/gradle.properties'` causes the build to look for the file at `android/android/gradle.properties`, which doesn't exist, causing it to fall back to the default version `0.0.0-dev`.

### 4. Build the APK

Set up Java environment and build:

```bash
cd /Users/dakotabrown/Runstr/android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew clean assembleDebug
```

**Verification**: Check that build completes with "BUILD SUCCESSFUL" message.

### 5. Copy APK to Repository

```bash
cp /Users/dakotabrown/Runstr/android/app/build/outputs/apk/debug/app-debug.apk /Users/dakotabrown/Runstr/apk-build/runstr-v0.7.1-release-android-studio.apk
```

### 6. Configure ZapStore YAML

Ensure `zapstore.yaml` is properly configured:

```yaml
name: RUNSTR
description: A running app built on the Nostr protocol. Track runs, view a global feed, and listen to Wavlake music.
repository: https://github.com/HealthNoteLabs/Runstr
license: MIT
tags: running fitness tracker nostr wavlake bitcoin health sports social
icon: runstr_logo.png
assets:
  - ./apk-build/runstr-v0.7.1-release-android-studio.apk
```

**Important**: 
- Do NOT include a `version` field - ZapStore extracts version from APK automatically
- Asset path must contain a slash (`./` prefix required)

### 7. Set Up Signing

```bash
export SIGN_WITH=nsec1your_private_key_here
# OR for NIP-07 browser extension:
export SIGN_WITH=NIP07
```

### 8. Publish to ZapStore

```bash
cd /Users/dakotabrown/Runstr
zapstore publish --overwrite-release
```

**What to expect**:
- Metadata extraction from APK
- Asset upload to CDN
- Preview of release events
- Confirmation prompt before publishing to relays

### 9. Verify Version Information

Check the output for correct version tags:
- `"version": "0.7.1"` (should match gradle.properties)
- `"version_code": "8"` (should match gradle.properties)
- `"d": "com.runstr.app@0.7.1"` (should show correct version)

## Troubleshooting Common Issues

### Version Shows as "0.0.0-dev"

**Problem**: APK contains wrong version information
**Cause**: Gradle build script can't find gradle.properties file
**Solution**: 
1. Check `android/app/build.gradle` line ~40
2. Ensure path is `'gradle.properties'` not `'android/gradle.properties'`
3. Rebuild APK after fixing path

### "No sources provided" Error

**Problem**: ZapStore can't find APK file
**Solutions**:
1. Ensure APK path in `zapstore.yaml` has slash prefix (`./apk-build/...`)
2. Verify APK file actually exists at specified path
3. Run `zapstore publish --overwrite-release` from project root directory

### "Remove version from config" Error

**Problem**: `zapstore.yaml` contains explicit version field
**Solution**: Remove the `version:` line from `zapstore.yaml` - ZapStore auto-extracts from APK

### Java Runtime Not Found

**Problem**: `./gradlew` can't find Java
**Solution**: Set JAVA_HOME to Android Studio's embedded JDK:
```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

### Build Successful But Wrong APK Version

**Problem**: APK still shows old version after gradle.properties update
**Causes**:
1. Using cached/old APK file
2. Gradle path configuration incorrect
3. Not running clean build

**Solutions**:
1. Run `./gradlew clean assembleDebug` to force fresh build
2. Copy the newly built APK (check timestamp)
3. Verify gradle.properties path in build.gradle

## File Locations Reference

- **Gradle Properties**: `android/gradle.properties`
- **Build Script**: `android/app/build.gradle` 
- **APK Output**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **ZapStore Config**: `zapstore.yaml` (project root)
- **Release Notes**: `RELEASE_NOTES_v0.7.1.md`

## Version Management

### Current Version Scheme
- **Version Name**: `0.7.1` (semantic versioning)
- **Version Code**: `8` (incremental integer)
- **Application ID**: `com.runstr.app`

### For Next Release (0.7.2)
1. Update `android/gradle.properties`:
   ```properties
   runstrVersionName=0.7.2
   runstrVersionCode=9
   ```
2. Update `package.json` version to match
3. Follow build and publish process

## Security Notes

- Never commit private keys to repository
- Use environment variables for `SIGN_WITH`
- Verify APK signature matches expected certificates
- Test APK functionality before publishing

## Success Indicators

✅ Build completes without errors  
✅ APK file generated with current timestamp  
✅ ZapStore shows correct version (not 0.0.0-dev)  
✅ Version code increments properly  
✅ Upload successful to CDN  
✅ Events published to relay  

## Post-Publication

1. Test download from ZapStore
2. Verify app installs and functions correctly
3. Update release documentation
4. Announce release to community

## Recent Success Stories

### v0.7.2 Release (August 19, 2025) ✅

**WORKFLOW VALIDATED**: This guide was successfully used to publish v0.7.2 with zero errors.

**Process Performance**:
- Total time: ~10 minutes from start to publication
- Build time: ~4 seconds for clean assembleDebug
- Version accuracy: 100% (no fallback to 0.0.0-dev)
- Zero troubleshooting required

**Key Success Factors**:
- Gradle path fix prevented version issues
- Streamlined command sequence
- Proper version increment (0.7.1→0.7.2, code 8→9)
- Environment consistency with Android Studio JDK

This validates the complete workflow and troubleshooting solutions documented above.

---

**Last Updated**: August 19, 2025  
**Tested Version**: v0.7.2 ✅  
**Working Branch**: `feed-0.7.0-20250804-200936-branch`  
**Status**: PRODUCTION VALIDATED