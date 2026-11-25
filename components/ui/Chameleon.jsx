"use client";

import { useEffect, useRef } from "react";
import { PET_STATES } from "@/lib/chameleon";
import { PetAura, PetBack, PetBackground, PetBody, PetEyes, PetFeet, PetHead, PetNeck, PetWaist } from "@/components/ui/petParts";

// Oscurece (p < 0) o aclara (p > 0) un color #RRGGBB
function shade(hex, p) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p)));
  return "#" + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const TAIL_UP = "M60 100 C30 108 18 80 33 68 C46 58 62 72 52 82 C46 88 39 81 44 77";
const TAIL_DOWN = "M60 100 C36 110 20 98 22 84 C24 72 38 70 42 78 C45 84 38 88 35 84";

// Camaleón compañero (de lado, sobre su rama). mood: 1 Estresado · 2 Cansado · 3 Normal · 4 Bien · 5 Con toda.
// El color sale del estado. sleeping = todavía no hizo el check-in (gris, dormido).
// animate: el ojo mira por su cuenta y parpadea, respira, mueve la cola; con "Con toda" saca la lengua.
// level (logros de la comunidad): 0 rama · 1 con hojas · 2 en flor · 3 rama dorada
// party = celebración: el camaleón (sin la rama) salta, da una vuelta hacia atrás, cae en su rama y baila
// outfit = { head, eyes, body, neck, waist, back, feet, aura, bg } (lo que tiene puesto). scene = dibujar su fondo.
export function Chameleon({ mood = 3, sleeping = false, animate = true, size = 160, className = "", title, level = 0, party = false, outfit = null, scene = false }) {
  const o = outfit || {};
  const k = sleeping ? 2 : PET_STATES[mood] ? mood : 3;
  const c = sleeping ? "#7D8580" : PET_STATES[k].color;
  const d = shade(c, -0.35);
  const l = shade(c, 0.45);
  const down = k <= 2 ? 5 : 0;
  const [bx, by] = k === 5 ? [153, 66] : k <= 2 ? [151, 74] : [155, 70];
  const pupilRef = useRef(null);
  const lidRef = useRef(null);

  // Ojo que mira por su cuenta + parpadeo (respeta "reducir movimiento")
  useEffect(() => {
    if (!animate || sleeping) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf;
    const s = { x: 0, y: 0, tx: 0, ty: 0, next: 0, blinkAt: performance.now() + 1500 + Math.random() * 2500 };
    const tick = (t) => {
      if (t > s.next) {
        const a = Math.random() * Math.PI * 2;
        const r = (k === 2 ? 1.5 : 4) * (0.4 + Math.random() * 0.6);
        if (k === 5 && Math.random() < 0.5) { s.tx = 2; s.ty = -1; } else { s.tx = Math.cos(a) * r; s.ty = Math.sin(a) * r * 0.8; }
        s.next = t + (k === 1 ? 250 + Math.random() * 450 : k === 2 ? 1600 + Math.random() * 2400 : 700 + Math.random() * 1800);
      }
      const sp = k === 1 ? 0.25 : k === 2 ? 0.05 : 0.12;
      s.x += (s.tx - s.x) * sp;
      s.y += (s.ty - s.y) * sp;
      pupilRef.current?.setAttribute("transform", `translate(${(bx + s.x).toFixed(1)} ${(by + s.y).toFixed(1)})`);
      const b = t - s.blinkAt;
      lidRef.current?.setAttribute("opacity", b > 0 && b < 140 ? "1" : "0");
      if (b > 140) s.blinkAt = t + 2200 + Math.random() * 3800;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, sleeping, k, bx, by]);

  const a = animate;
  const headCls = !a ? "" : sleeping ? "" : k >= 4 ? "cham-bob" : k === 1 ? "cham-shake" : "";

  let mouth;
  if (sleeping) mouth = <path d="M159 89 Q165 88 171 89" fill="none" stroke={d} strokeWidth="2.5" strokeLinecap="round" />;
  else if (k === 5) mouth = (
    <>
      <path d="M156 85 Q165 95 174 84 Q165 88 156 85Z" fill="#0F1512" stroke={d} strokeWidth="1.8" strokeLinejoin="round" />
      {a && <path className="cham-tongue" d="M172 86 Q194 90 204 82" stroke="#ED93B1" strokeWidth="3.5" strokeLinecap="round" fill="none" />}
    </>
  );
  else if (k === 4) mouth = <path d="M157 86 Q165 92 173 85" fill="none" stroke={d} strokeWidth="2.5" strokeLinecap="round" />;
  else if (k === 3) mouth = <path d="M158 88 L172 87" stroke={d} strokeWidth="2.5" strokeLinecap="round" />;
  else if (k === 2) mouth = <path d="M159 89 Q165 87 171 89" fill="none" stroke={d} strokeWidth="2.5" strokeLinecap="round" />;
  else mouth = <path d="M158 91 Q165 85 172 90" fill="none" stroke={d} strokeWidth="2.5" strokeLinecap="round" />;

  return (
    <svg viewBox="0 0 210 150" width={size} role="img" className={`block ${className}`} style={{ maxWidth: "100%", overflow: party ? "visible" : undefined }}>
      <title>{title || (sleeping ? "Camaleón dormido" : `Camaleón: ${PET_STATES[k].name}`)}</title>
      {scene && <PetBackground item={o.bg || "selva"} />}
      <path d="M4 132 Q100 124 206 134" stroke={level >= 3 ? "#C9A227" : "#6B4F2A"} strokeWidth="8" fill="none" strokeLinecap="round" />
      {level >= 3 && <path d="M10 130 Q100 123 200 131" stroke="#F2D16B" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />}
      <path d="M150 128 q10-16 22-14" stroke="#3B6D11" strokeWidth="4" fill="none" />
      <ellipse cx="174" cy="112" rx="8" ry="4" fill="#639922" />
      {level >= 1 && (
        <g>
          <path d="M30 129 q-6-14 -18-15" stroke="#3B6D11" strokeWidth="3" fill="none" />
          <ellipse cx="12" cy="114" rx="7" ry="3.5" fill="#639922" transform="rotate(-20 12 114)" />
          <path d="M190 132 q4 8 12 8" stroke="#3B6D11" strokeWidth="3" fill="none" />
          <ellipse cx="203" cy="141" rx="6" ry="3" fill="#639922" />
        </g>
      )}
      {level >= 2 && (
        <g>
          {[[22, 118], [182, 108], [200, 139]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="0" cy="-3.5" rx="2.4" ry="3.5" fill={level >= 3 ? "#FFE38A" : "#F4A6C9"} transform={`rotate(${r})`} />)}
              <circle r="1.8" fill="#F2D16B" />
            </g>
          ))}
        </g>
      )}
      <g className={party ? "cham-party-flip" : ""}><g className={party ? "cham-party-dance" : ""}>
      <PetAura item={o.aura} />
      <g transform={`translate(0 ${down})`}>
        <PetBack item={o.back} />
        <g className={a && !sleeping ? (k === 5 ? "cham-tail cham-tail-fast" : "cham-tail") : ""}>
          <path d={k >= 4 ? TAIL_UP : TAIL_DOWN} stroke={c} strokeWidth="11" fill="none" strokeLinecap="round" />
        </g>
        <path d="M72 106 L62 126" stroke={d} strokeWidth="7" strokeLinecap="round" />
        <path d="M118 108 L128 126" stroke={d} strokeWidth="7" strokeLinecap="round" />
        <g className={a ? "cham-breathe" : ""}>
          <path d="M55 100 C55 70 90 55 125 62 C145 66 150 90 140 105 C125 118 70 118 55 100Z" fill={c} stroke={d} strokeWidth="1.5" />
          <path d="M62 104 C85 114 120 114 138 103" stroke={l} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M70 78 C90 66 110 64 128 68" stroke={d} strokeWidth="2" fill="none" strokeDasharray="2 7" strokeLinecap="round" />
          <circle cx="88" cy="88" r="3.5" fill={d} />
          <circle cx="104" cy="82" r="2.5" fill={d} />
          <circle cx="112" cy="96" r="3" fill={d} />
          <PetBody item={o.body} />
          <PetWaist item={o.waist} />
          <PetNeck item={o.neck} />
        </g>
        <g className={headCls}>
          <path d="M125 62 C140 45 165 50 180 72 C186 84 176 96 150 98 C140 99 134 90 130 85Z" fill={c} stroke={d} strokeWidth="1.5" />
          <path d="M127 63 C130 44 150 36 160 52" stroke={d} strokeWidth="2" fill={shade(c, -0.12)} />
          <circle cx="152" cy="70" r="14" fill={d} />
          <circle cx="152" cy="70" r="9" fill="#FFFFFF" />
          <g ref={pupilRef} transform={`translate(${bx} ${by})`}>
            <circle r="4" fill="#0F1512" />
            <circle cx="1.3" cy="-1.3" r="1.1" fill="#FFFFFF" />
          </g>
          {a && !sleeping && <circle ref={lidRef} cx="152" cy="70" r="9.5" fill={c} stroke={d} strokeWidth="1.5" opacity="0" />}
          {sleeping && (
            <>
              <circle cx="152" cy="70" r="9.5" fill={c} />
              <path d="M144 71 Q152 75 160 71" stroke={d} strokeWidth="2" fill="none" strokeLinecap="round" />
            </>
          )}
          {!sleeping && k === 2 && (
            <>
              <path d="M139 70 A13 13 0 0 1 165 70 Z" fill={c} />
              <path d="M139 70 L165 70" stroke={d} strokeWidth="2" />
            </>
          )}
          {!sleeping && k === 1 && (
            <>
              <path d="M139 66 Q152 58 165 70 L165 66 A13 13 0 0 0 139 66 Z" fill={c} />
              <path d="M140 64 L163 69" stroke={d} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          {!sleeping && k >= 4 && <circle cx="164" cy="79" r="3.5" fill="#ED93B1" opacity="0.7" />}
          {mouth}
          <PetEyes item={o.eyes} />
          <PetHead item={o.head} />
        </g>
        <path d="M84 104 L80 126" stroke={d} strokeWidth="6" strokeLinecap="round" />
        <path d="M106 106 L112 126" stroke={d} strokeWidth="6" strokeLinecap="round" />
        <PetFeet item={o.feet} />
      </g>
      </g></g>
      <g className={a ? "cham-float" : ""}>
        {(sleeping || k === 2) && (
          <>
            <text x="176" y="44" fontSize="14" fill="#AFA9EC" fontFamily="sans-serif">z</text>
            <text x="186" y="32" fontSize="11" fill="#AFA9EC" fontFamily="sans-serif">z</text>
          </>
        )}
        {!sleeping && k === 5 && (
          <>
            <path d="M184 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#D6FF5C" />
            <path d="M100 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#D6FF5C" />
          </>
        )}
        {!sleeping && k === 1 && (
          <>
            <path d="M170 40 q6-10 14-4 q8-6 12 4 q6 2 2 8 h-26 q-6-4-2-8z" fill="#5F5E5A" />
            <path d="M178 52 l-2 6 M186 52 l-2 6" stroke="#85B7EB" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </g>
    </svg>
  );
}
