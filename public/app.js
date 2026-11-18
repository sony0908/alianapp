const K = "bichito-v2",
  O = "bichito-data-v1",
  $ = (x) => document.getElementById(x),
  blank = {
    events: [],
    cryChecks: {},
    profile: {
      name: "Bichito",
      birthDate: "",
      wakeWindow: 120,
      reminder: false,
    },
  };

let S = load(),
  pick = key(),
  edit = null,
  said = "",
  timer,
  liveInterval;

function load() {
  try {
    let x = JSON.parse(localStorage.getItem(K) || "null");
    if (!x) {
      let o = JSON.parse(localStorage.getItem(O) || "null");
      x = o && {
        events: o.events,
        profile: {
          name: o.settings?.name || "Bichito",
          wakeWindow: o.settings?.wakeWindow || 120,
        },
      };
    }
    return {
      events: Array.isArray(x?.events) ? x.events : [],
      cryChecks: x?.cryChecks || {},
      profile: { ...blank.profile, ...x?.profile },
    };
  } catch {
    return structuredClone(blank);
  }
}

function save() {
  localStorage.setItem(K, JSON.stringify(S));
}

function key(d = new Date()) {
  d = new Date(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function date(k) {
  return new Date(`${k}T12:00:00`);
}

function fmt(d) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(new Date(d))
    .replace(/^./, (x) => x.toUpperCase());
}

function clock(d) {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function input(d) {
  if (!d) return "";
  d = new Date(d);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function id() {
  return crypto.randomUUID?.() || `${Date.now()}${Math.random()}`;
}

function all() {
  return [...S.events].sort((a, b) => new Date(a.time) - new Date(b.time));
}

function events(d = pick) {
  return S.events
    .filter((x) => key(x.time) === d)
    .sort((a, b) => new Date(b.time) - new Date(a.time));
}

function esc(s) {
  let e = document.createElement("i");
  e.textContent = s;
  return e.innerHTML;
}

const M = {
  sleepStart: ["Se durmió (Inicio de sueño)", "🌙"],
  sleepEnd: ["Despertó (Fin de sueño)", "☀️"],
  feedingStart: ["Empezó con hambre", "🍼"],
  feeding: ["Terminó la leche", "🍼"],
  diaperStart: ["Cambio de pañal", "🧷"],
  diaper: ["Cambio de pañal", "🧷"],
  note: ["Nota", "•"],
};

function mins(n) {
  n = Math.max(0, Math.round(n));
  return n >= 60
    ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ""}`
    : `${n} min`;
}

function formatChrono(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  return `${String(hrs).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function detail(e) {
  let parts = [];
  if (e.type === "feeding" || e.type === "feedingStart") {
    if (e.details?.hungerStart) {
      const durMin = Math.round(
        (+new Date(e.time) - +new Date(e.details.hungerStart)) / 60000
      );
      if (durMin > 0 && durMin < 240) {
        parts.push(`Hambre ${clock(e.details.hungerStart)} (${durMin} min)`);
      }
    }
    if (e.details?.method) parts.push(e.details.method);
    if (e.details?.amount) parts.push(`${e.details.amount} ml`);
  } else if (e.type === "diaper" || e.type === "diaperStart") {
    if (e.details?.kind) parts.push(e.details.kind.replace(/caca/gi, (m) => (m[0] === "C" ? "Popó" : "popó")));
  } else if (e.type === "sleepStart" || e.type === "sleepEnd") {
    if (e.details?.place) parts.push(e.details.place);
    if (e.type === "sleepEnd" && e.details?.sleepStart) {
      const durMin = Math.round(
        (+new Date(e.time) - +new Date(e.details.sleepStart)) / 60000
      );
      if (durMin > 0 && durMin < 1440) {
        parts.push(`Durmió ${mins(durMin)}`);
      }
    }
  }
  if (e.note) parts.push(e.note);
  return parts.filter(Boolean).join(" · ");
}

function hasPendingDetails(e) {
  if (!e) return false;
  if (e.type === "feeding" || e.type === "feedingStart") {
    return !e.details?.method && !e.details?.amount && !e.note;
  }
  if (e.type === "diaper" || e.type === "diaperStart") {
    return !e.details?.kind && !e.note;
  }
  if (e.type === "sleepStart" || e.type === "sleepEnd") {
    return !e.details?.place && !e.note;
  }
  return false;
}

function add(type, time = new Date().toISOString(), details = {}, note = "") {
  const entry = { id: id(), type, time, details, note };
  S.events.push(entry);
  save();
  render();
  return entry;
}

// --- Estados activos de cada parámetro ---
function activeSleep() {
  let a = null;
  for (const e of all()) {
    if (e.type === "sleepStart") a = e;
    if (e.type === "sleepEnd") a = null;
  }
  return a;
}

function activeFeeding() {
  let a = null;
  for (const e of all()) {
    if (e.type === "feedingStart") a = e;
    if (e.type === "feeding") a = null;
  }
  return a;
}

function latestOfTypes(types) {
  return all()
    .filter((x) => types.includes(x.type))
    .at(-1);
}

function latest(type) {
  return all()
    .filter((x) => x.type === type)
    .at(-1);
}

// --- Acciones de 1 toque ---
function toggleSleepState() {
  const sleeping = activeSleep();
  const nowIso = new Date().toISOString();
  if (sleeping) {
    add("sleepEnd", nowIso, {
      sleepStart: sleeping.time,
      place: sleeping.details?.place || "",
    });
    toast("☀️ Despertó · Puedes añadir detalles cuando quieras");
  } else {
    add("sleepStart", nowIso, {});
    toast("🌙 Se durmió · Cronómetro de sueño iniciado");
  }
}

function toggleFeedState() {
  const feeding = activeFeeding();
  const nowIso = new Date().toISOString();
  if (feeding) {
    // Transformamos o cerramos el ciclo desde que empezó con hambre hasta que terminó la leche
    const details = {
      ...feeding.details,
      hungerStart: feeding.details?.hungerStart || feeding.time,
    };
    const note = feeding.note || "";
    // Reemplazamos el evento feedingStart por el registro consolidado 'feeding' con hungerStart y time=fin
    const idx = S.events.findIndex((e) => e.id === feeding.id);
    if (idx !== -1) {
      S.events[idx] = {
        ...feeding,
        type: "feeding",
        time: nowIso,
        details,
        note,
      };
      save();
      render();
    } else {
      add("feeding", nowIso, details, note);
    }
    toast("🍼 Terminó la leche · Añade ml o método con calma");
  } else {
    add("feedingStart", nowIso, { hungerStart: nowIso });
    toast("🍼 Empezó con hambre · Cronómetro corriendo");
  }
}

function toggleDiaperState() {
  const nowIso = new Date().toISOString();
  add("diaper", nowIso, {});
  toast("🧷 Contador de pañal reiniciado · Puedes añadir pipí o popó al lado");
}

// --- Cálculos matemáticos corregidos ---

// 1. Ventanas de vigilia reales (solo pares consecutivos sleepEnd -> sleepStart)
function samples() {
  let a = all().filter((x) => x.type === "sleepStart" || x.type === "sleepEnd"),
    v = [];
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i].type === "sleepEnd" && a[i + 1].type === "sleepStart") {
      let m = (+new Date(a[i + 1].time) - +new Date(a[i].time)) / 60000;
      if (m >= 25 && m <= 420) v.push(m);
    }
  }
  return v.slice(-12);
}

function model() {
  let a = samples();
  const fallback = +S.profile.wakeWindow || 120;
  if (a.length < 2)
    return { m: fallback, n: a.length, learn: false };
  let sorted = [...a].sort((x, y) => x - y);
  let mid = sorted[Math.floor(sorted.length / 2)];
  let v = a.filter((x) => Math.abs(x - mid) <= 90);
  if (!v.length) v = a;
  let num = v.reduce((s, x, i) => s + x * (i + 1), 0);
  let den = v.reduce((s, _, i) => s + (i + 1), 0);
  let w = den > 0 ? num / den : fallback;
  return { m: Math.max(30, Math.round(w / 5) * 5), n: a.length, learn: true };
}

function estimate() {
  let a = activeSleep(),
    mo = model();
  if (a) {
    const durMin = Math.max(0, Math.round((Date.now() - +new Date(a.time)) / 60000));
    return {
      sleeping: true,
      activeEvent: a,
      sinceMs: +new Date(a.time),
      t: "Durmiendo",
      c: `Inició a las ${clock(a.time)} (${mins(durMin)}).`,
      d: "100%",
      n: "Recalcularemos su ventana al despertar",
      q: "Cuando despierte, pulsa «Despertó».",
      mo,
    };
  }
  let last = latest("sleepEnd");
  if (!last) {
    return {
      sleeping: false,
      activeEvent: null,
      sinceMs: null,
      t: "Despierto",
      c: "Pulsa «Se durmió» cuando inicie su siesta o sueño.",
      d: "10%",
      n: `Ventana inicial: ${mins(mo.m)}`,
      q: "Aprenderemos su ritmo automáticamente con cada descanso.",
      mo,
    };
  }
  const lastEndMs = +new Date(last.time);
  const awakeMin = Math.max(0, (Date.now() - lastEndMs) / 60000);
  let target = new Date(lastEndMs + mo.m * 60000),
    left = Math.round((target - Date.now()) / 60000);
  const pct = Math.max(4, Math.min(98, Math.round((awakeMin / mo.m) * 100)));

  return left <= 0
    ? {
        sleeping: false,
        activeEvent: null,
        sinceMs: lastEndMs,
        t: "En ventana de sueño",
        c: `Despertó a las ${clock(last.time)} · Ya cumplió su ventana (${mins(mo.m)}).`,
        d: `${pct}%`,
        n: `Tocaba siesta a las ${clock(target)} (hace ${mins(Math.abs(left))})`,
        q: "Parece un buen momento para dormir.",
        mo,
        target,
      }
    : {
        sleeping: false,
        activeEvent: null,
        sinceMs: lastEndMs,
        t: "Despierto",
        c: `Despertó a las ${clock(last.time)} · Ventana estimada de ${mins(mo.m)}.`,
        d: `${pct}%`,
        n: `Próxima siesta: ${clock(target)} (en ${mins(left)})`,
        q: `En aproximadamente ${mins(left)}.`,
        mo,
        target,
      };
}

// 2. Cálculos de Leche / Hambre (frecuencia desde hambre, duración de toma y evolución)
function feedingStats() {
  const feeds = all().filter((x) => x.type === "feeding" || x.type === "feedingStart");
  // Puntos de inicio de hambre de cada toma
  const hungerTimes = feeds.map((f) => +new Date(f.details?.hungerStart || f.time));
  let gaps = [];
  for (let i = 1; i < hungerTimes.length; i++) {
    const gapMin = (hungerTimes[i] - hungerTimes[i - 1]) / 60000;
    if (gapMin >= 25 && gapMin <= 720) {
      gaps.push(gapMin);
    }
  }
  // Últimos 10 intervalos con peso mayor a los más recientes
  const recentGaps = gaps.slice(-10);
  let avgGapMin = null;
  if (recentGaps.length >= 1) {
    const num = recentGaps.reduce((s, g, i) => s + g * (i + 1), 0);
    const den = recentGaps.reduce((s, _, i) => s + (i + 1), 0);
    avgGapMin = Math.round(num / den);
  }

  // Comparación de evolución (primeras tomas vs últimas tomas)
  let trendText = "";
  if (gaps.length >= 4) {
    const half = Math.floor(gaps.length / 2);
    const prevAvg = Math.round(gaps.slice(0, half).reduce((a, b) => a + b, 0) / half);
    const currAvg = Math.round(gaps.slice(half).reduce((a, b) => a + b, 0) / (gaps.length - half));
    const diff = currAvg - prevAvg;
    if (Math.abs(diff) >= 10) {
      trendText =
        diff > 0
          ? `Su frecuencia se ha espaciado (+${diff} min entre tomas respecto a días anteriores).`
          : `Está pidiendo leche más seguido (${diff} min entre tomas respecto a días anteriores).`;
    } else {
      trendText = "Su frecuencia de alimentación se mantiene estable.";
    }
  }

  // Duración promedio desde que empieza con hambre hasta que termina la leche
  const completedWithHunger = all().filter(
    (x) => x.type === "feeding" && x.details?.hungerStart
  );
  const durations = completedWithHunger
    .map((x) => (+new Date(x.time) - +new Date(x.details.hungerStart)) / 60000)
    .filter((d) => d >= 1 && d <= 180)
    .slice(-10);
  const avgDurationMin = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  return {
    avgGapMin,
    avgDurationMin,
    trendText,
    totalCount: feeds.length,
  };
}

function learnedNext(type) {
  if (type === "feeding") {
    const fStats = feedingStats();
    const act = activeFeeding();
    if (act) return "Tomando leche ahora";
    const last = latest("feeding");
    if (!last || !fStats.avgGapMin) return "Aún aprendiendo su frecuencia";
    // Calculamos próximo hambre desde que empezó el hambre anterior o terminó la toma
    const baseMs = +new Date(last.details?.hungerStart || last.time);
    const nextHunger = new Date(baseMs + fStats.avgGapMin * 60000);
    // Si ya pasó respecto al inicio del hambre anterior, probamos desde el fin de la toma
    const effectiveTarget =
      nextHunger > new Date(+new Date(last.time) + 15 * 60000)
        ? nextHunger
        : new Date(+new Date(last.time) + fStats.avgGapMin * 60000);
    const leftMin = Math.round((effectiveTarget - Date.now()) / 60000);
    return leftMin <= 0
      ? `Puede empezar con hambre pronto (${clock(effectiveTarget)})`
      : `Aprox. ${clock(effectiveTarget)} (en ${mins(leftMin)})`;
  }

  let records = all().filter((x) => x.type === type).slice(-12);
  if (records.length < 2) return "Aún aprendiendo su frecuencia";
  let gaps = records
    .slice(1)
    .map((record, index) => (+new Date(record.time) - +new Date(records[index].time)) / 60000)
    .filter((gap) => gap >= 20 && gap <= 720);
  if (!gaps.length) return "Aún aprendiendo su frecuencia";
  const num = gaps.reduce((s, g, i) => s + g * (i + 1), 0);
  const den = gaps.reduce((s, _, i) => s + (i + 1), 0);
  let average = num / den;
  let target = new Date(+new Date(records.at(-1).time) + average * 60000);
  const leftMin = Math.round((target - Date.now()) / 60000);
  return leftMin <= 0
    ? `Puede tocar revisión pronto (${clock(target)})`
    : `Aprox. ${clock(target)} (en ${mins(leftMin)})`;
}

// 3. Cálculo de sueño por día exacto (incluyendo siestas que cruzan medianoche y siesta en curso)
function sleep(d) {
  const dayStart = +new Date(`${d}T00:00:00`);
  const dayEnd = dayStart + 86400000;
  const now = Date.now();
  let startMs = null;
  let totalMs = 0;

  for (const e of all()) {
    const t = +new Date(e.time);
    if (e.type === "sleepStart") {
      startMs = t;
    } else if (e.type === "sleepEnd" && startMs !== null) {
      const segStart = Math.max(startMs, dayStart);
      const segEnd = Math.min(t, dayEnd);
      if (segEnd > segStart) {
        totalMs += segEnd - segStart;
      }
      startMs = null;
    }
  }

  // Si hay una siesta activa ahora mismo, sumar lo que cae en este día
  if (startMs !== null && now > startMs) {
    const segStart = Math.max(startMs, dayStart);
    const segEnd = Math.min(now, dayEnd);
    if (segEnd > segStart) {
      totalMs += segEnd - segStart;
    }
  }

  return Math.max(0, Math.round(totalMs / 60000));
}

// 4. Edad exacta sin números negativos por hora del día
function age() {
  if (!S.profile.birthDate) return "";
  const birth = new Date(`${S.profile.birthDate}T00:00:00`);
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now - birth) / 86400000));
  if (diffDays < 31) return `${diffDays} día${diffDays === 1 ? "" : "s"}`;
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months = Math.max(0, months - 1);
  return months < 1 ? `${diffDays} días` : `${months} mes${months === 1 ? "" : "es"}`;
}

