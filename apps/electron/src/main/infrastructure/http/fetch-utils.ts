// Note: This file is in shared/ so it should not directly import from main/
// The auth token and API_BASE_URL should be passed as parameters or configured differently

/**
 * Make a fetch request with authentication token
 * @param path The API path to fetch (will be appended to API_BASE_URL)
 * @param options Fetch options
 * @returns Fetch response
 * @throws Error if token is not available or fetch fails
 */
export async function fetchWithToken(
  path: string,
  options: RequestInit & { token?: string; apiBaseUrl?: string } = {},
): Promise<Response> {
  // Get the authentication token from options
  const token = options.token;
  const apiBaseUrl = options.apiBaseUrl || "https://mcp-router.net/api";

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
    : `${apiBaseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

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
  options: RequestInit & { token?: string; apiBaseUrl?: string } = {},
): Promise<T> {
  const response = await fetchWithToken(path, options);

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}
