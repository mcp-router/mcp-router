import { HookModule } from "@mcp_router/shared";

/**
 * Mock data for user-defined hook modules
 * TODO: Replace with actual Electron backend API calls
 */
let mockUserModules: HookModule[] = [
  {
    id: "example-logger",
    name: "Example Logger",
    script: `console.log('[Hook] Example:', context);`,
  },
];

/**
 * Get all user-defined hook modules
 * TODO: Replace with actual API call to Electron backend
 */
export async function getUserHookModules(): Promise<HookModule[]> {
  // Mock implementation - will be replaced with window.api.getHookModules()
  return Promise.resolve(mockUserModules);
}

/**
 * Create a new hook module
 * TODO: Replace with actual API call to Electron backend
 */
export async function createHookModule(module: Omit<HookModule, 'id'>): Promise<HookModule> {
  // Mock implementation - will be replaced with window.api.createHookModule(module)
  const newModule: HookModule = {
    ...module,
    id: `module-${Date.now()}`,
  };
  mockUserModules.push(newModule);
  return Promise.resolve(newModule);
}

/**
 * Update an existing hook module
 * TODO: Replace with actual API call to Electron backend
 */
export async function updateHookModule(id: string, module: Partial<HookModule>): Promise<HookModule> {
  // Mock implementation - will be replaced with window.api.updateHookModule(id, module)
  const index = mockUserModules.findIndex(m => m.id === id);
  if (index >= 0) {
    mockUserModules[index] = { ...mockUserModules[index], ...module };
    return Promise.resolve(mockUserModules[index]);
  }
  throw new Error('Module not found');
}

/**
 * Delete a hook module
 * TODO: Replace with actual API call to Electron backend
 */
export async function deleteHookModule(id: string): Promise<void> {
  // Mock implementation - will be replaced with window.api.deleteHookModule(id)
  mockUserModules = mockUserModules.filter(m => m.id !== id);
  return Promise.resolve();
}

/**
 * Get hook module by ID
 */
export async function getHookModuleById(id: string): Promise<HookModule | undefined> {
  const modules = await getUserHookModules();
  return modules.find(module => module.id === id);
}