// --- Actualización en vivo de los 3 cronómetros cada segundo ---
function updateLiveStopwatches() {
  const now = Date.now();

  // 1. SUEÑO
  const e = estimate();
  const lastSleepEvent = latestOfTypes(["sleepStart", "sleepEnd"]);
  if ($("sleepCard")) {
    $("sleepCard").classList.toggle("is-active", e.sleeping);
    $("sleepStateLabel").textContent = e.sleeping ? "Durmiendo" : "Despierto";
    $("sleepSub").textContent = e.c;
    $("sleepChrono").textContent = e.sinceMs ? formatChrono(now - e.sinceMs) : "00:00:00";
    $("sleepChronoContext").textContent = e.sleeping
      ? "durmiendo ahora"
      : e.sinceMs
        ? "tiempo despierto"
        : "sin siestas aún";
    $("dot").style.left = e.d;
    const todaySleepMin = sleep(key());
    const lastDetail = lastSleepEvent && detail(lastSleepEvent);
    $("sleepMeta").innerHTML = `<b>${e.n}</b> · Sueño acumulado hoy: <b>${mins(todaySleepMin)}</b>${
      lastDetail ? `<br><small>Último detalle: ${esc(lastDetail)}</small>` : ""
    }`;
    $("btnSleepIcon").textContent = e.sleeping ? "☀️" : "🌙";
    $("btnSleepText").textContent = e.sleeping ? "Despertó" : "Se durmió";
    const sleepDetailBtn = $("btnDetailSleep");
    if (sleepDetailBtn) {
      sleepDetailBtn.disabled = !lastSleepEvent;
      sleepDetailBtn.classList.toggle("needs-detail", hasPendingDetails(lastSleepEvent));
      sleepDetailBtn.textContent = hasPendingDetails(lastSleepEvent)
        ? "✎ Añadir detalles •"
        : "✎ Añadir detalles";
    }
  }

  // 2. LECHE / HAMBRE
  const actFeed = activeFeeding();
  const lastFeed = actFeed || latest("feeding");
  const fStats = feedingStats();
  if ($("feedCard")) {
    const isFeeding = Boolean(actFeed);
    $("feedCard").classList.toggle("is-active", isFeeding);
    $("feedStateLabel").textContent = isFeeding ? "Con hambre / Tomando" : "Satisfecho";
    const feedSinceMs = isFeeding
      ? +new Date(actFeed.details?.hungerStart || actFeed.time)
      : lastFeed
        ? +new Date(lastFeed.time)
        : null;
    $("feedChrono").textContent = feedSinceMs ? formatChrono(now - feedSinceMs) : "00:00:00";
    $("feedChronoContext").textContent = isFeeding
      ? "desde que empezó con hambre"
      : lastFeed
        ? "desde que terminó la leche"
        : "sin tomas aún";
    $("feedSub").textContent = isFeeding
      ? `Empezó con hambre a las ${clock(actFeed.details?.hungerStart || actFeed.time)}`
      : lastFeed
        ? `Última leche terminó a las ${clock(lastFeed.time)}`
        : "Pulsa cuando empiece con hambre";

    const nextFeedStr = learnedNext("feeding");
    const freqInfo = fStats.avgGapMin
      ? `Frecuencia promedio: cada <b>${mins(fStats.avgGapMin)}</b>`
      : "Registrando tomas para calcular frecuencia";
    const durInfo = fStats.avgDurationMin
      ? ` · Duración media: <b>${fStats.avgDurationMin} min</b>`
      : "";
    const lastFeedDetail = lastFeed && detail(lastFeed);
    $("feedMeta").innerHTML = `Próxima leche: <b>${nextFeedStr}</b><br>${freqInfo}${durInfo}${
      lastFeedDetail ? `<br><small>Último detalle: ${esc(lastFeedDetail)}</small>` : ""
    }`;
    $("btnFeedIcon").textContent = isFeeding ? "✓" : "🍼";
    $("btnFeedText").textContent = isFeeding ? "Terminó la leche" : "Empezó con hambre";
    const feedDetailBtn = $("btnDetailFeed");
    if (feedDetailBtn) {
      feedDetailBtn.disabled = !lastFeed;
      feedDetailBtn.classList.toggle("needs-detail", hasPendingDetails(lastFeed));
      feedDetailBtn.textContent = hasPendingDetails(lastFeed)
        ? "✎ Añadir detalles •"
        : "✎ Añadir detalles";
    }
  }

  // 3. PAÑAL
  const lastDiaper = latestOfTypes(["diaper", "diaperStart"]);
  if ($("diaperCard")) {
    $("diaperCard").classList.remove("is-active");
    $("diaperStateLabel").textContent = "Pañal limpio";
    const diaperSinceMs = lastDiaper ? +new Date(lastDiaper.time) : null;
    $("diaperChrono").textContent = diaperSinceMs ? formatChrono(now - diaperSinceMs) : "00:00:00";
    $("diaperChronoContext").textContent = lastDiaper
      ? "desde el último cambio"
      : "sin cambios aún";
    $("diaperSub").textContent = lastDiaper
      ? `Último cambio a las ${clock(lastDiaper.time)}`
      : "Pulsa el botón para reiniciar el contador";

    const nextDiaperStr = learnedNext("diaper");
    const lastDiaperDetail = lastDiaper && detail(lastDiaper);
    const todayDiapers = events(key()).filter((x) => x.type === "diaper" || x.type === "diaperStart").length;
    $("diaperMeta").innerHTML = `Próximo cambio estimado: <b>${nextDiaperStr}</b> · Cambios hoy: <b>${todayDiapers}</b>${
      lastDiaperDetail ? `<br><small>Último detalle: ${esc(lastDiaperDetail)}</small>` : ""
    }`;
    $("btnDiaperIcon").textContent = "🧷";
    $("btnDiaperText").textContent = "Pañal cambiado";
    const diaperDetailBtn = $("btnDetailDiaper");
    if (diaperDetailBtn) {
      diaperDetailBtn.disabled = !lastDiaper;
      diaperDetailBtn.classList.toggle("needs-detail", hasPendingDetails(lastDiaper));
      diaperDetailBtn.textContent = hasPendingDetails(lastDiaper)
        ? "✎ Añadir detalles •"
        : "✎ Añadir detalles";
    }
  }
}

