'use client';

import React from 'react';
import { trpc } from '../lib/trpc';

interface HelloWorldProps {
  name?: string;
}

export const HelloWorld: React.FC<HelloWorldProps> = ({ name = 'World' }) => {
  const [isElectron, setIsElectron] = React.useState(false);

  React.useEffect(() => {
    setIsElectron(
      typeof window !== 'undefined' && window.electronTRPC !== undefined
    );
  }, []);

  // Example of using tRPC for queries
  const { data: greeting, isLoading, error } = trpc.sayHello.useQuery({ name });

  // Example of using tRPC for mutations
  const { mutate: addUser, isLoading: isAdding } = trpc.addUser.useMutation({
    onSuccess: (data) => {
      console.log('User added:', data);
    },
  });

  const handleAddUser = () => {
    addUser({
      name: 'Test User',
      email: 'test@example.com',
    });
  };

  return (
    <div
      style={{
        padding: '20px',
        border: '2px solid #007acc',
        borderRadius: '8px',
        backgroundColor: '#f0f8ff',
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ color: '#007acc', margin: '0 0 10px 0' }}>
        {isLoading ? 'Loading...' : greeting || `Hello, ${name}!`}
      </h1>
      <p style={{ color: '#666', margin: '0 0 10px 0' }}>
        This component works in both Web and Electron applications
      </p>
      <p style={{ color: '#999', fontSize: '14px', margin: '0 0 10px 0' }}>
        Running in: {isElectron ? 'Electron' : 'Next.js'}
      </p>
      {error && (
        <p style={{ color: 'red', margin: '10px 0' }}>Error: {error.message}</p>
      )}
      <button
        onClick={handleAddUser}
        disabled={isAdding}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isAdding ? 'not-allowed' : 'pointer',
          opacity: isAdding ? 0.6 : 1,
        }}
      >
        {isAdding ? 'Adding User...' : 'Add Test User'}
      </button>
    </div>
  );
};
