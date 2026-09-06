"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGraph, useMe } from "@/hooks/use-data";
import type { GraphDto } from "@/lib/types";
import { Skeleton } from "./ui";

/**
 * «Шоқжұлдыз» — созвездие связей. Граф подписок рисуется как звёздное небо:
 * узлы — люди (размер = число постов, свечение = подписчики), линии — подписки.
 * Простая force-симуляция на requestAnimationFrame, без внешних библиотек.
 */
type Node = GraphDto["nodes"][number] & { x: number; y: number; vx: number; vy: number };

const W = 720, H = 460;
const HUES = [168, 34, 210, 350, 90, 265, 20, 140];

export function Constellation() {
  const graph = useGraph();
  const { data: me } = useMe();
  if (graph.isPending) return <Skeleton className="aspect-[720/460] w-full rounded-2xl!" />;
  if (graph.isError || !graph.data) return <p className="text-sm text-muted">Не удалось загрузить созвездие.</p>;
  return <Sky graph={graph.data} meId={me?.user?.id ?? null} />;
}

function Sky({ graph, meId }: { graph: GraphDto; meId: string | null }) {
  const [nodes, setNodes] = useState<Node[]>(() => graph.nodes.map((n, i) => {
    const a = (i / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
    return { ...n, x: W / 2 + Math.cos(a) * 150, y: H / 2 + Math.sin(a) * 120, vx: 0, vy: 0 };
  }));
  const [hover, setHover] = useState<string | null>(null);
  const frame = useRef(0);
  const linkSet = useMemo(() => new Set(graph.links.map((l) => `${l.source}>${l.target}`)), [graph.links]);

  useEffect(() => {
    let alive = true;
    let iter = 0;
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const ns = nodes.map((n) => ({ ...n }));
    const tick = () => {
      if (!alive || iter++ > 260) return;
      const k = 0.02;
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i];
        // притяжение к центру
        a.vx += (W / 2 - a.x) * 0.004; a.vy += (H / 2 - a.y) * 0.004;
        // отталкивание
        for (let j = 0; j < ns.length; j++) {
          if (i === j) continue;
          const b = ns[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const f = 5200 / d2;
          a.vx += (dx / Math.sqrt(d2)) * f * k; a.vy += (dy / Math.sqrt(d2)) * f * k;
        }
      }
      // пружины по связям
      for (const l of graph.links) {
        const a = ns[idx.get(l.source)!], b = ns[idx.get(l.target)!];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const f = (d - 130) * 0.004;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      for (const n of ns) {
        n.vx *= 0.82; n.vy *= 0.82;
        n.x = Math.min(W - 50, Math.max(50, n.x + n.vx)); n.y = Math.min(H - 50, Math.max(50, n.y + n.vy));
      }
      setNodes(ns.map((n) => ({ ...n })));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(frame.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const maxPosts = Math.max(1, ...nodes.map((n) => n.posts));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line" style={{ background: "radial-gradient(ellipse at 50% 40%, var(--elev), var(--bg) 75%)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Граф подписок">
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {graph.links.map((l) => {
          const a = byId.get(l.source), b = byId.get(l.target);
          if (!a || !b) return null;
          const mutual = linkSet.has(`${l.target}>${l.source}`);
          const active = hover === l.source || hover === l.target;
          return <line key={`${l.source}-${l.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={active ? "var(--saffron)" : mutual ? "var(--accent)" : "var(--line-strong)"} strokeWidth={active ? 1.8 : mutual ? 1.2 : 0.8} strokeOpacity={hover && !active ? 0.25 : 0.9} />;
        })}
        {nodes.map((n) => {
          const r = 6 + (n.posts / maxPosts) * 12;
          const h = HUES[n.hue % HUES.length];
          const dim = hover && hover !== n.id && !linkSet.has(`${hover}>${n.id}`) && !linkSet.has(`${n.id}>${hover}`);
          return (
            <g key={n.id} opacity={dim ? 0.35 : 1} style={{ transition: "opacity .2s" }} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
              <circle cx={n.x} cy={n.y} r={r + 6 + n.followers * 1.5} fill={`hsl(${h} 70% 60%)`} opacity="0.12" filter="url(#glow)" />
              <Link href={`/u/${n.handle}`}>
                <circle cx={n.x} cy={n.y} r={r} fill={`hsl(${h} 65% 55%)`} stroke={n.id === meId ? "var(--saffron)" : "var(--elev)"} strokeWidth={n.id === meId ? 3 : 1.5} className="cursor-pointer" />
              </Link>
              <text x={n.x} y={n.y + r + 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink-2)" style={{ pointerEvents: "none" }}>@{n.handle}</text>
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-accent" /> взаимная подписка</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-line-strong" /> в одну сторону</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-saffron" /> это вы</span>
      </div>
    </div>
  );
}
