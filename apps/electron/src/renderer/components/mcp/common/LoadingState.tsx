import React from "react";
import { RotateCw } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  className = "",
}) => {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center ${className}`}>
      <RotateCw className="h-8 w-8 animate-spin mb-4" />
      <p>{message}</p>
    </div>
  );
};