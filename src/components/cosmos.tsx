"use client";

import { useEffect, useRef } from "react";

/**
 * Космический фон: canvas со звёздами трёх слоёв параллакса, мерцанием, медленным дрейфом,
 * пятью разными планетами (кольца, полосы, кратеры, лёд, луна) и редкими падающими звёздами;
 * под ним — CSS-туманности (см. .nebula в globals.css).
 * Читает тему из data-theme: ночью — белые звёзды на глубоком небе, днём — индиго/бирюзовые
 * искры на светлом фоне. Уважает prefers-reduced-motion и не рисует, когда вкладка скрыта.
 */
type Star = { x: number; y: number; z: number; r: number; tw: number; hue: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number };
type Planet = { fx: number; fy: number; r: number; kind: "ringed" | "banded" | "rocky" | "ice" | "moon"; hue: number; drift: number; spin: number };

/** Планеты: позиции в долях экрана, по краям, чтобы не спорить с контентом. */
const PLANETS: Planet[] = [
  { fx: 0.88, fy: 0.14, r: 78, kind: "ringed", hue: 34, drift: 0.9, spin: 0.15 },
  { fx: 0.07, fy: 0.62, r: 58, kind: "banded", hue: 168, drift: 0.6, spin: 0.35 },
  { fx: 0.3, fy: 0.05, r: 22, kind: "rocky", hue: 20, drift: 1.4, spin: 0.5 },
  { fx: 0.93, fy: 0.72, r: 40, kind: "ice", hue: 205, drift: 0.8, spin: 0.25 },
  { fx: 0.55, fy: 0.92, r: 16, kind: "moon", hue: 250, drift: 1.8, spin: 0.9 },
];

/** Рисует одну планету с объёмной подсветкой слева-сверху. */
function drawPlanet(ctx: CanvasRenderingContext2D, p: Planet, cx: number, cy: number, t: number, dark: boolean) {
  const { r, hue } = p;
  const alpha = dark ? 0.95 : 0.5;
  const sat = dark ? 55 : 45, light = dark ? 48 : 62;
  ctx.save();
  ctx.globalAlpha = alpha;

  // кольца сзади
  if (p.kind === "ringed") {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.35); ctx.scale(1, 0.32);
    const rg = ctx.createRadialGradient(0, 0, r * 1.25, 0, 0, r * 2.3);
    rg.addColorStop(0, `hsla(${hue},60%,75%,0)`); rg.addColorStop(0.25, `hsla(${hue},60%,78%,.75)`); rg.addColorStop(0.55, `hsla(${hue},40%,60%,.35)`); rg.addColorStop(0.75, `hsla(${hue},60%,80%,.6)`); rg.addColorStop(1, `hsla(${hue},60%,75%,0)`);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r * 2.3, Math.PI, Math.PI * 2); ctx.arc(0, 0, r * 1.25, Math.PI * 2, Math.PI, true); ctx.fill();
    ctx.restore();
  }

  // тело
  const g = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.45, r * 0.1, cx, cy, r);
  g.addColorStop(0, `hsl(${hue},${sat}%,${light + 22}%)`); g.addColorStop(0.6, `hsl(${hue},${sat}%,${light}%)`); g.addColorStop(1, `hsl(${hue},${sat + 10}%,${Math.max(light - 34, 8)}%)`);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();

  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (p.kind === "banded" || p.kind === "ringed") {
    // полосы газового гиганта, медленно ползут
    const off = (t * p.spin * 0.02) % (r * 0.5);
    for (let y = -r - r * 0.5; y < r + r * 0.5; y += r * 0.25) {
      const i = Math.round((y + r) / (r * 0.25));
      ctx.fillStyle = i % 2 ? `hsla(${hue + 12},50%,30%,.22)` : `hsla(${hue - 10},60%,85%,.14)`;
      ctx.fillRect(cx - r, cy + y + off, r * 2, r * 0.13);
    }
  }
  if (p.kind === "rocky" || p.kind === "moon") {
    // кратеры
    const seeds = [[-0.35, -0.2, 0.22], [0.3, 0.1, 0.18], [-0.05, 0.45, 0.13], [0.45, -0.4, 0.1], [-0.5, 0.3, 0.09]];
    for (const [sx, sy, sr] of seeds) {
      ctx.beginPath(); ctx.arc(cx + sx * r, cy + sy * r, sr * r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fill();
      ctx.beginPath(); ctx.arc(cx + sx * r - sr * r * 0.2, cy + sy * r - sr * r * 0.2, sr * r * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fill();
    }
  }
  if (p.kind === "ice") {
    // ледяные разводы
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse(cx + Math.sin(i * 2.1 + t * 0.002) * r * 0.5, cy + Math.cos(i * 1.7) * r * 0.5, r * 0.45, r * 0.12, i * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fill();
    }
  }
  // терминатор (тень)
  const sh = ctx.createRadialGradient(cx - r * 0.5, cy - r * 0.5, r * 0.6, cx, cy, r * 1.05);
  sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, dark ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.28)");
  ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  // передняя половина кольца
  if (p.kind === "ringed") {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.35); ctx.scale(1, 0.32);
    const rg = ctx.createRadialGradient(0, 0, r * 1.25, 0, 0, r * 2.3);
    rg.addColorStop(0, `hsla(${hue},60%,75%,0)`); rg.addColorStop(0.25, `hsla(${hue},60%,82%,.85)`); rg.addColorStop(0.55, `hsla(${hue},40%,62%,.4)`); rg.addColorStop(0.75, `hsla(${hue},60%,84%,.7)`); rg.addColorStop(1, `hsla(${hue},60%,75%,0)`);
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r * 2.3, 0, Math.PI); ctx.arc(0, 0, r * 1.25, Math.PI, 0, true); ctx.fill();
    ctx.restore();
  }
  // атмосферное свечение
  const glow = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.35);
  glow.addColorStop(0, `hsla(${hue},70%,70%,${dark ? 0.28 : 0.16})`); glow.addColorStop(1, `hsla(${hue},70%,70%,0)`);
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
  ctx.restore();
}

