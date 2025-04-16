const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const unzipper = require('unzipper');

const analyzeAPK = async (apkPath) => {
  try {
    console.log(`Analyzing APK: ${apkPath}`);

    // Check if the file exists
    if (!fs.existsSync(apkPath)) {
      console.error(`❌ Error: File '${apkPath}' not found.`);
      return;
    }

    // Check if it's a valid APK
    const zip = fs.createReadStream(apkPath).pipe(unzipper.Parse({ forceStream: true }));
    let isValidAPK = false;
    for await (const entry of zip) {
      if (entry.path === 'AndroidManifest.xml') {
        isValidAPK = true;
      }
      entry.autodrain();
    }

    if (!isValidAPK) {
      console.error(`❌ Error: '${apkPath}' does not appear to be a valid APK (no AndroidManifest.xml found).`);
      return;
    }

    console.log('✅ Valid APK file detected');

    // Check for signature files
    console.log('\nChecking APK signature...');
    const zip2 = fs.createReadStream(apkPath).pipe(unzipper.Parse({ forceStream: true }));
    let signatureCount = 0;
    for await (const entry of zip2) {
      if (entry.path.startsWith('META-INF/') && entry.path.endsWith('.RSA')) {
        signatureCount++;
      }
      entry.autodrain();
    }

    if (signatureCount > 0) {
      console.log(`✅ APK appears to be signed (found ${signatureCount} .RSA files)`);
    } else {
      console.warn('⚠️ Warning: APK may not be properly signed (no .RSA files found)');
    }

    // Check for YAML metadata
    console.log('\nChecking for problematic YAML metadata...');
    const zip3 = fs.createReadStream(apkPath).pipe(unzipper.Parse({ forceStream: true }));
    let yamlCount = 0;
    let problematicFiles = [];
    for await (const entry of zip3) {
      if (entry.path.endsWith('.yml') || entry.path.endsWith('.yaml')) {
        yamlCount++;
        const content = await entry.buffer();
        if (content.includes('!!brut.androlib.meta.MetaInfo')) {
          problematicFiles.push(entry.path);
        }
      } else {
        entry.autodrain();
      }
    }

    if (yamlCount > 0) {
      console.log(`⚠️ Found ${yamlCount} YAML files in the APK`);
      if (problematicFiles.length > 0) {
        console.error('❌ Found problematic YAML metadata in the following files:');
        console.error(problematicFiles.join('\n'));
      } else {
        console.log('✅ No problematic YAML tags found in the files');
      }
    } else {
      console.log('✅ No YAML files found in the APK');
    }

    // Display size and SHA256 hash
    const stats = fs.statSync(apkPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex');

    console.log('\nAPK file information:');
    console.log(`- Size: ${sizeMB} MB (${stats.size} bytes)`);
    console.log(`- SHA256: ${sha256}`);

    console.log('\n✅ APK analysis complete');
  } catch (error) {
    console.error('❌ Error analyzing APK:', error);
  }
};

// Run the script if executed directly
if (require.main === module) {
  const apkPath = process.argv[2];
  if (!apkPath) {
    console.error('❌ Error: No APK file specified.');
    console.error('Usage: node check-apk.js <path-to-apk>');
    process.exit(1);
  }

  analyzeAPK(apkPath);
}

module.exports = analyzeAPK;