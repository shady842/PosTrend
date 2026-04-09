"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { io, type Socket } from "socket.io-client";
import { Clock, Radio, RefreshCw } from "lucide-react";
import { getAccessToken } from "@/lib/auth";
import { apiGet, apiPost } from "@/lib/api";
import { wsOrigin } from "@/lib/ws-origin";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

type MonitorColumn = "open" | "preparing" | "ready" | "paid" | "closed";

type LiveOrder = {
  id: string;
  order_number: string | null;
  order_type: string;
  status: string;
  total: number;
  opened_at: string | null;
  created_at: string;
  seconds_open: number;
  table_label: string;
  monitor_column: MonitorColumn;
  station_ids: string[];
  items: { id: string; name: string; qty: number; line_total: number; kitchen_status: string }[];
};

type BranchOpt = { id: string; name: string; conceptId?: string };
type StationOpt = { id: string; name: string };

const COLUMNS: {
  id: MonitorColumn;
  label: string;
  subtitle: string;
  accent: string;
  headerBg: string;
}[] = [
  {
    id: "open",
    label: "Open",
    subtitle: "New & in progress",
    accent: "text-emerald-400",
    headerBg: "bg-emerald-500/15 border-emerald-500/30"
  },
  {
    id: "preparing",
    label: "Preparing",
    subtitle: "Kitchen / bar",
    accent: "text-amber-400",
    headerBg: "bg-amber-500/15 border-amber-500/30"
  },
  {
    id: "ready",
    label: "Ready",
    subtitle: "Pick up / serve",
    accent: "text-sky-400",
    headerBg: "bg-sky-500/15 border-sky-500/30"
  },
  {
    id: "paid",
    label: "Paid",
    subtitle: "Settled — close",
    accent: "text-violet-400",
    headerBg: "bg-violet-500/15 border-violet-500/30"
  },
  {
    id: "closed",
    label: "Closed",
    subtitle: "Last 3h",
    accent: "text-zinc-400",
    headerBg: "bg-zinc-500/15 border-zinc-500/30"
  }
];

function formatDuration(totalSec: number) {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function money(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function useLiveSeconds(openedAt: string | null, createdAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const start = new Date(openedAt || createdAt).getTime();
  return Math.max(0, Math.floor((now - start) / 1000));
}

function columnDroppableId(c: MonitorColumn) {
  return `col-${c}`;
}

function parseColumnFromDroppable(id: string | number | undefined): MonitorColumn | null {
  if (typeof id !== "string" || !id.startsWith("col-")) return null;
  const c = id.slice(4) as MonitorColumn;
  if (COLUMNS.some((x) => x.id === c)) return c;
  return null;
}

function OrderCardBody({
  order,
  dragging,
  liveSec
}: {
  order: LiveOrder;
  dragging?: boolean;
  liveSec: number;
}) {
  const col = order.monitor_column;
  const badgeStyles: Record<MonitorColumn, string> = {
    open: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
    preparing: "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40",
    ready: "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40",
    paid: "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40",
    closed: "bg-zinc-600/40 text-zinc-300 ring-1 ring-zinc-500/40"
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: dragging ? 0.85 : 1, scale: dragging ? 1.02 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "rounded-xl border border-zinc-700/80 bg-zinc-900/90 p-3 shadow-lg shadow-black/20 backdrop-blur-sm",
        dragging && "ring-2 ring-amber-400/60"
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2">
        <div>
          <p className="font-mono text-lg font-bold tracking-tight text-white">{order.table_label}</p>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            {order.order_number || order.id.slice(0, 8)} · {order.order_type.replace("_", " ")}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", badgeStyles[col])}>
          {col}
        </span>
      </div>
      <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-sm text-zinc-300">
        {order.items.length === 0 ? (
          <li className="text-zinc-500">No line items</li>
        ) : (
          order.items.map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span>
                <span className="font-medium text-zinc-100">{it.qty}×</span> {it.name}
              </span>
              <span className="shrink-0 text-zinc-500">{money(it.line_total)}</span>
            </li>
          ))
        )}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs text-zinc-400">
        <span className="flex items-center gap-1 font-mono tabular-nums">
          <Clock className="h-3.5 w-3.5 text-amber-500/90" />
          {formatDuration(liveSec)}
        </span>
        <span className="font-semibold text-amber-200">{money(order.total)}</span>
      </div>
    </motion.div>
  );
}

