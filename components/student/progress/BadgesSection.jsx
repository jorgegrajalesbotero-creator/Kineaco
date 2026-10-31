"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BADGE_GROUPS, computeBadges, loadBadgeData } from "@/lib/badges";
import { tr } from "@/lib/i18n";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/Skeleton";

export function BadgesSection({ userId }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newBadges, setNewBadges] = useState([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const stats = await loadBadgeData(supabase, userId);
      if (cancelled) return;
      const list = computeBadges(stats);
      setBadges(list);
      setLoading(false);

      const storageKey = `badges_seen_${userId}`;
      let seen = [];
      try {
        seen = JSON.parse(localStorage.getItem(storageKey) || "[]");
      } catch {
        seen = [];
      }
      const seenSet = new Set(seen);
      const fresh = list.filter((b) => b.unlocked && !seenSet.has(b.key));
      if (fresh.length > 0) {
        setNewBadges(fresh);
        try {
          localStorage.setItem(storageKey, JSON.stringify(list.filter((b) => b.unlocked).map((b) => b.key)));
        } catch { }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const FirstNewIcon = newBadges[0]?.icon;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-muted text-xs uppercase tracking-wider">{tr("Logros")}</p>
        {!loading && unlockedCount > 0 && (
          <span className="text-soft text-xs">{unlockedCount} {unlockedCount === 1 ? tr("lograda") : tr("logradas")}</span>
        )}
      </div>

      {newBadges.length > 0 && (
        <div className="bg-accent rounded-2xl p-3 mb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-app flex items-center justify-center shrink-0">
            {FirstNewIcon && <FirstNewIcon size={18} className="text-accent" />}
          </div>
          <div className="flex-1">
            <p className="text-app text-sm font-semibold">
              {newBadges.length === 1 ? tr("¡Nueva insignia!") : tr("¡Ganó {p0} insignias nuevas!", { p0: newBadges.length })}
            </p>
            <p className="text-app/70 text-xs">{newBadges.map((b) => tr(b.title)).join(" · ")}</p>
          </div>
          <button onClick={() => setNewBadges([])} className="text-app/60 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 mb-6 space-y-4">
        {loading ? (
          <Skeleton />
        ) : unlockedCount === 0 ? (
          <p className="text-muted text-sm text-center py-2">{tr("Todavía no tiene insignias. ¡Siga entrenando para ganar la primera!")}</p>
        ) : (
          BADGE_GROUPS.filter((g) => badges.some((b) => b.group === g.key && b.unlocked)).map((g) => (
            <div key={g.key}>
              <p className="text-soft text-[11px] mb-2">{tr(g.label)}</p>
              <div className="grid grid-cols-3 gap-2">
                {badges.filter((b) => b.group === g.key && b.unlocked).map((b) => {
                  const Icon = b.icon;
                  return (
                    <div
                      key={b.key}
                      className={`rounded-xl p-2.5 flex flex-col items-center text-center ${b.unlocked ? "bg-accent/10 border border-accent/30" : "bg-field"}`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 ${b.unlocked ? "bg-accent" : "bg-card"}`}>
                        <Icon size={16} className={b.unlocked ? "text-app" : "text-muted"} />
                      </div>
                      <p className={`text-[11px] leading-tight mb-1 ${b.unlocked ? "text-ink" : "text-soft"}`}>{tr(b.title)}</p>
                      <p className={`text-[10px] ${b.unlocked ? "text-accent" : "text-muted"}`}>
                        {b.unlocked ? tr("Lograda") : `${b.current} / ${b.target} ${tr(b.unit)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