export function Cosmos() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, t = 0, alive = true;
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let dark = document.documentElement.getAttribute("data-theme") === "dark";

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(260, Math.floor((w * h) / 6500));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h, z: 0.3 + Math.random() * 0.7,
        r: 0.4 + Math.random() * 1.3, tw: Math.random() * Math.PI * 2, hue: Math.random(),
      }));
    };

    const colorFor = (s: Star, a: number) => {
      if (dark) {
        // тёплые/холодные оттенки белого, как у настоящих звёзд
        return s.hue < 0.15 ? `rgba(255,200,140,${a})` : s.hue < 0.3 ? `rgba(160,220,255,${a})` : `rgba(255,255,255,${a})`;
      }
      return s.hue < 0.4 ? `rgba(10,163,154,${a})` : s.hue < 0.7 ? `rgba(92,84,220,${a})` : `rgba(239,154,29,${a})`;
    };

    const draw = () => {
      if (!alive) return;
      t += 1;
      ctx.clearRect(0, 0, w, h);
      const drift = reduced ? 0 : 0.02;
      for (const s of stars) {
        s.x += drift * s.z; if (s.x > w + 2) s.x = -2;
        const tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.03 * s.z + s.tw);
        const alpha = (dark ? 0.35 + 0.65 * tw : 0.25 + 0.45 * tw) * (0.5 + s.z * 0.5);
        const r = s.r * (0.8 + s.z * 0.6);
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fillStyle = colorFor(s, alpha); ctx.fill();
        if (s.z > 0.85 && dark) { // мягкое сияние у ближних звёзд
          ctx.beginPath(); ctx.arc(s.x, s.y, r * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = colorFor(s, alpha * 0.12); ctx.fill();
        }
      }
      // планеты: медленный дрейф по горизонтали + лёгкое покачивание
      const scale = Math.min(1, Math.max(0.55, w / 1400));
      for (const p of PLANETS) {
        const cx = p.fx * w + (reduced ? 0 : Math.sin(t * 0.0009 * p.drift) * 18);
        const cy = p.fy * h + (reduced ? 0 : Math.cos(t * 0.0007 * p.drift) * 10);
        drawPlanet(ctx, { ...p, r: p.r * scale }, cx, cy, t, dark);
      }
      if (!reduced) {
        if (meteors.length < 2 && Math.random() < 0.004) {
          const sx = Math.random() * w * 0.8 + w * 0.1, sy = Math.random() * h * 0.4;
          meteors.push({ x: sx, y: sy, vx: 6 + Math.random() * 5, vy: 3 + Math.random() * 3, life: 0, max: 45 + Math.random() * 30 });
        }
        for (const m of meteors) {
          m.life++; m.x += m.vx; m.y += m.vy;
          const k = 1 - m.life / m.max;
          const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 10, m.y - m.vy * 10);
          const c = dark ? "255,255,255" : "92,84,220";
          grad.addColorStop(0, `rgba(${c},${0.9 * k})`); grad.addColorStop(1, `rgba(${c},0)`);
          ctx.strokeStyle = grad; ctx.lineWidth = 1.6; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 10, m.y - m.vy * 10); ctx.stroke();
        }
        meteors = meteors.filter((m) => m.life < m.max && m.x < w + 50 && m.y < h + 50);
      }
      raf = reduced ? 0 : requestAnimationFrame(draw);
    };

    const start = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => (document.hidden ? stop() : start());
    const mo = new MutationObserver(() => { dark = document.documentElement.getAttribute("data-theme") === "dark"; if (reduced) draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    resize(); draw(); start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; stop(); mo.disconnect(); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return (
    <div className="cosmos" aria-hidden>
      <div className="nebula nebula-a" />
      <div className="nebula nebula-b" />
      <div className="nebula nebula-c" />
      <canvas ref={ref} />
    </div>
  );
}
