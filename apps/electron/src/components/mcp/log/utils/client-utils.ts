/**
 * Utility functions for client-related operations in the log visualization.
 */

/**
 * Client type categories
 */
export enum ClientType {
  API = "API Client",
  WEB = "Web Client",
  MOBILE = "Mobile Client",
  SERVER = "Server Client",
  CLI = "CLI Client",
  UNKNOWN = "Other Client",
}

/**
 * Interface for categorized client information
 */
export interface CategorizedClient {
  id: string;
  name: string;
  type: ClientType;
  displayName: string;
}

/**
 * Helper function to determine client type from client name or ID
 * @param clientId The client ID string
 * @param clientName The client name string
 * @returns The identified client type
 */
export const determineClientType = (
  clientId: string,
  clientName?: string,
): ClientType => {
  // Use both name and ID for more accurate classification
  const identifier = ((clientName || "") + clientId).toLowerCase();

  // Classification rules based on common patterns
  if (identifier.includes("api") || identifier.includes("sdk")) {
    return ClientType.API;
  } else if (identifier.includes("web") || identifier.includes("browser")) {
    return ClientType.WEB;
  } else if (
    identifier.includes("mobile") ||
    identifier.includes("android") ||
    identifier.includes("ios") ||
    identifier.includes("app")
  ) {
    return ClientType.MOBILE;
  } else if (
    identifier.includes("server") ||
    identifier.includes("backend") ||
    identifier.includes("service")
  ) {
    return ClientType.SERVER;
  } else if (
    identifier.includes("cli") ||
    identifier.includes("console") ||
    identifier.includes("terminal")
  ) {
    return ClientType.CLI;
  }

  return ClientType.UNKNOWN;
};

/**
 * Generate a meaningful display name for a client based on ID and type
 * @param clientId The client ID string
 * @param clientName The client name string
 * @param clientType The client type
 * @returns A display name for the client
 */
export const generateClientDisplayName = (
  clientId: string,
  clientName?: string,
  clientType?: ClientType,
): string => {
  if (
    clientName &&
    clientName !== "unknown-client" &&
    clientName.trim() !== ""
  ) {
    // If valid name is provided, use it
    return clientName;
  }

  // Create a type-based prefix
  const typePrefix = clientType
    ? clientType.toString().split(" ")[0].toLowerCase()
    : "client";

  // Use shortened ID (first 6 chars)
  const shortId = clientId.substring(0, Math.min(6, clientId.length));

  return `${typePrefix}-${shortId}`;
};

/**
 * Categorize a client based on its ID and name
 * @param clientId The client ID string
 * @param clientName The client name string
 * @returns A categorized client object
 */
export const categorizeClient = (
  clientId: string,
  clientName?: string,
): CategorizedClient => {
  const type = determineClientType(clientId, clientName);

  return {
    id: clientId,
    name: clientName || "",
    type: type,
    displayName: generateClientDisplayName(clientId, clientName, type),
  };
};

/**
 * Group clients by their type
 * @param clients Array of client objects with id and name
 * @returns Map of client types to arrays of categorized clients
 */
export const groupClientsByType = (
  clients: Array<{ id: string; name: string }>,
): Map<ClientType, CategorizedClient[]> => {
  const groupedClients = new Map<ClientType, CategorizedClient[]>();

  // Initialize all client type groups
  Object.values(ClientType).forEach((type) => {
    groupedClients.set(type, []);
  });

  // Categorize and group each client
  clients.forEach((client) => {
    const categorized = categorizeClient(client.id, client.name);
    const typeGroup = groupedClients.get(categorized.type) || [];
    typeGroup.push(categorized);
    groupedClients.set(categorized.type, typeGroup);
  });

  return groupedClients;
};
