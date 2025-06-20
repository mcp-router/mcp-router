export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AppState {
  user: User | null;
  isLoading: boolean;
}
