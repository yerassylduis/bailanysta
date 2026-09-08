"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Hand, ZoomOut, Sparkles, Pencil, Upload, X, Link2, Trash2, Loader2 } from "lucide-react";
import { useGraph, useLinkGalaxies, useMe, useUnlinkGalaxies, useUpdateGalaxy } from "@/hooks/use-data";
import { api } from "@/lib/api-client";
import type { GalaxyDto, GalaxyLinkDto, GraphDto } from "@/lib/types";
import { Skeleton } from "./ui";
import { cn } from "@/lib/format";
import { useT } from "./locale-provider";

/**
 * «Шоқжұлдыз» — созвездие связей как карта галактик.
 * Галактика — именованная группа (отдел, команда): в обзоре это один большой круг с общим аватаром,
 * между галактиками — связи с описанием, чем они связаны. Клик по галактике приближает камеру
 * и раскрывает её звёзды — людей с аватарками, которых можно перетаскивать; клик по звезде открывает профиль.
 * Участники галактики могут менять её имя и аватар и создавать связи с другими галактиками.
 */
type Node = GraphDto["nodes"][number] & { x: number; y: number; vx: number; vy: number; cluster: string };
type Cluster = { id: string; galaxy: GalaxyDto | null; members: string[]; cx: number; cy: number; label: string; hue: number };
type View = { x: number; y: number; w: number; h: number };

const W = 1600, H = 1000, PAD = 60;
const HUES = [168, 34, 210, 350, 90, 265, 20, 140];
const LONERS = "loners";
const FULL: View = { x: 0, y: 0, w: W, h: H };
const CAM_MS = 520;

export function Constellation() {
  const graph = useGraph();
  const { data: me } = useMe();
  const { t } = useT();
  if (graph.isPending) return <Skeleton className="aspect-[16/10] w-full rounded-2xl!" />;
  if (graph.isError || !graph.data) return <p className="text-sm text-muted">{t("explore.loadFailed")}</p>;
  return <Sky graph={graph.data} meId={me?.user?.id ?? null} meAdmin={me?.user?.isAdmin ?? false} />;
}

/* ------------------------------ галактики ------------------------------- */

/** Центры галактик по кольцу, чтобы круги не перекрывались. */
function clusterCenters(n: number): Array<[number, number]> {
  if (n === 1) return [[W / 2, H / 2]];
  if (n === 2) return [[W * 0.32, H / 2], [W * 0.68, H / 2]];
  const out: Array<[number, number]> = [];
  const rx = W * 0.36, ry = H * 0.34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = n > 6 ? (i % 2 ? 1 : 0.55) : 1; // при многих галактиках — два кольца
    out.push([W / 2 + Math.cos(a) * rx * k, H / 2 + Math.sin(a) * ry * k]);
  }
  return out;
}

function buildClusters(graph: GraphDto, lonersLabel: string): Cluster[] {
  const gal = [...graph.galaxies].sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));
  const list: Array<Omit<Cluster, "cx" | "cy">> = gal.map((g, i) => ({
    id: g.id, galaxy: g, members: graph.nodes.filter((n) => n.galaxyId === g.id).map((n) => n.id), label: g.name, hue: HUES[i % HUES.length],
  }));
  const loners = graph.nodes.filter((n) => !n.galaxyId || !graph.galaxies.some((g) => g.id === n.galaxyId)).map((n) => n.id);
  if (loners.length) list.push({ id: LONERS, galaxy: null, members: loners, label: lonersLabel, hue: HUES[2] });
  const centers = clusterCenters(list.length);
  return list.map((c, i) => ({ ...c, cx: centers[i][0], cy: centers[i][1] }));
}

function seedNodes(graph: GraphDto, clusters: Cluster[], jitter = 0): Node[] {
  const of = new Map<string, Cluster>();
  for (const c of clusters) for (const m of c.members) of.set(m, c);
  return graph.nodes.map((u, i) => {
    const c = of.get(u.id)!;
    const k = c.members.indexOf(u.id), n = c.members.length;
    const a = (k / Math.max(n, 1)) * Math.PI * 2 + jitter + i * 0.1;
    const r = n === 1 ? 0 : 30 + Math.min(80, n * 9);
    return { ...u, x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r * 0.8, vx: 0, vy: 0, cluster: c.id };
  });
}

