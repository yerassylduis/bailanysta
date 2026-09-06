"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/format";

type Toast = { id: number; text: string; kind: "info" | "error" | "success" };
const Ctx = createContext<{ toast: (text: string, kind?: Toast["kind"]) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++seq.current;
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={cn("card fade-in pointer-events-auto px-4 py-2.5 text-sm font-medium shadow-card",
            t.kind === "error" && "border-rose/40 text-rose", t.kind === "success" && "border-accent/40 text-accent")}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast вне ToastProvider");
  return ctx.toast;
}

/** Хук: показать ошибку из промиса-мутации. */
export function useErrorToast() {
  const toast = useToast();
  const ref = useRef(toast);
  useEffect(() => { ref.current = toast; }, [toast]);
  return useCallback((e: unknown) => ref.current(e instanceof Error ? e.message : "Что-то пошло не так", "error"), []);
}
