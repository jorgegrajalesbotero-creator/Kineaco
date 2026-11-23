"use client";

import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { describeIssue, isStrongIssue } from "@/lib/checkout";

// Check-out de un día (coach): esfuerzo, molestias por ejercicio y comentario del alumno
export function CheckoutSummary({ checkout, title = null }) {
  if (!checkout) return null;
  const issues = checkout.issues || [];
  return (
    <div className={`rounded-xl px-3.5 py-3 ${checkout.had_issue ? "bg-danger/[0.07] border border-danger/30" : "bg-card"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink text-sm font-medium flex items-center gap-1.5">
          {checkout.had_issue ? <AlertTriangle size={14} className="text-danger" /> : <ClipboardCheck size={14} className="text-accent" />}
          {title || "Check-out"}
        </p>
        <span className="text-muted text-[11px]">
          {checkout.effort ? `Esfuerzo ${checkout.effort}/10` : "Sin esfuerzo"} · {checkout.had_issue ? `${issues.length} molestia${issues.length === 1 ? "" : "s"}` : "Sin molestias"}
        </span>
      </div>
      {issues.length > 0 && (
        <ul className="mt-2 space-y-1">
          {issues.map((i, k) => (
            <li key={k} className={`text-xs ${isStrongIssue(i) ? "text-danger font-medium" : "text-ink"}`}>• {describeIssue(i)}</li>
          ))}
        </ul>
      )}
      {checkout.comment && <p className="text-soft text-xs mt-2 whitespace-pre-wrap break-words">&ldquo;{checkout.comment}&rdquo;</p>}
    </div>
  );
}
