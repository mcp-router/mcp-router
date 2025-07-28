import React from "react";
import { useAuthStore } from "@/renderer/stores";
import { usePlatformAPI } from "@/main/infrastructure/platform-api";
import { LoginScreen } from "../setup/LoginScreen";

interface AgentAuthGuardProps {
  children: React.ReactNode;
}

const AgentAuthGuard: React.FC<AgentAuthGuardProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const platformAPI = usePlatformAPI();

  const handleLogin = () => {
    platformAPI.auth.signIn();
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-content-light h-screen">
        <React.Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-content-light">
              <div className="text-center">
                <p className="mt-4 text-muted-foreground">Loading...</p>
              </div>
            </div>
          }
        >
          <LoginScreen onLogin={handleLogin} />
        </React.Suspense>
      </div>
    );
  }

  return <>{children}</>;
};

export default AgentAuthGuard;
