import { getSettingsService } from "@/main/modules/settings/settings.service";
import { API_BASE_URL, mainWindow } from "../../../main";
import crypto from "crypto";
import { shell } from "electron";
import { fetchWithToken } from "@/main/utils/fetch-utils";
import { machineIdSync } from "node-machine-id";
import { PKCEAuthState } from "@mcp_router/shared";

// Store the current authentication state
let currentAuthState: PKCEAuthState | null = null;

/**
 * Generate a random string for PKCE code verifier
 * @param length Length of the random string
 * @returns Random string
 */
function generateRandomString(length: number): string {
  return crypto
    .randomBytes(length)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .substring(0, length);
}

/**
 * Generate a code challenge from a code verifier using SHA-256
 * @param codeVerifier The code verifier
 * @returns Code challenge (BASE64URL encoded)
 */
function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return hash;
}

/**
 * Generate a state parameter with optional identity provider information
 * @param idp Optional identity provider identifier
 * @returns State string containing random data and idp info
 */
function generateState(idp?: string): string {
  const randomPart = generateRandomString(16);
  const stateParts = [randomPart];

  if (idp) {
    stateParts.push(`idp:${idp}`);
  }

  return stateParts.join("|");
}

export function startAuthFlow(idp?: string) {
  // Generate PKCE code verifier and challenge
  const codeVerifier = generateRandomString(64);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Generate state with optional IdP info
  const state = generateState(idp);

  // Store the auth state for later validation
  currentAuthState = {
    codeVerifier,
    codeChallenge,
    state,
    idp,
    createdAt: Date.now(),
  };

  // Create callback URL with PKCE parameters
  const callbackUrl = new URL("/desktop-signin/callback", API_BASE_URL);
  callbackUrl.searchParams.append("code_challenge", codeChallenge);
  callbackUrl.searchParams.append("code_challenge_method", "S256");
  callbackUrl.searchParams.append("state", state);

  // Build auth URL
  const authUrl = new URL(`${API_BASE_URL}/auth/signin`);
  authUrl.searchParams.append(
    "callbackUrl",
    callbackUrl.pathname + callbackUrl.search,
  );

  // Open the auth page in external browser
  shell.openExternal(authUrl.toString());
}

// Handle the auth token received from the website
export function handleAuthToken(token: string, state?: string) {
  try {
    // Validate state parameter if provided
    if (state && currentAuthState) {
      // Check if state matches what we generated
      if (state !== currentAuthState.state) {
        console.error("State parameter mismatch - possible CSRF attack");
        return;
      }

      // Extract IdP information if it was stored in the state
      const idp = currentAuthState.idp;

      // In a complete PKCE flow, we would now make a token exchange request:
      // POST to token endpoint with:

      // For now, simulate the exchange by validating the token directly:
      exchangeCodeForToken(token, currentAuthState.codeVerifier, idp);
      // Clear the current auth state once used
      currentAuthState = null;
      return;
    }
  } catch (error) {
    console.error("Error handling auth token:", error);
  }
}

/**
 * Exchange authorization code for token using PKCE
 * @param code The authorization code from the auth server
 * @param codeVerifier The original code verifier
 * @param idp Optional identity provider info
 */
