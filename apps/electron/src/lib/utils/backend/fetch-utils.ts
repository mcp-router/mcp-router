import { getDecryptedAuthToken } from "../../../main/auth";
import { API_BASE_URL } from "../../../main";

/**
 * Make a fetch request with authentication token
 * @param path The API path to fetch (will be appended to API_BASE_URL)
 * @param options Fetch options
 * @returns Fetch response
 * @throws Error if token is not available or fetch fails
 */
export async function fetchWithToken(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  // Get the authentication token - now async
  const token = await getDecryptedAuthToken();

  if (!token) {
    throw new Error("Authentication token not available");
  }

  // Prepare headers
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  // Create URL (handle both relative paths and full URLs)
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  // Make the authenticated request
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Make a fetch request with authentication token and parse the JSON response
 * @param path The API path to fetch
 * @param options Fetch options
 * @returns Parsed JSON response
 * @throws Error if token is not available, fetch fails, or response is not valid JSON
 */
export async function fetchWithTokenJson<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetchWithToken(path, options);

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}
