/**
 * Utility functions for color-related operations in the log visualization.
 */

// Professional color palette for request types
const REQUEST_TYPE_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#14b8a6", // teal
];

/**
 * Generate a color for a request type
 * @param requestType The request type string
 * @returns A color from the palette
 */
export const getRequestTypeColor = (requestType: unknown): string => {
  // Handle undefined, null, or non-string requestType to prevent runtime errors
  if (typeof requestType !== "string") {
    return REQUEST_TYPE_COLORS[0]; // Default to the first color
  }

  // Use a hash function to get a stable color for each request type
  const hash = requestType.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const index = Math.abs(hash) % REQUEST_TYPE_COLORS.length;
  return REQUEST_TYPE_COLORS[index];
};

/**
 * Generate a color for a server ID
 * @param serverId The server ID string
 * @returns A color from the palette
 */
export const getServerColor = (serverId: unknown): string => {
  // Handle undefined, null, or non-string serverId to prevent runtime errors
  if (typeof serverId !== "string") {
    return REQUEST_TYPE_COLORS[0]; // Default to the first color
  }

  // Use a hash function to get a stable color for each server
  const hash = serverId.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const index = Math.abs(hash) % REQUEST_TYPE_COLORS.length;
  return REQUEST_TYPE_COLORS[index];
};

/**
 * Generate a color for a client ID
 * @param clientId The client ID string
 * @returns A color from the palette
 */
export const getClientColor = (clientId: unknown): string => {
  // Handle undefined, null, or non-string clientId to prevent runtime errors
  if (typeof clientId !== "string") {
    return REQUEST_TYPE_COLORS[0]; // Default to the first color
  }

  // Use a hash function to get a stable color for each client
  const hash = clientId.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const index = Math.abs(hash) % REQUEST_TYPE_COLORS.length;
  return REQUEST_TYPE_COLORS[index];
};
