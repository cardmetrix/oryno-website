"use client";

import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  className?: string;
  /** Hide this column in the mobile card list (e.g. redundant fields). */
  hideOnMobile?: boolean;
  cell: (row: T) => React.ReactNode;
};

export function AdminTable<T extends { id?: string }>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  const mobileColumns = columns.filter((col) => !col.hideOnMobile);
  const primary = mobileColumns[0];
  const rest = mobileColumns.slice(1).filter((col) => col.header);
  const actions = mobileColumns.find((col) => !col.header);

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className="rounded-[16px] border border-border bg-muted/25 p-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {primary ? (
                  <div className="min-w-0 text-sm">{primary.cell(row)}</div>
                ) : null}
              </div>
              {actions ? (
                <div className="shrink-0 pt-0.5">{actions.cell(row)}</div>
              ) : null}
            </div>
            {rest.length > 0 ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/80 pt-3">
                {rest.map((col) => (
                  <div key={col.key} className="min-w-0">
                    <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {col.header}
                    </dt>
                    <dd className="mt-0.5 min-w-0 text-sm text-foreground [&>*]:max-w-full">
                      {col.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("pb-3 font-semibold", col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-muted/30">
                {columns.map((col) => (
                  <td key={col.key} className={cn("py-3.5", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
