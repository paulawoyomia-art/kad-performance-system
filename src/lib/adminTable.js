import { useState, useMemo } from "react";

/**
 * Client-side CSV export for admin tables. Columns are [{key, label}] — key
 * can be a dotted path (e.g. "kad.name") for nested fields. Always quotes
 * values and escapes embedded quotes/commas/newlines per RFC 4180.
 */
export function exportCsv(filename, rows, columns) {
  const get = (row, key) => key.split(".").reduce((v, k) => (v == null ? v : v[k]), row);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = columns.map((c) => esc(c.label));
  const lines = [head.join(","), ...rows.map((r) => columns.map((c) => esc(get(r, c.key))).join(","))];
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Sortable-table state: click a column to sort ascending, click again for
 * descending, click a different column to switch. Handles numbers, strings,
 * and nulls (nulls always sort last regardless of direction).
 */
export function useSort(rows, initialKey = null, initialDir = "asc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  const sorted = useMemo(() => {
    if (!sortKey || !rows) return rows || [];
    const get = (row) => sortKey.split(".").reduce((v, k) => (v == null ? v : v[k]), row);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls last regardless of direction
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [rows, sortKey, sortDir]);

  function toggle(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  return { sorted, sortKey, sortDir, toggle };
}

/** A clickable <th> that shows the current sort direction. Use inside a useSort()'d table. */
export function SortTh({ label, sortKeyName, sortKey, sortDir, onSort, ...rest }) {
  const active = sortKey === sortKeyName;
  return (
    <th
      onClick={() => onSort(sortKeyName)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      {...rest}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.25, fontSize: 11 }}>
        {active ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );
}
