/**
 * Migration Phase Controller - Hybrid Innovation
 * 
 * Orchestrates service-aware migration with GPT-5's safety phases
 * and Claude's domain-specific validation concerns.
 */

import { DbError } from '../core/errors';

export type Backend = 'legacy' | 'idb' | 'memory';
export type MigrationPhase = 'shadow' | 'reads' | 'dualwrite' | 'writes' | 'complete';
export type ServiceName = 
  | 'translationService'
  | 'navigationService' 
  | 'chaptersSlice'
  | 'exportSlice'
  | 'imageGenerationService'
  | 'sessionManagementService'
  | 'importTransformationService'
  | 'openrouterService';

export interface ServiceMigrationState {
  service: ServiceName;
  phase: MigrationPhase;
  shadowValidated: boolean;
  readsValidated: boolean;
  writesValidated: boolean;
  errorCount: number;
  lastError?: DbError;
  startedAt?: Date;
  completedAt?: Date;
}

export interface MigrationConfig {
  backend: Backend;
  enabledServices: Set<ServiceName>;
  shadowReadDuration: number; // minutes
  validationThreshold: number; // max error rate (0.01 = 1%)
  rollbackOnError: boolean;
}

export class MigrationController {
  private config: MigrationConfig;
  private serviceStates = new Map<ServiceName, ServiceMigrationState>();
  
