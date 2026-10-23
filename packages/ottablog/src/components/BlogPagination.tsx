import { ArrowLeft, ArrowRight } from 'lucide-react';

export interface BlogPaginationProps {
    page: number | undefined;
    lastPage: number | undefined;
    isLoading?: boolean;
    showNextPrev?: boolean;
    showPageNumbers?: boolean;
    onPageChange: (page: number) => void;
}

/** Page numbers with an ellipsis: every page up to 7, else first, last and the current page's neighbours. */
function pageNumbers(page: number, lastPage: number): (number | '...')[] {
    if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(lastPage - 1, page + 1); i++) pages.push(i);
    if (page < lastPage - 2) pages.push('...');
    pages.push(lastPage);
    return pages;
}

/** Numbered pagination for post lists: previous/next plus page numbers (numbers hide below `md`). */
export function BlogPagination({
    page = 1,
    lastPage = 1,
    isLoading,
    showNextPrev = true,
    showPageNumbers = true,
    onPageChange,
}: BlogPaginationProps) {
    return (
        <nav aria-label="Pagination" className="flex items-center justify-between border-t border-border px-4 sm:px-0">
            <div className="-mt-px flex w-0 flex-1">
                {showNextPrev && (
                    <button
                        type="button"
                        onClick={() => page > 1 && onPageChange(page - 1)}
                        disabled={isLoading || page === 1}
                        className="inline-flex items-center border-t-2 border-transparent pr-1 pt-4 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground disabled:opacity-50"
                    >
                        <ArrowLeft aria-hidden="true" className="mr-3 h-5 w-5 text-muted-foreground" />
                        Previous
                    </button>
                )}
            </div>

            <div className="hidden md:-mt-px md:flex">
                {showPageNumbers &&
                    pageNumbers(page, lastPage).map((pageNum, index) =>
                        pageNum === '...' ? (
                            <span
                                key={`ellipsis-${index}`}
                                className="inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium text-muted-foreground"
                            >
                                ...
                            </span>
                        ) : (
                            <button
                                type="button"
                                key={pageNum}
                                onClick={() => onPageChange(pageNum)}
                                disabled={isLoading}
                                aria-current={pageNum === page ? 'page' : undefined}
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
                        type="button"
                        onClick={() => page < lastPage && onPageChange(page + 1)}
                        disabled={isLoading || page === lastPage}
                        className="inline-flex items-center border-t-2 border-transparent pl-1 pt-4 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground disabled:opacity-50"
                    >
                        Next
                        <ArrowRight aria-hidden="true" className="ml-3 h-5 w-5 text-muted-foreground" />
                    </button>
                )}
            </div>
        </nav>
    );
}
