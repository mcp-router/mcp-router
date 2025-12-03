// Authentication and user types

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "trialing"
  | "past_due";

export interface UserInfo {
  userId: string;
  name: string;
  subscriptionStatus: SubscriptionStatus | null;
  planName?: string | null;
}

// PKCE flow authentication state
export interface PKCEAuthState {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  idp?: string; // Identity provider (optional)
  createdAt: number; // Timestamp for potential expiry checking
}
