"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { LEGAL_TEXT } from "@/lib/legalText";
import { detectLang, rememberLang } from "@/lib/i18n";

// Página pública con los Términos o la Política de datos, en español o inglés
export function LegalDocument({ kind }) {
  const [lang, setLang] = useState("es");
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    setLang(fromUrl === "en" || fromUrl === "es" ? fromUrl : detectLang());
  }, []);
  const t = LEGAL_TEXT[lang];
  const doc = t[kind];
  const other = kind === "terms" ? { href: "/privacidad", label: lang === "en" ? "Privacy Policy" : "Política de datos" } : { href: "/terminos", label: lang === "en" ? "Terms and Conditions" : "Términos y Condiciones" };

  return (
    <div className="min-h-screen bg-night">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-8">
          <a href="/" className="flex items-center gap-3">
            <BrandMark size={36} />
            <span className="text-ink text-lg font-semibold tracking-tight">kineaco</span>
          </a>
          <div className="flex gap-1 bg-card border border-white/[0.06] rounded-full p-1">
            {["es", "en"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => { setLang(code); rememberLang(code); }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${lang === code ? "bg-accent text-app" : "text-soft"}`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <h1 className="text-ink text-2xl font-semibold tracking-tight mb-1">{doc.title}</h1>
        <p className="text-muted text-xs mb-2">{doc.updated}</p>
        {t.note && <p className="text-warning text-xs mb-6">{t.note}</p>}

        <div className="space-y-6 mt-6">
          {doc.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-ink text-base font-semibold mb-2">{s.title}</h2>
              <div className="space-y-2">
                {s.body.map((p, i) =>
                  typeof p === "string" ? (
                    <p key={i} className="text-soft text-sm leading-relaxed">{p}</p>
                  ) : (
                    <ul key={i} className="space-y-1.5 pl-1">
                      {p.list.map((li) => (
                        <li key={li} className="text-soft text-sm leading-relaxed flex gap-2">
                          <span className="text-accent shrink-0">•</span>
                          <span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.06] flex flex-wrap gap-4 text-sm">
          <a href={other.href} className="text-accent">{other.label}</a>
          <a href="/" className="text-soft">{lang === "en" ? "Back to the app" : "Volver a la app"}</a>
        </div>
      </div>
    </div>
  );
}
