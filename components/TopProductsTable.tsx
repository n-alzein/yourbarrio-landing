"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { TopProduct } from "@/lib/dashboardTypes";

type TopProductsTableProps = {
  products: TopProduct[];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const TopProductsTable = ({ products }: TopProductsTableProps) => {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "revenue", desc: true },
  ]);

  const columns = useMemo<ColumnDef<TopProduct>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Product",
        cell: (info) => (
          <div>
            <p className="font-semibold text-slate-900">{info.getValue<string>()}</p>
            <p className="text-xs text-slate-500">{info.row.original.category}</p>
          </div>
        ),
      },
      {
        accessorKey: "revenue",
        header: "Revenue",
        cell: (info) => (
          <span className="font-semibold text-slate-900">
            {formatCurrency(info.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "orders",
        header: "Orders",
        cell: (info) => info.getValue<number>().toLocaleString(),
      },
      {
        accessorKey: "inventoryQty",
        header: "Inventory",
        cell: (info) => {
          const value = info.getValue<number | null>();
          return value === null ? "—" : value.toLocaleString();
        },
      },
    ],
    []
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Merchandising
          </p>
          <h3 className="text-lg font-semibold text-slate-900">Top products</h3>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left"
                    scope="col"
                    aria-sort={
                      header.column.getIsSorted()
                        ? header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-700"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        <span className="text-[10px]">
                          {header.column.getIsSorted() === "desc"
                            ? "▼"
                            : header.column.getIsSorted() === "asc"
                            ? "▲"
                            : ""}
                        </span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                onClick={() => router.push("/business/dashboard/products")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") router.push("/business/dashboard/products");
                }}
                tabIndex={0}
                role="row"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-slate-600">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopProductsTable;
