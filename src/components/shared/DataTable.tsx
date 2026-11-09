'use client';

import { Fragment, useState, type ReactNode } from 'react';
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type PaginationState, type SortingState, type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Columns3, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/overlays';
import { Input, NativeSelect, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { downloadCsv, type CsvColumn } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState } from './States';

export type { ColumnDef } from '@tanstack/react-table';

interface BaseProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  getRowId?: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyMessage?: ReactNode;
  emptyAction?: ReactNode;
  /** Filters and buttons shown above the table, next to the search box. */
  toolbar?: ReactNode;
  csv?: { fileName: string; columns: CsvColumn<T>[] };
  rowClassName?: (row: T) => string | undefined;
  /** A <TableFooter> (totals row). */
  footer?: ReactNode;
  /** Makes rows expandable: clicking a row shows this under it. Ignored when onRowClick is set. */
  renderExpanded?: (row: T) => ReactNode;
  /** Below 640 px, rows render as these cards instead of a table (README §8.6: most members use phones). */
  mobileCard?: (row: T) => ReactNode;
  /** Offer a menu to show and hide columns (columns with a string header). */
  columnToggle?: boolean;
  /** Cap the grid's height and scroll inside it, keeping the header row in view. Default true. */
  stickyHeader?: boolean;
}

interface ClientProps<T> extends BaseProps<T> {
  mode?: 'client';
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
}

interface ServerProps<T> extends BaseProps<T> {
  mode: 'server';
  /** Zero-based, as the API pages. */
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange(page: number): void;
  onPageSizeChange?(pageSize: number): void;
}

export type DataTableProps<T> = ClientProps<T> | ServerProps<T>;

/**
 * Column meta. `numeric` right-aligns the column with tabular figures (amounts, counts); `align` is the older spelling.
 * `hideable: false` keeps a column out of the column menu.
 */
export type ColMeta = { align?: 'right' | 'center'; numeric?: boolean; className?: string; hideable?: boolean } | undefined;

const alignClass = (meta: ColMeta) => cn((meta?.numeric || meta?.align === 'right') && 'text-right tabular', meta?.align === 'center' && 'text-center', meta?.className);

