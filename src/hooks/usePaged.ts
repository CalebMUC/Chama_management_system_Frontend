'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Paged } from '@/api/client';

/**
 * A server-paged list (zero-based pages). Changing any filter returns to the first page. Spread `table` into a server-mode
 * DataTable.
 */
export function usePaged<T, F extends object>(key: unknown[], filters: F, load: (params: F & { page: number; size: number }) => Promise<Paged<T>>, opts: { enabled?: boolean; initialSize?: number } = {}) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(opts.initialSize ?? 25);
  const filterKey = JSON.stringify(filters);
  useEffect(() => setPage(0), [filterKey]);
  const query = useQuery({
    queryKey: [...key, filters, page, size],
    queryFn: () => load({ ...filters, page, size }),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
  return {
    query,
    items: query.data?.items,
    table: {
      mode: 'server' as const,
      data: query.data?.items,
      isLoading: query.isLoading,
      error: query.error,
      onRetry: () => void query.refetch(),
      page,
      pageSize: size,
      totalCount: query.data?.meta.totalElements ?? 0,
      onPageChange: setPage,
      onPageSizeChange: (s: number) => { setSize(s); setPage(0); },
    },
  };
}
