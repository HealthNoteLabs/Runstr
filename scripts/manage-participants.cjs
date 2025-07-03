/**
 * RUNSTR Season Pass Participant Manager
 * 
 * Terminal-based tool for managing Season Pass participants
 * Supports both hex and npub formats, generates browser import commands
 * 
 * Usage:
 *   node scripts/manage-participants.cjs list
 *   node scripts/manage-participants.cjs add <pubkey>
 *   node scripts/manage-participants.cjs remove <pubkey>
 *   node scripts/manage-participants.cjs clear
 *   node scripts/manage-participants.cjs import-cmd
 *   node scripts/manage-participants.cjs help
 */

const fs = require('fs');
const path = require('path');

// File paths
const PARTICIPANTS_FILE = path.join(__dirname, 'participants.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Simple npub to hex conversion (without external dependencies)
 */
function npubToHex(npub) {
  if (!npub.startsWith('npub1')) {
    return npub; // Already hex format
  }
  
  // Basic bech32 alphabet for npub conversion
  const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const npubData = npub.slice(5); // Remove 'npub1'
  
  // Convert to binary
  let bits = '';
  for (const char of npubData) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error('Invalid npub character');
    bits += index.toString(2).padStart(5, '0');
  }
  
  // Convert to hex (taking first 32 bytes = 256 bits)
  let hex = '';
  for (let i = 0; i < 256; i += 8) {
    const byte = bits.substr(i, 8);
    if (byte.length === 8) {
      hex += parseInt(byte, 2).toString(16).padStart(2, '0');
    }
  }
  
  return hex;
}

/**
 * Simple hex to npub conversion (display only, basic implementation)
 */
function hexToNpub(hex) {
  if (hex.startsWith('npub1')) {
    return hex; // Already npub format
  }
  
  // Simple fallback for display
  return `npub1${hex.substring(0, 16)}...`;
}

/**
 * Load participants from file
 */
