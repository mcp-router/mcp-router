/**
 * Token-related type definitions
 */

/**
 * Map of server access permissions
 */
export type TokenServerAccess = Record<string, boolean>;

/**
 * OAuth 2.1 Resource Indicators (RFC 8707)
 * Used to restrict token scope to specific resource servers
 */
export interface TokenResourceIndicator {
  /** Resource server URI this token is valid for */
  resource: string;
  /** Scopes granted for this resource */
  scopes?: string[];
}

/**
 * Token interface
 */
export interface Token {
  id: string; // Unique token ID
  clientId: string; // Associated client ID
  issuedAt: number; // UNIX timestamp when the token was issued
  serverAccess: TokenServerAccess; // Per-server access permissions (true=allow, false=deny)
  expiresAt?: number; // Token expiration (UNIX timestamp)
  /** RFC 8707 resource indicators - restricts token to specific resources */
  resourceIndicators?: TokenResourceIndicator[];
}

/**
 * Options for token generation
 */
export interface TokenGenerateOptions {
  clientId: string; // Client ID
  serverAccess: TokenServerAccess; // Map of server IDs to grant access to
  expiresIn?: number; // Token validity period in seconds, default is 24 hours
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  isValid: boolean; // Whether the token exists
  clientId?: string; // Client ID if valid
  error?: string; // Error message if not found
}
