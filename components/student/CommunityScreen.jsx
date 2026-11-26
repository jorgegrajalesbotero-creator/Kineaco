"use client";

import { useEffect, useState } from "react";
import { Award, Flame, Lock, Megaphone, Shirt, Sparkles, Trash2, Trophy, User, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { signedAvatarUrls } from "@/lib/avatars";
import { tr } from "@/lib/i18n";
import { PET_STATES } from "@/lib/chameleon";
import { Chameleon } from "@/components/ui/Chameleon";
import { Skeleton } from "@/components/ui/Skeleton";
import { HIGHLIGHT_LABEL, PET_LEVELS, REACTIONS, challengePct, createPost, deletePost, loadChallenges, loadFeed, loadMembership, loadMyPet, loadPosts, react, setHighlight, setMembership, todayExercises } from "@/lib/community";
import { PET_ITEMS, cleanOutfit, progressText } from "@/lib/petItems";
import { PetCloset } from "@/components/student/PetCloset";
import { setMyOutfit } from "@/lib/myPet";
import { ChallengeManager } from "@/components/coach/ChallengeManager";

// Comunidad de su coach: mascotas, ejercicio destacado, constancia, retos y reacciones con un toque.
// coachMode = la ve el coach desde su panel. isStaff = coach o admin en su vista de alumno.
// El coach/admin siempre está dentro (no tiene que "entrar"), aparece con su mascota y puede publicar avisos y crear retos.
// Igual que las demás pantallas del alumno: la pantalla tiene su propio scroll (si no, en computador no baja)
export function CommunityScreen(props) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <CommunityBody {...props} />
    </div>
  );
}

