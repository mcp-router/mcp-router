/**
 * Authentication domain API
 */

export type AuthProvider = "github" | "google" | string;
export type Unsubscribe = () => void;

export interface AuthStatus {
  authenticated: boolean;
  userId?: string;
  user?: any;
  token?: string;
}

export interface AuthAPI {
  signIn(provider?: AuthProvider): Promise<boolean>;
  signOut(): Promise<boolean>;
  getStatus(forceRefresh?: boolean): Promise<AuthStatus>;
  handleToken(token: string, state?: string): Promise<boolean>;
  onChange(callback: (status: AuthStatus) => void): Unsubscribe;
}
