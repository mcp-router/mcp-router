import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@mcp_router/ui";

const RetirementNotice: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <>
      <aside className="mx-4 mt-2 rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <strong>{t("retirement.title")}</strong>
        <p>{t("retirement.summary")}</p>
        <Button
          variant="link"
          className="h-auto p-0"
          onClick={() => setOpen(true)}
        >
          {t("retirement.details")}
        </Button>
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("retirement.title")}</DialogTitle>
            <DialogDescription>{t("retirement.summary")}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{t("retirement.local")}</p>
          <p className="text-sm">{t("retirement.export")}</p>
          <Button onClick={() => setOpen(false)}>
            {t("retirement.continue")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
export default RetirementNotice;
