import React, { useState, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender
} from '@tanstack/react-table';

/**
 * Универсальная premium-таблица на базе @tanstack/react-table
 * - Никакого своего UI: только headless-логика + ваши классы (.table-premium, .table-shell и т.п.)
 * - Единый контроль сортировки и рендеринга заголовков/ячеек
 */
function PremiumTable({
  columns,
  data,
  initialSorting = [],
  onSortingChange,
  getRowId,
  colWidths,
  className = '',
  emptyState = null,
  highlightRowId,
  highlightTick
}) {
  const [internalSorting, setInternalSorting] = useState(initialSorting);

  const sorting = onSortingChange ? undefined : internalSorting;

  const table = useReactTable({
    data: data || [],
    columns,
    state: onSortingChange
      ? undefined
      : {
          sorting: internalSorting
        },
    onSortingChange: updater => {
      if (onSortingChange) {
        onSortingChange(updater);
      } else {
        const next =
          typeof updater === 'function' ? updater(internalSorting) : updater;
        setInternalSorting(next);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId
  });

  const headerGroups = table.getHeaderGroups();
  const rowModel = table.getRowModel();

  const highlightedRowRef = useRef(null);

  useEffect(() => {
    if (highlightRowId == null || !highlightedRowRef.current) return;
    try {
      highlightedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    } catch {
      // fail silently
    }
  }, [highlightTick, highlightRowId]);

  if (!data || data.length === 0) {
    return emptyState || null;
  }

  // Получаем видимые колонки из первой строки заголовков
  const visibleHeaders = headerGroups[0]?.headers?.filter(header => !header.isPlaceholder) || [];
  
  // Создаем colgroup на основе видимых колонок, а не просто по индексу colWidths
  const getColWidths = () => {
    if (!Array.isArray(colWidths) || colWidths.length === 0) {
      return null;
    }
    
    return (
      <colgroup>
        {visibleHeaders.map((header, idx) => {
          // Используем ширину из colWidths по индексу видимой колонки
          const width = colWidths[idx] || 'auto';
          return <col key={header.id} style={{ width }} />;
        })}
      </colgroup>
    );
  };

  return (
    <div className="table-shell">
      <table className={`table-premium ${className}`.trim()}>
        {getColWidths()}
        <thead>
          {headerGroups.map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const column = header.column;
                const canSort = column.getCanSort();
                const sortDirection = column.getIsSorted(); // 'asc' | 'desc' | false

                let sortSuffix = '';
                if (sortDirection === 'asc') sortSuffix = ' ▲';
                if (sortDirection === 'desc') sortSuffix = ' ▼';

                const headerProps = {
                  className: canSort ? 'sortable' : undefined,
                  onClick: canSort
                    ? column.getToggleSortingHandler()
                    : undefined
                };

                return (
                  <th key={header.id} {...headerProps}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {sortSuffix}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rowModel.rows.map(row => {
            const isHighlighted =
              highlightRowId != null &&
              String(row.id) === String(highlightRowId);
            return (
              <tr
                key={row.id}
                className={`table-row${
                  isHighlighted ? ' table-row-highlighted' : ''
                }`}
                ref={isHighlighted ? highlightedRowRef : null}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PremiumTable;

