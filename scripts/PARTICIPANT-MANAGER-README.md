# RUNSTR Season Pass Participant Manager

Terminal-based tool for managing Season Pass participants for RUNSTR Season 1. Supports both hex and npub formats, generates browser import commands.

## 🚀 Quick Start

```bash
# Show help
node scripts/manage-participants.cjs help

# List current participants
node scripts/manage-participants.cjs list

# Add a participant (hex or npub format)
node scripts/manage-participants.cjs add <pubkey>

# Remove a participant
node scripts/manage-participants.cjs remove <pubkey>

# Generate browser import command
node scripts/manage-participants.cjs import-cmd
```

## 📋 Commands

| Command | Description | Example |
|---------|-------------|---------|
| `list` or `ls` | Show all participants | `node scripts/manage-participants.cjs list` |
| `add <pubkey>` | Add participant | `node scripts/manage-participants.cjs add npub1abc...` |
| `remove <pubkey>` or `rm <pubkey>` | Remove participant | `node scripts/manage-participants.cjs remove abc123...` |
| `clear` | Remove all participants | `node scripts/manage-participants.cjs clear` |
| `import-cmd` | Generate browser command | `node scripts/manage-participants.cjs import-cmd` |
| `help` | Show help message | `node scripts/manage-participants.cjs help` |

## 🔧 Pubkey Formats

The tool accepts both formats:

- **Hex**: `abc123def456789...` (64 characters)
- **Npub**: `npub1abc123def456...`

Both will be stored as hex format internally.

## 💾 Storage

- **File**: `scripts/participants.json`
- **Format**: JSON array of hex pubkeys
- **Example**: `["abc123...", "def456..."]`

## 🌐 Browser Import

1. **Add participants** using the terminal commands
2. **Generate import command**: `node scripts/manage-participants.cjs import-cmd`
3. **Copy the generated command** and paste into browser console
4. **Refresh the page** to see participants in the app

The generated command looks like:
```javascript
localStorage.setItem('seasonPassParticipants', '["abc123...","def456..."]');
```

## 🖥️ Windows Users

Use the batch script for easier access:

```batch
# Instead of: node scripts/manage-participants.cjs list
scripts\manage-participants.bat list

# Add participant
scripts\manage-participants.bat add npub1abc123...

# Generate import command
scripts\manage-participants.bat import-cmd
```

## 🎯 Typical Workflow

1. **Add participants** via terminal as they purchase Season Passes
2. **Generate import command** when you need to test/update the app
3. **Paste command** into browser console when accessing the app
4. **Refresh page** to see updated participant list in League tab

## 🔍 Examples

```bash
# Add participants (both formats work)
node scripts/manage-participants.cjs add npub1abc123def456789abc123def456789abc123def456789abc123def456789
node scripts/manage-participants.cjs add abc123def456789abc123def456789abc123def456789abc123def456789

# View current list
node scripts/manage-participants.cjs list

# Generate browser import
node scripts/manage-participants.cjs import-cmd

# Remove specific participant
node scripts/manage-participants.cjs remove npub1abc123def456789abc123def456789abc123def456789abc123def456789

# Clear all for fresh start
node scripts/manage-participants.cjs clear
```

## 🛡️ Safety

- **Validation**: All pubkeys are validated before adding
- **Deduplication**: Duplicate participants are automatically detected
- **Error handling**: Invalid formats show helpful error messages
- **Backup**: The JSON file can be manually backed up/restored

## 📁 Files Created

- `scripts/participants.json` - JSON storage file
- `scripts/manage-participants.cjs` - Main script
- `scripts/manage-participants.bat` - Windows wrapper
- `scripts/PARTICIPANT-MANAGER-README.md` - This documentation 