function DraggableOrderCard({ order }: { order: LiveOrder }) {
  const locked = order.monitor_column === "closed";
  const liveSec = useLiveSeconds(order.opened_at, order.created_at);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    disabled: locked,
    data: { order }
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className={cn(locked && "cursor-default", !locked && "cursor-grab active:cursor-grabbing")}>
      <div {...(locked ? {} : listeners)} {...(locked ? {} : attributes)}>
        <OrderCardBody order={order} dragging={isDragging} liveSec={liveSec} />
      </div>
    </div>
  );
}

function DragOverlayInner({ order }: { order: LiveOrder }) {
  const liveSec = useLiveSeconds(order.opened_at, order.created_at);
  return <OrderCardBody order={order} dragging liveSec={liveSec} />;
}

function KanbanColumn({
  col,
  orders,
  count
}: {
  col: (typeof COLUMNS)[number];
  orders: LiveOrder[];
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(col.id) });
  return (
    <div className="flex min-w-[260px] max-w-[300px] flex-1 flex-col">
      <div
        className={cn(
          "mb-3 rounded-xl border px-3 py-2",
          col.headerBg,
          isOver && "ring-2 ring-amber-400/70 ring-offset-2 ring-offset-zinc-950"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className={cn("text-sm font-bold uppercase tracking-wide", col.accent)}>{col.label}</h2>
          <span className="rounded-md bg-black/30 px-2 py-0.5 font-mono text-xs text-zinc-200">{count}</span>
        </div>
        <p className="text-[10px] text-zinc-500">{col.subtitle}</p>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[520px] flex-1 space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-2 transition-colors",
          isOver && "border-amber-500/50 bg-zinc-900/40"
        )}
      >
        <AnimatePresence mode="popLayout">
          {orders.map((o) => (
            <DraggableOrderCard key={o.id} order={o} />
          ))}
        </AnimatePresence>
        {orders.length === 0 && (
          <p className="py-12 text-center text-xs text-zinc-600">Drop orders here</p>
        )}
      </div>
    </div>
  );
}

