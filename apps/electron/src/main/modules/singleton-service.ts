import { logError } from "@/main/utils/logger";

/**
 * Base class for singleton services.
 *
 * Inheriting from this class provides the following features:
 * 1. Singleton pattern implementation
 * 2. Instance reset on workspace switch
 * 3. Dynamic repository retrieval (supports workspace switching)
 * 4. Common error handling
 *
 * @template T - Entity type managed by the service
 * @template K - Entity ID type (defaults to string)
 * @template S - The service class type itself
 */
export abstract class SingletonService<_T, _K = string, _S = any> {
  /**
   * Map storing singleton instances.
   * Key: Service class constructor
   * Value: Service instance
   */
  private static instances: Map<Function, any> = new Map();

  /**
   * Constructor.
   * Note: To maintain the singleton pattern, use getInstance() instead of
   * direct instantiation.
   */
  public constructor() {}

  /**
   * Abstract method to get entity name (used for error messages, etc.).
   * Must be implemented by each subclass.
   */
  protected abstract getEntityName(): string;

  /**
   * Common error handling.
   * @param operation - Operation name
   * @param error - Error object
   * @param defaultValue - Value to return on error (throws if not specified)
   * @returns Default value or throws
   */
  protected handleError(
    operation: string,
    error: unknown,
    defaultValue?: any,
  ): any {
    const entityName = this.getEntityName();
    const message = `Error during ${operation} of ${entityName}`;
    logError(message, error);

    if (arguments.length > 2) {
      return defaultValue;
    }

    throw error;
  }

  /**
   * Get the singleton instance.
   * @param ServiceClass - Service class constructor
   * @returns Service instance
   */
  protected static getInstanceBase<T extends SingletonService<any, any, any>>(
    this: new () => T,
  ): T {
    if (!SingletonService.instances.has(this)) {
      SingletonService.instances.set(this, new this());
    }
    return SingletonService.instances.get(this) as T;
  }

  /**
   * Reset a specific service instance.
   * Used when switching workspaces.
   * @param ServiceClass - Constructor of the service class to reset
   */
  protected static resetInstanceBase<T extends Function>(
    ServiceClass: T,
  ): void {
    SingletonService.instances.delete(ServiceClass);
  }

  /**
   * Reset all service instances.
   * Used on application exit or during tests.
   */
  public static resetAllInstances(): void {
    SingletonService.instances.clear();
  }
}
