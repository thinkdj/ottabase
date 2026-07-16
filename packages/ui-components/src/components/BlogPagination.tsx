/*  Simple Pagination for Blog Posts */

import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';

interface BlogPaginationProps {
    page: number | undefined;
    lastPage: number | undefined;
    perPage: number | undefined;
    isLoading?: boolean;
    showNextPrev?: boolean;
    showPageNumbers?: boolean;
    onPageChange: (page: number) => void;
}

export default function BlogPagination({
    page = 1,
    lastPage = 1,
    perPage = 30,
    isLoading,
    showNextPrev = true,
    showPageNumbers = true,
    onPageChange,
}: BlogPaginationProps) {
    /*  Generate page numbers with ellipsis... */
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (!showPageNumbers) return pages;
        if (lastPage <= 7) {
            // Show all pages if total pages are 7 or less
            for (let i = 1; i <= lastPage; i++) pages.push(i);
        } else {
            // Always show first page
            pages.push(1);
            if (page > 3) pages.push('...');
            // Show pages around current page
            for (let i = Math.max(2, page - 1); i <= Math.min(lastPage - 1, page + 1); i++) {
                pages.push(i);
            }
            if (page < lastPage - 2) pages.push('...');
            // Always show last page
            pages.push(lastPage);
        }
        return pages;
    };

    return (
        <nav className="flex items-center justify-between border-t border-border px-4 sm:px-0">
            <div className="-mt-px flex w-0 flex-1">
                {showNextPrev && (
                    <button
                        onClick={() => page > 1 && onPageChange(page - 1)}
                        disabled={isLoading || page === 1}
                        className="inline-flex items-center border-t-2 border-transparent pr-1 pt-4 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground disabled:opacity-50"
                    >
                        <IconArrowLeft aria-hidden="true" className="mr-3 h-5 w-5 text-muted-foreground" />
                        Previous
                    </button>
                )}
            </div>

            <div className="hidden md:-mt-px md:flex">
                {showPageNumbers &&
                    getPageNumbers().map((pageNum, index) =>
                        pageNum === '...' ? (
                            <span
                                key={`ellipsis-${index}`}
                                className="inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium text-muted-foreground"
                            >
                                ...
                            </span>
                        ) : (
                            <button
                                key={pageNum}
                                onClick={() => typeof pageNum === 'number' && onPageChange(pageNum)}
                                disabled={isLoading}
                                className={`inline-flex items-center border-t-2 px-4 pt-4 text-sm font-medium ${
                                    pageNum === page
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                                }`}
                            >
                                {pageNum}
                            </button>
                        ),
                    )}
            </div>

            <div className="-mt-px flex w-0 flex-1 justify-end">
                {showNextPrev && (
                    <button
                        onClick={() => page < lastPage && onPageChange(page + 1)}
                        disabled={isLoading || page === lastPage}
                        className="inline-flex items-center border-t-2 border-transparent pl-1 pt-4 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground disabled:opacity-50"
                    >
                        Next
                        <IconArrowRight aria-hidden="true" className="ml-3 h-5 w-5 text-muted-foreground" />
                    </button>
                )}
            </div>
        </nav>
    );
}