function renderCryChecklist(sleepEstimate) {
  let sleeping = activeSleep(),
    lastSleep = sleeping || latest("sleepEnd"),
    actFeed = activeFeeding(),
    lastFeed = actFeed || latest("feeding"),
    lastDiaper = latestOfTypes(["diaper", "diaperStart"]),
    lastSleepText = sleeping
      ? `Durmiendo desde ${clock(sleeping.time)}`
      : lastSleep
        ? `Despertó a las ${clock(lastSleep.time)}`
        : "Aún sin siestas registradas",
    nextSleepText = sleeping
      ? "Próxima siesta: al despertar recalculamos"
      : sleepEstimate.target
        ? `Próxima siesta: ${clock(sleepEstimate.target)}`
        : "Próxima siesta: aún estamos aprendiendo";
  let checks = S.cryChecks[key()] || {};
  let diaperKindLabel = lastDiaper?.details?.kind
    ? ` (${lastDiaper.details.kind.replace(/caca/gi, (m) => (m[0] === "C" ? "Popó" : "popó"))})`
    : "";
  let items = [
    ["Sueño", `${lastSleepText}. ${nextSleepText}.`],
    [
      "Hambre",
      actFeed
        ? `Está tomando leche (empezó con hambre a las ${clock(actFeed.time)}).`
        : `Última leche: ${lastFeed ? clock(lastFeed.time) : "sin registro"}. Próxima leche: ${learnedNext("feeding")}.`,
    ],
    [
      "Pañal",
      `Último cambio: ${lastDiaper ? clock(lastDiaper.time) : "sin registro"}${diaperKindLabel}. Próximo cambio: ${learnedNext("diaper")}.`,
    ],
    ["¿Está aburrido?", "Puede que lleve mucho rato en el mismo lugar."],
    ["¿Incomodidad?", "Revisa postura, temperatura o ropa ajustada."],
    ["¿Dientes o cólicos?", "Revisa si se lleva todo a la boca o tiene gases."],
  ];
  $("cryList").innerHTML = items
    .map(
      ([title, detailText], index) =>
        `<label class="cry-item ${checks[index] ? "done" : ""}"><input type="checkbox" data-cry="${index}" ${checks[index] ? "checked" : ""} /><span><b>${title}</b><small>${detailText}</small></span></label>`
    )
    .join("");
  document.querySelectorAll("[data-cry]").forEach((checkbox) => {
    checkbox.onchange = () => {
      S.cryChecks[key()] = { ...checks, [checkbox.dataset.cry]: checkbox.checked };
      save();
      renderCryChecklist(estimate());
    };
  });
}

