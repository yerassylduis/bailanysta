"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Hand } from "lucide-react";
import { useGraph, useMe } from "@/hooks/use-data";
import type { GraphDto } from "@/lib/types";
import { Skeleton } from "./ui";

/**
 * «Шоқжұлдыз» — созвездие связей. Граф подписок как звёздное небо:
 * узлы — люди (размер = число постов, свечение = подписчики), линии — подписки.
 * Живая force-симуляция на requestAnimationFrame: звёзды можно таскать мышью и пальцем,
 * остальные реагируют пружинами и отталкиванием. Клик без движения — в профиль.
 */
type Node = GraphDto["nodes"][number] & { x: number; y: number; vx: number; vy: number };

const W = 720, H = 460, PAD = 44;
const HUES = [168, 34, 210, 350, 90, 265, 20, 140];

export function Constellation() {
  const graph = useGraph();
  const { data: me } = useMe();
  if (graph.isPending) return <Skeleton className="aspect-[720/460] w-full rounded-2xl!" />;
  if (graph.isError || !graph.data) return <p className="text-sm text-muted">Не удалось загрузить созвездие.</p>;
  return <Sky graph={graph.data} meId={me?.user?.id ?? null} />;
}

function seedNodes(graph: GraphDto, jitter = 0): Node[] {
  const n = Math.max(graph.nodes.length, 1);
  return graph.nodes.map((u, i) => {
    const a = (i / n) * Math.PI * 2 + jitter;
    const r = 120 + ((i * 37) % 60);
    return { ...u, x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r * 0.8, vx: 0, vy: 0 };
  });
}

