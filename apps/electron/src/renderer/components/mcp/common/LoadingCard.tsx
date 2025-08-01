import React from "react";
import { RotateCw } from "lucide-react";
import { Card, CardContent } from "@mcp_router/ui";

interface LoadingCardProps {
  message?: string;
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  message = "Loading...",
  className = "",
}) => {
  return (
    <Card className={`mx-auto max-w-md ${className}`}>
      <CardContent className="pt-6 pb-6 text-center">
        <RotateCw className="h-8 w-8 animate-spin mb-4 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
};
