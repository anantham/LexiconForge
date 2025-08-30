/**
 * Database Services Index
 * 
 * Centralized exports for all database-related services.
 * This replaces the monolithic indexeddb.ts with focused, modular services.
 */

// Core data access layer (thin wrapper around IndexedDB)
export { indexedDBService } from '../indexeddb';

// Specialized database services
export * from './maintenanceService';
export * from './migrationService';

// Re-export types that might be needed by consumers
export type { TranslationRecord } from '../indexeddb';