function Sky({ graph, meId }: { graph: GraphDto; meId: string | null }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const loopRef = useRef<() => void>(() => {});
  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean; pointerId: number } | null>(null);
  const frameRef = useRef(0);
  /** Снимок позиций для рендера; физика живёт в nodesRef и публикует снимок каждый кадр. */
  const [snap, setSnap] = useState<Node[]>(() => seedNodes(graph));
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const linkSet = useMemo(() => new Set(graph.links.map((l) => `${l.source}>${l.target}`)), [graph.links]);

  const step = useCallback(() => {
    const ns = nodesRef.current;
    const idx = new Map(ns.map((n, i) => [n.id, i]));
    const drag = dragRef.current;
    const k = 0.02;
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      if (drag?.id === a.id) continue;
      a.vx += (W / 2 - a.x) * 0.003; a.vy += (H / 2 - a.y) * 0.003;
      for (let j = 0; j < ns.length; j++) {
        if (i === j) continue;
        const b = ns[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const f = 5600 / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f * k; a.vy += (dy / d) * f * k;
      }
    }
    for (const l of graph.links) {
      const a = ns[idx.get(l.source)!], b = ns[idx.get(l.target)!];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - 130) * 0.004;
      if (drag?.id !== a.id) { a.vx += (dx / d) * f; a.vy += (dy / d) * f; }
      if (drag?.id !== b.id) { b.vx -= (dx / d) * f; b.vy -= (dy / d) * f; }
    }
    let energy = 0;
    for (let i = 0; i < ns.length; i++) {
      const c = ns[i];
      if (drag?.id === c.id) continue;
      c.vx *= 0.8; c.vy *= 0.8;
      c.x = Math.min(W - PAD, Math.max(PAD, c.x + c.vx));
      c.y = Math.min(H - PAD, Math.max(PAD, c.y + c.vy));
      energy += Math.abs(c.vx) + Math.abs(c.vy);
    }
    setSnap(ns.map((n) => ({ ...n })));
    // Засыпаем, когда всё успокоилось и никто не тянет; проснёмся от следующего kick().
    if (energy > 0.15 || drag) frameRef.current = requestAnimationFrame(() => loopRef.current());
    else frameRef.current = 0;
  }, [graph.links]);

  useEffect(() => { loopRef.current = step; }, [step]);

  const kick = useCallback(() => { if (!frameRef.current) frameRef.current = requestAnimationFrame(() => loopRef.current()); }, []);

  useEffect(() => { kick(); return () => { cancelAnimationFrame(frameRef.current); frameRef.current = 0; }; }, [kick]);

  // Пересеваем узлы при обновлении графа (например, после подписки), сохраняя позиции знакомых звёзд.
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodesRef.current = seedNodes(graph).map((n) => (prev.get(n.id) ? { ...n, x: prev.get(n.id)!.x, y: prev.get(n.id)!.y } : n));
    kick();
  }, [graph, kick]);

  /** Координаты указателя → система координат viewBox. */
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onDown = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toSvg(e);
    dragRef.current = { id, startX: p.x, startY: p.y, moved: false, pointerId: e.pointerId };
    setDragging(id);
    setHover(id);
    kick();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const p = toSvg(e);
    if (Math.hypot(p.x - d.startX, p.y - d.startY) > 4) d.moved = true;
    const n = nodesRef.current.find((x) => x.id === d.id);
    if (n) { n.x = Math.min(W - PAD, Math.max(PAD, p.x)); n.y = Math.min(H - PAD, Math.max(PAD, p.y)); n.vx = 0; n.vy = 0; }
    kick();
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(null);
    if (!d.moved) {
      const n = nodesRef.current.find((x) => x.id === d.id);
      if (n) router.push(`/u/${n.handle}`);
    }
    kick();
  };

  const shuffle = () => {
    nodesRef.current = seedNodes(graph, Math.random() * Math.PI * 2).map((n) => ({ ...n, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 }));
    kick();
  };

  const nodes = snap;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const maxPosts = Math.max(1, ...nodes.map((n) => n.posts));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line" style={{ background: "radial-gradient(ellipse at 50% 40%, var(--elev), var(--bg) 75%)" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" style={{ touchAction: "none" }} role="img" aria-label="Граф подписок — звёзды можно перетаскивать"
        onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
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
          const r = 7 + (n.posts / maxPosts) * 12;
          const h = HUES[n.hue % HUES.length];
          const dim = hover && hover !== n.id && !linkSet.has(`${hover}>${n.id}`) && !linkSet.has(`${n.id}>${hover}`);
          const isDrag = dragging === n.id;
          return (
            <g key={n.id} opacity={dim ? 0.35 : 1} style={{ transition: "opacity .2s", cursor: isDrag ? "grabbing" : "grab" }}
              onPointerEnter={() => !dragging && setHover(n.id)} onPointerLeave={() => !dragging && setHover(null)} onPointerDown={onDown(n.id)}>
              <circle cx={n.x} cy={n.y} r={r + 6 + n.followers * 1.5} fill={`hsl(${h} 70% 60%)`} opacity={isDrag ? 0.25 : 0.12} filter="url(#glow)" />
              {/* невидимая большая зона захвата — удобно на телефоне */}
              <circle cx={n.x} cy={n.y} r={Math.max(r + 10, 22)} fill="transparent" />
              <circle cx={n.x} cy={n.y} r={isDrag ? r * 1.15 : r} fill={`hsl(${h} 65% 55%)`} stroke={n.id === meId ? "var(--saffron)" : "var(--elev)"} strokeWidth={n.id === meId ? 3 : 1.5} style={{ transition: "r .15s" }} />
              <text x={n.x} y={n.y + r + 15} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink-2)" style={{ pointerEvents: "none" }}>@{n.handle}</text>
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-accent" /> взаимная подписка</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-line-strong" /> в одну сторону</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-saffron" /> это вы</span>
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <span className="hidden items-center gap-1 rounded-full bg-elev/80 px-2.5 py-1 text-[11px] text-muted backdrop-blur sm:flex"><Hand size={12} /> тяните звёзды</span>
        <button onClick={shuffle} className="btn btn-outline gap-1.5 px-3 py-1.5 text-xs" title="Расставить заново"><Shuffle size={14} /> Перемешать</button>
      </div>
    </div>
  );
}
