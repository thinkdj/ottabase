// Core classes
export { MigrationManager } from './core/MigrationManager';
export { StateManager, type MigrationRecord, type MigrationDatabase } from './core/StateManager';
export { LockManager } from './core/LockManager';

// Generator classes
export { ModelDiscovery, type DiscoveredModel } from './generator/ModelDiscovery';
export { DrizzleGenerator, type GenerateMigrationOptions } from './generator/DrizzleGenerator';

// Executor classes
export { D1Executor, createD1Executor } from './executor/D1Executor';
export { LocalExecutor, createLocalExecutor } from './executor/LocalExecutor';

// Config
export * from './config/types';
export * from './config/loader';

// Utils
export { generateChecksum, verifyChecksum } from './utils/checksum';
export { Logger } from './utils/logger';

// Templates
export * from './generator/templates';
