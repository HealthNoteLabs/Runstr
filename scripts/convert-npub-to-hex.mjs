import { nip19 } from "nostr-tools";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function convertNpubToHex(npub) {
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') {
      return decoded.data;
    } else {
      throw new Error(`Invalid type: ${decoded.type}. Expected 'npub'.`);
    }
  } catch (error) {
    throw new Error(`Failed to decode npub: ${error.message}`);
  }
}

function convertHexToNpub(hex) {
  try {
    return nip19.npubEncode(hex);
  } catch (error) {
    throw new Error(`Failed to encode hex to npub: ${error.message}`);
  }
}

function main() {
  console.log("🔄 NPUB ↔ HEX Converter");
  console.log("=".repeat(50));
  console.log("Usage: Enter an npub or hex pubkey to convert");
  console.log("Type 'exit' to quit\n");

  const promptUser = () => {
    rl.question("Enter npub or hex pubkey: ", (input) => {
      const trimmed = input.trim();
      
      if (trimmed.toLowerCase() === 'exit') {
        console.log("👋 Goodbye!");
        rl.close();
        return;
      }

      if (!trimmed) {
        console.log("❌ Please enter a valid npub or hex pubkey\n");
        promptUser();
        return;
      }

      try {
        if (trimmed.startsWith('npub1')) {
          // Convert npub to hex
          const hex = convertNpubToHex(trimmed);
          console.log(`✅ Hex: ${hex}\n`);
        } else if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
          // Convert hex to npub
          const npub = convertHexToNpub(trimmed);
          console.log(`✅ Npub: ${npub}\n`);
        } else {
          console.log("❌ Invalid format. Please enter a valid npub (starts with 'npub1') or 64-character hex string\n");
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
      }

      promptUser();
    });
  };

  promptUser();
}

main(); 