/** Радиус звезды в мировых единицах: от числа постов. При приближении камеры звезда растёт на экране. */
const nodeRadius = (n: { posts: number }, maxPosts: number) => 14 + (n.posts / maxPosts) * 12;
/** Половина ширины подписи галактики в мировых единицах (22px шрифт ≈ 11.5px на символ + счётчик). */
const labelHalf = (label: string) => Math.min(260, label.length * 6 + 26);
const initialsOf = (name: string) => name.replace(/^Галактика\s+/i, "").replace(/@/g, "").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "★";

/* --------------------------------- небо ---------------------------------- */

function Sky({ graph, meId, meAdmin }: { graph: GraphDto; meId: string | null; meAdmin: boolean }) {
  const router = useRouter();
  const { t } = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const lonersLabel = t("explore.loners");
  const clusters = useMemo(() => buildClusters(graph, lonersLabel), [graph, lonersLabel]);
  const nodesRef = useRef<Node[]>([]);
  const loopRef = useRef<() => void>(() => {});
  const frameRef = useRef(0);
  const dragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean; pointerId: number } | null>(null);
  const [snap, setSnap] = useState<Node[]>(() => seedNodes(graph, clusters));
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  /** Камера живёт вне React: viewBox пишется в DOM напрямую, чтобы зум не перерисовывал всё дерево каждый кадр. */
  const viewRef = useRef<View>(FULL);
  /** Полёт камеры по времени: from → to за CAM_MS с плавным замедлением — одинаково чётко при любой частоте кадров. */
  const cam = useRef<{ from: View; to: View; start: number } | null>(null);
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
      a.vx += (c.cx - a.x) * 0.012; a.vy += (c.cy - a.y) * 0.012;
      for (let j = 0; j < ns.length; j++) {
        if (i === j) continue;
        const b = ns[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const d = Math.sqrt(d2);
        const f = (a.cluster === b.cluster ? 4200 : 6000) / d2;
        a.vx += (dx / d) * f * k; a.vy += (dy / d) * f * k;
      }
    }
    for (const l of graph.links) {
      const a = ns[idx.get(l.source)!], b = ns[idx.get(l.target)!];
      if (!a || !b || a.cluster !== b.cluster) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - 78) * 0.006;
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
    // React перерисовывает звёзды только пока они реально двигаются
    const moving = energy > 0.15 || !!drag;
    if (moving) setSnap(ns.map((n) => ({ ...n })));

    // камера: полёт к цели по времени без React — прямая запись viewBox
    let camMoving = false;
    const c = cam.current;
    if (c) {
      if (!c.start) c.start = performance.now();
      const p = Math.min(1, (performance.now() - c.start) / CAM_MS);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const lerp = (a: number, b: number) => a + (b - a) * e;
      const nv = p >= 1 ? c.to : { x: lerp(c.from.x, c.to.x), y: lerp(c.from.y, c.to.y), w: lerp(c.from.w, c.to.w), h: lerp(c.from.h, c.to.h) };
      viewRef.current = nv;
      svgRef.current?.setAttribute("viewBox", `${nv.x} ${nv.y} ${nv.w} ${nv.h}`);
      if (p >= 1) cam.current = null; else camMoving = true;
    }
    if (moving || camMoving) frameRef.current = requestAnimationFrame(() => loopRef.current());
    else frameRef.current = 0;
  }, [graph.links, clusterOf]);

  useEffect(() => { loopRef.current = step; }, [step]);
  const kick = useCallback(() => { if (!frameRef.current) frameRef.current = requestAnimationFrame(() => loopRef.current()); }, []);
  useEffect(() => { kick(); return () => { cancelAnimationFrame(frameRef.current); frameRef.current = 0; }; }, [kick]);

  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodesRef.current = seedNodes(graph, clusters).map((n) => (prev.get(n.id)?.cluster === n.cluster ? { ...n, x: prev.get(n.id)!.x, y: prev.get(n.id)!.y } : n));
    kick();
  }, [graph, clusters, kick]);

  /** Приблизить галактику: камера подлетает к её звёздам вплотную. */
  const focusCluster = (id: string) => {
    const ns = nodesRef.current.filter((n) => n.cluster === id);
    if (!ns.length) return;
    const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
    const x1 = Math.max(...xs) + 70, y1 = Math.max(...ys) + 80;
    let x0 = Math.min(...xs) - 70, y0 = Math.min(...ys) - 60;
    // пропорции 16:10; минимальная ширина кадра 320 мировых px → приближение до 5×
    let w = Math.max(x1 - x0, 320), h = Math.max(y1 - y0, 320 * (H / W));
    if (w / h > W / H) h = w * (H / W); else w = h * (W / H);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = cx - w / 2; y0 = cy - h / 2;
    flyTo({ x: x0, y: y0, w, h });
    setFocus(id); setPanel(false);
  };
  const flyTo = (to: View) => { cam.current = { from: viewRef.current, to, start: 0 }; kick(); }; // start проставится первым кадром
  const unfocus = () => { flyTo(FULL); setFocus(null); setPanel(false); };

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    const view = viewRef.current;
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
      if (focus === n.cluster) router.push(`/u/${n.handle}`); else focusCluster(n.cluster);
    }
    kick();
  };
  const shuffle = () => {
    nodesRef.current = seedNodes(graph, clusters, Math.random() * Math.PI * 2).map((n) => ({ ...n, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8 }));
    kick();
  };

  const nodes = snap;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const maxPosts = Math.max(1, ...nodes.map((n) => n.posts));
  const zoomed = focus !== null;
  const focused = focus ? clusterOf.get(focus) ?? null : null;
  const canEdit = !!focused?.galaxy && (meAdmin || (!!meId && focused.members.includes(meId)));
  const galaxyById = new Map(clusters.filter((c) => c.galaxy).map((c) => [c.id, c]));
  /** Живая геометрия скопления: центроид звёзд и радиус разброса. */
  const geo = new Map(clusters.map((c) => {
    const ms = nodes.filter((n) => n.cluster === c.id);
    if (!ms.length) return [c.id, { cx: c.cx, cy: c.cy, rad: 60 }] as const;
    const cx = ms.reduce((a, n) => a + n.x, 0) / ms.length, cy = ms.reduce((a, n) => a + n.y, 0) / ms.length;
    const rad = Math.max(48, ...ms.map((n) => Math.hypot(n.x - cx, n.y - cy) + nodeRadius(n, maxPosts))) + 26;
    return [c.id, { cx, cy, rad }] as const;
  }));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line" style={{ background: "radial-gradient(ellipse at 50% 40%, var(--elev), var(--bg) 75%)" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block aspect-[16/10] w-full select-none" style={{ touchAction: "none" }} role="img" aria-label={t("explore.mapAria")}
        onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={() => { if (zoomed && !dragRef.current) unfocus(); }}>
        <defs>
          {/* свечение без SVG-фильтров: радиальные градиенты дёшевы при любом масштабе */}
          {HUES.map((h) => (
            <radialGradient key={h} id={`glow-${h}`}>
              <stop offset="0%" stopColor={`hsl(${h} 75% 62%)`} stopOpacity="0.55" />
              <stop offset="60%" stopColor={`hsl(${h} 75% 62%)`} stopOpacity="0.12" />
              <stop offset="100%" stopColor={`hsl(${h} 75% 62%)`} stopOpacity="0" />
            </radialGradient>
          ))}
          {clusters.map((c) => (
            <radialGradient key={`neb-${c.id}`} id={`neb-${c.id}`}>
              <stop offset="0%" stopColor={`hsl(${c.hue} 70% 62%)`} stopOpacity="0.28" />
              <stop offset="45%" stopColor={`hsl(${(c.hue + 40) % 360} 70% 70%)`} stopOpacity="0.12" />
              <stop offset="100%" stopColor={`hsl(${c.hue} 70% 62%)`} stopOpacity="0" />
            </radialGradient>
          ))}
          {clusters.map((c) => { const g = geo.get(c.id)!; return <clipPath key={c.id} id={`clip-g-${c.id}`}><circle cx={g.cx - labelHalf(c.label) - 6} cy={g.cy - g.rad - 20} r={16} /></clipPath>; })}
          {nodes.map((n) => <clipPath key={n.id} id={`clip-${n.id}`}><circle cx={n.x} cy={n.y} r={nodeRadius(n, maxPosts)} /></clipPath>)}
        </defs>

        {/* связи между галактиками с описанием */}
        {graph.galaxyLinks.map((l) => {
          const ca = galaxyById.get(l.from), cb = galaxyById.get(l.to);
          if (!ca || !cb) return null;
          const a = geo.get(ca.id)!, b = geo.get(cb.id)!;
          const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
          const dx = b.cx - a.cx, dy = b.cy - a.cy, len = Math.hypot(dx, dy) || 1;
          // лёгкая дуга — перпендикулярный изгиб
          const bend = Math.min(90, len * 0.12);
          const qx = mx - (dy / len) * bend, qy = my + (dx / len) * bend;
          const lx = mx - (dy / len) * bend * 0.5, ly = my + (dx / len) * bend * 0.5;
          const text = l.description.length > 44 ? l.description.slice(0, 42) + "…" : l.description;
          const tw = Math.max(60, text.length * 8.2 + 28);
          const dim = zoomed && focus !== ca.id && focus !== cb.id;
          return (
            <g key={l.id} opacity={dim ? 0.15 : zoomed ? 0.55 : 1} style={{ transition: "opacity .3s", pointerEvents: "none" }}>
              <path d={`M${a.cx},${a.cy} Q${qx},${qy} ${b.cx},${b.cy}`} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeDasharray="6 8" strokeOpacity={0.7} />
              {!zoomed && (
                <g>
                  <rect x={lx - tw / 2} y={ly - 14} width={tw} height={28} rx={14} fill="var(--elev)" stroke="var(--line)" />
                  <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="600" fill="var(--ink-2)">{text}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* туманности скоплений и названия галактик сверху */}
        {clusters.map((c) => {
          const g = geo.get(c.id)!;
          const isFocus = focus === c.id;
          const dim = zoomed && !isFocus;
          const lx = g.cx, ly = g.cy - g.rad - 20;
          const half = labelHalf(c.label);
          return (
            <g key={c.id} opacity={dim ? 0.25 : 1} style={{ transition: "opacity .3s" }}>
              <ellipse cx={g.cx} cy={g.cy} rx={g.rad * 1.6} ry={g.rad * 1.25} fill={`url(#neb-${c.id})`} style={{ pointerEvents: "none" }} />
              {!isFocus && (
                <g style={{ cursor: "zoom-in" }} onClick={(e) => { e.stopPropagation(); focusCluster(c.id); }}>
                  <rect x={lx - half - 30} y={ly - 22} width={half * 2 + 60} height={44} rx={22} fill="var(--elev)" fillOpacity={0.92} stroke={`hsl(${c.hue} 60% 55%)`} strokeWidth={1.5} />
                  {c.galaxy?.avatarUrl
                    ? <image href={c.galaxy.avatarUrl} x={lx - half - 22} y={ly - 16} width={32} height={32} clipPath={`url(#clip-g-${c.id})`} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
                    : <circle cx={lx - half - 6} cy={ly} r={9} fill={`hsl(${c.hue} 65% 55%)`} />}
                  <text x={lx + 12} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill="var(--ink)" style={{ pointerEvents: "none" }}>
                    {c.label} <tspan fill="var(--muted)" fontWeight="500" fontSize="18">· {c.members.length}</tspan>
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* связи людей внутри галактик */}
        {graph.links.map((l) => {
          const a = byId.get(l.source), b = byId.get(l.target);
          if (!a || !b || a.cluster !== b.cluster) return null;
          const mutual = linkSet.has(`${l.target}>${l.source}`);
          const active = hover === l.source || hover === l.target;
          const dim = zoomed && a.cluster !== focus;
          return <line key={`${l.source}-${l.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={active ? "var(--saffron)" : mutual ? "var(--accent)" : "var(--line-strong)"} strokeWidth={active ? 2 : mutual ? 1.4 : 0.9} strokeOpacity={dim ? 0.15 : hover && !active ? 0.3 : 0.9} />;
        })}

        {/* звёзды с аватарками — скопления людей */}
        {nodes.map((n) => {
          const r = nodeRadius(n, maxPosts);
          const h = HUES[n.hue % HUES.length];
          const inFocus = !zoomed || n.cluster === focus;
          const dim = !inFocus || (hover && hover !== n.id && !linkSet.has(`${hover}>${n.id}`) && !linkSet.has(`${n.id}>${hover}`));
          const isDrag = dragging === n.id;
          const initials = n.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
          return (
            <g key={n.id} opacity={dim ? (inFocus ? 0.3 : 0.2) : 1} style={{ transition: "opacity .2s", cursor: isDrag ? "grabbing" : inFocus && zoomed ? "pointer" : "zoom-in" }}
              onPointerEnter={() => !dragging && setHover(n.id)} onPointerLeave={() => !dragging && setHover(null)} onPointerDown={onDown(n.id)}>
              <circle cx={n.x} cy={n.y} r={r + 12 + n.followers * 2} fill={`url(#glow-${h})`} opacity={isDrag ? 0.9 : 0.5} />
              <circle cx={n.x} cy={n.y} r={Math.max(r + 10, 22)} fill="transparent" />
              <circle cx={n.x} cy={n.y} r={r} fill={`hsl(${h} 65% 55%)`} />
              {n.avatarUrl
                ? <image href={n.avatarUrl} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} clipPath={`url(#clip-${n.id})`} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none" }} />
                : <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={r * 0.8} fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{initials}</text>}
              <circle cx={n.x} cy={n.y} r={r} fill="none" stroke={n.id === meId ? "var(--saffron)" : "var(--elev)"} strokeWidth={n.id === meId ? 3 : 2} />
              {zoomed && inFocus && <text x={n.x} y={n.y + r + 13} textAnchor="middle" fontSize={11} fontWeight="600" fill="var(--ink-2)" style={{ pointerEvents: "none" }}>@{n.handle}</text>}
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 text-[11px] text-muted">
        {zoomed ? (
          <>
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-accent" /> {t("explore.legendMutual")}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-line-strong" /> {t("explore.legendOneWay")}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-saffron" /> {t("explore.legendYou")}</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-accent" /> {t("explore.legendGalaxyLink")}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-saffron" /> {t("explore.legendYou")}</span>
          </>
        )}
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <span className="hidden items-center gap-1 rounded-full bg-elev/80 px-2.5 py-1 text-[11px] text-muted backdrop-blur sm:flex">
          {zoomed ? <><Hand size={12} /> {t("explore.hintZoomed")}</> : <><Sparkles size={12} /> {t("explore.hintOverview")}</>}
        </span>
        {zoomed && <button onClick={unfocus} className={cn("btn btn-primary gap-1.5 px-3 py-1.5 text-xs")}><ZoomOut size={14} /> {t("explore.zoomOut")}</button>}
        {!zoomed && <button onClick={shuffle} className="btn btn-outline gap-1.5 px-3 py-1.5 text-xs" title={t("explore.shuffleTitle")}><Shuffle size={14} /> {t("explore.shuffle")}</button>}
      </div>
      {zoomed && focused && (
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-elev/85 py-1 pl-1 pr-3 text-xs font-semibold backdrop-blur">
            <GalaxyAvatar galaxy={focused.galaxy} label={focused.label} hue={focused.hue} size={26} />
            {focused.label} <span className="text-muted">· {t("common.people", { count: focused.members.length })}</span>
          </div>
          {canEdit && (
            <button onClick={() => setPanel((p) => !p)} className={cn("btn gap-1.5 px-3 py-1.5 text-xs", panel ? "btn-primary" : "btn-outline")} title={t("explore.configureTitle")}>
              <Pencil size={13} /> {t("explore.configure")}
            </button>
          )}
        </div>
      )}
      {zoomed && focused?.galaxy && panel && canEdit && (
        <GalaxyPanel key={focused.id} galaxy={focused.galaxy} hue={focused.hue} others={clusters.filter((c) => c.galaxy && c.id !== focused.id).map((c) => c.galaxy!)}
          links={graph.galaxyLinks.filter((l) => l.from === focused.id || l.to === focused.id)} nameOf={(id) => galaxyById.get(id)?.label ?? "…"} onClose={() => setPanel(false)} />
      )}
    </div>
  );
}

/* ---------------------------- панель галактики ---------------------------- */

function GalaxyAvatar({ galaxy, label, hue, size }: { galaxy: GalaxyDto | null; label: string; hue: number; size: number }) {
  return galaxy?.avatarUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={galaxy.avatarUrl} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <span className="grid place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 60% 50%)` }}>{initialsOf(label)}</span>;
}

function GalaxyPanel({ galaxy, hue, others, links, nameOf, onClose }: {
  galaxy: GalaxyDto; hue: number; others: GalaxyDto[]; links: GalaxyLinkDto[]; nameOf: (id: string) => string; onClose: () => void;
}) {
  const update = useUpdateGalaxy();
  const link = useLinkGalaxies();
  const unlink = useUnlinkGalaxies();
  const { t } = useT();
  const [name, setName] = useState(galaxy.name);
  const [uploading, setUploading] = useState(false);
  const [toId, setToId] = useState(others[0]?.id ?? "");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const busy = update.isPending || link.isPending || unlink.isPending || uploading;

  const saveName = async () => {
    const v = name.trim();
    if (v.length < 2 || v === galaxy.name) return;
    setErr(null);
    try { await update.mutateAsync({ id: galaxy.id, name: v }); } catch (e) { setErr((e as Error).message); }
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null); setUploading(true);
    try {
      const m = await api.upload(f);
      await update.mutateAsync({ id: galaxy.id, avatarMediaId: m.id });
    } catch (e) { setErr((e as Error).message); } finally { setUploading(false); }
  };
  const addLink = async () => {
    const d = desc.trim();
    if (!toId || d.length < 2) return;
    setErr(null);
    try { await link.mutateAsync({ id: galaxy.id, toId, description: d }); setDesc(""); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="absolute left-3 top-14 z-10 w-[min(340px,calc(100%-24px))] rounded-2xl border border-line bg-elev/95 p-3 text-sm shadow-lg backdrop-blur" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">{t("explore.panelTitle")}</span>
        <button onClick={onClose} className="btn btn-ghost h-7 w-7 p-0" aria-label={t("common.close")}><X size={14} /></button>
      </div>

      <div className="flex items-center gap-3">
        <label className="group relative cursor-pointer" title={t("explore.changeGalaxyAvatar")}>
          <GalaxyAvatar galaxy={galaxy} label={galaxy.name} hue={hue} size={56} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          </span>
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[11px] text-muted">{t("explore.groupNameLabel")}</label>
          <div className="flex gap-1.5">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="input h-8 min-w-0 flex-1 text-sm" placeholder={t("explore.groupNamePlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter") void saveName(); }} />
            <button onClick={() => void saveName()} disabled={busy || name.trim().length < 2 || name.trim() === galaxy.name} className="btn btn-primary h-8 px-2.5 text-xs">{t("common.save")}</button>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted">{t("explore.anyMemberHint")}</p>

      <div className="mt-3 border-t border-line pt-3">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold"><Link2 size={14} /> {t("explore.linksTitle")}</div>
        {links.length === 0 && <p className="text-[12px] text-muted">{t("explore.noLinks")}</p>}
        <ul className="space-y-1.5">
          {links.map((l) => {
            const otherId = l.from === galaxy.id ? l.to : l.from;
            return (
              <li key={l.id} className="flex items-start gap-2 rounded-xl bg-bg/60 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold">{nameOf(otherId)}</div>
                  <div className="text-[12px] text-ink-2">{l.description}</div>
                </div>
                <button onClick={() => unlink.mutate(l.id)} disabled={busy} className="btn btn-ghost h-7 w-7 shrink-0 p-0 text-muted hover:text-rose" title={t("explore.deleteLink")}><Trash2 size={13} /></button>
              </li>
            );
          })}
        </ul>
        {others.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            <select value={toId} onChange={(e) => setToId(e.target.value)} className="input h-8 w-full text-sm">
              {others.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.members}</option>)}
            </select>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={160} rows={2} className="input w-full resize-none text-sm" placeholder={t("explore.linkDescPlaceholder")} />
            <button onClick={() => void addLink()} disabled={busy || desc.trim().length < 2} className="btn btn-primary w-full gap-1.5 py-1.5 text-xs">
              {link.isPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} {t("explore.linkGalaxies")}
            </button>
          </div>
        ) : <p className="mt-2 text-[12px] text-muted">{t("explore.noOtherGalaxies")}</p>}
      </div>
      {err && <p className="mt-2 text-[12px] text-rose">{err}</p>}
    </div>
  );
}
