export interface Context {
  user?: {
    id: string;
    name: string;
  };
}

export function createContext(): Context {
  return {};
}
