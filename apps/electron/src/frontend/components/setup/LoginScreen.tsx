import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mcp_router/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@mcp_router/ui";
import { IconUserPlus } from "@tabler/icons-react";

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center items-center min-h-screen bg-content-light">
      <Card className="w-[450px] shadow-lg">
        <CardHeader>
          <CardTitle>{t("login.title", "Login Required")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              className="w-full flex items-center justify-center"
              onClick={onLogin}
            >
              <IconUserPlus className="h-5 w-5 mr-2" />
              {t("login.loginButton", "Login")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