  // Service priority order (Claude's insight - coupling-based)
  private static readonly SERVICE_PRIORITY: ServiceName[] = [
    'translationService',    // P0: 582 LOC, core business logic
    'navigationService',     // P0: 549 LOC, critical navigation
    'chaptersSlice',        // P0: 580 LOC, state management
    'exportSlice',          // P1: Secondary services
    'imageGenerationService',
    'sessionManagementService', 
    'importTransformationService',
    'openrouterService',    // P2: Lowest coupling
  ];
  
  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      backend: 'legacy',
      enabledServices: new Set(),
      shadowReadDuration: 60, // 1 hour default
      validationThreshold: 0.01, // 1% error rate
      rollbackOnError: true,
      ...config
    };
    
    this.initializeServiceStates();
  }
  
  private initializeServiceStates(): void {
    for (const service of MigrationController.SERVICE_PRIORITY) {
      this.serviceStates.set(service, {
        service,
        phase: 'shadow',
        shadowValidated: false,
        readsValidated: false,
        writesValidated: false,
        errorCount: 0,
      });
    }
  }
  
  /**
   * Get current backend for the entire system
   */
  getBackend(): Backend {
    return this.config.backend;
  }
  
  /**
   * Set system-wide backend (GPT-5's single toggle)
   */
  setBackend(backend: Backend): void {
    this.config.backend = backend;
    console.log(`[MigrationController] Backend set to: ${backend}`);
  }
  
  /**
   * Check if a service should use the new backend
   */
  shouldUseNewBackend(service: ServiceName): boolean {
    if (this.config.backend === 'legacy') {
      return false;
    }
    
    if (this.config.backend === 'memory' || this.config.backend === 'idb') {
      return this.config.enabledServices.has(service);
    }
    
    return false;
  }
  
  /**
   * Start shadow reads for a service (GPT-5's safety phase)
   */
  async startShadowReads(service: ServiceName): Promise<void> {
    const state = this.serviceStates.get(service);
    if (!state) {
      throw new DbError('NotFound', 'migration', 'controller', 
        `Unknown service: ${service}`);
    }
    
    if (state.phase !== 'shadow') {
      throw new DbError('Constraint', 'migration', 'controller',
        `Service ${service} is not in shadow phase (current: ${state.phase})`);
    }
    
    state.startedAt = new Date();
    console.log(`[MigrationController] Starting shadow reads for ${service}`);
    
    // Shadow reads run for configured duration
    setTimeout(() => {
      this.validateShadowReads(service);
    }, this.config.shadowReadDuration * 60 * 1000);
  }
  
  /**
   * Validate shadow read results
   */
  private async validateShadowReads(service: ServiceName): Promise<void> {
    const state = this.serviceStates.get(service)!;
    
    // Check error rate against threshold
    const errorRate = this.calculateErrorRate(service);
    const isValid = errorRate <= this.config.validationThreshold;
    
    state.shadowValidated = isValid;
    
    if (isValid) {
      console.log(`[MigrationController] Shadow validation passed for ${service} (${errorRate}% error rate)`);
      state.phase = 'reads';
    } else {
      console.warn(`[MigrationController] Shadow validation failed for ${service} (${errorRate}% error rate > ${this.config.validationThreshold}%)`);
      
      if (this.config.rollbackOnError) {
        await this.rollbackService(service);
      }
    }
  }
  
  /**
   * Enable reads for a service (after shadow validation)
   */
  async enableReads(service: ServiceName): Promise<void> {
    const state = this.serviceStates.get(service)!;
    
    if (!state.shadowValidated) {
      throw new DbError('Constraint', 'migration', 'controller',
        `Cannot enable reads for ${service} - shadow reads not validated`);
    }
    
    if (state.phase !== 'reads') {
      throw new DbError('Constraint', 'migration', 'controller',
        `Service ${service} is not ready for reads phase (current: ${state.phase})`);
    }
    
    this.config.enabledServices.add(service);
    console.log(`[MigrationController] Reads enabled for ${service}`);
    
    // Monitor reads for issues
    setTimeout(() => {
      this.validateReads(service);
    }, 30 * 60 * 1000); // 30 minutes
  }
  
  /**
   * Validate read performance and correctness
   */
  private async validateReads(service: ServiceName): Promise<void> {
    const state = this.serviceStates.get(service)!;
    const errorRate = this.calculateErrorRate(service);
    const isValid = errorRate <= this.config.validationThreshold;
    
    state.readsValidated = isValid;
    
    if (isValid) {
      console.log(`[MigrationController] Read validation passed for ${service}`);
      state.phase = 'dualwrite';
    } else {
      console.warn(`[MigrationController] Read validation failed for ${service}`);
      await this.rollbackService(service);
    }
  }
  
  /**
   * Enable dual writes (writes to both systems)
   */
  async enableDualWrites(service: ServiceName): Promise<void> {
    const state = this.serviceStates.get(service)!;
    
    if (!state.readsValidated) {
      throw new DbError('Constraint', 'migration', 'controller',
        `Cannot enable dual writes for ${service} - reads not validated`);
    }
    
    console.log(`[MigrationController] Dual writes enabled for ${service}`);
    // Implementation would coordinate with operation modules
  }
  
  /**
   * Switch to new backend writes only
   */
  async enableWrites(service: ServiceName): Promise<void> {
    const state = this.serviceStates.get(service)!;
    state.phase = 'writes';
    
    console.log(`[MigrationController] New backend writes enabled for ${service}`);
    
    // Monitor writes for data consistency
    setTimeout(() => {
      this.validateWrites(service);
    }, 60 * 60 * 1000); // 1 hour
  }
  
  /**
   * Validate write operations
   */
  private async validateWrites(service: ServiceName): Promise<void> {
    const state = this.serviceStates.get(service)!;
    const errorRate = this.calculateErrorRate(service);
    const isValid = errorRate <= this.config.validationThreshold;
    
    state.writesValidated = isValid;
    
    if (isValid) {
      console.log(`[MigrationController] Write validation passed for ${service}`);
      state.phase = 'complete';
      state.completedAt = new Date();
    } else {
      console.warn(`[MigrationController] Write validation failed for ${service}`);
      await this.rollbackService(service);
    }
  }
  
  /**
   * Rollback a service to legacy backend
   */
  async rollbackService(service: ServiceName): Promise<void> {
    this.config.enabledServices.delete(service);
    
    const state = this.serviceStates.get(service)!;
    state.phase = 'shadow';
    state.shadowValidated = false;
    state.readsValidated = false;
    state.writesValidated = false;
    
    console.warn(`[MigrationController] Rolled back service: ${service}`);
  }
  
  /**
   * Emergency rollback - revert entire system to legacy
   */
  async emergencyRollback(): Promise<void> {
    this.config.backend = 'legacy';
    this.config.enabledServices.clear();
    
    for (const [service, state] of this.serviceStates) {
      state.phase = 'shadow';
      state.shadowValidated = false;
      state.readsValidated = false;
      state.writesValidated = false;
    }
    
    console.error('[MigrationController] EMERGENCY ROLLBACK - All services reverted to legacy');
  }
  
  /**
   * Calculate error rate for a service
   */
  private calculateErrorRate(service: ServiceName): number {
    // This would integrate with actual telemetry/metrics
    // For now, return mock data
    const state = this.serviceStates.get(service);
    return state ? (state.errorCount / 1000) * 100 : 0; // Mock calculation
  }
  
  /**
   * Get migration status for all services
   */
  getMigrationStatus(): ServiceMigrationState[] {
    return Array.from(this.serviceStates.values());
  }
  
  /**
   * Get services ready for next phase
   */
  getServicesReadyForPhase(targetPhase: MigrationPhase): ServiceName[] {
    const ready: ServiceName[] = [];
    
    for (const [service, state] of this.serviceStates) {
      if (this.isReadyForPhase(service, targetPhase)) {
        ready.push(service);
      }
    }
    
    return ready;
  }
  
  /**
   * Check if a service is ready for a specific phase
   */
  private isReadyForPhase(service: ServiceName, targetPhase: MigrationPhase): boolean {
    const state = this.serviceStates.get(service)!;
    
    switch (targetPhase) {
      case 'reads':
        return state.shadowValidated && state.phase === 'shadow';
      case 'dualwrite':
        return state.readsValidated && state.phase === 'reads';
      case 'writes':
        return state.phase === 'dualwrite';
      case 'complete':
        return state.writesValidated && state.phase === 'writes';
      default:
        return false;
    }
  }
  
  /**
   * Automated migration orchestration (Claude's service priority + GPT-5's phases)
   */
  async runAutomatedMigration(): Promise<void> {
    console.log('[MigrationController] Starting automated migration...');
    
    for (const service of MigrationController.SERVICE_PRIORITY) {
      try {
        console.log(`[MigrationController] Migrating ${service}...`);
        
        // Phase 1: Shadow reads
        await this.startShadowReads(service);
        await this.waitForPhaseCompletion(service, 'reads');
        
        // Phase 2: Enable reads
        if (this.serviceStates.get(service)!.shadowValidated) {
          await this.enableReads(service);
          await this.waitForPhaseCompletion(service, 'dualwrite');
        }
        
        // Phase 3: Dual writes
        if (this.serviceStates.get(service)!.readsValidated) {
          await this.enableDualWrites(service);
          await this.waitForPhaseCompletion(service, 'writes');
        }
        
        // Phase 4: New backend writes
        await this.enableWrites(service);
        await this.waitForPhaseCompletion(service, 'complete');
        
        console.log(`[MigrationController] Successfully migrated ${service}`);
        
      } catch (error) {
        console.error(`[MigrationController] Failed to migrate ${service}:`, error);
        
        if (this.config.rollbackOnError) {
          await this.rollbackService(service);
          break; // Stop migration on first failure
        }
      }
    }
  }
  
  /**
   * Wait for a service to complete a specific phase
   */
  private async waitForPhaseCompletion(
    service: ServiceName, 
    targetPhase: MigrationPhase,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkPhase = () => {
        const state = this.serviceStates.get(service)!;
        if (state.phase === targetPhase || state.phase === 'complete') {
          resolve();
        }
      };
      
      const interval = setInterval(checkPhase, 1000);
      
      setTimeout(() => {
        clearInterval(interval);
        reject(new DbError('Timeout', 'migration', 'controller',
          `Service ${service} did not reach phase ${targetPhase} within timeout`));
      }, timeoutMs);
      
      checkPhase(); // Check immediately
    });
  }
}

// Export singleton instance
export const migrationController = new MigrationController();