function render() {
  let e = estimate(),
    n = S.profile.name || "Bichito",
    fStats = feedingStats();
  $("date").textContent = `${fmt(new Date())}${age() ? ` · ${age()}` : ""}`;
  $("heading").textContent = `El ritmo de ${n}`;

  updateLiveStopwatches();

  const sleepLearn = e.mo.learn
    ? `Sueño: Aprendiendo de ${e.mo.n} ventanas reales (promedio actual: ${mins(e.mo.m)} despierto).`
    : `Sueño: Faltan ${Math.max(1, 2 - e.mo.n)} ventana${2 - e.mo.n === 1 ? "" : "s"} completa${2 - e.mo.n === 1 ? "" : "s"} para personalizar (usando ${mins(e.mo.m)}).`;
  const feedLearn = fStats.avgGapMin
    ? ` Alimentación: Pide leche cada ${mins(fStats.avgGapMin)} en promedio${fStats.trendText ? ` (${fStats.trendText})` : "."}`
    : "";
  $("learn").textContent = sleepLearn + feedLearn;

  renderCryChecklist(e);
  list();
  history();
  reminder(e);

  if (window.AndroidBridge && typeof window.AndroidBridge.updateWidget === "function") {
    try {
      window.AndroidBridge.updateWidget(
        e.n || "Próxima siesta en cálculo",
        e.t || "Bichito al día"
      );
    } catch {}
  }
}

