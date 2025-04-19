/**
 * DEPRECATED: This file is maintained for backward compatibility
 * Please import from 'utils/nostr' instead
 * 
 * See src/utils/nostr/MIGRATION.md for migration instructions
 */

// Re-export everything from the new modular structure
export * from './nostr/index.js';

// For more targeted imports, use:
// import { fetchGroupMessages } from './nostr/groups/messages.js';
// import { joinGroup, leaveGroup } from './nostr/groups/membership.js';
// import { fetchGroupMetadata } from './nostr/groups/metadata.js'; 