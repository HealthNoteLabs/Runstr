# Migration Guide: nostrClient.js → Modular Nostr Structure

This guide will help you migrate your code from using the monolithic `nostrClient.js` file to the new modular structure.

## Step 1: Update Import Statements

### Before:

```javascript
import { 
  initializeNostr, 
  fetchGroupMessages, 
  joinGroup 
} from '../utils/nostrClient';
```

### After:

```javascript
import { 
  initializeNostr, 
  fetchGroupMessages, 
  joinGroup 
} from '../utils/nostr';
```

The new structure re-exports everything through the main `index.js` for backward compatibility, so you can keep using the same function names but import from `'../utils/nostr'` instead.

## Step 2: Check for Any Custom Extensions

If you've added custom functions to `nostrClient.js`, you'll need to:

1. Identify which module they belong to
2. Add them to the appropriate module file
3. Export them in the module's index file

## Step 3: Update Tests

If you have tests that import directly from `nostrClient.js`, update them to:

1. Import from `'../utils/nostr'` or
2. Import from the specific module (e.g., `'../utils/nostr/groups/messages'`)

## Step 4: Check for Default Exports

The original `nostrClient.js` used named exports. The new structure continues this pattern, so there should be no issues with default exports.

## Step 5: Verification

After updating imports, verify that:

1. Your application builds successfully
2. Unit tests pass
3. Basic Nostr functionality works as expected

## Benefits of the New Structure

- **Better organization**: Related functions are grouped together
- **Smaller files**: Easier to read and maintain
- **Independent testing**: Test specific modules in isolation
- **Reduced circular dependencies**: Cleaner import structure
- **Better code discoverability**: Easier to find specific functionality

## Troubleshooting

If you encounter issues during migration:

1. **Build errors**: Check import paths and ensure all functions are properly exported
2. **Runtime errors**: Verify that the function signatures haven't changed
3. **Missing functionality**: Ensure all functions from the original file were migrated

If functions seem to be missing, check the specific module files to locate them:

- Group-related functions → `groups/` directory
- Authentication functions → `auth.js`
- Event publishing → `events.js`
- Relay connection → `connection.js` 