// PDF del alumno: progreso, medidas (con la figura), nutrición, calendario del plan y, al final, las rutinas.
// También el PDF de una sola rutina.
import { blockTypeLabel } from "@/lib/blocks";
import { WEEK_DAYS, localDateString } from "@/lib/dates";
import { computeResults } from "@/lib/measurements";
import { addDays, loadSchedule, planLastDay, planStart, planWeekOf } from "@/lib/trainingPlan";
import { createPdf, downloadBlob, safeFileName, textWidth } from "@/lib/pdf";
import { bodyFigureJpeg } from "@/lib/figureImage";

const plain = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? "").toString()) : text);

const INK = [0.09, 0.1, 0.09];
const SOFT = [0.33, 0.36, 0.34];
const MUTED = [0.55, 0.57, 0.55];
const ACCENT = [0.47, 0.62, 0.02]; // lima oscurecido para que se lea sobre blanco
const LIME = [0.84, 1, 0.36];
const BAND = [0.95, 0.97, 0.91];
const CARD = [0.96, 0.965, 0.955];
const LINE = [0.86, 0.87, 0.85];
const DARK = [0.059, 0.082, 0.071];
const TONE = { good: ACCENT, ok: SOFT, low: [0.8, 0.55, 0.1], warn: [0.85, 0.5, 0.05], bad: [0.85, 0.25, 0.15] };

const GOALS = { deficit: "Bajar grasa", mantener: "Mantener", superavit: "Ganar músculo" };
const ACTIVITY = { sedentario: "Sedentario", moderado: "Moderado", activo: "Activo" };

const dec = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(/\.?0+$/, "").replace(".", ","));

// ---------- Datos ----------

