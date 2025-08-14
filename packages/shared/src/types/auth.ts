// Authentication and user types

export interface UserInfo {
  userId: string;
  name: string;
  creditBalance: number;
  paidCreditBalance: number;
}

// PKCE flow authentication state
export interface PKCEAuthState {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  idp?: string; // Identity provider (optional)
  createdAt: number; // Timestamp for potential expiry checking
}
