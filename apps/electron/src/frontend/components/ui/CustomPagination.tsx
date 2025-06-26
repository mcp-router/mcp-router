import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@mcp-router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp-router/ui";

interface CustomPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  maxPageButtons?: number;
  className?: string;
}

export const CustomPagination: React.FC<CustomPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  showPageSizeSelector = false,
  maxPageButtons = 5,
  className,
}) => {
  const renderPageNumbers = () => {
    const pages: (number | string)[] = [];
    const halfMax = Math.floor(maxPageButtons / 2);

    let startPage = Math.max(1, currentPage - halfMax);
    let endPage = Math.min(totalPages, currentPage + halfMax);

    if (currentPage - halfMax <= 0) {
      endPage = Math.min(totalPages, maxPageButtons);
    }

    if (currentPage + halfMax >= totalPages) {
      startPage = Math.max(1, totalPages - maxPageButtons + 1);
    }

    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) {
        pages.push("ellipsis-start");
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push("ellipsis-end");
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePageSizeChange = (value: string) => {
    if (onPageSizeChange) {
      onPageSizeChange(Number(value));
    }
  };

  return (
    <div
      className={`flex items-center justify-between space-x-4 ${className || ""}`}
    >
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span>
          Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to{" "}
          {Math.min(currentPage * pageSize, totalItems)} of {totalItems} results
        </span>
      </div>

      <div className="flex items-center space-x-4">
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">per page</span>
          </div>
        )}

        <Pagination className={className}>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) {
                    onPageChange(currentPage - 1);
                  }
                }}
                className={
                  currentPage === 1 ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>

            {renderPageNumbers().map((page, index) => (
              <PaginationItem key={`page-${index}`}>
                {typeof page === "string" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(page);
                    }}
                    isActive={page === currentPage}
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) {
                    onPageChange(currentPage + 1);
                  }
                }}
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
};
