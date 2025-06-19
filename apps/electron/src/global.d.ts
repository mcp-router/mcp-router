declare global {
  interface Window {
    api: {
      trpc: {
        sayHello: {
          query: (input: { name: string }) => Promise<string>;
        };
        fetchUser: {
          query: (input: {
            id: string;
          }) => Promise<{ id: string; name: string; email: string }>;
        };
        addUser: {
          mutate: (input: {
            name: string;
            email: string;
          }) => Promise<{ id: string; name: string; email: string }>;
        };
      };
    };
  }
}

export {};