function CommunityBody({ userId, coachMode = false, isStaff = false, header = null }) {
  const staff = coachMode || isStaff;
  const [posts, setPosts] = useState([]);
  const [membership, setMembershipState] = useState(null); // { missing, member }
  const [feed, setFeed] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [busy, setBusy] = useState(false);
  const [todayList, setTodayList] = useState([]);
  const [myPet, setMyPet] = useState(null); // { trainings, streak_now, streak_best, unlocked, outfit, ... }
  const [closetOpen, setClosetOpen] = useState(false);

  async function load() {
    const m = await loadMembership(supabase, userId);
    // El coach queda dentro automáticamente: así suma en los retos y le llegan los avisos de los otros coaches
    if (staff && !m.missing && !m.member?.visible) {
      const { error } = await setMembership(supabase, userId, true);
      if (!error) m.member = { ...(m.member || {}), visible: true };
    }
    setMembershipState(m);
    if (m.missing || (!m.member?.visible && !staff)) { setFeed([]); return; }
    const [f, c, t, p, pet] = await Promise.all([loadFeed(supabase), loadChallenges(supabase), todayExercises(supabase, userId), loadPosts(supabase), loadMyPet(supabase)]);
    setMyPet(pet);
    if (pet && !coachMode) setMyOutfit(pet.outfit);
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
          <Chameleon mine mood={4} size={150} className="mx-auto" />
          <h2 className="text-ink text-lg font-semibold mt-2">{tr("La comunidad de su coach")}</h2>
          <p className="text-soft text-sm mt-1">{tr("Vea cómo van los demás, anímelos con un toque y sumen juntos en los retos.")}</p>
          <div className="text-left bg-white/[0.03] rounded-2xl p-4 mt-4 space-y-2">
            <p className="text-ink text-xs font-semibold">{tr("Los demás verán:")}</p>
            <p className="text-soft text-xs">• {tr("Su foto en miniatura y su nombre con apellido")}</p>
            <p className="text-soft text-xs">• {tr("Su mascota con su ropa y su fondo, su nombre y su ánimo de hoy")}</p>
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
  const nameOf = (m) => m.display_name || m.first_name || tr("Alumno");
  const outfitOf = (m) => (m.is_me && myPet ? cleanOutfit(myPet.outfit, myPet.unlocked) : m.outfit || {});
  // Podio: los que más días entrenaron esta semana (y si empatan, la racha)
  const podium = [...feed].filter((m) => Number(m.week_days) > 0)
    .sort((a, b) => (b.week_days - a.week_days) || ((b.streak_weeks || 0) - (a.streak_weeks || 0)))
    .slice(0, 3);
  // Lo de hoy: récords, ejercicios destacados y quién entrenó
  const todayFeed = feed.filter((m) => m.trained_today).map((m) => ({
    m,
    text: m.highlight_kind === "record" && m.highlight_name ? tr("hizo récord en {p0}", { p0: m.highlight_name })
      : m.highlight_name ? tr("destacó {p0}", { p0: m.highlight_name })
      : tr("entrenó hoy"),
    record: m.highlight_kind === "record",
  })).sort((a, b) => Number(b.record) - Number(a.record));

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
        <MyPetCard m={me} pet={myPet} outfit={outfitOf(me)} name={nameOf(me)} onDress={() => setClosetOpen(true)}
          todayList={todayList} onHighlight={chooseHighlight} />
      )}

      {podium.length > 0 && (
        <div className="bg-card rounded-2xl px-4 pt-4 pb-0 mb-5">
          <p className="text-ink text-sm font-medium flex items-center gap-1.5 mb-1"><Award size={15} className="text-accent" /> {tr("Los más constantes de la semana")}</p>
          <div className="flex items-end justify-center gap-2">
            {[podium[1], podium[0], podium[2]].map((m, i) => {
              if (!m) return <div key={i} className="flex-1" />;
              const pos = i === 1 ? 1 : i === 0 ? 2 : 3;
              const h = pos === 1 ? "h-14" : pos === 2 ? "h-10" : "h-7";
              const color = pos === 1 ? "bg-accent text-app" : pos === 2 ? "bg-field-strong text-ink" : "bg-field text-soft";
              return (
                <div key={m.user_id} className="flex-1 min-w-0 text-center">
                  <Chameleon mood={m.pet_mood || 4} level={m.level || 0} outfit={outfitOf(m)} size={pos === 1 ? 92 : 74} animate={false} className="mx-auto" />
                  <p className="text-ink text-xs font-medium truncate mt-1">{nameOf(m)}</p>
                  <p className="text-muted text-[10px] mb-1">{tr("{p0} días esta semana", { p0: m.week_days })}</p>
                  <div className={`${h} ${color} rounded-t-xl flex items-start justify-center pt-1 text-sm font-semibold`}>{pos}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {todayFeed.length > 0 && (
        <div className="mb-5">
          <p className="text-muted text-[11px] uppercase tracking-[0.14em] mb-2">{tr("Hoy en la comunidad")}</p>
          <div className="flex gap-2 overflow-x-auto pb-1 min-w-0 max-w-full">
            {todayFeed.map(({ m, text, record }) => (
              <div key={m.user_id} className={`shrink-0 max-w-[240px] rounded-2xl pl-1 pr-3 py-1 flex items-center gap-2 ${record ? "bg-accent/15 border border-accent/30" : "bg-card"}`}>
                <div className="w-12 shrink-0"><Chameleon mood={m.pet_mood || 4} outfit={outfitOf(m)} size={48} animate={false} /></div>
                <p className="text-xs min-w-0"><span className="text-ink font-medium">{nameOf(m)}</span> <span className="text-soft">{text}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-muted text-[11px] uppercase tracking-[0.14em] mb-2">{tr("El terrario")}</p>
      {others.length === 0 ? (
        <p className="text-muted text-sm bg-card rounded-2xl p-4">{tr("Todavía no hay más personas en la comunidad. Cuando otros entren, aparecerán aquí.")}</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {others.map((m) => <TerrariumCard key={m.user_id} m={m} name={nameOf(m)} outfit={outfitOf(m)} onReact={(k) => toggleReaction(m, k)} />)}
        </div>
      )}

      {closetOpen && myPet && (
        <PetCloset pet={myPet} petName={me?.pet_name} mood={me?.pet_mood || 4} level={me?.level || 0}
          onClose={() => setClosetOpen(false)}
          onSaved={(outfit) => setMyPet((p) => ({ ...p, outfit }))} />
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

// Mi mascota: con su fondo y su ropa, la racha nueva, lo próximo que va a desbloquear y el botón para vestirla
function MyPetCard({ m, pet, outfit, name, onDress, todayList, onHighlight }) {
  const mood = m.pet_mood || null;
  const sleeping = !mood && !m.trained_today;
  const unlocked = new Set(pet?.unlocked || []);
  // Lo más cerca de desbloquear
  const next = pet ? PET_ITEMS.filter((i) => i.metric && !unlocked.has(i.key))
    .map((i) => ({ i, pct: Math.min(1, (Number(pet[i.metric]) || 0) / i.need) }))
    .sort((a, b) => b.pct - a.pct)[0] : null;
  return (
    <div className="mb-5">
      <div className="rounded-3xl overflow-hidden border border-accent/30 bg-card">
        <div className="relative">
          <Chameleon mood={mood || 3} sleeping={sleeping} level={m.level || 0} outfit={outfit} scene size={640} className="w-full" />
          {m.pet_name && (
            <span className="absolute left-3 top-3 bg-app/70 backdrop-blur text-ink text-xs font-semibold rounded-full px-3 py-1">{m.pet_name}</span>
          )}
          {pet && (
            <button onClick={onDress} className="absolute right-3 top-3 bg-accent text-app text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1.5 active:scale-95">
              <Shirt size={13} /> {tr("Vestir")}
            </button>
          )}
        </div>
        <div className="p-4">
          <p className="text-ink text-sm font-semibold">{name} <span className="text-muted font-normal">({tr("usted")})</span></p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-soft">
            <span className="flex items-center gap-1"><Flame size={12} className="text-accent" /> {tr("{p0} semanas seguidas cumpliendo", { p0: m.streak_weeks || 0 })}</span>
            <span className="flex items-center gap-1"><Award size={12} /> {tr("{p0} entrenamientos", { p0: m.workouts })}</span>
            {m.week_days != null && <span>{tr("{p0} días esta semana", { p0: m.week_days })}</span>}
          </div>
          {next && (
            <div className="mt-3">
              <p className="text-soft text-[11px]">{tr("Próximo: {p0}", { p0: tr(next.i.name) })} · {progressText(next.i, pet)}</p>
              <div className="h-1.5 rounded-full bg-field mt-1 overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: `${Math.round(next.pct * 100)}%` }} /></div>
            </div>
          )}
        </div>
      </div>
      {todayList.length > 0 && (
        <div className="bg-card rounded-2xl px-4 py-3 mt-2">
          <p className="text-soft text-xs mb-2 flex items-center gap-1.5"><Sparkles size={13} /> {tr("¿Qué ejercicio quiere destacar hoy?")}</p>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onHighlight(null)} className={`text-xs rounded-full px-3 py-1.5 ${m.highlight_kind !== "elegido" ? "bg-accent text-app font-semibold" : "bg-field text-soft"}`}>{tr("El que elija la app")}</button>
            {todayList.map((x) => (
              <button key={x.id} onClick={() => onHighlight(x.id)} className={`text-xs rounded-full px-3 py-1.5 ${m.highlight_kind === "elegido" && m.highlight_name === x.name ? "bg-accent text-app font-semibold" : "bg-field text-soft"}`}>{x.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Tarjeta del terrario: la mascota en su fondo, con su ropa, y abajo de quién es y cómo va
function TerrariumCard({ m, name, outfit, onReact }) {
  const mood = m.pet_mood || null;
  const sleeping = !mood && !m.trained_today;
  const hl = m.highlight_name ? { name: m.highlight_name, label: tr(HIGHLIGHT_LABEL[m.highlight_kind] || "Destacó") } : null;
  return (
    <div className="rounded-2xl overflow-hidden bg-card flex flex-col">
      <div className="relative">
        <Chameleon mood={mood || 3} sleeping={sleeping} level={m.level || 0} outfit={outfit} scene size={400} animate={false} className="w-full" />
        {m.streak_weeks > 0 && (
          <span className="absolute right-2 top-2 bg-app/70 backdrop-blur text-accent text-[10px] font-semibold rounded-full px-2 py-0.5 flex items-center gap-1"><Flame size={10} /> {m.streak_weeks}</span>
        )}
        {m.is_coach && <span className="absolute left-2 top-2 text-[10px] text-app bg-accent rounded-full px-2 py-0.5 font-semibold">Coach</span>}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-field overflow-hidden flex items-center justify-center shrink-0">
            {m.avatar_url ? <img src={m.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <User size={13} className="text-muted" />}
          </div>
          <p className="text-ink text-xs font-semibold leading-tight line-clamp-2 min-w-0">{name}</p>
        </div>
        <p className="text-muted text-[11px] mt-1 truncate">
          {m.pet_name ? `${m.pet_name} · ` : ""}{sleeping ? tr("Descansando") : tr(PET_STATES[mood || 3].name)}
        </p>
        <p className={`text-[11px] mt-0.5 ${m.trained_today ? "text-accent" : "text-muted"}`}>{m.trained_today ? tr("Entrenó hoy") : tr("Hoy no ha entrenado")}</p>
        {hl && (
          <p className="text-ink text-[11px] mt-2 bg-accent/10 border border-accent/20 rounded-lg px-2 py-1.5 line-clamp-2">
            {m.highlight_kind === "record" ? "🏆 " : "⭐ "}<span className="text-accent font-semibold">{hl.label}:</span> {hl.name}
          </p>
        )}
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2 text-[10px] text-soft">
          <span>{tr("{p0} entrenamientos", { p0: m.workouts })}</span>
          {m.records_month > 0 && <span>· {tr("{p0} récords este mes", { p0: m.records_month })}</span>}
          <span>· {tr(PET_LEVELS[m.level || 0].name)}</span>
        </div>
        <div className="flex gap-1 mt-auto pt-2">
          {REACTIONS.map((r) => {
            const n = Number(m.reactions?.[r.key] || 0);
            const on = (m.my_reactions || []).includes(r.key);
            return (
              <button key={r.key} type="button" onClick={() => onReact?.(r.key)} aria-label={tr(r.label)}
                className={`flex-1 rounded-lg py-1.5 text-sm flex items-center justify-center gap-1 transition-colors active:scale-95 ${on ? "bg-accent/20 border border-accent/40" : "bg-white/[0.04] border border-transparent"}`}>
                <span>{r.emoji}</span>{n > 0 && <span className="text-soft text-[11px] tabular-nums">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