async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  idp?: string,
) {
  try {
    // Make a request to exchange the code for a token
    const tokenResponse = await fetch(`${API_BASE_URL}/auth/desktop-signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        codeVerifier: codeVerifier,
        machineId: machineIdSync(),
        codeChallengeMethod: "S256",
        client_id: "mcp-router-app",
        grant_type: "authorization_code",
        idp,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.accessToken) {
      // Get the settings service to store the token
      const settingsService = getSettingsService();

      // Get current settings and update with the new token
      const settings = settingsService.getSettings();
      settings.authToken = tokenData.accessToken;
      settings.loggedInAt = new Date().toISOString();

      settingsService.saveSettings(settings);
      const user = await status();

      // Notify the renderer process about the auth state change
      if (mainWindow) {
        mainWindow.webContents.send("auth:status-changed", {
          loggedIn: true,
          userId: user.userId,
          user: user.user,
        });
      }
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return false;
  }
}

/**
 * Logout the current user by removing the auth token
 * @returns True if logout was successful
 */
export function logout(): boolean {
  try {
    // Get the settings service
    const settingsService = getSettingsService();

    // Get current settings
    const settings = settingsService.getSettings();

    // Clear auth token and related fields
    settings.authToken = "";
    settings.userId = "";
    settings.subscriptionStatus = null;
    settings.planName = null;

    // Save the updated settings
    const result = settingsService.saveSettings(settings);

    // Clear the status cache
    clearStatusCache();

    // Notify the renderer process about the auth state change
    if (mainWindow) {
      mainWindow.webContents.send("auth:status-changed", {
        loggedIn: false,
        userId: "",
      });
    }

    return result;
  } catch (error) {
    console.error("Error during logout:", error);
    return false;
  }
}

/**
 * Get the authentication token from settings
 * @returns The authentication token or null if not available
 */
export async function getDecryptedAuthToken(): Promise<string | null> {
  try {
    // Get the settings service
    const settingsService = getSettingsService();

    // Get current settings
    const settings = settingsService.getSettings();

    // Return the auth token directly
    return settings.authToken || null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
}

// Cache for user data fetched from server
let userDataCache: { user?: any; lastFetched: number } | null = null;
const USER_DATA_CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache lifetime

/**
 * Clear the user data cache
 */
function clearStatusCache(): void {
  userDataCache = null;
}

/**
 * Check the current authentication status and retrieve user information
 * @param forceRefresh If true, bypasses the cache and fetches fresh data
 * @returns User status information or null if not authenticated
 */
export async function status(forceRefresh = false): Promise<{
  authenticated: boolean;
  userId?: string;
  user?: any;
  token?: string;
}> {
  try {
    const settingsService = getSettingsService();
    const settings = settingsService.getSettings();

    // If no auth token, return not authenticated
    if (!settings.authToken) {
      return { authenticated: false };
    }

    // Check if we have cached user data and it's still valid
    if (
      !forceRefresh &&
      userDataCache &&
      Date.now() - userDataCache.lastFetched < USER_DATA_CACHE_TTL
    ) {
      return {
        authenticated: true,
        userId: settings.userId,
        user: userDataCache.user,
      };
    }

    try {
      const token = await getDecryptedAuthToken();
      if (!token) {
        return { authenticated: false };
      }

      const userResponse = await fetchWithToken("/auth/desktop-signin/status", {
        token: token,
        apiBaseUrl: API_BASE_URL,
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();

        // Update user info in settings
        const newUserId = userData.id || userData.userId;
        const newSubscriptionStatus = userData.subscriptionStatus ?? null;
        const newPlanName = userData.planName ?? null;

        const needsUpdate =
          (newUserId && settings.userId !== newUserId) ||
          settings.subscriptionStatus !== newSubscriptionStatus ||
          settings.planName !== newPlanName;

        if (needsUpdate) {
          if (newUserId) {
            settings.userId = newUserId;
          }
          settings.subscriptionStatus = newSubscriptionStatus;
          settings.planName = newPlanName;
          settingsService.saveSettings(settings);
        }

        // Cache the user data
        userDataCache = {
          user: userData,
          lastFetched: Date.now(),
        };

        return {
          authenticated: true,
          userId: settings.userId,
          user: userData,
        };
      } else {
        if (userResponse.status === 401) {
          logout();
        }
        return { authenticated: false };
      }
    } catch (error) {
      console.error("Error fetching authentication status:", error);
      return { authenticated: false };
    }
  } catch (error) {
    console.error("Error checking authentication status:", error);
    return { authenticated: false };
  }
}
