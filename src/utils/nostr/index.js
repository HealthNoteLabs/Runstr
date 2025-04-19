// Re-export all modules for convenient imports
export * from './connection.js';
export * from './auth.js';
export * from './events.js';
export * from './nip19.js';
export * from './groups/index.js';

// Re-export some key objects for backward compatibility
import { pool, relays } from './connection.js';
export { pool, relays }; 