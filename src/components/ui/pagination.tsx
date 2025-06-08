import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  maxPageButtons?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = false,
  maxPageButtons = 5
}: PaginationProps) {
  const { t } = useTranslation();
  
  // Calculate start and end item numbers
  const startItem = totalPages > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  
  // Generate array of page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];
    
    if (totalPages <= maxPageButtons) {
      // Show all pages if total pages is less than maxPageButtons
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Calculate range of pages to show
      let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
      let endPage = startPage + maxPageButtons - 1;
      
      if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxPageButtons + 1);
      }
      
      // Add first page if not included
      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) {
          pageNumbers.push('ellipsis-start');
        }
      }
      
      // Add pages in range
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      // Add last page if not included
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageNumbers.push('ellipsis-end');
        }
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };
  
  const pageNumbers = getPageNumbers();
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
      <div className="text-sm text-muted-foreground">
        {totalItems > 0 ? (
          t('pagination.showing', { start: startItem, end: endItem, total: totalItems })
        ) : (
          t('pagination.noItems')
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center space-x-2 mr-4">
            <span className="text-sm text-muted-foreground">{t('pagination.itemsPerPage')}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="inline-flex flex-wrap">
            {pageNumbers.map((page, index) => (
              page === 'ellipsis-start' || page === 'ellipsis-end' ? (
                <span key={`ellipsis-${index}`} className="mx-1 text-muted-foreground">…</span>
              ) : (
                <Button
                  key={`page-${index}-${page}`}
                  variant={currentPage === page ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 mx-0.5 my-0"
                  onClick={() => onPageChange(Number(page))}
                  disabled={totalPages === 0}
                >
                  <span>{page}</span>
                </Button>
              )
            ))}
          </div>
      </div>
    </div>
  );
}
