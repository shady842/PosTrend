"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type CoaNode = {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId?: string | null;
  branchId?: string | null;
};

type Props = {
  accounts: CoaNode[];
  selectedId?: string;
  onSelect?: (id: string) => void;
};

type Tree = CoaNode & { children: Tree[] };

function buildTree(accounts: CoaNode[]): Tree[] {
  const map = new Map<string, Tree>();
  for (const a of accounts) map.set(a.id, { ...a, children: [] });
  const roots: Tree[] = [];
  for (const a of accounts) {
    const node = map.get(a.id)!;
    if (a.parentId && map.has(a.parentId)) map.get(a.parentId)!.children.push(node);
    else roots.push(node);
  }
  const sort = (n: Tree) => {
    n.children.sort((x, y) => (x.code || "").localeCompare(y.code || ""));
    n.children.forEach(sort);
  };
  roots.sort((x, y) => (x.code || "").localeCompare(y.code || ""));
  roots.forEach(sort);
  return roots;
}

function Row({
  node,
  level,
  open,
  onToggle,
  selected,
  onSelect
}: {
  node: Tree;
  level: number;
  open: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasKids = node.children.length > 0;
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800/60",
        selected && "bg-indigo-600 text-white hover:bg-indigo-600"
      )}
      style={{ paddingLeft: 8 + level * 14 }}
      onClick={onSelect}
    >
      <span className="shrink-0 text-slate-400">
        {hasKids ? (
          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }}
            className={cn("inline-flex rounded p-0.5", selected ? "text-white/90" : "hover:bg-black/5 dark:hover:bg-white/10")}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
      </span>
      <span className="font-mono text-[11px] tabular-nums opacity-90">{node.code}</span>
      <span className="truncate">{node.name}</span>
      <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", selected ? "bg-white/20" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>
        {node.type}
      </span>
    </button>
  );
}

export function AccountTreeView({ accounts, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => `${a.code} ${a.name} ${a.type}`.toLowerCase().includes(q));
  }, [accounts, query]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  const render = (node: Tree, level: number) => {
    const isOpen = open[node.id] ?? true;
    return (
      <div key={node.id} className="space-y-1">
        <Row
          node={node}
          level={level}
          open={isOpen}
          onToggle={() => setOpen((p) => ({ ...p, [node.id]: !isOpen }))}
          selected={selectedId === node.id}
          onSelect={() => onSelect?.(node.id)}
        />
        {node.children.length > 0 && isOpen ? (
          <div className="space-y-1">{node.children.map((c) => render(c, level + 1))}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="card p-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input className="w-full pl-9" placeholder="Search accounts..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto pr-1">{tree.map((n) => render(n, 0))}</div>
    </div>
  );
}