// Puente corregido para el Widget de Android
window.openQuickLogFromWidget = function (type) {
  if (type === "feed" || type === "feeding") {
    toggleFeedState();
  } else if (type === "sleep") {
    toggleSleepState();
  } else if (type === "diaper") {
    toggleDiaperState();
  }
};

function list() {
  let a = events();
  $("listTitle").textContent = pick === key() ? "Registros de hoy" : fmt(date(pick));
  $("clear").classList.toggle("hide", pick !== key());
  $("list").innerHTML = a.length
    ? a
        .map((e) => {
          const meta = M[e.type] || ["Registro", "•"];
          const dText = detail(e);
          const pending = hasPendingDetails(e);
          return `<article class="row"><span>${meta[1]}</span><button class="main" data-edit="${e.id}"><b>${meta[0]}</b>${
            dText
              ? `<small>${esc(dText)}</small>`
              : pending
                ? `<small style="color:var(--o)">Sin detalles aún · Toca para completar</small>`
                : ""
          }</button><button type="button" class="row-detail-btn" data-edit="${e.id}">${
            pending ? "+ Detalles" : "Editar"
          }</button><time>${clock(e.time)}</time><button class="x" data-del="${e.id}">×</button></article>`;
        })
        .join("")
    : '<div class="empty">Todavía no hay registros en este día.</div>';

  document.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => open(S.events.find((e) => e.id === b.dataset.edit));
  });
  document.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      if (confirm("¿Eliminar este registro?")) {
        S.events = S.events.filter((e) => e.id !== b.dataset.del);
        save();
        render();
        toast("Registro eliminado");
      }
    };
  });
}

