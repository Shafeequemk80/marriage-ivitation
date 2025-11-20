"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface Entry {
  _id: string;
  name: string;
  type: string;
  completed: boolean;
  count: number;
  createdAt?: string;
}

type SortBy = "createdAt" | "name" | "type" | "status";
type StatusFilter = "all" | "completed" | "pending";

export default function Home() {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [count, setCount] = useState(1);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editCount, setEditCount] = useState(1);


  const [isAdmin, setIsAdmin] = useState(false);

const types = process.env.NEXT_PUBLIC_TYPES.split(",");

  // --- Auth check (simple) ---


  // --- Fetch entries ---
  useEffect(() => {
    
    fetchEntries();
  }, [isAdmin]);

  const fetchEntries = async () => {
    const res = await fetch("/api/entries");
    const data = await res.json();
    setEntries(data);
  };

  // --- Helpers ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type || count <= 0) return;

    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type, count }),
    });

    const newEntry = await res.json();
    setEntries((prev) => [newEntry, ...prev]);
    setName("");
    setCount(1);
  };

  const toggleCompleted = async (entry: Entry) => {
    const res = await fetch("/api/entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entry._id,
        completed: !entry.completed,
      }),
    });
    const updated = await res.json();
    setEntries((prev) => prev.map((e) => (e._id === entry._id ? updated : e)));
  };

  const startEdit = (entry: Entry) => {
    setEditingId(entry._id);
    setEditName(entry.name);
    setEditType(entry.type);
    setEditCount(entry.count);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditType("");
    setEditCount(1);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim() || !editType || editCount <= 0) return;

    const res = await fetch("/api/entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: editName.trim(),
        type: editType,
        count: editCount,
      }),
    });
    const updated = await res.json();
    setEntries((prev) => prev.map((e) => (e._id === id ? updated : e)));
    cancelEdit();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;

    await fetch("/api/entries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    setEntries((prev) => prev.filter((e) => e._id !== id));
  };

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  // --- Filters ---
  const filtered = entries.filter((entry) => {
    const matchesSearch =
      entry.name.toLowerCase().includes(search.toLowerCase()) ||
      entry.type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && entry.completed) ||
      (statusFilter === "pending" && !entry.completed);

    return matchesSearch && matchesStatus;
  });

  // --- Sorting ---
  const sorted = [...filtered].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (sortBy === "name") {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (sortBy === "type") {
      aVal = a.type.toLowerCase();
      bVal = b.type.toLowerCase();
    } else if (sortBy === "status") {
      aVal = a.completed ? 1 : 0;
      bVal = b.completed ? 1 : 0;
    } else {
      aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    }

    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, sortDir, statusFilter]);

  // --- Export ---
  const exportExcel = () => {
    if (sorted.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(
      sorted.map((entry, i) => ({
        No: i + 1,
        Name: entry.name,
        Type: entry.type,
        Count: entry.count,
        Completed: entry.completed ? "Yes" : "No",
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, "task-list.xlsx");
  };

  const exportPDF = () => {
    if (sorted.length === 0) return;

    const doc = new jsPDF();
    doc.text("Task List", 14, 10);
    (doc as any).autoTable({
      head: [["#", "Name", "Type", "Count", "Completed"]],
      body: sorted.map((e, i) => [
        i + 1,
        e.name,
        e.type,
        e.count,
        e.completed ? "Yes" : "No",
      ]),
      startY: 20,
    });
    doc.save("task-list.pdf");
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // --- UI helpers ---
  const getTypeBadgeClasses = (type: string) => {
    switch (type) {
      case "IMIC":
        return "bg-emerald-100 text-emerald-800";
      case "SA-ADIYA":
        return "bg-sky-100 text-sky-800";
      case "MADRASSA":
        return "bg-amber-100 text-amber-800";
      case "SSF":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const totalCount = sorted.reduce((sum, e) => sum + (e.count || 0), 0);





  // --- MAIN UI ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-10 px-4 print:bg-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header + Search + Export */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 print:text-black">
              Marriage ivitation
            </h1>
            <p className="text-sm text-slate-500 print:text-black/70">
              Add, edit, filter, sort, and export your entries.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            {/* Search full width on mobile */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or type..."
              className="w-full md:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white print:border-black"
            />

            {/* Export + Print in one row */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={exportExcel}
                className="rounded-lg border border-emerald-500 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 print:hidden"
              >
                Export Excel
              </button>
              <button
                onClick={exportPDF}
                className="rounded-lg border border-indigo-500 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 print:hidden"
              >
                Export PDF
              </button>
              <button
                onClick={handlePrint}
                className="rounded-lg border border-slate-400 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 print:hidden"
              >
                Print
              </button>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow p-5 print:shadow-none print:border print:border-slate-300">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 md:flex-row md:items-end"
          >
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Name
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name"
                required
              />
            </div>

            <div className="md:w-48">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Type
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
              >
                <option value="">Select type</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:w-28">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Count
              </label>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>

            <button
              type="submit"
              className="mt-2 md:mt-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add
            </button>
          </form>
        </div>

        {/* Filters + Sort + Pagination */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-500">Status:</span>
            {(["all", "completed", "pending"] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-3 py-1 ${
                  statusFilter === status
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {status === "all"
                  ? "All"
                  : status === "completed"
                  ? "Completed"
                  : "Pending"}
              </button>
            ))}
          </div>

          {/* Sort + Pagination */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-slate-500">Sort by:</span>
              {(["createdAt", "name", "type", "status"] as SortBy[]).map(
                (field) => (
                  <button
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`rounded-full border px-3 py-1 ${
                      sortBy === field
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {field === "createdAt" ? "Created" : field.toUpperCase()}{" "}
                    {sortBy === field
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : ""}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded border px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Total count */}
        <div className="text-right font-semibold text-slate-900 print:text-black">
          Total Count: {totalCount}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow print:shadow-none print:border print:border-slate-300">
          <div className="max-h-[480px] overflow-auto print:max-h-none print:overflow-visible">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-slate-100 text-xs uppercase tracking-wide sticky top-0 z-10 print:static">
                <tr>
                  <th className="px-3 py-2 text-left">Done</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Count</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right print:text-left">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-slate-400"
                    >
                      No entries found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((entry) => {
                    const isEditing = editingId === entry._id;
                    return (
                      <tr
                        key={entry._id}
                        className={`border-t border-slate-100 transition-colors hover:bg-slate-50 ${
                          entry.completed ? "bg-emerald-50/60" : ""
                        }`}
                      >
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="checkbox"
                            checked={entry.completed}
                            onChange={() => toggleCompleted(entry)}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {isEditing ? (
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          ) : (
                            <span
                              className={
                                entry.completed
                                  ? "line-through text-slate-400"
                                  : "text-slate-800"
                              }
                            >
                              {entry.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {isEditing ? (
                            <select
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                              value={editType}
                              onChange={(e) => setEditType(e.target.value)}
                            >
                              {types.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${getTypeBadgeClasses(
                                entry.type
                              )}`}
                            >
                              {entry.type}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {isEditing ? (
                            <input
                              type="number"
                              min={1}
                              className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                              value={editCount}
                              onChange={(e) =>
                                setEditCount(Number(e.target.value))
                              }
                            />
                          ) : (
                            <span className="text-slate-800">
                              {entry.count}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {entry.completed ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                              Completed
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle text-right print:hidden">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => saveEdit(entry._id)}
                                className="rounded border border-emerald-500 px-2 py-1 text-[11px] text-emerald-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEdit(entry)}
                                className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(entry._id)}
                                className="rounded border border-red-500 px-2 py-1 text-[11px] text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
