'use client';

import React from 'react';
import { trpc } from '../lib/trpc';
import { HelloWorld } from '../components/HelloWorld';

export function HomePage() {
  const { data: helloData } = trpc.sayHello.useQuery({ name: 'World' });
  const { data: userData } = trpc.fetchUser.useQuery({ id: '123' });
  const createUserMutation = trpc.addUser.useMutation();

  const handleCreateUser = () => {
    createUserMutation.mutate({
      name: 'New User',
      email: 'newuser@example.com',
    });
  };

  const [isElectron, setIsElectron] = React.useState(false);

  React.useEffect(() => {
    setIsElectron(
      typeof window !== 'undefined' && window.electronTRPC !== undefined
    );
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <main style={{ maxWidth: '56rem', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 'bold',
            marginBottom: '2rem',
          }}
        >
          {isElectron ? 'Electron Monorepo App' : 'Electron Monorepo - Web'}
        </h1>

        <div style={{ marginBottom: '2rem' }}>
          <HelloWorld
            name={isElectron ? 'Electron Application' : 'Web Application'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                marginBottom: '0.5rem',
              }}
            >
              Hello Query
            </h2>
            <p>{helloData || 'Loading...'}</p>
          </div>

          <div
            style={{
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                marginBottom: '0.5rem',
              }}
            >
              User Query
            </h2>
            {userData ? (
              <pre style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(userData, null, 2)}
              </pre>
            ) : (
              <p>Loading...</p>
            )}
          </div>

          <div
            style={{
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                marginBottom: '0.5rem',
              }}
            >
              Create User
            </h2>
            <button
              onClick={handleCreateUser}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = '#2563eb')
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = '#3b82f6')
              }
            >
              Create User
            </button>
            {createUserMutation.data && (
              <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(createUserMutation.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