function history() {
  let ds = Array.from({ length: 7 }, (_, i) => {
      let d = new Date();
      d.setDate(d.getDate() - i);
      return key(d);
    }),
    es = S.events.filter((e) => ds.includes(key(e.time))),
    sl = ds.reduce((x, d) => x + sleep(d), 0),
    feedsCount = es.filter((e) => e.type === "feeding" || e.type === "feedingStart").length,
    diapersCount = es.filter((e) => e.type === "diaper" || e.type === "diaperStart").length;

  $("stats").innerHTML = `<div class="stat"><b>${mins(sl)}</b><span>sueño (7d)</span></div><div class="stat"><b>${feedsCount}</b><span>leches (7d)</span></div><div class="stat"><b>${diapersCount}</b><span>pañales (7d)</span></div>`;

  const fStats = feedingStats();
  const totalMl7d = es
    .filter((e) => e.type === "feeding" && Number(e.details?.amount) > 0)
    .reduce((sum, e) => sum + Number(e.details.amount), 0);

  if ($("feedInsights")) {
    $("feedInsights").innerHTML = `<b>Evolución alimenticia y ritmo</b>
      • Frecuencia entre hambre y hambre: <strong>${fStats.avgGapMin ? mins(fStats.avgGapMin) : "Aprendiendo"}</strong><br>
      • Tiempo promedio desde hambre hasta terminar la leche: <strong>${fStats.avgDurationMin ? `${fStats.avgDurationMin} min` : "Registra inicio y fin con el botón"}</strong><br>
      ${totalMl7d > 0 ? `• Leche registrada en ml (últimos 7 días): <strong>${totalMl7d} ml</strong><br>` : ""}
      ${fStats.trendText ? `• Tendencia: ${esc(fStats.trendText)}` : "• Registra más tomas para ver cómo evoluciona su frecuencia."}`;
  }

  $("days").innerHTML = ds
    .map((d) => {
      let a = events(d),
        x = [];
      const sMin = sleep(d);
      if (sMin) x.push(`${mins(sMin)} sueño`);
      let f = a.filter((e) => e.type === "feeding" || e.type === "feedingStart").length;
      if (f) x.push(`${f} leche${f === 1 ? "" : "s"}`);
      let p = a.filter((e) => e.type === "diaper" || e.type === "diaperStart").length;
      if (p) x.push(`${p} pañal${p === 1 ? "" : "es"}`);
      return `<button class="row day ${d === pick ? "selected" : ""}" data-day="${d}"><span><b>${d === key() ? "Hoy" : fmt(date(d))}</b><small>${x.join(" · ") || "Sin registros"}</small></span><small>${a.length} registros ›</small></button>`;
    })
    .join("");

  document.querySelectorAll("[data-day]").forEach((b) => {
    b.onclick = () => {
      pick = b.dataset.day;
      view("today");
    };
  });
}

