import { ChevronLeft, ChevronRight } from "lucide-react";

export const Pagination = ({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) => (
  <div className="flex items-center justify-between gap-3 pt-4" data-testid="pagination">
    <span className="text-xs text-txt-3">
      Page {page} of {totalPages} · {total} records
    </span>
    <div className="flex items-center gap-2">
      <button
        data-testid="pagination-prev"
        className="btn-ghost !px-2.5 !py-1.5"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
      </button>
      <button
        data-testid="pagination-next"
        className="btn-ghost !px-2.5 !py-1.5"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  </div>
);
