"use client";

import { useEffect, useRef } from "react";

/**
 * Космический фон: canvas со звёздами трёх слоёв параллакса, мерцанием, медленным дрейфом
 * и редкими падающими звёздами; под ним — CSS-туманности (см. .nebula в globals.css).
 * Читает тему из data-theme: ночью — белые звёзды на глубоком небе, днём — индиго/бирюзовые
 * искры на светлом фоне. Уважает prefers-reduced-motion и не рисует, когда вкладка скрыта.
 */
type Star = { x: number; y: number; z: number; r: number; tw: number; hue: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number };

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