// Ejercicios y bloques de varias rutinas a la vez
export async function loadRoutineDetails(supabase, routineIds) {
  const ids = [...new Set(routineIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const [{ data: routines }, { data: exercises }, { data: blocks }] = await Promise.all([
    supabase.from("routines").select("id, title, goal, duration_minutes").in("id", ids),
    supabase
      .from("routine_exercises")
      .select("routine_id, block_id, sets, reps, order_index, target_weight_kg, rest_minutes, exercises(name)")
      .in("routine_id", ids)
      .order("order_index"),
    supabase.from("routine_blocks").select("id, routine_id, block_type, title, sets, notes, order_index").in("routine_id", ids).order("order_index"),
  ]);
  const map = {};
  (routines || []).forEach((r) => { map[r.id] = { ...r, blocks: [], list: [] }; });
  (blocks || []).forEach((b) => { map[b.routine_id]?.blocks.push({ ...b, exercises: [] }); });
  (exercises || []).forEach((e) => {
    const r = map[e.routine_id];
    if (!r) return;
    const item = { name: e.exercises?.name || "Ejercicio", sets: e.sets, reps: e.reps, kg: e.target_weight_kg, rest: e.rest_minutes };
    const block = e.block_id ? r.blocks.find((b) => b.id === e.block_id) : null;
    if (block) block.exercises.push(item);
    else r.list.push(item);
  });
  return map;
}

async function loadReportData(supabase, userId, plan) {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  const progressFrom = plan ? planStart(plan) : addDays(new Date(), -29);
  const [weights, measures, nutrition, meals, progress, details] = await Promise.all([
    supabase.from("body_weight_logs").select("weight_kg, logged_at").eq("user_id", userId).order("logged_at", { ascending: false }).limit(40),
    supabase.from("body_measurements").select("*").eq("user_id", userId).order("measured_on", { ascending: false }).limit(2),
    supabase.from("nutrition_profiles").select("weight_kg, height_cm, age, gender, activity_level, goal, target_calories, protein_g").eq("user_id", userId).maybeSingle(),
    supabase.from("meal_logs").select("log_date, calories, protein_g").eq("user_id", userId).gte("log_date", localDateString(since)),
    supabase.from("progress").select("completed_at").eq("user_id", userId).gte("completed_at", progressFrom.toISOString()).limit(5000),
    plan ? loadRoutineDetails(supabase, (plan.training_plan_days || []).map((d) => d.routine_id)) : Promise.resolve({}),
  ]);
  return {
    weights: (weights.data || []).slice().reverse(),
    measures: measures.data || [],
    nutrition: nutrition.data || null,
    meals: meals.data || [],
    progress: progress.data || [],
    progressFrom,
    details,
  };
}

// ---------- Piezas de diseño ----------

function header(doc, title, studentName, subtitle) {
  const M = doc.margin;
  doc.rect(0, 0, doc.width, 6, LIME);
  doc.text("kineaco", M, doc.y, { size: 10, bold: true, color: ACCENT });
  doc.y += 16;
  doc.text(title, M, doc.y, { size: 21, bold: true, color: INK });
  doc.y += 27;
  if (studentName) {
    doc.text(studentName, M, doc.y, { size: 12, color: SOFT });
    doc.y += 17;
  }
  if (subtitle) doc.paragraph(subtitle, { size: 9.5, color: MUTED });
  doc.y += 10;
}

function section(doc, title) {
  doc.ensure(70);
  doc.y += 6;
  doc.rect(doc.margin, doc.y + 2, 3, 15, LIME);
  doc.text(title, doc.margin + 10, doc.y + 2, { size: 13.5, bold: true, color: INK });
  doc.y += 26;
}

// Tarjetas con un número grande: [{ label, value, unit, note }]
function stats(doc, items) {
  const M = doc.margin;
  const gap = 8;
  const w = (doc.contentWidth - gap * (items.length - 1)) / items.length;
  doc.ensure(62);
  items.forEach((it, i) => {
    const x = M + i * (w + gap);
    doc.roundRect(x, doc.y, w, 54, 6, CARD);
    doc.text(it.label, x + 10, doc.y + 8, { size: 8.5, color: MUTED });
    doc.text(it.value, x + 10, doc.y + 21, { size: 16, bold: true, color: INK });
    if (it.unit) doc.text(it.unit, x + 12 + textWidth(it.value, 16, true), doc.y + 27, { size: 9, color: SOFT });
    if (it.note) doc.text(it.note, x + 10, doc.y + 41, { size: 8, color: it.noteColor || SOFT });
  });
  doc.y += 64;
}

// Fila "etiqueta ........ valor  (calificación)"
function resultRow(doc, x, w, label, value, info, t) {
  doc.text(label, x, doc.y, { size: 9.5, color: SOFT });
  const tag = info?.label ? t(info.label) : "";
  const tagW = tag ? textWidth(tag, 8.5, true) + 4 : 0;
  doc.text(value, x + w - tagW - textWidth(value, 10, true) - (tag ? 6 : 0), doc.y - 0.5, { size: 10, bold: true, color: INK });
  if (tag) doc.text(tag, x + w - tagW + 4, doc.y, { size: 8.5, bold: true, color: TONE[info.tone] || SOFT });
  doc.y += 12;
  doc.line(x, doc.y, x + w, doc.y, LINE, 0.4);
  doc.y += 6;
}

function weightChart(doc, points) {
  const M = doc.margin;
  const w = doc.contentWidth, h = 90;
  doc.ensure(h + 20);
  const top = doc.y;
  doc.roundRect(M, top, w, h, 6, CARD);
  const vals = points.map((p) => Number(p.weight_kg));
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const px = (i) => M + 36 + (i * (w - 52)) / Math.max(1, vals.length - 1);
  const py = (v) => top + 12 + (h - 24) * (1 - (v - min) / span);
  doc.text(`${dec(max)} kg`, M + 6, py(max) - 4, { size: 7.5, color: MUTED });
  doc.text(`${dec(min)} kg`, M + 6, py(min) - 4, { size: 7.5, color: MUTED });
  doc.polyline(vals.map((v, i) => [px(i), py(v)]), ACCENT, 1.6);
  vals.forEach((v, i) => doc.circle(px(i), py(v), i === vals.length - 1 ? 2.6 : 1.4, ACCENT));
  doc.y = top + h + 12;
}

function exerciseLine(ex, withSets, t) {
  const parts = [];
  const reps = ex.reps ? t("{p0} reps", { p0: ex.reps }) : "";
  if (withSets && Number(ex.sets) > 0) parts.push(reps ? `${ex.sets} × ${reps}` : t("{p0} series", { p0: ex.sets }));
  else if (reps) parts.push(reps);
  if (ex.kg != null && ex.kg !== "") parts.push(`${dec(ex.kg, 2)} kg`);
  if (ex.rest != null && ex.rest !== "") parts.push(t("descanso {p0} min", { p0: dec(ex.rest, 2) }));
  return parts.join(" · ");
}

function routineDetail(doc, r, t, first, showTitle = true) {
  const M = doc.margin;
  const CW = doc.contentWidth;
  doc.ensure(70);
  if (!first) {
    doc.line(M, doc.y, M + CW, doc.y, LINE);
    doc.y += 12;
  }
  if (showTitle) doc.paragraph(r.title || t("Rutina"), { size: 13, bold: true, color: INK, after: 2 });
  const meta = [r.goal, Number(r.duration_minutes) > 0 ? `${r.duration_minutes} ${t("min")}` : ""].filter(Boolean).join(" · ");
  if (meta) doc.paragraph(meta, { size: 9, color: MUTED, after: 2 });
  doc.y += 4;

  const writeExercises = (list, withSets) => {
    list.forEach((ex) => {
      const detail = exerciseLine(ex, withSets, t);
      const nameLines = doc.wrap(ex.name, CW - 30, 10, false);
      const detailLines = detail ? doc.wrap(detail, CW - 30, 9, false) : [];
      doc.ensure(nameLines.length * 13 + detailLines.length * 12 + 4);
      doc.circle(M + 12, doc.y + 4.5, 1.8, ACCENT);
      nameLines.forEach((l) => { doc.text(l, M + 22, doc.y, { size: 10, color: INK }); doc.y += 13; });
      detailLines.forEach((l) => { doc.text(l, M + 22, doc.y, { size: 9, color: SOFT }); doc.y += 12; });
      doc.y += 3;
    });
  };

  if (r.blocks.length > 0) {
    r.blocks.forEach((b) => {
      const head = [b.title || t(blockTypeLabel(b.block_type)), Number(b.sets) > 0 ? t("{p0} series", { p0: b.sets }) : ""].filter(Boolean).join("  ·  ");
      doc.ensure(36);
      doc.text(head, M + 4, doc.y, { size: 10.5, bold: true, color: ACCENT });
      doc.y += 15;
      if (b.notes) doc.paragraph(b.notes, { x: M + 4, size: 9, color: MUTED, after: 3 });
      writeExercises(b.exercises, false);
      doc.y += 4;
    });
  } else {
    writeExercises(r.list, true);
  }
  doc.y += 6;
}

// ---------- Secciones del informe ----------

function progressSection(doc, data, plan, schedule, t, locale) {
  section(doc, t("Progreso"));
  const w = data.weights;
  if (w.length > 0) {
    const last = w[w.length - 1], first = w[0];
    const change = Number(last.weight_kg) - Number(first.weight_kg);
    const fmtD = (iso) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
    stats(doc, [
      { label: t("Peso actual"), value: dec(last.weight_kg), unit: "kg", note: fmtD(last.logged_at) },
      { label: t("Primer registro"), value: dec(first.weight_kg), unit: "kg", note: fmtD(first.logged_at) },
      { label: t("Cambio"), value: `${change > 0 ? "+" : ""}${dec(change)}`, unit: "kg", note: t("{p0} registros", { p0: w.length }) },
    ]);
    if (w.length > 1) weightChart(doc, w);
  } else {
    doc.paragraph(t("Todavía no hay registros de peso corporal."), { size: 9.5, color: MUTED, after: 8 });
  }

  // Días entrenados
  const trained = new Set(data.progress.map((p) => localDateString(new Date(p.completed_at))));
  const today = new Date();
  if (plan && schedule) {
    const end = planLastDay(plan) < today ? planLastDay(plan) : today;
    let planned = 0;
    let done = 0;
    for (let d = planStart(plan); d <= end; d = addDays(d, 1)) {
      const has = (plan.training_plan_days || []).some((x) => x.week_index === planWeekOf(plan, d) && x.day_label === WEEK_DAYS[(d.getDay() + 6) % 7]);
      if (has) planned += 1;
      if (has && trained.has(localDateString(d))) done += 1;
    }
    const pct = planned ? Math.round((done / planned) * 100) : 0;
    stats(doc, [
      { label: t("Entrenos hechos en el plan"), value: `${done}`, unit: t("de {p0}", { p0: planned }), note: planned ? t("{p0} % de cumplimiento", { p0: pct }) : t("El plan todavía no empieza") },
      { label: t("Días entrenados en total"), value: `${trained.size}`, unit: t("días"), note: t("desde el inicio del plan") },
    ]);
  } else {
    stats(doc, [{ label: t("Días entrenados"), value: `${trained.size}`, unit: t("días"), note: t("últimos 30 días") }]);
  }
}

async function measurementsSection(doc, data, t, locale) {
  const [m, prev] = data.measures;
  if (!m) return;
  const sex = m.sex || data.nutrition?.gender || "mujer";
  const values = { ...m, sex };
  const r = computeResults(values);
  section(doc, t("Medidas"));
  doc.paragraph(t("Medición del {p0}", { p0: new Date(`${m.measured_on}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) }) + (prev ? ` · ${t("comparada con la anterior")}` : ""), { size: 9, color: MUTED, after: 6 });

  const M = doc.margin;
  const figW = 200, figH = 261;
  doc.ensure(figH + 10);
  const top = doc.y;
  doc.roundRect(M, top, figW, figH, 8, DARK);
  const img = await bodyFigureJpeg({ sex, values, previous: prev ? { ...prev, sex } : null, labels: true, t });
  if (img) doc.image(img.data, img.width, img.height, M + 2, top + 2, figW - 4, figH - 4);

  // Resultados a la derecha de la figura
  const x = M + figW + 18;
  const w = doc.contentWidth - figW - 18;
  doc.y = top + 2;
  if (r.bodyFat) {
    doc.text(t("Grasa corporal"), x, doc.y, { size: 9, color: MUTED });
    doc.y += 12;
    doc.text(`${dec(r.bodyFat.value)} %`, x, doc.y, { size: 24, bold: true, color: INK });
    if (r.bodyFat.label) doc.text(t(r.bodyFat.label), x + textWidth(`${dec(r.bodyFat.value)} %`, 24, true) + 8, doc.y + 8, { size: 9.5, bold: true, color: TONE[r.bodyFat.tone] || SOFT });
    doc.y += 32;
    if (r.bodyFat.ranges) {
      doc.paragraph(t("Rango saludable para su edad: {p0}–{p1} %.", { p0: r.bodyFat.ranges.low, p1: r.bodyFat.ranges.healthy }), { x, maxW: w, size: 8.5, color: SOFT, after: 6 });
    }
  }
  if (r.fatKg != null) resultRow(doc, x, w, t("Masa grasa"), `${dec(r.fatKg)} kg`, null, t);
  if (r.leanKg != null) resultRow(doc, x, w, t("Masa libre de grasa"), `${dec(r.leanKg)} kg`, null, t);
  if (r.ffmi) resultRow(doc, x, w, "FFMI", dec(r.ffmi.value), r.ffmi, t);
  if (r.whtr) resultRow(doc, x, w, t("Cintura / estatura"), dec(r.whtr.value, 2), r.whtr, t);
  if (r.waist) resultRow(doc, x, w, t("Cintura"), `${dec(r.waist.value)} cm`, r.waist, t);
  if (r.whr) resultRow(doc, x, w, t("Cintura / cadera"), dec(r.whr.value, 2), r.whr, t);
  if (r.bmi) resultRow(doc, x, w, t("IMC"), dec(r.bmi.value), r.bmi, t);
  doc.y = Math.max(doc.y, top + figH) + 12;

  // Diferencias entre lados
  const diffs = (r.asymmetry || []).filter((a) => a.diff > 0);
  if ((r.asymmetry || []).length > 0) {
    doc.ensure(40);
    doc.text(t("Diferencias entre lados"), M, doc.y, { size: 10.5, bold: true, color: INK });
    doc.y += 15;
    if (diffs.length === 0) {
      doc.paragraph(t("Lados iguales"), { size: 9.5, color: SOFT, after: 6 });
    } else {
      diffs.forEach((a) => {
        doc.ensure(16);
        const color = a.level === "high" ? TONE.bad : a.level === "mid" ? TONE.warn : SOFT;
        doc.text(t(a.label), M + 4, doc.y, { size: 9.5, color: INK });
        doc.text(`${t("der.")} ${dec(a.r)} · ${t("izq.")} ${dec(a.l)} cm`, M + 150, doc.y, { size: 9.5, color: SOFT });
        doc.text(`${dec(a.diff)} cm · ${a.bigger === "derecho" ? t("más grande el derecho") : t("más grande el izquierdo")}`, M + 310, doc.y, { size: 9.5, bold: true, color });
        doc.y += 15;
      });
      doc.paragraph(t("Menos de 1 cm suele ser normal o error de medición; de 1 a 2 cm vale la pena vigilarlo; más de 2 cm conviene trabajarlo con su coach."), { size: 8.5, color: MUTED, after: 6 });
    }
  }
}

function nutritionSection(doc, data, t) {
  const n = data.nutrition;
  section(doc, t("Nutrición"));
  if (!n) {
    doc.paragraph(t("Todavía no hay datos de nutrición."), { size: 9.5, color: MUTED, after: 8 });
    return;
  }
  stats(doc, [
    { label: t("Calorías al día"), value: `${n.target_calories ?? "—"}`, unit: "kcal", note: t(GOALS[n.goal] || n.goal || "") },
    { label: t("Proteína al día"), value: `${n.protein_g ?? "—"}`, unit: "g", note: "" },
  ]);
  const info = [
    [t("Objetivo"), t(GOALS[n.goal] || n.goal || "—")],
    [t("Actividad"), t(ACTIVITY[n.activity_level] || n.activity_level || "—")],
    [t("Peso"), n.weight_kg ? `${dec(n.weight_kg)} kg` : "—"],
    [t("Estatura"), n.height_cm ? `${dec(n.height_cm)} cm` : "—"],
    [t("Edad"), n.age ? `${n.age}` : "—"],
  ];
  const M = doc.margin;
  const colW = doc.contentWidth / 2;
  info.forEach(([k, v], i) => {
    if (i % 2 === 0) doc.ensure(18);
    const x = M + (i % 2) * colW;
    doc.text(k, x, doc.y, { size: 9, color: MUTED });
    doc.text(v, x + 70, doc.y, { size: 9.5, bold: true, color: INK });
    if (i % 2 === 1 || i === info.length - 1) doc.y += 16;
  });

  // Comidas de las últimas 2 semanas
  const byDay = {};
  data.meals.forEach((m) => {
    const d = (byDay[m.log_date] = byDay[m.log_date] || { kcal: 0, protein: 0 });
    d.kcal += Number(m.calories) || 0;
    d.protein += Number(m.protein_g) || 0;
  });
  const days = Object.values(byDay);
  doc.y += 6;
  if (days.length > 0) {
    const avg = (k) => Math.round(days.reduce((s, d) => s + d[k], 0) / days.length);
    stats(doc, [
      { label: t("Días con comidas (14 días)"), value: `${days.length}`, unit: t("de 14"), note: "" },
      { label: t("Promedio de calorías"), value: `${avg("kcal")}`, unit: "kcal", note: n.target_calories ? t("meta {p0}", { p0: n.target_calories }) : "" },
      { label: t("Promedio de proteína"), value: `${avg("protein")}`, unit: "g", note: n.protein_g ? t("meta {p0} g", { p0: n.protein_g }) : "" },
    ]);
  } else {
    doc.paragraph(t("No registró comidas en las últimas 2 semanas."), { size: 9.5, color: MUTED, after: 8 });
  }
}

function calendarSection(doc, plan, details, t, locale) {
  const M = doc.margin;
  const CW = doc.contentWidth;
  const fmt = (d) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  section(doc, t("Plan de entrenamiento"));
  const start = planStart(plan);
  const days = plan.training_plan_days || [];
  for (let w = 1; w <= plan.weeks; w++) {
    const wStart = addDays(start, (w - 1) * 7);
    doc.ensure(60);
    doc.roundRect(M, doc.y, CW, 20, 4, BAND);
    doc.text(t("Semana {p0}", { p0: w }), M + 8, doc.y + 5, { size: 10.5, bold: true, color: INK });
    const range = `${fmt(wStart)} – ${fmt(addDays(wStart, 6))}`;
    doc.text(range, M + CW - 8 - textWidth(range, 9), doc.y + 6, { size: 9, color: MUTED });
    doc.y += 26;
    WEEK_DAYS.forEach((label, i) => {
      const date = addDays(wStart, i);
      const items = days.filter((d) => d.week_index === w && d.day_label === label).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      const titles = items.map((d) => details[d.routine_id]?.title || d.routines?.title || t("Rutina"));
      const right = titles.length ? titles.join(" + ") : t("Descanso");
      const lines = doc.wrap(right, CW - 110, 9.5, titles.length > 0);
      doc.ensure(lines.length * 13 + 4);
      doc.text(`${t(label)} ${date.getDate()}`, M + 8, doc.y, { size: 9.5, color: SOFT });
      lines.forEach((l, j) => doc.text(l, M + 100, doc.y + j * 13, { size: 9.5, bold: titles.length > 0, color: titles.length ? INK : MUTED }));
      doc.y += lines.length * 13 + 3;
    });
    doc.y += 8;
  }
}

// ---------- Descargas ----------

// Informe completo: progreso → medidas → nutrición → (calendario del plan, si hay) → entrenamientos.
// Funciona CON plan por semanas o SIN plan (en ese caso usa los días fijos del alumno).
export async function downloadReportPdf({ supabase, userId, plan = null, fixed = null, studentName, t = plain, locale = "es-CO", includeHealth = true }) {
  const data = await loadReportData(supabase, userId, plan);
  const doc = createPdf();
  const genLine = t("Generado el {p0}", { p0: new Date().toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) });

  if (plan) {
    const start = planStart(plan);
    const end = planLastDay(plan);
    const subtitle = [
      plan.name,
      `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`,
      t("{p0} semanas", { p0: plan.weeks }),
      genLine,
    ].filter(Boolean).join("  ·  ");
    header(doc, t("Informe de entrenamiento"), studentName, subtitle);
  } else {
    header(doc, t("Informe de entrenamiento"), studentName, genLine);
  }

  progressSection(doc, data, plan, true, t, locale);
  if (includeHealth) await measurementsSection(doc, data, t, locale);
  nutritionSection(doc, data, t);

  if (plan) {
    calendarSection(doc, plan, data.details, t, locale);
    const usedIds = [...new Set((plan.training_plan_days || []).map((d) => d.routine_id))].filter((id) => data.details[id]);
    if (usedIds.length > 0) {
      doc.ensure(160);
      section(doc, t("Rutinas del plan"));
      usedIds.forEach((id, i) => routineDetail(doc, data.details[id], t, i === 0));
    }
  } else {
    // Sin plan: las rutinas de sus días fijos de la semana
    const fixedRows = fixed || (await loadSchedule(supabase, userId, "id, title")).fixed;
    const ids = [...new Set((fixedRows || []).map((a) => a.routine_id || a.routines?.id).filter(Boolean))];
    if (ids.length > 0) {
      const details = await loadRoutineDetails(supabase, ids);
      const list = ids.map((id) => details[id]).filter(Boolean);
      if (list.length > 0) {
        doc.ensure(160);
        section(doc, t("Entrenamientos"));
        list.forEach((r, i) => routineDetail(doc, r, t, i === 0));
      }
    }
  }

  const stamp = plan ? plan.start_date : new Date().toISOString().slice(0, 10);
  downloadBlob(doc.toBlob(), `${safeFileName(`${t("Informe")} ${studentName || ""} ${stamp}`)}.pdf`);
}

// Compatibilidad: el informe del plan es el mismo informe general
export const downloadPlanPdf = downloadReportPdf;

// Una sola rutina (o las rutinas de un día)
export async function downloadRoutinePdf({ supabase, routineIds, dayTitle, t = plain, locale = "es-CO" }) {
  const details = await loadRoutineDetails(supabase, routineIds);
  const list = routineIds.map((id) => details[id]).filter(Boolean);
  if (list.length === 0) throw new Error(t("No se encontró la rutina."));
  const doc = createPdf();
  const title = list.length === 1 ? list[0].title || t("Rutina") : t("Entrenamiento del día");
  header(doc, title, null, [dayTitle, t("Generado el {p0}", { p0: new Date().toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })].filter(Boolean).join("  ·  "));
  list.forEach((r, i) => routineDetail(doc, r, t, i === 0, list.length > 1));
  downloadBlob(doc.toBlob(), `${safeFileName(title)}.pdf`);
}
