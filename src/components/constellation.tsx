"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Hand, ZoomOut, Sparkles } from "lucide-react";
import { useGraph, useMe } from "@/hooks/use-data";
import type { GraphDto } from "@/lib/types";
import { Skeleton } from "./ui";
import { cn } from "@/lib/format";

/**
 * «Шоқжұлдыз» — созвездие связей как карта галактик.
 * Люди делятся на сообщества (галактики) по связям подписок: каждая галактика — своё скопление
 * со свечением и подписью. Обзор — отдалённый ракурс; клик по галактике плавно приближает к ней
 * и показывает имена; клик по пустому месту или кнопка возвращает обзор.
 * Внутри звёзд — аватарки (или инициалы), звёзды можно перетаскивать.
 */
type Node = GraphDto["nodes"][number] & { x: number; y: number; vx: number; vy: number; cluster: number };
type Cluster = { id: number; members: string[]; cx: number; cy: number; label: string; hue: number };
type View = { x: number; y: number; w: number; h: number };

const W = 1600, H = 1000, PAD = 60;
const HUES = [168, 34, 210, 350, 90, 265, 20, 140];

export function Constellation() {
  const graph = useGraph();
  const { data: me } = useMe();
  if (graph.isPending) return <Skeleton className="aspect-[16/10] w-full rounded-2xl!" />;
  if (graph.isError || !graph.data) return <p className="text-sm text-muted">Не удалось загрузить созвездие.</p>;
  return <Sky graph={graph.data} meId={me?.user?.id ?? null} />;
}

/* ------------------------- сообщества (галактики) ------------------------- */

/** Распространение меток: несколько итераций, узел берёт самую частую метку соседей. Детерминированно. */
function communities(graph: GraphDto): Map<string, number> {
  const ids = graph.nodes.map((n) => n.id).sort();
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const l of graph.links) { adj.get(l.source)?.push(l.target); adj.get(l.target)?.push(l.source); }
  const label = new Map(ids.map((id, i) => [id, i]));
  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    for (const id of ids) {
      const nb = adj.get(id) ?? [];
      if (!nb.length) continue;
      const freq = new Map<number, number>();
      for (const n of nb) freq.set(label.get(n)!, (freq.get(label.get(n)!) ?? 0) + 1);
      // при равенстве — меньшая метка, чтобы результат был стабильным
      const best = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      if (best !== label.get(id)) { label.set(id, best); changed = true; }
    }
    if (!changed) break;
  }
  // одиночки (без связей) — в одно общее скопление «новых звёзд»
  const loners = ids.filter((id) => !(adj.get(id)?.length));
  const LONERS = -1;
  for (const id of loners) label.set(id, LONERS);
  // перенумеровать подряд, крупные сообщества — первыми
  const groups = new Map<number, string[]>();
  for (const [id, l] of label) groups.set(l, [...(groups.get(l) ?? []), id]);
  const ordered = [...groups.entries()].sort((a, b) => (a[0] === LONERS ? 1 : b[0] === LONERS ? -1 : b[1].length - a[1].length));
  const out = new Map<string, number>();
  ordered.forEach(([, members], i) => members.forEach((id) => out.set(id, i)));
  return out;
}

/** Центры галактик по кругу/спирали, чтобы скопления не перекрывались. */
function clusterCenters(n: number): Array<[number, number]> {
  if (n === 1) return [[W / 2, H / 2]];
  const out: Array<[number, number]> = [];
  const rx = W * 0.34, ry = H * 0.32;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = n > 6 ? 0.8 + 0.2 * ((i % 2) ? 1 : 0.6) : 1; // при многих галактиках — два кольца
    out.push([W / 2 + Math.cos(a) * rx * k, H / 2 + Math.sin(a) * ry * k]);
  }
  return out;
}

function buildClusters(graph: GraphDto, comm: Map<string, number>): Cluster[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const groups = new Map<number, string[]>();
  for (const n of graph.nodes) groups.set(comm.get(n.id)!, [...(groups.get(comm.get(n.id)!) ?? []), n.id]);
  const centers = clusterCenters(groups.size);
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([id, members], i) => {
    const top = members.map((m) => byId.get(m)!).sort((a, b) => b.followers - a.followers)[0];
    const isLoners = members.every((m) => !graph.links.some((l) => l.source === m || l.target === m));
    return { id, members, cx: centers[i][0], cy: centers[i][1], label: isLoners ? "Новые звёзды" : `Галактика @${top.handle}`, hue: HUES[top.hue % HUES.length] };
  });
}

