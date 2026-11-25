"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import styles from "./beta-splash.module.css";

type BetaSplashProps = {
  skipSplash?: boolean;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  c: number;
  buoy: number;
  seed: number;
};

type Ring = {
  x: number;
  y: number;
  r: number;
  life: number;
};

type WaveDef = {
  el: SVGPathElement;
  amp: number;
  spd: number;
  ph: number;
  pts: [number, number][];
  grp: number[];
};

const COLORS = [
  "#ffa64f",
  "#ff7a3d",
  "#ff3f3a",
  "#9a88fb",
  "#7c5cff",
  "#e9e3ff",
];

const EXIT_DURATION_MS = 500;

const subscribeNoop = () => () => {};
const getTwoFactorFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const cb = params.get("callbackUrl") ?? "";
  return (
    params.get("twoFactorRedirect") === "true" ||
    cb.includes("twoFactorRedirect=true")
  );
};
const getTwoFactorServer = () => false;

export function BetaSplash({ skipSplash = false }: BetaSplashProps) {
  const t = useTranslations("Auth.betaSplash");
  const hasTwoFactorQuery = React.useSyncExternalStore(
    subscribeNoop,
    getTwoFactorFromUrl,
    getTwoFactorServer,
  );
  const [phase, setPhase] = React.useState<"visible" | "exiting" | "gone">(
    skipSplash ? "gone" : "visible",
  );
  const effectivePhase = hasTwoFactorQuery ? "gone" : phase;
  const isMounted = effectivePhase !== "gone";
  const [controlsReady, setControlsReady] = React.useState(false);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const anchorTLRef = React.useRef<SVGGElement>(null);
  const anchorBR1Ref = React.useRef<SVGGElement>(null);
  const anchorBR2Ref = React.useRef<SVGGElement>(null);
  const pxGlowARef = React.useRef<SVGGElement>(null);
  const pxGlowBRef = React.useRef<SVGGElement>(null);
  const pxWavesRef = React.useRef<SVGGElement>(null);
  const pxLogoRef = React.useRef<SVGGElement>(null);
  const flameWrapRef = React.useRef<SVGGElement>(null);
  const flickerMapRef = React.useRef<SVGFEDisplacementMapElement>(null);
  const spotRef = React.useRef<SVGCircleElement>(null);
  const wave1Ref = React.useRef<SVGPathElement>(null);
  const wave2Ref = React.useRef<SVGPathElement>(null);
  const wave3Ref = React.useRef<SVGPathElement>(null);
  const wmPathRef = React.useRef<SVGPathElement>(null);
  const ctaRef = React.useRef<HTMLButtonElement>(null);
  const burstRef = React.useRef<((x: number, y: number, n?: number, power?: number) => void) | null>(null);
  const exitTimerRef = React.useRef<number | null>(null);

  // Lock page scroll while the splash is covering the viewport.
  React.useEffect(() => {
    if (effectivePhase !== "visible") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [effectivePhase]);

  // Main interactive SVG + canvas animation loop.
  React.useEffect(() => {
    if (!isMounted) return;

    const svg = svgRef.current;
    const canvas = canvasRef.current;
    const flameWrap = flameWrapRef.current;
    const flickerMap = flickerMapRef.current;
    const spot = spotRef.current;
    const anchorTL = anchorTLRef.current;
    const anchorBR1 = anchorBR1Ref.current;
    const anchorBR2 = anchorBR2Ref.current;
    const pxGlowA = pxGlowARef.current;
    const pxGlowB = pxGlowBRef.current;
    const pxWaves = pxWavesRef.current;
    const pxLogo = pxLogoRef.current;
    const wave1 = wave1Ref.current;
    const wave2 = wave2Ref.current;
    const wave3 = wave3Ref.current;
    const wmPath = wmPathRef.current;

    if (
      !svg ||
      !canvas ||
      !flameWrap ||
      !flickerMap ||
      !spot ||
      !anchorTL ||
      !anchorBR1 ||
      !anchorBR2 ||
      !pxGlowA ||
      !pxGlowB ||
      !pxWaves ||
      !pxLogo ||
      !wave1 ||
      !wave2 ||
      !wave3 ||
      !wmPath
    ) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let dpr = 1;
    let br = { x: 0, y: 0 };

    const layout = () => {
      const a = window.innerWidth / window.innerHeight;
      let w: number;
      let h: number;
      if (a >= 16 / 9) {
        w = 1920;
        h = w / a;
      } else {
        h = 1080;
        w = h * a;
        if (w < 860) {
          w = 860;
          h = w / a;
        }
      }
      const x = 960 - w / 2;
      const y = 540 - h / 2;
      svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
      anchorTL.setAttribute("transform", `translate(${x} ${y})`);
      br = { x: x + w - 1920, y: y + h - 1080 };
      const brTransform = `translate(${br.x} ${br.y})`;
      anchorBR1.setAttribute("transform", brTransform);
      anchorBR2.setAttribute("transform", brTransform);

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    layout();
    window.addEventListener("resize", layout);

    const pt = svg.createSVGPoint();
    const toScreen = (x: number, y: number, el: SVGGraphicsElement = svg) => {
      const ctm = el.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      pt.x = x;
      pt.y = y;
      const p = pt.matrixTransform(ctm);
      return { x: p.x, y: p.y };
    };

    const toSvg = (x: number, y: number) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 960, y: 540 };
      pt.x = x;
      pt.y = y;
      try {
        const p = pt.matrixTransform(ctm.inverse());
        return { x: p.x, y: p.y };
      } catch {
        return { x: 960, y: 540 };
      }
    };

    /* ---------- Live Waves ---------- */
    const waves: WaveDef[] = [
      {
        el: wave1,
        amp: 20,
        spd: 0.55,
        ph: 0.0,
        pts: [
          [1180, 1100],
          [1379.045, 1075],
          [1487.615, 937.5],
          [1650.47, 875],
          [1777.135, 825],
          [1867.61, 806.25],
          [1939.99, 750],
        ],
        grp: [0, 0, 1, 1, 1, 2, 2],
      },
      {
        el: wave2,
        amp: 16,
        spd: 0.7,
        ph: 1.7,
        pts: [
          [1270.475, 1100],
          [1451.425, 1070],
          [1559.995, 975],
          [1704.755, 945],
          [1804.277, 925],
          [1885.705, 912.5],
          [1939.99, 875],
        ],
        grp: [0, 0, 1, 1, 1, 2, 2],
      },
      {
        el: wave3,
        amp: 11,
        spd: 0.9,
        ph: 3.1,
        pts: [
          [1415.235, 1100],
          [1578.09, 1070],
          [1722.85, 1035],
          [1939.99, 1007.5],
        ],
        grp: [0, 0, 1, 1],
      },
    ];

    let waveBoost = 0;
    const drawWaves = (t: number, intro: number) => {
      const lift = (1 - intro) * 480;
      for (const w of waves) {
        const anchors = w.pts.filter((_, i) => i % 3 === 0);
        const off = anchors.map((a, i) =>
          i === 0
            ? 0
            : w.amp *
              (1 + waveBoost * 2.2) *
              (Math.sin(t * w.spd + w.ph + a[0] * 0.004) +
                0.4 * Math.sin(t * w.spd * 1.9 + i)),
        );
        const p = w.pts.map(([x, y], i) => [x, y + (off[w.grp[i]!] ?? 0) + lift]);
        let d = `M${p[0]![0]} ${p[0]![1]}`;
        for (let i = 1; i < p.length; i += 3) {
          d += ` C${p[i]![0]} ${p[i]![1]} ${p[i + 1]![0]} ${p[i + 1]![1]} ${p[i + 2]![0]} ${p[i + 2]![1]}`;
        }
        const last = p[p.length - 1]!;
        d += ` L2100 ${last[1]! - 40} L2100 1400 L${p[0]![0]! - 50} 1400 Z`;
        w.el.setAttribute("d", d);
      }
    };

    /* ---------- Ember Particles ---------- */
    const sprites = COLORS.map((c) => {
      const s = document.createElement("canvas");
      s.width = 64;
      s.height = 64;
      const g = s.getContext("2d");
      if (g) {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, "#fff");
        gr.addColorStop(0.15, c);
        gr.addColorStop(0.45, `${c}55`);
        gr.addColorStop(1, `${c}00`);
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
      }
      return s;
    });

    const parts: Particle[] = [];
    const rings: Ring[] = [];
    const MAX = 700;

    const spawn = (
      x: number,
      y: number,
      o: Partial<{
        angle: number;
        speed: number;
        vx: number;
        vy: number;
        max: number;
        size: number;
        c: number;
        buoy: number;
      }> = {},
    ) => {
      if (parts.length > MAX) return;
      const a = o.angle ?? Math.random() * Math.PI * 2;
      const s = o.speed ?? Math.random();
      parts.push({
        x,
        y,
        vx: Math.cos(a) * s + (o.vx || 0),
        vy: Math.sin(a) * s + (o.vy || 0),
        life: 0,
        max: o.max ?? 80 + Math.random() * 120,
        size: o.size ?? 4 + Math.random() * 10,
        c: o.c ?? ((Math.random() * COLORS.length) | 0),
        buoy: o.buoy ?? 0.015 + Math.random() * 0.02,
        seed: Math.random() * 100,
      });
    };

    const burst = (x: number, y: number, n = 70, power = 7) => {
      for (let i = 0; i < n; i++) {
        spawn(x, y, {
          speed: 1 + Math.random() * power,
          size: 6 + Math.random() * 14,
          max: 60 + Math.random() * 90,
        });
      }
      rings.push({ x, y, r: 0, life: 1 });
    };
    burstRef.current = burst;

    /* ---------- Pointer & Flame Interaction ---------- */
    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      nx: 0,
      ny: 0,
      sx: 0,
      sy: 0,
      active: false,
      last: null as { x: number; y: number } | null,
    };
    let hover = false;
    let flicker = 3;
    let spotOp = 0;
    let flareTimer: number | null = null;

    const onPointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ny = (e.clientY / window.innerHeight) * 2 - 1;
      if (!reduced && mouse.last) {
        const dx = e.clientX - mouse.last.x;
        const dy = e.clientY - mouse.last.y;
        const dist = Math.hypot(dx, dy);
        for (let i = 0; i < Math.min(dist / 14, 4); i++) {
          spawn(e.clientX, e.clientY, {
            speed: 0.4,
            vx: dx * 0.03,
            vy: dy * 0.03,
            size: 3 + Math.random() * 6,
            max: 40 + Math.random() * 40,
          });
        }
      }
      mouse.last = { x: e.clientX, y: e.clientY };
    };

    const onPointerLeave = () => {
      mouse.active = false;
      mouse.last = null;
    };

    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        mouse.active = false;
        mouse.last = null;
      }
    };

    const onFlameEnter = () => {
      hover = true;
      flameWrap.classList.add(styles.hover);
    };

    const onFlameLeave = () => {
      hover = false;
      flameWrap.classList.remove(styles.hover);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (reduced) return;
      const target = e.target as Node | null;
      if (ctaRef.current?.contains(target)) return;
      const onFlame = target ? flameWrap.contains(target) : false;
      burst(e.clientX, e.clientY, onFlame ? 140 : 70, onFlame ? 10 : 7);
      waveBoost = Math.min(waveBoost + (onFlame ? 1.2 : 0.7), 1.6);
      if (onFlame) {
        flameWrap.classList.remove(styles.flare);
        void flameWrap.getBBox();
        flameWrap.classList.add(styles.flare);
        if (flareTimer !== null) window.clearTimeout(flareTimer);
        flareTimer = window.setTimeout(
          () => flameWrap.classList.remove(styles.flare),
          750,
        );
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("mouseout", onMouseOut);
    flameWrap.addEventListener("pointerenter", onFlameEnter);
    flameWrap.addEventListener("pointerleave", onFlameLeave);
    window.addEventListener("pointerdown", onPointerDown);

    /* ---------- Align Primary CTA to Wordmark ---------- */
    const alignOverlayControls = () => {
      const cta = ctaRef.current;
      if (!cta) return;

      if (window.innerWidth <= 480) {
        if (cta.classList.contains(styles.aligned)) {
          cta.classList.remove(styles.aligned);
          cta.style.left = "";
          cta.style.top = "";
        }
        return;
      }

      const r = wmPath.getBoundingClientRect();
      if (!r.width) return;

      cta.classList.add(styles.aligned);
      cta.style.left = `${Math.round(r.left)}px`;
      cta.style.top = `${Math.round(r.bottom + Math.max(26, r.height * 0.52))}px`;
    };

    /* ---------- Animation Frame Loop ---------- */
    const introStart = performance.now();
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 4);
    let rafId = 0;

    const frame = (now: number) => {
      const t = now / 1000;
      const since = now - introStart;
      const intro = reduced
        ? 1
        : easeOut(Math.min(Math.max((since - 300) / 2000, 0), 1));

      // Smoothed parallax
      mouse.sx += (mouse.nx - mouse.sx) * 0.05;
      mouse.sy += (mouse.ny - mouse.sy) * 0.05;
      const setParallax = (el: SVGGElement, k: number) =>
        el.setAttribute(
          "transform",
          `translate(${(mouse.sx * k).toFixed(2)} ${(mouse.sy * k).toFixed(2)})`,
        );
      setParallax(pxGlowA, -60);
      setParallax(pxGlowB, 50);
      setParallax(pxWaves, 28);
      setParallax(pxLogo, -14);

      // Cursor light
      spotOp += ((mouse.active ? 1 : 0) - spotOp) * 0.05;
      const sp = toSvg(mouse.x, mouse.y);
      spot.setAttribute("cx", sp.x.toFixed(1));
      spot.setAttribute("cy", sp.y.toFixed(1));
      spot.setAttribute("opacity", spotOp.toFixed(3));

      // Waves
      waveBoost *= 0.975;
      drawWaves(reduced ? 0 : t, intro);

      // Flame flicker
      const targetFlicker = reduced ? 0 : (hover ? 9 : 3) + waveBoost * 6;
      flicker += (targetFlicker - flicker) * 0.08;
      flickerMap.setAttribute("scale", flicker.toFixed(2));

      // Ambient emission
      if (!reduced && since > 1200) {
        if (Math.random() < 0.35) {
          const wx = 1250 + Math.random() * 700;
          const wy = 930 + Math.random() * 150;
          const s = toScreen(
            wx + br.x + mouse.sx * 28,
            wy + br.y + mouse.sy * 28,
          );
          spawn(s.x, s.y, {
            angle: -Math.PI / 2 - 0.3 + Math.random() * 0.2,
            speed: 0.3 + Math.random() * 0.6,
            size: 3 + Math.random() * 7,
            max: 160 + Math.random() * 160,
            buoy: 0.006,
          });
        }
        if (Math.random() < (hover ? 0.6 : 0.08)) {
          const tip: [number, number] =
            Math.random() < 0.6 ? [770, 410] : [758, 505];
          const s = toScreen(
            tip[0] + (Math.random() - 0.5) * 12,
            tip[1],
            pxLogo,
          );
          spawn(s.x, s.y, {
            angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.8,
            speed: 0.6 + Math.random() * (hover ? 2.2 : 1),
            size: 3 + Math.random() * 7,
            c: Math.random() < 0.75 ? (Math.random() * 3) | 0 : 3,
            max: 60 + Math.random() * 80,
          });
        }
      }

      // Draw particles
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.life++;
        if (p.life >= p.max) {
          parts.splice(i, 1);
          continue;
        }
        p.vx += Math.sin(now * 0.002 + p.seed) * 0.02;
        p.vy -= p.buoy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x += p.vx;
        p.y += p.vy;
        const k = p.life / p.max;
        const alpha = Math.min(1, p.life / 8) * (1 - k);
        const size = p.size * (1 - k * 0.6);
        ctx.globalAlpha = alpha;
        const sprite = sprites[p.c];
        if (sprite) {
          ctx.drawImage(sprite, p.x - size, p.y - size, size * 2, size * 2);
        }
      }

      // Draw shockwave rings
      ctx.globalCompositeOperation = "source-over";
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]!;
        r.r += (220 - r.r) * 0.08;
        r.life -= 0.022;
        if (r.life <= 0) {
          rings.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = r.life * 0.6;
        ctx.strokeStyle = "#ff7a3d";
        ctx.lineWidth = 2 * r.life + 0.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = r.life * 0.35;
        ctx.strokeStyle = "#9a88fb";
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      alignOverlayControls();
      rafId = window.requestAnimationFrame(frame);
    };

    const controlsTimer = window.setTimeout(
      () => setControlsReady(true),
      reduced ? 220 : 2100,
    );

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(controlsTimer);
      if (flareTimer !== null) window.clearTimeout(flareTimer);
      window.removeEventListener("resize", layout);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("mouseout", onMouseOut);
      flameWrap.removeEventListener("pointerenter", onFlameEnter);
      flameWrap.removeEventListener("pointerleave", onFlameLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      burstRef.current = null;
    };
  }, [isMounted]);

  React.useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const handleEnter = React.useCallback(() => {
    if (effectivePhase !== "visible") return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduced && ctaRef.current && burstRef.current) {
      const r = ctaRef.current.getBoundingClientRect();
      burstRef.current(r.left + r.width / 2, r.top + r.height / 2, 48, 6);
    }
    setPhase("exiting");
    exitTimerRef.current = window.setTimeout(
      () => setPhase("gone"),
      reduced ? 20 : EXIT_DURATION_MS,
    );
  }, [effectivePhase]);

  if (effectivePhase === "gone") return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("stageLabel")}
      className={`${styles.root} ${styles.play}${effectivePhase === "exiting" ? ` ${styles.exiting}` : ""}`}
    >
      <svg
        ref={svgRef}
        className={styles.stage}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t("stageLabel")}
        focusable="false"
      >
        <defs>
          <radialGradient
            id="bs-radial-1"
            cx="0"
            cy="0"
            r="641.587"
            gradientTransform="matrix(1 0 0 0.931 1766.967 1053.75)"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#7c5cff" stopOpacity="0.19" />
            <stop offset="1" stopColor="#7c5cff" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="bs-radial-2"
            cx="0"
            cy="0"
            r="637.189"
            gradientTransform="matrix(1 0 0 0.951 125.974 83.803)"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#ff6b3d" stopOpacity="0.09" />
            <stop offset="1" stopColor="#ff6b3d" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id="bs-linear-1"
            x1="1180"
            y1="750"
            x2="1445.964"
            y2="1327.515"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#7c5cff" />
            <stop offset="1" stopColor="#3a2edb" />
          </linearGradient>
          <linearGradient
            id="bs-linear-2"
            x1="1270.475"
            y1="1100"
            x2="1406.357"
            y2="695.665"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#ff3f3a" />
            <stop offset="1" stopColor="#ffa64f" />
          </linearGradient>
          <linearGradient
            id="bs-linear-3"
            x1="1415.235"
            y1="1007.5"
            x2="1939.99"
            y2="1007.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#a78bfa" stopOpacity="0.85" />
            <stop offset="1" stopColor="#e9e3ff" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient
            id="bs-linear-4"
            x1="771.038"
            y1="407.88"
            x2="634.261"
            y2="544.657"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#ffa64f" />
            <stop offset="0.5" stopColor="#ff7a3d" />
            <stop offset="1" stopColor="#ff3f3a" />
          </linearGradient>
          <linearGradient
            id="bs-linear-5"
            x1="760.24"
            y1="505.064"
            x2="641.46"
            y2="613.046"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#9a88fb" />
            <stop offset="0.5" stopColor="#5e54f0" />
            <stop offset="1" stopColor="#3a2edb" />
          </linearGradient>
          <linearGradient
            id="bs-linear-6"
            x1="684.653"
            y1="586.05"
            x2="645.059"
            y2="620.245"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#2a1fb8" stopOpacity="0" />
            <stop offset="1" stopColor="#2a1fb8" stopOpacity="0.55" />
          </linearGradient>

          <radialGradient id="bs-logo-glow">
            <stop offset="0" stopColor="#ff7a3d" stopOpacity="0.22" />
            <stop offset="0.5" stopColor="#7c5cff" stopOpacity="0.08" />
            <stop offset="1" stopColor="#7c5cff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bs-spot-grad">
            <stop offset="0" stopColor="#7c5cff" stopOpacity="0.10" />
            <stop offset="1" stopColor="#7c5cff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bs-reveal-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.85" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <linearGradient id="bs-shine-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffa64f" stopOpacity="0" />
            <stop offset="0.45" stopColor="#ffa64f" stopOpacity="0.9" />
            <stop offset="0.55" stopColor="#ff7a3d" stopOpacity="0.9" />
            <stop offset="1" stopColor="#9a88fb" stopOpacity="0" />
          </linearGradient>

          <mask
            id="bs-reveal-mask"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1920"
            height="1080"
          >
            <rect
              className={styles.revealRect}
              x="-800"
              y="440"
              width="1600"
              height="160"
              fill="url(#bs-reveal-grad)"
            />
          </mask>
          <clipPath id="bs-wm-clip">
            <use href="#bs-wm-path" />
          </clipPath>

          <filter id="bs-flicker" x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.035"
              numOctaves={2}
              seed={7}
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="3.2s"
                repeatCount="indefinite"
                values="0.012 0.035; 0.017 0.05; 0.011 0.03; 0.012 0.035"
              />
            </feTurbulence>
            <feDisplacementMap
              ref={flickerMapRef}
              in="SourceGraphic"
              in2="noise"
              scale={3}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>

        {/* Background */}
        <rect x="-4000" y="-4000" width="10000" height="10000" fill="#0b1220" />

        {/* Top-left ambient glow */}
        <g ref={anchorTLRef}>
          <g ref={pxGlowARef}>
            <g className={styles.glowA}>
              <path
                d="M763.162 83.803 C763.162 244.475 696.03 398.566 576.534 512.178 C457.038 625.79 294.967 689.616 125.974 689.616 C-43.019 689.616 -205.091 625.79 -324.587 512.178 C-444.083 398.566 -511.215 244.475 -511.215 83.803 C-511.215 -76.869 -444.083 -230.96 -324.587 -344.572 C-205.091 -458.184 -43.019 -522.01 125.974 -522.01 C294.967 -522.01 457.038 -458.184 576.534 -344.572 C696.03 -230.96 763.162 -76.869 763.162 83.803 Z"
                fill="url(#bs-radial-2)"
              />
            </g>
          </g>
        </g>

        {/* Bottom-right ambient glow */}
        <g ref={anchorBR1Ref}>
          <g ref={pxGlowBRef}>
            <g className={styles.glowB}>
              <path
                d="M2408.554 1053.75 C2408.554 1212.217 2340.958 1364.193 2220.637 1476.246 C2100.317 1588.299 1937.126 1651.25 1766.967 1651.25 C1596.807 1651.25 1433.617 1588.299 1313.296 1476.246 C1192.975 1364.193 1125.38 1212.217 1125.38 1053.75 C1125.38 895.283 1192.975 743.307 1313.296 631.254 C1433.617 519.201 1596.807 456.25 1766.967 456.25 C1937.126 456.25 2100.317 519.201 2220.637 631.254 C2340.958 743.307 2408.554 895.283 2408.554 1053.75 Z"
                fill="url(#bs-radial-1)"
              />
            </g>
          </g>
        </g>

        {/* Cursor spotlight */}
        <circle
          ref={spotRef}
          cx="960"
          cy="540"
          r="520"
          fill="url(#bs-spot-grad)"
          opacity="0"
        />

        {/* Animated brand waves */}
        <g ref={anchorBR2Ref}>
          <g ref={pxWavesRef} opacity="0.95">
            <path ref={wave1Ref} fill="url(#bs-linear-1)" />
            <path ref={wave2Ref} fill="url(#bs-linear-2)" fillOpacity="0.92" />
            <path ref={wave3Ref} fill="url(#bs-linear-3)" />
          </g>
        </g>

        {/* Firecent logo */}
        <g ref={pxLogoRef}>
          <circle
            className={styles.logoGlow}
            cx="705"
            cy="520"
            r="260"
            fill="url(#bs-logo-glow)"
          />

          <g ref={flameWrapRef} className={styles.flameWrap}>
            <g filter="url(#bs-flicker)">
              <path
                className={styles.flameTop}
                d="M770.318 405 C775.358 405 780.037 429.476 777.157 451.073 C773.918 479.868 742.243 497.865 706.249 508.663 C681.053 515.862 659.457 519.461 645.059 533.859 C639.66 539.258 634.261 544.657 632.101 548.257 C629.222 548.257 629.942 541.058 630.662 533.859 C632.461 505.064 645.059 479.868 677.454 463.671 C709.848 449.273 742.243 440.275 760.24 418.678 C765.639 412.199 767.439 405 770.318 405 Z"
                fill="url(#bs-linear-4)"
              />
              <g className={styles.flameBottom}>
                <path
                  d="M761.32 501.464 C764.559 502.184 763.839 519.461 756.641 537.458 C747.642 559.055 717.047 573.452 685.732 584.251 C675.654 589.65 672.055 600.448 666.656 614.845 C662.336 625.644 657.657 634.642 652.258 635.002 C641.46 632.842 630.662 609.446 631.022 587.85 C631.382 562.654 645.059 544.657 670.255 533.859 C695.451 524.86 731.445 517.662 756.641 502.184 C758.44 501.104 760.24 501.104 761.32 501.464 Z"
                  fill="url(#bs-linear-5)"
                />
                <path
                  d="M640.74 605.847 C646.859 593.249 664.856 587.13 685.732 584.251 C675.654 589.65 672.055 600.448 666.656 614.845 C662.336 625.644 657.657 634.642 652.258 635.002 C645.059 633.202 638.58 620.245 640.74 605.847 Z"
                  fill="url(#bs-linear-6)"
                />
              </g>
            </g>
          </g>

          <g mask="url(#bs-reveal-mask)">
            <g className={styles.wordmark}>
              <path
                ref={wmPathRef}
                id="bs-wm-path"
                fill="#ffffff"
                d="M862.43 502.919 L862.43 518.049 L848.28 518.049 L848.28 572.099 L829.02 572.099 L829.02 518.049 L816.5 518.049 L816.5 502.919 L829.02 502.919 L829.02 493.939 C829.02 480.965 836.51 474.479 851.49 474.479 L862.43 474.479 L862.43 489.619 L855.87 489.619 C853.076 489.619 851.113 490.195 849.98 491.349 C848.846 492.509 848.28 494.465 848.28 497.219 L848.28 502.919 Z M869.85 572.099 L869.85 502.919 L889.17 502.919 L889.17 572.099 Z M879.48 494.199 C876.293 494.199 873.65 493.229 871.55 491.289 C869.456 489.342 868.41 486.885 868.41 483.919 C868.41 480.945 869.456 478.489 871.55 476.549 C873.65 474.602 876.293 473.629 879.48 473.629 C882.62 473.629 885.24 474.602 887.34 476.549 C889.433 478.489 890.48 480.945 890.48 483.919 C890.48 486.885 889.433 489.342 887.34 491.289 C885.24 493.229 882.62 494.199 879.48 494.199 Z M900.79 572.099 L900.79 502.919 L919.39 502.919 L919.39 514.709 L919.59 514.709 C920.857 510.555 922.843 507.475 925.55 505.469 C928.256 503.462 931.903 502.459 936.49 502.459 C937.623 502.459 938.66 502.479 939.6 502.519 C940.54 502.565 941.403 502.589 942.19 502.589 L942.19 519.029 C941.49 518.989 940.333 518.925 938.72 518.839 C937.1 518.745 935.483 518.699 933.87 518.699 C929.896 518.699 926.61 520.055 924.01 522.769 C921.41 525.475 920.11 529.425 920.11 534.619 L920.11 572.099 Z M979.81 573.669 C972.823 573.669 966.743 572.119 961.57 569.019 C956.39 565.919 952.37 561.649 949.51 556.209 C946.65 550.769 945.22 544.555 945.22 537.569 C945.22 530.535 946.673 524.292 949.58 518.839 C952.48 513.379 956.486 509.099 961.6 505.999 C966.707 502.892 972.56 501.339 979.16 501.339 C985.973 501.339 991.923 502.859 997.01 505.899 C1002.097 508.932 1006.07 513.145 1008.93 518.539 C1011.79 523.932 1013.22 530.145 1013.22 537.179 L1013.22 542.349 L964.02 542.349 C964.2 547.462 965.706 551.545 968.54 554.599 C971.38 557.659 975.333 559.189 980.4 559.189 C984.16 559.189 987.293 558.382 989.8 556.769 C992.313 555.149 994.007 553.009 994.88 550.349 L1012.5 550.349 C1011.673 554.929 1009.73 558.969 1006.67 562.469 C1003.617 565.962 999.773 568.702 995.14 570.689 C990.513 572.675 985.403 573.669 979.81 573.669 Z M964.15 530.039 L995.01 530.039 C994.53 525.712 992.923 522.295 990.19 519.789 C987.463 517.275 983.916 516.019 979.55 516.019 C975.223 516.019 971.707 517.275 969 519.789 C966.293 522.295 964.677 525.712 964.15 530.039 Z M1053.27 573.669 C1046.323 573.669 1040.253 572.152 1035.06 569.119 C1029.86 566.079 1025.806 561.842 1022.9 556.409 C1020 550.969 1018.55 544.689 1018.55 537.569 C1018.55 530.409 1020 524.109 1022.9 518.669 C1025.806 513.235 1029.86 508.989 1035.06 505.929 C1040.253 502.869 1046.323 501.339 1053.27 501.339 C1059.337 501.339 1064.74 502.509 1069.48 504.849 C1074.22 507.182 1078.02 510.412 1080.88 514.539 C1083.74 518.672 1085.366 523.422 1085.76 528.789 L1067.09 528.789 C1066.563 525.255 1065.133 522.395 1062.8 520.209 C1060.46 518.029 1057.37 516.939 1053.53 516.939 C1048.683 516.939 1044.883 518.792 1042.13 522.499 C1039.376 526.212 1038 531.235 1038 537.569 C1038 543.862 1039.376 548.852 1042.13 552.539 C1044.883 556.232 1048.683 558.079 1053.53 558.079 C1057.417 558.079 1060.473 556.985 1062.7 554.799 C1064.926 552.619 1066.346 549.715 1066.96 546.089 L1085.76 546.089 C1085.5 551.415 1083.95 556.152 1081.11 560.299 C1078.27 564.452 1074.46 567.719 1069.68 570.099 C1064.893 572.479 1059.423 573.669 1053.27 573.669 Z M1125.61 573.669 C1118.623 573.669 1112.543 572.119 1107.37 569.019 C1102.19 565.919 1098.17 561.649 1095.31 556.209 C1092.45 550.769 1091.02 544.555 1091.02 537.569 C1091.02 530.535 1092.473 524.292 1095.38 518.839 C1098.28 513.379 1102.287 509.099 1107.4 505.999 C1112.506 502.892 1118.36 501.339 1124.96 501.339 C1131.767 501.339 1137.716 502.859 1142.81 505.899 C1147.897 508.932 1151.87 513.145 1154.73 518.539 C1157.59 523.932 1159.02 530.145 1159.02 537.179 L1159.02 542.349 L1109.82 542.349 C1109.993 547.462 1111.5 551.545 1114.34 554.599 C1117.18 557.659 1121.133 559.189 1126.2 559.189 C1129.953 559.189 1133.087 558.382 1135.6 556.769 C1138.113 555.149 1139.807 553.009 1140.68 550.349 L1158.3 550.349 C1157.473 554.929 1155.53 558.969 1152.47 562.469 C1149.41 565.962 1145.566 568.702 1140.94 570.689 C1136.313 572.675 1131.203 573.669 1125.61 573.669 Z M1109.95 530.039 L1140.81 530.039 C1140.33 525.712 1138.723 522.295 1135.99 519.789 C1133.263 517.275 1129.716 516.019 1125.35 516.019 C1121.023 516.019 1117.507 517.275 1114.8 519.789 C1112.093 522.295 1110.477 525.712 1109.95 530.039 Z M1186.68 533.639 L1186.68 572.099 L1167.36 572.099 L1167.36 502.919 L1186.36 502.919 L1186.36 513.789 C1188.713 509.855 1191.66 506.819 1195.2 504.679 C1198.74 502.539 1203 501.469 1207.98 501.469 C1215.313 501.469 1221.187 503.839 1225.6 508.579 C1230.013 513.319 1232.22 520.055 1232.22 528.789 L1232.22 572.099 L1212.95 572.099 L1212.95 532.329 C1212.95 527.702 1211.837 524.175 1209.61 521.749 C1207.383 519.322 1204.263 518.109 1200.25 518.109 C1196.27 518.109 1193.013 519.355 1190.48 521.849 C1187.947 524.335 1186.68 528.265 1186.68 533.639 Z M1283.66 502.919 L1283.66 518.049 L1269.51 518.049 L1269.51 550.739 C1269.51 553.099 1269.98 554.725 1270.92 555.619 C1271.86 556.512 1273.64 556.959 1276.26 556.959 L1283.66 556.959 L1283.66 572.099 L1272.39 572.099 C1264.79 572.099 1259.19 570.612 1255.59 567.639 C1251.983 564.672 1250.18 560.042 1250.18 553.749 L1250.18 518.049 L1238.26 518.049 L1238.26 502.919 L1250.18 502.919 L1250.18 484.049 L1269.51 484.049 L1269.51 502.919 Z"
              />
              <g clipPath="url(#bs-wm-clip)">
                <rect
                  className={styles.shine}
                  x="0"
                  y="460"
                  width="260"
                  height="130"
                  fill="url(#bs-shine-grad)"
                />
              </g>
              {/* Superscript Beta version tag integrated into the wordmark lockup */}
              <g aria-hidden="true">
                <rect
                  x="1296"
                  y="476"
                  width="66"
                  height="26"
                  rx="6"
                  fill="rgba(124, 92, 255, 0.14)"
                  stroke="rgba(167, 139, 250, 0.35)"
                  strokeWidth="1.2"
                />
                <text
                  x="1329"
                  y="493.5"
                  textAnchor="middle"
                  fill="#d8ccff"
                  fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                  fontSize="12.5"
                  fontWeight="600"
                  letterSpacing="2.2"
                >
                  {t("badge").toUpperCase()}
                </text>
              </g>
            </g>
          </g>
        </g>
      </svg>

      <canvas ref={canvasRef} className={styles.fx} />
      <div className={styles.vignette} />

      <button
        ref={ctaRef}
        type="button"
        onClick={handleEnter}
        onPointerDown={(e) => e.stopPropagation()}
        className={`${styles.cta}${controlsReady ? ` ${styles.show}` : ""}`}
      >
        <span>{t("enterButton")}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
