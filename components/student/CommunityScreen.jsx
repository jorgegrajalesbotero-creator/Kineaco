"use client";

import { useEffect, useState } from "react";
import { Award, Flame, Lock, Megaphone, Sparkles, Trash2, Trophy, User, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { signedAvatarUrls } from "@/lib/avatars";
import { tr } from "@/lib/i18n";
import { PET_STATES } from "@/lib/chameleon";
import { Chameleon } from "@/components/ui/Chameleon";
import { Skeleton } from "@/components/ui/Skeleton";
import { HIGHLIGHT_LABEL, PET_LEVELS, REACTIONS, challengePct, createPost, deletePost, loadChallenges, loadFeed, loadMembership, loadPosts, react, setHighlight, setMembership, todayExercises } from "@/lib/community";
import { ChallengeManager } from "@/components/coach/ChallengeManager";

// Comunidad de su coach: mascotas, ejercicio destacado, constancia, retos y reacciones con un toque.
// coachMode = la ve el coach desde su panel. isStaff = coach o admin en su vista de alumno.
// El coach/admin siempre está dentro (no tiene que "entrar"), aparece con su mascota y puede publicar avisos y crear retos.
export function CommunityScreen({ userId, coachMode = false, isStaff = false, header = null }) {
  const staff = coachMode || isStaff;
  const [posts, setPosts] = useState([]);
  const [membership, setMembershipState] = useState(null); // { missing, member }
  const [feed, setFeed] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [busy, setBusy] = useState(false);
  const [todayList, setTodayList] = useState([]);

  async function load() {
    const m = await loadMembership(supabase, userId);
    // El coach queda dentro automáticamente: así suma en los retos y le llegan los avisos de los otros coaches
    if (staff && !m.missing && !m.member?.visible) {
      const { error } = await setMembership(supabase, userId, true);
      if (!error) m.member = { ...(m.member || {}), visible: true };
    }
    setMembershipState(m);
    if (m.missing || (!m.member?.visible && !staff)) { setFeed([]); return; }
    const [f, c, t, p] = await Promise.all([loadFeed(supabase), loadChallenges(supabase), todayExercises(supabase, userId), loadPosts(supabase)]);
    // Las fotos están en un bucket privado: se guarda la ruta y aquí se firma para poder mostrarla
    const urls = await signedAvatarUrls(f.members.map((x) => x.avatar_url));
    setFeed(f.members.map((x, i) => ({ ...x, avatar_url: urls[i] || null })));
    setChallenges(c);
    setTodayList(t);
    setPosts(p);
  }
  useEffect(() => { load(); }, [userId]);

  const join = async (visible) => {
    if (!visible && !confirm(tr("¿Salir de la comunidad? Los demás dejarán de ver su mascota y sus logros."))) return;
    setBusy(true);
    const { error } = await setMembership(supabase, userId, visible);
    setBusy(false);
    if (error) return alert(tr("No se pudo guardar. Intente de nuevo."));
    load();
  };

  const toggleReaction = async (m, key) => {
    // Cambia al instante y después confirma con la base
    setFeed((list) => list.map((x) => {
      if (x.user_id !== m.user_id) return x;
      const had = (x.my_reactions || []).includes(key);
      const count = Number(x.reactions?.[key] || 0) + (had ? -1 : 1);
      return { ...x, my_reactions: had ? x.my_reactions.filter((k) => k !== key) : [...(x.my_reactions || []), key], reactions: { ...x.reactions, [key]: Math.max(0, count) } };
    }));
    const { error } = await react(supabase, m.user_id, key);
    if (error) load();
  };

  const chooseHighlight = async (exerciseId) => {
    const { error } = await setHighlight(supabase, userId, exerciseId);
    if (error) return alert(tr("No se pudo guardar. Intente de nuevo."));
    load();
  };

  if (!membership || feed === null) return <div className="p-4"><Skeleton rows={4} height="h-28" /></div>;

  if (membership.missing) {
    return <div className="p-4"><p className="text-muted text-sm bg-card rounded-2xl p-4">{tr("La comunidad todavía no está activa.")}</p></div>;
  }

  // Todavía no entró: se explica qué se comparte y qué no
  if (!membership.member?.visible && !staff) {
    return (
      <div className="p-4 md:p-8 max-w-xl mx-auto">
        {header}
        <div className="bg-card rounded-3xl p-5 text-center">
          <Chameleon mood={4} size={150} className="mx-auto" />
          <h2 className="text-ink text-lg font-semibold mt-2">{tr("La comunidad de su coach")}</h2>
          <p className="text-soft text-sm mt-1">{tr("Vea cómo van los demás, anímelos con un toque y sumen juntos en los retos.")}</p>
          <div className="text-left bg-white/[0.03] rounded-2xl p-4 mt-4 space-y-2">
            <p className="text-ink text-xs font-semibold">{tr("Los demás verán:")}</p>
            <p className="text-soft text-xs">• {tr("Su foto en miniatura y su primer nombre")}</p>
            <p className="text-soft text-xs">• {tr("Su mascota, su nombre y su ánimo de hoy")}</p>
            <p className="text-soft text-xs">• {tr("El ejercicio que destacó hoy (sin el peso)")}</p>
            <p className="text-soft text-xs">• {tr("Sus entrenamientos, su racha y sus récords del mes (sin números de peso)")}</p>
            <p className="text-ink text-xs font-semibold pt-2 flex items-center gap-1.5"><Lock size={12} /> {tr("Nunca se muestra:")}</p>
            <p className="text-soft text-xs">• {tr("Pesos, medidas, fotos de progreso, molestias ni mensajes")}</p>
          </div>
          <button onClick={() => join(true)} disabled={busy} className="w-full bg-accent text-app font-semibold text-sm rounded-xl py-3 mt-4 disabled:opacity-60">
            {busy ? tr("Guardando...") : tr("Entrar a la comunidad")}
          </button>
          <p className="text-muted text-[11px] mt-2">{tr("Puede salir cuando quiera.")}</p>
        </div>
      </div>
    );
  }

  const me = feed.find((m) => m.is_me);
  const others = feed.filter((m) => !m.is_me);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {header}
      {!coachMode && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <h1 className="text-ink text-xl font-semibold flex items-center gap-2"><Users size={20} className="text-accent" /> {tr("Comunidad")}</h1>
          {!staff && <button onClick={() => join(false)} className="text-muted text-xs">{tr("Salir")}</button>}
        </div>
      )}

      {isStaff && !coachMode && <div className="mb-4"><ChallengeManager onChange={load} /></div>}

      <PostsBox posts={posts} feed={feed} userId={userId} staff={staff} onChange={load} />

      {challenges.length > 0 && (
        <div className="space-y-2 mb-5">
          {challenges.map((c) => {
            const pct = challengePct(c);
            const ended = new Date(`${c.end_date}T23:59:59`) < new Date();
            return (
              <div key={c.id} className="bg-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-ink text-sm font-semibold flex items-center gap-1.5"><Trophy size={15} className="text-accent" /> {c.title}</p>
                  <span className={`text-[11px] shrink-0 ${pct >= 100 ? "text-accent font-semibold" : "text-muted"}`}>{pct >= 100 ? tr("¡Logrado!") : ended ? tr("Terminó") : `${pct}%`}</span>
                </div>
                <div className="h-2 rounded-full bg-field mt-2 overflow-hidden"><div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                <p className="text-muted text-[11px] mt-1.5">
                  {tr("{p0} de {p1} {p2}", { p0: c.progress, p1: c.target, p2: c.kind === "series" ? tr("series") : tr("entrenamientos") })}
                  {" · "}{tr("{p0} en la comunidad", { p0: c.members })}
                  {Number(c.mine) > 0 ? ` · ${tr("usted aportó {p0}", { p0: c.mine })}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {me && (
        <div className="mb-5">
          <MemberCard m={me} mine />
          {todayList.length > 0 && (
            <div className="bg-card rounded-2xl px-4 py-3 mt-2">
              <p className="text-soft text-xs mb-2 flex items-center gap-1.5"><Sparkles size={13} /> {tr("¿Qué ejercicio quiere destacar hoy?")}</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => chooseHighlight(null)} className={`text-xs rounded-full px-3 py-1.5 ${me.highlight_kind !== "elegido" ? "bg-accent text-app font-semibold" : "bg-field text-soft"}`}>{tr("El que elija la app")}</button>
                {todayList.map((x) => (
                  <button key={x.id} onClick={() => chooseHighlight(x.id)} className={`text-xs rounded-full px-3 py-1.5 ${me.highlight_kind === "elegido" && me.highlight_name === x.name ? "bg-accent text-app font-semibold" : "bg-field text-soft"}`}>{x.name}</button>
                ))}
              </div>
            </div>
          )}
          <PetLevels level={me.level} workouts={me.workouts} streak={me.streak_weeks} />
        </div>
      )}

      {others.length === 0 ? (
        <p className="text-muted text-sm bg-card rounded-2xl p-4">{tr("Todavía no hay más personas en la comunidad. Cuando otros entren, aparecerán aquí.")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {others.map((m) => <MemberCard key={m.user_id} m={m} onReact={(k) => toggleReaction(m, k)} />)}
        </div>
      )}
    </div>
  );
}

// Avisos del coach: arriba del muro. El coach (o admin) escribe; los alumnos solo leen.
function PostsBox({ posts, feed, userId, staff, onChange }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const byId = new Map((feed || []).map((m) => [m.user_id, m]));

  const publish = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const { error } = await createPost(supabase, userId, text);
    setSaving(false);
    if (error) return alert("No se pudo publicar el aviso. ¿Ya se corrió el SQL de avisos en Supabase?");
    setText("");
    onChange?.();
  };

  const remove = async (p) => {
    if (!confirm("¿Borrar este aviso?")) return;
    const { error } = await deletePost(supabase, p.id);
    if (error) return alert("No se pudo borrar.");
    onChange?.();
  };

  if (!staff && posts.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl p-4 mb-5">
      <p className="text-ink text-sm font-medium flex items-center gap-1.5 mb-3"><Megaphone size={15} className="text-accent" /> {tr("Avisos del coach")}</p>
      {staff && (
        <div className="mb-3">
          <textarea value={text} maxLength={500} rows={2} onChange={(e) => setText(e.target.value)} placeholder="Escriba un aviso para la comunidad (ej: «Esta semana vamos por el reto, ¡no se queden!»). Les llega una notificación."
            className="w-full bg-field text-ink text-sm rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-accent resize-none" />
          <div className="flex justify-end mt-1.5">
            <button onClick={publish} disabled={saving || !text.trim()} className="bg-accent text-app text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-50">{saving ? "Publicando..." : "Publicar aviso"}</button>
          </div>
        </div>
      )}
      {posts.length === 0 ? (
        <p className="text-muted text-xs">Todavía no ha publicado avisos.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => {
            const a = byId.get(p.coach_id);
            return (
              <div key={p.id} className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-field overflow-hidden flex items-center justify-center shrink-0">
                    {a?.avatar_url ? <img src={a.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <User size={12} className="text-muted" />}
                  </div>
                  <p className="text-ink text-xs font-medium flex-1 truncate">{a?.first_name || tr("Coach")} <span className="text-muted font-normal">· {new Date(p.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span></p>
                  {staff && p.coach_id === userId && (
                    <button onClick={() => remove(p)} aria-label="Borrar aviso" className="text-soft hover:text-danger"><Trash2 size={13} /></button>
                  )}
                </div>
                <p className="text-soft text-sm mt-1.5 whitespace-pre-line break-words">{p.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MemberCard({ m, mine = false, onReact }) {
  const mood = m.pet_mood || null;
  const sleeping = !mood && !m.trained_today;
  const hl = m.highlight_name ? { name: m.highlight_name, label: tr(HIGHLIGHT_LABEL[m.highlight_kind] || "Destacó") } : null;
  return (
    <div className={`rounded-2xl p-4 ${mine ? "bg-card border border-accent/30" : "bg-card"}`}>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-field overflow-hidden flex items-center justify-center shrink-0">
          {m.avatar_url ? <img src={m.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <User size={16} className="text-muted" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ink text-sm font-medium truncate flex items-center gap-1.5">
            {m.first_name}{mine ? ` (${tr("usted")})` : ""}
            {m.is_coach && <span className="text-[10px] text-app bg-accent rounded-full px-2 py-0.5 font-semibold">Coach</span>}
          </p>
          <p className="text-muted text-[11px]">{m.trained_today ? tr("Entrenó hoy") : tr("Hoy no ha entrenado")}</p>
        </div>
      </div>

      {m.pet_name ? (
        <div className="flex items-center gap-3 mt-3">
          <Chameleon mood={mood || 3} sleeping={sleeping} level={m.level || 0} size={110} animate={mine} />
          <div className="min-w-0">
            <p className="text-ink text-base font-semibold truncate">{m.pet_name}</p>
            <p className="text-soft text-xs">{sleeping ? tr("Descansando") : tr(PET_STATES[mood || 3].name)}</p>
            <p className="text-muted text-[11px] mt-0.5">{tr(PET_LEVELS[m.level || 0].name)}</p>
          </div>
        </div>
      ) : (
        <p className="text-muted text-xs mt-3">{m.is_coach ? tr("Su coach") : tr("Todavía no tiene mascota")}</p>
      )}

      {hl && (
        <p className="text-ink text-xs mt-3 bg-accent/10 border border-accent/20 rounded-xl px-3 py-2">
          {m.highlight_kind === "record" ? "🏆 " : "⭐ "}<span className="text-accent font-semibold">{hl.label}:</span> {hl.name}
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-soft">
        <span className="flex items-center gap-1"><Award size={12} /> {tr("{p0} entrenamientos", { p0: m.workouts })}</span>
        {m.streak_weeks > 0 && <span className="flex items-center gap-1"><Flame size={12} /> {tr("Racha de {p0} sem.", { p0: m.streak_weeks })}</span>}
        {m.records_month > 0 && <span className="flex items-center gap-1"><Trophy size={12} /> {tr("{p0} récords este mes", { p0: m.records_month })}</span>}
      </div>

      <div className="flex gap-1.5 mt-3">
        {REACTIONS.map((r) => {
          const n = Number(m.reactions?.[r.key] || 0);
          const on = (m.my_reactions || []).includes(r.key);
          return (
            <button key={r.key} type="button" disabled={mine || !onReact} onClick={() => onReact?.(r.key)} aria-label={tr(r.label)}
              className={`flex-1 rounded-xl py-1.5 text-sm flex items-center justify-center gap-1 transition-colors ${on ? "bg-accent/20 border border-accent/40" : "bg-white/[0.04] border border-transparent"} ${mine ? "cursor-default" : "active:scale-95"}`}>
              <span>{r.emoji}</span>{n > 0 && <span className="text-soft text-xs tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Logros de la mascota: la rama cambia con la constancia
function PetLevels({ level = 0, workouts = 0, streak = 0 }) {
  return (
    <div className="bg-card rounded-2xl p-4 mt-2">
      <p className="text-ink text-sm font-medium mb-1">{tr("Logros de su mascota")}</p>
      <p className="text-muted text-[11px] mb-3">{tr("{p0} entrenamientos · racha de {p1} semanas", { p0: workouts, p1: streak })}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PET_LEVELS.map((l) => {
          const on = level >= l.level;
          return (
            <div key={l.level} className={`rounded-xl p-2 text-center ${on ? "bg-accent/10 border border-accent/30" : "bg-field opacity-70"}`}>
              <Chameleon mood={4} level={l.level} size={70} animate={false} className="mx-auto" />
              <p className={`text-[11px] font-medium ${on ? "text-ink" : "text-soft"}`}>{tr(l.name)}</p>
              <p className="text-muted text-[10px] leading-tight mt-0.5">{on ? tr("Logrado") : tr(l.need)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
