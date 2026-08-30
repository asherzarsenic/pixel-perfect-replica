import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileSearch,
  Scissors,
  ShieldCheck,
  Settings2,
  Sliders,
  Info,
  Menu,
  X,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./Logo";
import {
  readHistory,
  deleteHistory,
  TOOL_LABEL,
  TOOL_PATH,
  formatDate,
  type HistoryEntry,
} from "@/lib/history";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const WORKSPACE = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/brief-buster", label: "Brief Buster", icon: FileSearch },
  { to: "/chop-shop", label: "Chop Shop", icon: Scissors },
  { to: "/export-inspector", label: "Export Inspector", icon: ShieldCheck },
] as const;

const SETTINGS = [
  { to: "/settings/preferences", label: "Preferences", icon: Settings2 },
  { to: "/settings/export-defaults", label: "Export Defaults", icon: Sliders },
  { to: "/settings/about", label: "About", icon: Info },
] as const;

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/brief-buster": "Brief Buster",
  "/chop-shop": "Chop Shop",
  "/export-inspector": "Export Inspector",
  "/settings/preferences": "Preferences",
  "/settings/export-defaults": "Export Defaults",
  "/settings/about": "About",
};

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-primary/12 text-foreground ring-1 ring-inset ring-primary/30"
          : "text-muted-foreground hover:bg-elevated hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4", active && "text-primary")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const sync = () => setHistory(readHistory().slice(0, 5));
    sync();
    window.addEventListener("bb:history", sync);
    return () => window.removeEventListener("bb:history", sync);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <Link to="/" onClick={onNavigate}>
          <Wordmark />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <div className="label-caps px-2.5 pb-1">Workspace</div>
          {WORKSPACE.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              active={pathname === item.to}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="space-y-1">
          <div className="label-caps px-2.5 pb-1">Recent</div>
          {history.length === 0 ? (
            <p className="px-2.5 text-xs text-subtle">No recent projects yet.</p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="group flex items-center gap-1">
                <Link
                  to={TOOL_PATH[entry.tool]}
                  onClick={onNavigate}
                  className="min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground"
                >
                  <div className="truncate">{entry.name}</div>
                  <div className="truncate text-[10px] text-subtle">
                    {TOOL_LABEL[entry.tool]} · {formatDate(entry.date)}
                  </div>
                </Link>
                <button
                  type="button"
                  aria-label={`Delete ${entry.name}`}
                  onClick={() => deleteHistory(entry.id)}
                  className="rounded p-1.5 text-subtle opacity-0 transition-opacity hover:text-fail group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-1">
          <div className="label-caps px-2.5 pb-1">Settings</div>
          {SETTINGS.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              active={pathname === item.to}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-border px-4 py-3 text-[11px] text-subtle">
        Files are processed in your browser.
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmd((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = TITLES[pathname] ?? "Workspace";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[236px] shrink-0 border-r border-border bg-sidebar md:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent pathname={pathname} onNavigate={() => undefined} />
        </div>
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/80"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-[300px] border-r border-border bg-sidebar">
            <button
              aria-label="Close navigation"
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 rounded-md p-2 text-muted-foreground hover:bg-elevated"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <button
            aria-label="Open navigation"
            className="rounded-md p-2 text-muted-foreground hover:bg-elevated md:hidden"
            onClick={() => setDrawer(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-display truncate text-sm font-medium">{title}</div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setCmd(true)}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search tools, projects, files...</span>
              <kbd className="hidden rounded border border-border bg-elevated px-1 py-0.5 text-[10px] sm:inline">
                ⌘/
              </kbd>
            </button>
            <Link
              to="/settings/preferences"
              aria-label="Preferences"
              className="rounded-md p-2 text-muted-foreground hover:bg-elevated hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>

      <CommandDialog open={cmd} onOpenChange={setCmd}>
        <CommandInput placeholder="Search tools, projects, files..." />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Workspace">
            {[...WORKSPACE, ...SETTINGS].map((item) => (
              <CommandItem
                key={item.to}
                value={item.label}
                onSelect={() => {
                  setCmd(false);
                  void navigate({ to: item.to });
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Recent">
            {readHistory()
              .slice(0, 6)
              .map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={`${entry.name} ${TOOL_LABEL[entry.tool]}`}
                  onSelect={() => {
                    setCmd(false);
                    void navigate({ to: TOOL_PATH[entry.tool] });
                  }}
                >
                  {entry.name}
                  <span className="ml-2 text-xs text-subtle">{TOOL_LABEL[entry.tool]}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
