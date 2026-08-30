export type HistoryTool = "brief" | "chop" | "inspect";

export type HistoryEntry = {
  id: string;
  name: string;
  tool: HistoryTool;
  date: string;
  files: number;
  status: string;
};

const KEY = "bb.history.v1";

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 30)));
  window.dispatchEvent(new Event("bb:history"));
}

export function addHistory(entry: Omit<HistoryEntry, "id" | "date">): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  write([full, ...readHistory()]);
  return full;
}

export function deleteHistory(id: string) {
  write(readHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  write([]);
}

export const TOOL_LABEL: Record<HistoryTool, string> = {
  brief: "Brief Buster",
  chop: "Chop Shop",
  inspect: "Export Inspector",
};

export const TOOL_PATH: Record<HistoryTool, string> = {
  brief: "/brief-buster",
  chop: "/chop-shop",
  inspect: "/export-inspector",
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
