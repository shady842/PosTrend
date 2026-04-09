"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ToastItem = { id: string; message: string };
type ToastCtx = { notify: (message: string) => void };

const Ctx = createContext<ToastCtx>({ notify: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const value = useMemo(
    () => ({
      notify: (message: string) => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600);
      }
    }),
    []
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