function loadParticipants() {
  try {
    if (!fs.existsSync(PARTICIPANTS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(PARTICIPANTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`${colors.red}Error loading participants:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Save participants to file
 */
function saveParticipants(participants) {
  try {
    const data = JSON.stringify(participants, null, 2);
    fs.writeFileSync(PARTICIPANTS_FILE, data, 'utf8');
    return true;
  } catch (error) {
    console.error(`${colors.red}Error saving participants:${colors.reset}`, error.message);
    return false;
  }
}

/**
 * Normalize pubkey to hex format
 */
function normalizePubkey(pubkey) {
  try {
    if (pubkey.startsWith('npub1')) {
      return npubToHex(pubkey);
    }
    
    // Validate hex format
    if (!/^[a-fA-F0-9]{64}$/.test(pubkey)) {
      throw new Error('Invalid pubkey format. Must be 64-character hex or npub1...');
    }
    
    return pubkey.toLowerCase();
  } catch (error) {
    throw new Error(`Invalid pubkey: ${error.message}`);
  }
}

/**
 * Display participants list
 */
function listParticipants() {
  const participants = loadParticipants();
  
  console.log(`\n${colors.cyan}${colors.bright}🎫 RUNSTR Season Pass Participants${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);
  
  if (participants.length === 0) {
    console.log(`${colors.yellow}No participants found.${colors.reset}`);
    console.log(`${colors.yellow}Use 'add <pubkey>' to add your first participant.${colors.reset}\n`);
    return;
  }
  
  participants.forEach((pubkey, index) => {
    const npub = hexToNpub(pubkey);
    const shortHex = `${pubkey.substring(0, 8)}...${pubkey.substring(56)}`;
    const shortNpub = `${npub.substring(0, 12)}...${npub.substring(npub.length - 8)}`;
    
    console.log(`${colors.bright}${index + 1}.${colors.reset} ${colors.green}${shortHex}${colors.reset}`);
    console.log(`   ${colors.magenta}${shortNpub}${colors.reset}\n`);
  });
  
  console.log(`${colors.blue}Total: ${colors.bright}${participants.length}${colors.reset} ${colors.blue}participants${colors.reset}\n`);
}

/**
 * Add participant
 */
function addParticipant(pubkey) {
  try {
    const normalizedPubkey = normalizePubkey(pubkey);
    const participants = loadParticipants();
    
    if (participants.includes(normalizedPubkey)) {
      console.log(`${colors.yellow}⚠️  Participant already exists:${colors.reset} ${normalizedPubkey.substring(0, 8)}...`);
      return;
    }
    
    participants.push(normalizedPubkey);
    
    if (saveParticipants(participants)) {
      const npub = hexToNpub(normalizedPubkey);
      console.log(`${colors.green}✅ Added participant:${colors.reset}`);
      console.log(`   ${colors.bright}Hex:${colors.reset} ${normalizedPubkey}`);
      console.log(`   ${colors.bright}Npub:${colors.reset} ${npub}`);
      console.log(`   ${colors.blue}Total participants: ${participants.length}${colors.reset}\n`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error adding participant:${colors.reset}`, error.message);
  }
}

/**
 * Remove participant
 */
function removeParticipant(pubkey) {
  try {
    const normalizedPubkey = normalizePubkey(pubkey);
    const participants = loadParticipants();
    
    const index = participants.indexOf(normalizedPubkey);
    if (index === -1) {
      console.log(`${colors.yellow}⚠️  Participant not found:${colors.reset} ${normalizedPubkey.substring(0, 8)}...`);
      return;
    }
    
    participants.splice(index, 1);
    
    if (saveParticipants(participants)) {
      const npub = hexToNpub(normalizedPubkey);
      console.log(`${colors.green}✅ Removed participant:${colors.reset}`);
      console.log(`   ${colors.bright}Hex:${colors.reset} ${normalizedPubkey}`);
      console.log(`   ${colors.bright}Npub:${colors.reset} ${npub}`);
      console.log(`   ${colors.blue}Total participants: ${participants.length}${colors.reset}\n`);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error removing participant:${colors.reset}`, error.message);
  }
}

/**
 * Clear all participants
 */
function clearParticipants() {
  const participants = loadParticipants();
  
  if (participants.length === 0) {
    console.log(`${colors.yellow}No participants to clear.${colors.reset}\n`);
    return;
  }
  
  if (saveParticipants([])) {
    console.log(`${colors.green}✅ Cleared all ${participants.length} participants.${colors.reset}\n`);
  }
}

/**
 * Generate import command for browser console
 */
function generateImportCommand() {
  const participants = loadParticipants();
  
  console.log(`\n${colors.cyan}${colors.bright}📋 Browser Import Command${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);
  
  if (participants.length === 0) {
    console.log(`${colors.yellow}No participants to import.${colors.reset}`);
    console.log(`${colors.yellow}Add some participants first, then run this command again.${colors.reset}\n`);
    return;
  }
  
  const command = `localStorage.setItem('seasonPassParticipants', '${JSON.stringify(participants)}');`;
  
  console.log(`${colors.bright}Copy and paste this into your browser console:${colors.reset}\n`);
  console.log(`${colors.green}${command}${colors.reset}\n`);
  console.log(`${colors.blue}This will load ${participants.length} participants into the app.${colors.reset}`);
  console.log(`${colors.blue}Refresh the page after running the command.${colors.reset}\n`);
}

/**
 * Display help
 */
function showHelp() {
  console.log(`\n${colors.cyan}${colors.bright}🎫 RUNSTR Season Pass Participant Manager${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);
  
  console.log(`${colors.bright}USAGE:${colors.reset}`);
  console.log(`  node scripts/manage-participants.cjs <command> [arguments]\n`);
  
  console.log(`${colors.bright}COMMANDS:${colors.reset}`);
  console.log(`  ${colors.green}list${colors.reset}                    Show all participants`);
  console.log(`  ${colors.green}add <pubkey>${colors.reset}            Add participant (hex or npub format)`);
  console.log(`  ${colors.green}remove <pubkey>${colors.reset}         Remove participant (hex or npub format)`);
  console.log(`  ${colors.green}clear${colors.reset}                   Remove all participants`);
  console.log(`  ${colors.green}import-cmd${colors.reset}              Generate browser console command`);
  console.log(`  ${colors.green}help${colors.reset}                    Show this help message\n`);
  
  console.log(`${colors.bright}EXAMPLES:${colors.reset}`);
  console.log(`  ${colors.yellow}node scripts/manage-participants.cjs add npub1abc123...${colors.reset}`);
  console.log(`  ${colors.yellow}node scripts/manage-participants.cjs add abc123def456...${colors.reset}`);
  console.log(`  ${colors.yellow}node scripts/manage-participants.cjs remove npub1abc123...${colors.reset}`);
  console.log(`  ${colors.yellow}node scripts/manage-participants.cjs list${colors.reset}`);
  console.log(`  ${colors.yellow}node scripts/manage-participants.cjs import-cmd${colors.reset}\n`);
  
  console.log(`${colors.bright}PUBKEY FORMATS:${colors.reset}`);
  console.log(`  ${colors.blue}Hex:${colors.reset}  abc123def456... (64 characters)`);
  console.log(`  ${colors.blue}Npub:${colors.reset} npub1abc123def456...\n`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    return;
  }
  
  const command = args[0].toLowerCase();
  
  switch (command) {
    case 'list':
    case 'ls':
      listParticipants();
      break;
      
    case 'add':
      if (args.length < 2) {
        console.error(`${colors.red}❌ Error: Please provide a pubkey to add${colors.reset}`);
        console.log(`${colors.yellow}Usage: node scripts/manage-participants.cjs add <pubkey>${colors.reset}\n`);
        return;
      }
      addParticipant(args[1]);
      break;
      
    case 'remove':
    case 'rm':
      if (args.length < 2) {
        console.error(`${colors.red}❌ Error: Please provide a pubkey to remove${colors.reset}`);
        console.log(`${colors.yellow}Usage: node scripts/manage-participants.cjs remove <pubkey>${colors.reset}\n`);
        return;
      }
      removeParticipant(args[1]);
      break;
      
    case 'clear':
      clearParticipants();
      break;
      
    case 'import-cmd':
    case 'import':
    case 'cmd':
      generateImportCommand();
      break;
      
    case 'help':
    case '-h':
    case '--help':
      showHelp();
      break;
      
    default:
      console.error(`${colors.red}❌ Unknown command: ${command}${colors.reset}`);
      console.log(`${colors.yellow}Run 'node scripts/manage-participants.cjs help' for usage information.${colors.reset}\n`);
      break;
  }
}

// Run the script
if (require.main === module) {
  main();
} 