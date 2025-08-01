import React from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@mcp_router/ui";

interface MessageCardProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  icon,
  title,
  description,
  className = "",
}) => {
  return (
    <Card className={`mx-auto max-w-md ${className}`}>
      <CardContent className="pt-6 text-center">
        {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
        <CardTitle className="text-xl mb-2">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardContent>
    </Card>
  );
};