function seedNodes(graph: GraphDto, comm: Map<string, number>, clusters: Cluster[], jitter = 0): Node[] {
  return graph.nodes.map((u, i) => {
    const c = clusters[comm.get(u.id)!];
    const k = c.members.indexOf(u.id), n = c.members.length;
    const a = (k / Math.max(n, 1)) * Math.PI * 2 + jitter + i * 0.1;
    const r = n === 1 ? 0 : 40 + Math.min(120, n * 14);
    return { ...u, x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r * 0.8, vx: 0, vy: 0, cluster: c.id };
  });
}

/* --------------------------------- небо ---------------------------------- */

function Sky({ graph, meId }: { graph: GraphDto; meId: string | null }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const comm = useMemo(() => communities(graph), [graph]);
  const clusters = useMemo(() => buildClusters(graph, comm), [graph, comm]);
  const nodesRef = useRef<Node[]>([]);
  const loopRef = useRef<() => void>(() => {});
  const frameRef = useRef(0);
  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean; pointerId: number } | null>(null);
  const [snap, setSnap] = useState<Node[]>(() => seedNodes(graph, comm, clusters));
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const FULL: View = { x: 0, y: 0, w: W, h: H };
  const [view, setView] = useState<View>(FULL);
  const targetView = useRef<View>(FULL);
  const linkSet = useMemo(() => new Set(graph.links.map((l) => `${l.source}>${l.target}`)), [graph.links]);
  const clusterOf = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);

  const step = useCallback(() => {
    const ns = nodesRef.current;
    const idx = new Map(ns.map((n, i) => [n.id, i]));
    const drag = dragRef.current;
    const k = 0.02;
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      if (drag?.id === a.id) continue;
      const c = clusterOf.get(a.cluster)!;
      // притяжение к центру своей галактики
      a.vx += (c.cx - a.x) * 0.006; a.vy += (c.cy - a.y) * 0.006;
      for (let j = 0; j < ns.length; j++) {
        if (i === j) continue;
        const b = ns[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const d = Math.sqrt(d2);
        // внутри галактики отталкивание сильнее — чтобы аватарки не наезжали
        const f = (a.cluster === b.cluster ? 9000 : 3000) / d2;
        a.vx += (dx / d) * f * k; a.vy += (dy / d) * f * k;
      }
    }
    for (const l of graph.links) {
      const a = ns[idx.get(l.source)!], b = ns[idx.get(l.target)!];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - 110) * 0.004;
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
    // плавное приближение/отдаление камеры
    setView((v) => {
      const t = targetView.current;
      const nv = { x: v.x + (t.x - v.x) * 0.15, y: v.y + (t.y - v.y) * 0.15, w: v.w + (t.w - v.w) * 0.15, h: v.h + (t.h - v.h) * 0.15 };
      if (Math.abs(nv.w - t.w) < 0.5 && Math.abs(nv.x - t.x) < 0.5 && Math.abs(nv.y - t.y) < 0.5) return t;
      energy += 1;
      return nv;
    });
    setSnap(ns.map((n) => ({ ...n })));
    if (energy > 0.15 || drag) frameRef.current = requestAnimationFrame(() => loopRef.current());
    else frameRef.current = 0;
  }, [graph.links, clusterOf]);

  useEffect(() => { loopRef.current = step; }, [step]);
  const kick = useCallback(() => { if (!frameRef.current) frameRef.current = requestAnimationFrame(() => loopRef.current()); }, []);
  useEffect(() => { kick(); return () => { cancelAnimationFrame(frameRef.current); frameRef.current = 0; }; }, [kick]);

  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodesRef.current = seedNodes(graph, comm, clusters).map((n) => (prev.get(n.id) ? { ...n, x: prev.get(n.id)!.x, y: prev.get(n.id)!.y } : n));
    kick();
  }, [graph, comm, clusters, kick]);

  /** Приблизить галактику: рамка вокруг её звёзд с запасом. */
  const focusCluster = (id: number) => {
    const ns = nodesRef.current.filter((n) => n.cluster === id);
    if (!ns.length) return;
    const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
    const x1 = Math.max(...xs) + 90, y1 = Math.max(...ys) + 90;
    let x0 = Math.min(...xs) - 90, y0 = Math.min(...ys) - 90;
    // держим пропорции 16:10 и минимальный масштаб
    let w = Math.max(x1 - x0, 420), h = Math.max(y1 - y0, 420 * (H / W));
    if (w / h > W / H) h = w * (H / W); else w = h * (W / H);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = cx - w / 2; y0 = cy - h / 2;
    targetView.current = { x: x0, y: y0, w, h };
    setFocus(id); kick();
  };
  const unfocus = () => { targetView.current = FULL; setFocus(null); kick(); };

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: view.x + ((e.clientX - r.left) / r.width) * view.w, y: view.y + ((e.clientY - r.top) / r.height) * view.h };
  };
  const onDown = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toSvg(e);
    dragRef.current = { id, startX: p.x, startY: p.y, moved: false, pointerId: e.pointerId };
    setDragging(id); setHover(id); kick();
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
    dragRef.current = null; setDragging(null);
    if (!d.moved) {
      const n = nodesRef.current.find((x) => x.id === d.id);
      if (!n) return;
      // в обзоре клик по звезде приближает её галактику; в приближении — открывает профиль
      if (focus === null) focusCluster(n.cluster); else router.push(`/u/${n.handle}`);
    }
    kick();
  };
  const shuffle = () => {
    nodesRef.current = seedNodes(graph, comm, clusters, Math.random() * Math.PI * 2).map((n) => ({ ...n, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8 }));
    kick();
  };

  const nodes = snap;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const maxPosts = Math.max(1, ...nodes.map((n) => n.posts));
  const zoomed = focus !== null;
  const scale = view.w / W; // 1 — обзор, меньше — приближение

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line" style={{ background: "radial-gradient(ellipse at 50% 40%, var(--elev), var(--bg) 75%)" }}>
      <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="block aspect-[16/10] w-full select-none" style={{ touchAction: "none" }} role="img" aria-label="Карта галактик — сообщества подписок"
        onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={() => { if (zoomed && !dragRef.current) unfocus(); }}>
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="nebula"><feGaussianBlur stdDeviation="28" /></filter>
          {nodes.map((n) => { const r = nodeRadius(n, maxPosts, scale); return <clipPath key={n.id} id={`clip-${n.id}`}><circle cx={n.x} cy={n.y} r={r} /></clipPath>; })}
        </defs>

        {/* туманности галактик */}
        {clusters.map((c) => {
          const ms = nodes.filter((n) => n.cluster === c.id);
          if (!ms.length) return null;
          const cx = ms.reduce((s, n) => s + n.x, 0) / ms.length, cy = ms.reduce((s, n) => s + n.y, 0) / ms.length;
          const rad = Math.max(90, ...ms.map((n) => Math.hypot(n.x - cx, n.y - cy))) + 70;
          const dim = zoomed && focus !== c.id;
          return (
            <g key={c.id} opacity={dim ? 0.25 : 1} style={{ transition: "opacity .3s", cursor: zoomed ? "default" : "zoom-in" }} onClick={(e) => { if (!zoomed) { e.stopPropagation(); focusCluster(c.id); } }}>
              <ellipse cx={cx} cy={cy} rx={rad * 1.15} ry={rad * 0.85} fill={`hsl(${c.hue} 70% 60%)`} opacity="0.13" filter="url(#nebula)" />
              <ellipse cx={cx} cy={cy} rx={rad * 0.7} ry={rad * 0.5} fill={`hsl(${(c.hue + 40) % 360} 70% 70%)`} opacity="0.1" filter="url(#nebula)" />
              {!zoomed && (
                <text x={cx} y={cy + rad * 0.85 + 26} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink-2)" style={{ pointerEvents: "none" }}>
                  {c.label} <tspan fill="var(--muted)" fontWeight="500">· {ms.length}</tspan>
                </text>
              )}
            </g>
          );
        })}

        {/* связи */}
        {graph.links.map((l) => {
          const a = byId.get(l.source), b = byId.get(l.target);
          if (!a || !b) return null;
          const mutual = linkSet.has(`${l.target}>${l.source}`);
          const active = hover === l.source || hover === l.target;
          const dim = zoomed && a.cluster !== focus && b.cluster !== focus;
          return <line key={`${l.source}-${l.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={active ? "var(--saffron)" : mutual ? "var(--accent)" : "var(--line-strong)"} strokeWidth={(active ? 2.2 : mutual ? 1.6 : 1) * Math.max(scale, 0.5)} strokeOpacity={dim ? 0.15 : hover && !active ? 0.3 : 0.9} />;
        })}

        {/* звёзды с аватарками */}
        {nodes.map((n) => {
          const r = nodeRadius(n, maxPosts, scale);
          const h = HUES[n.hue % HUES.length];
          const dim = (zoomed && n.cluster !== focus) || (hover && hover !== n.id && !linkSet.has(`${hover}>${n.id}`) && !linkSet.has(`${n.id}>${hover}`));
          const isDrag = dragging === n.id;
          const initials = n.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
          return (
            <g key={n.id} opacity={dim ? 0.3 : 1} style={{ transition: "opacity .2s", cursor: isDrag ? "grabbing" : zoomed ? "pointer" : "zoom-in" }}
              onPointerEnter={() => !dragging && setHover(n.id)} onPointerLeave={() => !dragging && setHover(null)} onPointerDown={onDown(n.id)}>
              <circle cx={n.x} cy={n.y} r={r + 8 + n.followers * 2} fill={`hsl(${h} 70% 60%)`} opacity={isDrag ? 0.3 : 0.14} filter="url(#glow)" />
              <circle cx={n.x} cy={n.y} r={Math.max(r + 10, 22)} fill="transparent" />
              <circle cx={n.x} cy={n.y} r={r} fill={`hsl(${h} 65% 55%)`} />
              {n.avatarUrl
                ? <image href={n.avatarUrl} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} clipPath={`url(#clip-${n.id})`} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
                : <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={r * 0.8} fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{initials}</text>}
              <circle cx={n.x} cy={n.y} r={r} fill="none" stroke={n.id === meId ? "var(--saffron)" : "var(--elev)"} strokeWidth={n.id === meId ? 3 : 2} />
              {(zoomed || scale < 0.6) && <text x={n.x} y={n.y + r + 16} textAnchor="middle" fontSize={12 * Math.max(scale, 0.45)} fontWeight="600" fill="var(--ink-2)" style={{ pointerEvents: "none" }}>@{n.handle}</text>}
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
        <span className="hidden items-center gap-1 rounded-full bg-elev/80 px-2.5 py-1 text-[11px] text-muted backdrop-blur sm:flex">
          {zoomed ? <><Hand size={12} /> тяните звёзды · клик по звезде — профиль</> : <><Sparkles size={12} /> нажмите на галактику, чтобы приблизить</>}
        </span>
        {zoomed && <button onClick={unfocus} className={cn("btn btn-primary gap-1.5 px-3 py-1.5 text-xs")}><ZoomOut size={14} /> К обзору</button>}
        <button onClick={shuffle} className="btn btn-outline gap-1.5 px-3 py-1.5 text-xs" title="Расставить заново"><Shuffle size={14} /> Перемешать</button>
      </div>
      {zoomed && (
        <div className="absolute left-3 top-3 rounded-full bg-elev/85 px-3 py-1.5 text-xs font-semibold backdrop-blur">
          {clusterOf.get(focus!)?.label} <span className="text-muted">· {nodes.filter((n) => n.cluster === focus).length} {plural(nodes.filter((n) => n.cluster === focus).length)}</span>
        </div>
      )}
    </div>
  );
}

/** Радиус звезды: от числа постов; в обзоре звёзды крупнее в мировых единицах, чтобы оставаться видимыми. */
function nodeRadius(n: { posts: number }, maxPosts: number, scale: number) {
  const base = 16 + (n.posts / maxPosts) * 14;
  return base * (0.7 + 0.6 * Math.min(scale, 1));
}
const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "человек" : "человек");
