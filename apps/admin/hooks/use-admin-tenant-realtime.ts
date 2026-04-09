"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { decodeJwtPayload, getAccessToken } from "@/lib/auth";
import { wsOrigin } from "@/lib/ws-origin";

/** Events emitted to `admin.tenant.{tenantId}` that should refresh the ops dashboard. */
const TENANT_DASHBOARD_EVENTS = [
  "order.created",
  "order.updated",
  "order.closed",
  "payment.added",
  "order.sent",
  "item.preparing",
  "item.ready",
  "kds.updated",
  "sync.delta.available"
] as const;

/**
 * Subscribes to `admin.tenant.{tenantId}` with the current access token (SYNC-4).
 * Debounces callbacks so bursts of events trigger one refresh.
 */
export function useAdminTenantRealtime(onActivity: () => void, debounceMs = 450) {
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onActivityRef.current();
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    const token = getAccessToken();
    const payload = token ? decodeJwtPayload<{ tenant_id?: string }>(token) : null;
    const tenantId = payload?.tenant_id != null ? String(payload.tenant_id) : "";
    if (!token || !tenantId) {
      return;
    }

    const url = wsOrigin();
    const channel = `admin.tenant.${tenantId}`;
    const socket: Socket = io(url, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 12,
      reconnectionDelay: 1200
    });

    const subscribe = () => {
      socket.emit("realtime.subscribe", { channels: [channel] });
    };

    const onConnect = () => {
      setConnected(true);
      subscribe();
    };

    socket.on("connect", onConnect);
    socket.io.on("reconnect", subscribe);
    socket.on("disconnect", () => setConnected(false));
    for (const ev of TENANT_DASHBOARD_EVENTS) {
      socket.on(ev, scheduleRefresh);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      socket.off("connect", onConnect);
      socket.io.off("reconnect", subscribe);
      for (const ev of TENANT_DASHBOARD_EVENTS) {
        socket.off(ev, scheduleRefresh);
      }
      socket.close();
    };
  }, [scheduleRefresh]);

  return { connected };
}