export default function LivePosPage() {
  const { notify } = useToast();
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [branchId, setBranchId] = useState("");
  const [stationId, setStationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDrag, setActiveDrag] = useState<LiveOrder | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadBranches = useCallback(async () => {
    try {
      const rows = (await apiGet("/branches")) as BranchOpt[];
      setBranches(Array.isArray(rows) ? rows : []);
    } catch {
      setBranches([]);
    }
  }, []);

  const loadStations = useCallback(
    async (bid: string) => {
      if (!bid) {
        setStations([]);
        return;
      }
      try {
        const rows = (await apiGet(`/kds/stations?branch_id=${encodeURIComponent(bid)}`)) as StationOpt[];
        setStations(Array.isArray(rows) ? rows : []);
      } catch {
        setStations([]);
      }
    },
    []
  );

  const loadOrders = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      let path = `/pos/orders/live?branch_id=${encodeURIComponent(branchId)}`;
      if (stationId) path += `&station_id=${encodeURIComponent(stationId)}`;
      const data = (await apiGet(path)) as LiveOrder[];
      setOrders(Array.isArray(data) ? data : []);
      setLastRefresh(new Date());
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [branchId, stationId, notify]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    const c = localStorage.getItem("pt_concept_id") || "";
    const b = localStorage.getItem("pt_branch_id") || "";
    if (b) setBranchId(b);
    else if (branches.length) {
      const filtered = c ? branches.filter((x) => (x as { conceptId?: string }).conceptId === c) : branches;
      const pick = filtered[0] || branches[0];
      if (pick) {
        setBranchId(pick.id);
        localStorage.setItem("pt_branch_id", pick.id);
      }
    }
  }, [branches]);

  useEffect(() => {
    if (branchId) void loadStations(branchId);
  }, [branchId, loadStations]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const t = setInterval(() => void loadOrders(), 30_000);
    return () => clearInterval(t);
  }, [loadOrders]);

  useEffect(() => {
    if (!branchId) return;
    const token = getAccessToken();
    if (!token) return;
    const url = wsOrigin();
    const branchChannels = (b: string) => [
      `orders.branch.${b}`,
      `kds.branch.${b}`,
      `pos.branch.${b}`
    ];
    const socket: Socket = io(url, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 8,
      reconnectionDelay: 1200,
      auth: { token }
    });
    const subscribe = () => {
      socket.emit("realtime.subscribe", { channels: branchChannels(branchId) });
    };
    const onConnect = () => {
      setWsConnected(true);
      subscribe();
    };
    const onRefresh = () => void loadOrders();
    const realtimeEvents = [
      "order.created",
      "order.updated",
      "order.closed",
      "payment.added",
      "kds.updated",
      "order.sent",
      "item.preparing",
      "item.ready"
    ] as const;
    socket.on("connect", onConnect);
    socket.io.on("reconnect", subscribe);
    socket.on("disconnect", () => setWsConnected(false));
    for (const ev of realtimeEvents) {
      socket.on(ev, onRefresh);
    }
    return () => {
      socket.off("connect", onConnect);
      socket.io.off("reconnect", subscribe);
      for (const ev of realtimeEvents) {
        socket.off(ev, onRefresh);
      }
      socket.close();
    };
  }, [branchId, loadOrders]);

  const byColumn = useMemo(() => {
    const m: Record<MonitorColumn, LiveOrder[]> = {
      open: [],
      preparing: [],
      ready: [],
      paid: [],
      closed: []
    };
    for (const o of orders) {
      const col = o.monitor_column;
      if (m[col]) m[col].push(o);
    }
    return m;
  }, [orders]);

  const onDragStart = (e: DragStartEvent) => {
    const o = e.active.data.current?.order as LiveOrder | undefined;
    setActiveDrag(o || null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    const targetCol = parseColumnFromDroppable(e.over?.id);
    const order = e.active.data.current?.order as LiveOrder | undefined;
    if (!targetCol || !order) return;
    if (order.monitor_column === targetCol) return;
    try {
      await apiPost("/pos/orders/monitor-move", { order_id: order.id, column: targetCol });
      notify(`Moved to ${targetCol}`);
      await loadOrders();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Move failed");
    }
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] rounded-2xl bg-zinc-950 p-4 text-zinc-100 md:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Live POS</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                wsConnected ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"
              )}
            >
              <Radio className={cn("h-3.5 w-3.5", wsConnected && "animate-pulse text-emerald-400")} />
              {wsConnected ? "Live" : "WS…"}
            </span>
            {loading && <span className="text-xs text-zinc-500">Updating…</span>}
          </div>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Kitchen-style board: drag tickets across stages. Paid requires a settled check. Closed runs the normal close flow.
          </p>
          {lastRefresh && (
            <p className="mt-1 text-[11px] text-zinc-600">Last sync {lastRefresh.toLocaleTimeString()}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Branch</label>
            <select
              className="min-w-[180px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={branchId}
              onChange={(e) => {
                const v = e.target.value;
                setBranchId(v);
                localStorage.setItem("pt_branch_id", v);
                setStationId("");
              }}
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Station</label>
            <select
              className="min-w-[180px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
            >
              <option value="">All stations</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={(e) => void onDragEnd(e)}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <KanbanColumn key={col.id} col={col} orders={byColumn[col.id]} count={byColumn[col.id].length} />
          ))}
        </div>
        <DragOverlay>
          {activeDrag ? (
            <div className="w-[280px] opacity-95">
              <DragOverlayInner order={activeDrag} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