/** One table for every list: client mode sorts, filters and pages loaded rows; server mode drives the API's paging. */
export function DataTable<T>(props: DataTableProps<T>) {
  const server = props.mode === 'server';
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const expandable = !!props.renderExpanded && !props.onRowClick;
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: (!server && (props as ClientProps<T>).pageSize) || 25 });

  const table = useReactTable<T>({
    data: props.data ?? [],
    columns: props.columns,
    getRowId: props.getRowId ? (row) => props.getRowId!(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    ...(server
      ? {
          manualPagination: true,
          enableSorting: false,
          pageCount: Math.max(1, Math.ceil(props.totalCount / props.pageSize)),
          state: { pagination: { pageIndex: props.page, pageSize: props.pageSize }, columnVisibility },
        }
      : {
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          state: { sorting, globalFilter, pagination, columnVisibility },
          onSortingChange: setSorting,
          onGlobalFilterChange: setGlobalFilter,
          onPaginationChange: setPagination,
          globalFilterFn: 'includesString',
        }),
  });

  const rows = table.getRowModel().rows;
  const showSearch = !server && !!(props as ClientProps<T>).searchable;
  const total = server ? props.totalCount : table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();
  const colSpan = table.getVisibleLeafColumns().length;
  const emptyTitle = globalFilter ? 'No matches' : props.emptyTitle ?? 'Nothing here yet';
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide() && typeof c.columnDef.header === 'string' && (c.columnDef.meta as ColMeta)?.hideable !== false);
  const sticky = props.stickyHeader ?? true;

  const states = props.isLoading ? 'loading' : props.error ? 'error' : rows.length === 0 ? 'empty' : 'rows';
  const hasToolbar = showSearch || !!props.toolbar || !!props.csv || (props.columnToggle && hideable.length > 1);
  const showPager = total > 0 && (pageCount > 1 || server);

  return (
    <div className="sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
      {hasToolbar && (
        <div className="no-print mb-2 flex flex-wrap items-center gap-2 sm:mb-0 sm:border-b sm:bg-panel-header sm:px-2 sm:py-1.5">
          {showSearch && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => { setGlobalFilter(e.target.value); table.setPageIndex(0); }}
                placeholder={(props as ClientProps<T>).searchPlaceholder ?? 'Search…'}
                className="pl-8"
                aria-label="Search"
              />
            </div>
          )}
          {props.toolbar}
          <div className="ml-auto flex items-center gap-1.5">
            {props.columnToggle && hideable.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:inline-flex"><Columns3 />Columns</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  {hideable.map((c) => (
                    <DropdownMenuItem key={c.id} onSelect={(e) => { e.preventDefault(); c.toggleVisibility(); }} role="menuitemcheckbox" aria-checked={c.getIsVisible()}>
                      <Check className={cn(!c.getIsVisible() && 'opacity-0')} />
                      {c.columnDef.header as string}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {props.csv && (
              <Button
                variant="outline"
                size="sm"
                disabled={!props.data?.length}
                onClick={() => {
                  const exportRows = server ? props.data ?? [] : table.getSortedRowModel().rows.map((r) => r.original);
                  downloadCsv(props.csv!.fileName, exportRows, props.csv!.columns);
                }}
              >
                <Download />CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {props.mobileCard && (
        <div className="space-y-1.5 sm:hidden">
          {states === 'loading' && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          {states === 'error' && <ErrorState error={props.error} onRetry={props.onRetry} />}
          {states === 'empty' && <EmptyState title={emptyTitle} message={props.emptyMessage} action={props.emptyAction} />}
          {states === 'rows' && rows.map((row) => (
            <div
              key={row.id}
              role={props.onRowClick ? 'button' : undefined}
              tabIndex={props.onRowClick ? 0 : undefined}
              onClick={props.onRowClick ? () => props.onRowClick!(row.original) : undefined}
              onKeyDown={props.onRowClick ? (e) => { if (e.key === 'Enter') props.onRowClick!(row.original); } : undefined}
              className={cn('rounded-md border bg-card px-3 py-2.5', props.onRowClick && 'cursor-pointer active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', props.rowClassName?.(row.original))}
            >
              {props.mobileCard!(row.original)}
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          'data-grid relative w-full overflow-auto rounded-lg border bg-card sm:rounded-none sm:border-0',
          sticky && 'sm:max-h-[calc(100vh-14rem)] sm:min-h-[12rem]',
          props.mobileCard && 'hidden sm:block',
        )}
      >
        <Table className="[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-panel-header [&_thead_th]:shadow-[inset_0_-1px_0_hsl(var(--border))]">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta as ColMeta;
                  const right = meta?.numeric || meta?.align === 'right';
                  return (
                    <TableHead
                      key={header.id}
                      className={alignClass(meta)}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn('no-touch-min inline-flex items-center gap-1 rounded-sm uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', right && 'flex-row-reverse')}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {states === 'loading' ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {table.getVisibleLeafColumns().map((c) => <TableCell key={c.id}><Skeleton className="h-3.5 w-full max-w-[9rem]" /></TableCell>)}
                </TableRow>
              ))
            ) : states === 'error' ? (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={colSpan}><ErrorState error={props.error} onRetry={props.onRetry} /></TableCell></TableRow>
            ) : states === 'empty' ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan}><EmptyState title={emptyTitle} message={globalFilter ? 'Try a different search.' : props.emptyMessage} action={globalFilter ? undefined : props.emptyAction} /></TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isOpen = expandable && expanded.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      onClick={props.onRowClick ? () => props.onRowClick!(row.original) : expandable ? () => toggle(row.id) : undefined}
                      onKeyDown={
                        props.onRowClick
                          ? (e) => { if (e.key === 'Enter') props.onRowClick!(row.original); }
                          : expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(row.id); } } : undefined
                      }
                      tabIndex={props.onRowClick || expandable ? 0 : undefined}
                      aria-expanded={expandable ? isOpen : undefined}
                      className={cn(
                        (props.onRowClick || expandable) && 'cursor-pointer focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        isOpen && 'border-b-0 bg-accent/40',
                        props.rowClassName?.(row.original),
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={alignClass(cell.column.columnDef.meta as ColMeta)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-accent/40 hover:bg-accent/40">
                        <TableCell colSpan={colSpan} className="pt-0">{props.renderExpanded!(row.original)}</TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
          {props.footer}
        </Table>
      </div>

      {showPager && (
        <div className="no-print mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground sm:mt-0 sm:border-t sm:bg-panel-header sm:px-3 sm:py-1.5">
          <span className="tabular">
            {(pageIndex * pageSize + 1).toLocaleString('en-KE')}–{Math.min((pageIndex + 1) * pageSize, total).toLocaleString('en-KE')} of {total.toLocaleString('en-KE')}
          </span>
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1.5">
              <span className="hidden sm:inline">Rows</span>
              <NativeSelect
                value={pageSize}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  if (server) props.onPageSizeChange?.(size);
                  else table.setPageSize(size);
                }}
                className="h-7 w-[4.75rem] text-xs tabular"
                aria-label="Rows per page"
                disabled={server && !props.onPageSizeChange}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </NativeSelect>
            </label>
            <Button variant="outline" size="icon-sm" disabled={pageIndex === 0} onClick={() => (server ? props.onPageChange(props.page - 1) : table.previousPage())} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="min-w-[3.5rem] text-center tabular">{pageIndex + 1} / {pageCount}</span>
            <Button variant="outline" size="icon-sm" disabled={pageIndex + 1 >= pageCount} onClick={() => (server ? props.onPageChange(props.page + 1) : table.nextPage())} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