function reminder(e) {
  clearTimeout(timer);
  if (!S.profile.reminder || !e.target) return;
  let d = e.target - Date.now();
  if (d < 1e3 || d > 216e5) return;
  timer = setTimeout(() => {
    let m = `Se acerca la ventana de siesta de ${S.profile.name}`;
    if ("Notification" in window && Notification.permission === "granted")
      new Notification("Bichito", { body: m });
    else toast(m);
  }, d);
}

let toastTimer;
function toast(x) {
  $("toast").textContent = x;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}

function view(v) {
  $("today").classList.toggle("hide", v !== "today");
  $("history").classList.toggle("hide", v !== "history");
  const wardrobeEl = $("wardrobe");
  if (wardrobeEl) wardrobeEl.classList.toggle("hide", v !== "wardrobe");
  const familyEl = $("family");
  if (familyEl && v !== "family") familyEl.classList.add("hide");
  const familyNav = $("familyNav");
  if (familyNav && v !== "family") familyNav.classList.remove("active");

  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  if (v === "today" || v === "history") render();
  if (v === "wardrobe" && typeof window.initWardrobe3D === "function") {
    window.initWardrobe3D();
  }
}

function fields() {
  let t = $("type").value;
  const isFeed = t === "feeding" || t === "feedingStart";
  const isDiaper = t === "diaper" || t === "diaperStart";
  const isSleep = t === "sleepStart" || t === "sleepEnd";
  if ($("sleepFields")) $("sleepFields").classList.toggle("show", isSleep);
  $("feedFields").classList.toggle("show", isFeed);
  $("diaperFields").classList.toggle("show", isDiaper);
  $("noteFields").classList.add("show");
}

function open(e, defaultType = "note") {
  edit = e?.id || null;
  $("recordTitle").textContent = e ? "Añadir o editar detalles" : "Añadir registro manual";
  $("type").value = e?.type === "diaperStart" ? "diaper" : e?.type || defaultType;
  $("time").value = input(e?.time || new Date());
  if ($("sleepPlace")) $("sleepPlace").value = e?.details?.place || "";
  if ($("hungerStart")) {
    $("hungerStart").value = input(
      e?.details?.hungerStart || (e?.type === "feedingStart" ? e?.time : "")
    );
  }
  $("method").value = e?.details?.method || "";
  $("amount").value = e?.details?.amount || "";
  const rawKind = e?.details?.kind || "";
  $("kind").value =
    rawKind === "Caca"
      ? "Popó"
      : rawKind === "Mixto" || rawKind === "Mixto (pipí y caca)"
        ? "Mixto (pipí y popó)"
        : rawKind === "Solo pipí"
          ? "Solo pipí (orinó)"
          : rawKind;
  $("note").value = e?.note || "";
  $("remove").classList.toggle("hide", !e);
  fields();
  $("record").showModal();
}

// Abre directamente el modal de "Añadir detalles" del último registro de ese parámetro
function openLatestDetailsFor(category) {
  let targetEvent = null;
  if (category === "sleep") {
    targetEvent = activeSleep() || latestOfTypes(["sleepEnd", "sleepStart"]);
    if (!targetEvent) return open(null, "sleepStart");
  } else if (category === "feeding") {
    targetEvent = activeFeeding() || latestOfTypes(["feeding", "feedingStart"]);
    if (!targetEvent) return open(null, "feeding");
  } else if (category === "diaper") {
    targetEvent = latestOfTypes(["diaper", "diaperStart"]);
    if (!targetEvent) return open(null, "diaper");
  }
  open(targetEvent);
}

// Eventos de botones de las 3 tarjetas de cronómetro
$("btnToggleSleep").onclick = toggleSleepState;
$("btnDetailSleep").onclick = () => openLatestDetailsFor("sleep");

$("btnToggleFeed").onclick = toggleFeedState;
$("btnDetailFeed").onclick = () => openLatestDetailsFor("feeding");

$("btnToggleDiaper").onclick = toggleDiaperState;
$("btnDetailDiaper").onclick = () => openLatestDetailsFor("diaper");

$("manualQuick").onclick = () => open(null, "note");
if ($("closeRecord")) $("closeRecord").onclick = () => $("record").close();
$("type").onchange = fields;

