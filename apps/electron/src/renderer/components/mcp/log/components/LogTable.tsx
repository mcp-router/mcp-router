import React from "react";
import { useTranslation } from "react-i18next";
import { RequestLogEntry } from "@mcp_router/shared";
import { formatDateI18n } from "@/lib/utils/date-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { Card } from "@mcp_router/ui";

interface LogTableProps {
  logs: RequestLogEntry[];
  total: number;
  loading: boolean;
  currentPage: number;
  hasMore: boolean;
  hasPrevious: boolean;
  limit: number;
  onSelectLog: (log: RequestLogEntry) => void;
  onPageChange: (direction: "next" | "previous") => void;
  onLimitChange: (newLimit: number) => void;
}

const LogTable: React.FC<LogTableProps> = ({
  logs,
  total,
  loading,
  currentPage,
  hasMore,
  hasPrevious,
  limit,
  onSelectLog,
  onPageChange,
  onLimitChange,
}) => {
  const { t, i18n } = useTranslation();
  return (
    <Card className="p-4 flex-1 overflow-auto">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 mr-1"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
            <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
            <path d="M9 12h6" />
            <path d="M9 16h6" />
          </svg>
          <h3 className="text-lg font-medium">
            {t("logs.viewer.table.title")}
          </h3>
        </div>
        <div className="text-sm text-muted-foreground">
          {t("logs.viewer.table.showing", {
            total: total,
            start: total > 0 ? (currentPage - 1) * limit + 1 : 0,
            end: Math.min((currentPage - 1) * limit + logs.length, total),
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <div>{t("logs.viewer.table.noLogs")}</div>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50">
              <TableRow>
                <TableHead className="whitespace-nowrap">
                  {t("logs.viewer.table.timestamp")}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t("logs.viewer.table.client")}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t("logs.viewer.table.server")}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t("logs.viewer.table.requestType")}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t("logs.viewer.table.status")}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t("logs.viewer.table.processingTime")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => onSelectLog(log)}
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateI18n(
                      log.timestamp,
                      t,
                      "shortDateTimeWithSeconds",
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {log.clientName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {log.serverName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {log.requestType}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span
                      className={
                        log.responseStatus === "success"
                          ? "text-green-600 dark:text-green-500"
                          : "text-destructive"
                      }
                    >
                      {log.responseStatus === "success"
                        ? t("logs.viewer.table.success")
                        : t("logs.viewer.table.error")}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {log.duration}ms
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-end items-center text-sm">
            <div className="flex gap-2">
              <Button
                onClick={() => onPageChange("previous")}
                disabled={!hasPrevious}
                variant="outline"
                size="sm"
              >
                {t("logs.viewer.table.previous")}
              </Button>
              <Button
                onClick={() => onPageChange("next")}
                disabled={!hasMore}
                variant="outline"
                size="sm"
              >
                {t("logs.viewer.table.next")}
              </Button>
              <Select
                value={String(limit)}
                onValueChange={(value) => onLimitChange(Number(value))}
              >
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue
                    placeholder={t("logs.viewer.table.itemsPerPage", {
                      count: limit,
                    })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">
                    {t("logs.viewer.table.itemsPerPage", { count: 10 })}
                  </SelectItem>
                  <SelectItem value="25">
                    {t("logs.viewer.table.itemsPerPage", { count: 25 })}
                  </SelectItem>
                  <SelectItem value="50">
                    {t("logs.viewer.table.itemsPerPage", { count: 50 })}
                  </SelectItem>
                  <SelectItem value="100">
                    {t("logs.viewer.table.itemsPerPage", { count: 100 })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default LogTable;
