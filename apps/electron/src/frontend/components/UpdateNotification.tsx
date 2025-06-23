import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mcp-router/ui";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@mcp-router/ui";
import { IconDownload } from "@tabler/icons-react";

export const UpdateNotification: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center items-center min-h-screen bg-content-light">
      <Card className="w-[500px] shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconDownload className="h-6 w-6 text-primary" />
            {t("updateNotification.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg mb-4">
            <p className="mb-2">{t("updateNotification.description")}</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-4">
          <Button
            className="flex items-center gap-2"
            onClick={() => {
              window.open(
                "https://github.com/mcp-router/mcp-router/releases/latest",
                "_blank",
              );
            }}
          >
            <IconDownload className="h-4 w-4" />
            {t("common.update")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UpdateNotification;