$("save").onclick = (e) => {
  e.preventDefault();
  const currentExisting = edit ? S.events.find((ev) => ev.id === edit) : null;
  const prevDetails = currentExisting?.details || {};
  let x = {
    type: $("type").value,
    time: new Date($("time").value).toISOString(),
    details: {
      ...prevDetails,
      place: $("sleepPlace") ? $("sleepPlace").value : prevDetails.place,
      hungerStart:
        $("hungerStart") && $("hungerStart").value
          ? new Date($("hungerStart").value).toISOString()
          : prevDetails.hungerStart,
      method: $("method").value,
      amount: $("amount").value,
      kind: $("kind").value,
    },
    note: $("note").value.trim(),
  };
  if (edit) {
    let i = S.events.findIndex((ev) => ev.id === edit);
    if (i !== -1) {
      S.events[i] = { ...S.events[i], ...x };
    }
    save();
    toast("Detalles guardados");
  } else {
    add(x.type, x.time, x.details, x.note);
    toast("Registro guardado");
  }
  $("record").close();
  render();
};

$("remove").onclick = () => {
  if (confirm("¿Eliminar este registro?")) {
    S.events = S.events.filter((e) => e.id !== edit);
    save();
    $("record").close();
    render();
    toast("Registro eliminado");
  }
};

$("clear").onclick = () => {
  if (confirm("¿Limpiar todos los registros de hoy?")) {
    S.events = S.events.filter((e) => key(e.time) !== key());
    save();
    render();
  }
};

$("settings").onclick = () => {
  $("name").value = S.profile.name;
  $("birth").value = S.profile.birthDate;
  $("wake").value = S.profile.wakeWindow;
  $("remind").checked = S.profile.reminder;
  $("prefs").showModal();
};

$("closePrefs").onclick = () => $("prefs").close();
$("savePrefs").onclick = async () => {
  S.profile = {
    name: $("name").value.trim() || "Bichito",
    birthDate: $("birth").value,
    wakeWindow: +$("wake").value,
    reminder: $("remind").checked,
  };
  if (
    S.profile.reminder &&
    "Notification" in window &&
    Notification.permission === "default"
  )
    await Notification.requestPermission();
  save();
  $("prefs").close();
  render();
  toast("Ajustes guardados");
};

document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => view(b.dataset.view)));

$("export").onclick = () => {
  let a = document.createElement("a"),
    u = URL.createObjectURL(
      new Blob([JSON.stringify({ app: "Bichito", data: S }, null, 2)], {
        type: "application/json",
      })
    );
  a.href = u;
  a.download = `bichito-${key()}.json`;
  a.click();
  URL.revokeObjectURL(u);
};

$("import").onclick = async () => $("file").click();
$("file").onchange = async (e) => {
  try {
    let x = JSON.parse(await e.target.files[0].text());
    if (!x.data?.events) throw 0;
    if (confirm("Esto reemplazará los datos actuales. ¿Continuar?")) {
      S = {
        events: x.data.events,
        cryChecks: x.data.cryChecks || {},
        profile: { ...blank.profile, ...x.data.profile },
      };
      save();
      render();
      toast("Copia recuperada");
    }
  } catch {
    toast("No pude leer esa copia");
  }
  e.target.value = "";
};

$("voice").onclick = () => {
  said = "";
  $("heard").textContent = "Toca el botón y habla.";
  $("voiceText").value = "";
  $("talk").showModal();
};
$("closeTalk").onclick = () => $("talk").close();
$("listen").onclick = () => {
  let R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) {
    $("heard").textContent =
      "El dictado no está disponible aquí. Puedes escribir la nota abajo.";
    return;
  }
  let r = new R();
  r.lang = "es-CL";
  r.interimResults = true;
  r.onstart = () => {
    $("heard").textContent = "Escuchando…";
    $("listen").textContent = "Escuchando…";
  };
  r.onresult = (e) => {
    said = [...e.results].map((x) => x[0].transcript).join(" ");
    $("heard").textContent = said;
    $("voiceText").value = said;
  };
  r.onerror = () =>
    ($("heard").textContent =
      "No pude escuchar. Puedes escribir la nota abajo.");
  r.onend = () => ($("listen").textContent = "Escuchar otra vez");
  r.start();
};

$("saveTalk").onclick = () => {
  const text = (said || $("voiceText").value).trim();
  if (!text) {
    $("heard").textContent =
      "Escribe una nota o vuelve a tocar “Empezar a escuchar”.";
    return;
  }
  let t = text.toLowerCase();
  if (
    t.includes("despert") ||
    (t.includes("siesta") && (t.includes("termin") || t.includes("fin")))
  ) {
    if (activeSleep()) toggleSleepState();
    else add("sleepEnd", new Date().toISOString(), {}, text);
  } else if (
    t.includes("siesta") ||
    t.includes("durmi") ||
    t.includes("dorm")
  ) {
    toggleSleepState();
  } else if (
    t.includes("hambre") ||
    t.includes("leche") ||
    t.includes("mam") ||
    t.includes("pecho")
  ) {
    toggleFeedState();
  } else if (t.includes("pañal") || t.includes("panal") || t.includes("pip") || t.includes("pop") || t.includes("caca")) {
    toggleDiaperState();
  } else {
    add("note", new Date().toISOString(), {}, text);
    toast("Nota guardada");
  }
  $("talk").close();
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

// Iniciar cronómetro en vivo segundo a segundo
clearInterval(liveInterval);
liveInterval = setInterval(updateLiveStopwatches, 1000);

render();
