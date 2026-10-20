/* The Magic Farmcare - game engine. Pure logic, no DOM: every function takes the
   plain-JSON state object, so the same code runs in the browser and in Node (scripts/sim.js). */
(function (root) {
  var MF = (root.MF = root.MF || {});
  var C = MF.CONFIG;
  var NUTRIENTS = ['N', 'P', 'K'];
  var FERT_KEEP = 0.7; // share of fertilizer that stays in the soil after the season
  var SAVE_VERSION = 2; // bump when a change makes older saved games invalid (v2 = one-year game)

  /* ---------- helpers ---------- */

  // mulberry32: seeded so a game can be replayed and tested
  function rand(state) {
    var t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pickWeighted(state, list) {
    var total = 0;
    list.forEach(function (x) { total += x[1]; });
    var r = rand(state) * total;
    for (var i = 0; i < list.length; i++) {
      r -= list[i][1];
      if (r < 0) return list[i][0];
    }
    return list[list.length - 1][0];
  }

  function shuffle(state, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand(state) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function isCrop(use) { return !!MF.CROPS[use]; }

  function totalSeasons() { return C.years * MF.SEASONS.length; }

  function seasonOf(state) {
    var i = Math.min(state.season, totalSeasons() - 1);
    return { index: i, year: Math.floor(i / MF.SEASONS.length) + 1, season: MF.SEASONS[i % MF.SEASONS.length] };
  }

  function useCost(use) {
    if (MF.CROPS[use]) return MF.CROPS[use].seedCost;
    return MF.LAND_USES[use] ? MF.LAND_USES[use].cost : 0;
  }

  function fertAdd(fid, stage) {
    var out = { N: 0, P: 0, K: 0 };
    var f = fid && MF.FERTS[fid];
    if (!f) return out;
    var eff = f.best === 'any' || f.best === stage ? 1 : C.offStageEfficiency;
    NUTRIENTS.forEach(function (k) { out[k] = (f.add[k] || 0) * eff; });
    return out;
  }

  /* soil + fertilizer that the crop can use this season */
  function available(plot, includeTop) {
    var b = fertAdd(plot.basal, 'basal');
    var t = includeTop ? fertAdd(plot.top, 'top') : { N: 0, P: 0, K: 0 };
    var out = {};
    NUTRIENTS.forEach(function (k) { out[k] = plot.soil[k] + b[k] + t[k]; });
    return { total: out, added: { N: b.N + t.N, P: b.P + t.P, K: b.K + t.K } };
  }

  function nutrientFactor(crop, avail) {
    var nf = 1, limiting = null;
    NUTRIENTS.forEach(function (k) {
      var ratio = avail[k] / crop.need[k];
      var f = ratio >= 1 ? 1 : 0.45 + 0.55 * Math.max(0, ratio);
      if (f < nf) { nf = f; limiting = k; }
    });
    return { nf: nf, limiting: limiting, excess: avail.N > crop.need.N * C.excessNRatio };
  }

  /* ---------- game flow ---------- */

  function newGame(seed) {
    var state = {
      v: SAVE_VERSION,
      rng: seed >>> 0 || 1,
      money: C.startMoney,
      season: 0,
      stage: 'plan',
      over: null,
      plots: MF.PLOTS.map(function (p) {
        return { soil: { N: p.soil.N, P: p.soil.P, K: p.soil.K }, use: 'idle', basal: null, top: null, lastUse: null, event: null };
      }),
      weather: null,
      results: null,
      history: [],
      stats: { treated: 0, correct: 0, kg: Object.keys(MF.CROPS).reduce(function (o, k) { o[k] = 0; return o; }, {}), revenue: 0, cost: 0 },
      seasonCost: 0,
      tutorial: {},
    };
    beginSeason(state);
    return state;
  }

  function beginSeason(state) {
    var s = seasonOf(state).season;
    var actual = pickWeighted(state, s.weather);
    var forecast = actual;
    if (rand(state) > C.forecastAccuracy) {
      var others = s.weather.filter(function (w) { return w[0] !== actual; });
      if (others.length) forecast = pickWeighted(state, others);
    }
    state.weather = { actual: actual, forecast: forecast, respond: false };
    state.stage = 'plan';
    state.seasonCost = 0;
    state.results = null;
    state.plots.forEach(function (p) {
      p.use = 'idle'; p.basal = null; p.top = null; p.event = null;
    });
  }

  function planCost(state) {
    return state.plots.reduce(function (sum, p) {
      return sum + useCost(p.use) + (isCrop(p.use) && p.basal ? MF.FERTS[p.basal].cost : 0);
    }, 0);
  }

  function setPlan(state, i, use, basal) {
    var p = state.plots[i];
    p.use = use;
    p.basal = isCrop(use) ? basal || null : null;
  }

  /* Four products to choose from: up to two that work, every partial or harmful one, and at least
     one plain wrong answer, so an event with many cures still needs thought. */
  function eventOptions(state, id) {
    var e = MF.EVENTS[id];
    var listed = e.correct.concat(Object.keys(e.partial), Object.keys(e.harmful));
    var opts = shuffle(state, e.correct).slice(0, 2).concat(Object.keys(e.partial), Object.keys(e.harmful));
    var sameGroup = { insect: ['insect', 'bio'], disease: ['fungus'], weed: ['weed'] }[e.type];
    var keep = e.notWrong || [];
    var rest = Object.keys(MF.PRODUCTS).filter(function (k) {
      return listed.indexOf(k) < 0 && keep.indexOf(k) < 0 && MF.PRODUCTS[k].distractor !== false;
    });
    var near = shuffle(state, rest.filter(function (k) { return sameGroup.indexOf(MF.PRODUCTS[k].group) >= 0; }));
    var far = shuffle(state, rest.filter(function (k) { return sameGroup.indexOf(MF.PRODUCTS[k].group) < 0; }));
    var pool = near.concat(far);
    if (opts.length < 4 && far.length) { opts.push(far.shift()); pool = near.concat(far); }
    while (opts.length < 4 && pool.length) opts.push(pool.shift());
    return shuffle(state, opts.slice(0, 4));
  }

  function startGrowing(state) {
    var cost = planCost(state);
    if (state.stage !== 'plan' || cost > state.money) return false;
    state.money -= cost;
    state.seasonCost = cost;
    state.stats.cost += cost;

    var w = state.weather.actual;
    state.plots.forEach(function (p) {
      p.event = null;
      if (!isCrop(p.use)) return;
      var crop = MF.CROPS[p.use];
      var excess = nutrientFactor(crop, available(p, false).total).excess;
      var repeat = p.lastUse === p.use;
      var chance = 0.38 + (w === 'humid' ? 0.15 : 0) + (w === 'flood' ? 0.08 : 0) + (excess ? 0.15 : 0) + (repeat ? 0.15 : 0);
      if (rand(state) >= Math.min(0.85, chance)) return;
      var list = crop.events.map(function (id) {
        var e = MF.EVENTS[id], wt = 1;
        if (e.type === 'disease' && (w === 'humid' || w === 'flood')) wt += 1.5;
        if (e.type !== 'weed' && excess) wt += 0.7;
        if (e.dry && w === 'drought') wt += 1;
        return [id, wt];
      });
      var id = pickWeighted(state, list);
      p.event = { id: id, options: eventOptions(state, id), choice: null };
    });
    state.stage = 'care';
    return true;
  }

  function weatherResponse(state) {
    return MF.WEATHER[state.weather.actual].response || null;
  }

  function responseCost(state) {
    var r = weatherResponse(state);
    if (!r) return 0;
    var drought = state.weather.actual === 'drought';
    return state.plots.reduce(function (sum, p, i) {
      if (!isCrop(p.use)) return sum;
      return sum + (drought ? MF.PLOTS[i].irrigateCost : r.costPerPlot);
    }, 0);
  }

  function careCost(state) {
    var cost = state.weather.respond ? responseCost(state) : 0;
    state.plots.forEach(function (p) {
      if (!isCrop(p.use)) return;
      if (p.top) cost += MF.FERTS[p.top].cost;
      if (p.event && p.event.choice && p.event.choice !== 'none') cost += MF.PRODUCTS[p.event.choice].cost;
    });
    return cost;
  }

  function setTop(state, i, fid) { if (isCrop(state.plots[i].use)) state.plots[i].top = fid || null; }
  function setTreatment(state, i, pid) { var e = state.plots[i].event; if (e) e.choice = pid || null; }
  function setResponse(state, on) { state.weather.respond = !!on && !!weatherResponse(state); }

  function treatmentOutcome(ev) {
    var e = MF.EVENTS[ev.id];
    var c = ev.choice || 'none';
    if (e.correct.indexOf(c) >= 0) return { outcome: 'correct', loss: e.loss * 0.1 };
    if (c in e.partial) return { outcome: 'partial', loss: e.loss * (1 - e.partial[c]) };
    if (c in e.harmful) return { outcome: 'harmful', loss: e.loss + e.harmful[c] };
    return { outcome: c === 'none' ? 'none' : 'wrong', loss: e.loss };
  }

  function harvestPlot(state, p, i, season, w, respond) {
    var info = MF.PLOTS[i];
    var before = { N: p.soil.N, P: p.soil.P, K: p.soil.K };
    var r = { use: p.use, kg: 0, revenue: 0, tips: [], soilBefore: before, soilAfter: null };
    var nat = C.naturalRecovery;

    if (!isCrop(p.use)) {
      var add = p.use === 'fallow' ? MF.LAND_USES.fallow.add : { N: 0, P: 0, K: 0 };
      NUTRIENTS.forEach(function (k) { p.soil[k] = clamp(Math.round(p.soil[k] + add[k] + nat), 0, 100); });
      if (p.use === 'fallow') r.tips.push({ tone: 'good', text: 'ไถกลบปอเทือง ดินได้ไนโตรเจนเพิ่ม +' + add.N });
      r.soilAfter = { N: p.soil.N, P: p.soil.P, K: p.soil.K };
      return r;
    }

    var crop = MF.CROPS[p.use];
    var av = available(p, true);
    var nut = nutrientFactor(crop, av.total);
    var suit = crop.suit[season.id];

    var wl = 0;
    if (w === 'drought') wl = crop.drought * info.droughtMult * (respond ? 0.15 : 1);
    if (w === 'flood') wl = crop.flood * info.floodMult * (respond ? 0.25 : 1);
    wl = clamp(wl, 0, 0.95);
    // the Mekong rises over the riverside plot every rainy season, whatever the weather
    var riverLoss = clamp(crop.flood * ((info.riverRise && info.riverRise[season.id]) || 0), 0, 0.9);

    var pest = null;
    if (p.event) {
      pest = treatmentOutcome(p.event);
      pest.loss = clamp(pest.loss, 0, 0.95);
      state.stats.treated++;
      if (pest.outcome === 'correct') state.stats.correct++;
    }

    var jitter = 1 + (rand(state) * 2 - 1) * C.yieldJitter;
    var kg = Math.round(crop.baseYield * suit * nut.nf * (nut.excess ? 0.9 : 1) * (1 - wl) * (1 - riverLoss) * (1 - (pest ? pest.loss : 0)) * jitter);
    var spray = p.event && p.event.choice && p.event.choice !== 'none' ? MF.PRODUCTS[p.event.choice] : null;
    var safe = !!crop.veg && (!spray || spray.group === 'bio');
    r.kg = Math.max(0, kg);
    r.price = safe ? Math.round(crop.price * (1 + C.safeVegBonus) * 10) / 10 : crop.price;
    r.safe = safe;
    r.revenue = Math.round(r.kg * r.price);
    r.factors = { suit: suit, nf: nut.nf, limiting: nut.limiting, excess: nut.excess, weatherLoss: wl, riverLoss: riverLoss, pest: pest, eventId: p.event ? p.event.id : null, safe: safe, sprayed: !!(crop.veg && spray && !safe) };

    var grow = Math.min(1, suit * nut.nf);
    var care = p.basal && MF.FERTS[p.basal].soilCare ? 0.75 : 1;
    NUTRIENTS.forEach(function (k) {
      p.soil[k] = clamp(Math.round(before[k] + av.added[k] * FERT_KEEP - crop.uptake[k] * grow * care + nat), 0, 100);
    });
    r.soilAfter = { N: p.soil.N, P: p.soil.P, K: p.soil.K };
    r.tips = cropTips(p, crop, season, w, respond, r.factors);
    state.stats.kg[p.use] = (state.stats.kg[p.use] || 0) + r.kg;
    return r;
  }

  function cropTips(p, crop, season, w, respond, f) {
    var tips = [];
    if (f.pest) {
      var e = MF.EVENTS[f.eventId];
      var prod = p.event.choice && p.event.choice !== 'none' ? MF.PRODUCTS[p.event.choice].name : '';
      var o = f.pest.outcome;
      if (o === 'correct') tips.push({ tone: 'good', text: 'ใช้' + prod + 'ถูกต้อง หยุด' + e.name + 'ได้ทัน' });
      else if (o === 'partial') tips.push({ tone: 'bad', text: prod + 'ได้ผลไม่เต็มที่ เสียหาย ' + pct(f.pest.loss) + ' · ' + e.tip });
      else if (o === 'harmful') tips.push({ tone: 'bad', text: prod + 'ทำให้แย่ลง เสียหาย ' + pct(f.pest.loss) + ' · ' + e.tip });
      else if (o === 'wrong') tips.push({ tone: 'bad', text: prod + 'ไม่ได้ผลกับ' + e.name + ' เสียหาย ' + pct(f.pest.loss) + ' · ' + e.tip });
      else tips.push({ tone: 'bad', text: 'ปล่อย' + e.name + 'ไว้ เสียหาย ' + pct(f.pest.loss) + ' · ' + e.tip });
      if (p.lastUse === p.use) tips.push({ tone: 'bad', text: 'ปลูก' + crop.name + 'ซ้ำแปลงเดิม โรคและแมลงสะสม ลองปลูกสลับพืช' });
    }
    if (f.suit < 0.8) tips.push({ tone: 'bad', text: crop.name + 'ไม่เหมาะกับ' + season.name + ' ได้ผลผลิตแค่ ' + pct(f.suit) });
    if (f.weatherLoss > 0.04) {
      if (respond) tips.push({ tone: 'good', text: (w === 'drought' ? 'สูบน้ำ' : 'ระบายน้ำ') + 'ทัน ความเสียหายเหลือแค่ ' + pct(f.weatherLoss) });
      else if (w === 'drought') tips.push({ tone: 'bad', text: 'พืชขาดน้ำ ผลผลิตลด ' + pct(f.weatherLoss) + ' ครั้งหน้าลองสูบน้ำเข้าแปลง' });
      else tips.push({ tone: 'bad', text: 'น้ำท่วมขัง ผลผลิตลด ' + pct(f.weatherLoss) + ' ครั้งหน้าลองขุดร่องระบายน้ำ' });
    }
    if (f.riverLoss > 0.04) tips.push({ tone: 'bad', text: 'น้ำโขงขึ้นท่วมแปลงริมฝั่ง ผลผลิตลด ' + pct(f.riverLoss) + ' หน้าฝนแปลงนี้เหมาะกับผักบุ้งหรือข้าวที่ทนน้ำ' });
    if (f.safe) tips.push({ tone: 'good', text: 'ไม่ใช้ยาเคมี ขายเป็นผักปลอดภัย ได้ราคาเพิ่ม ' + pct(C.safeVegBonus) });
    if (f.sprayed) tips.push({ tone: 'bad', text: 'ผักที่ฉีดยาเคมีต้องเว้นระยะก่อนเก็บเกี่ยว ขายได้ราคาปกติ ถ้าใช้เชื้อบีทีหรือไม่ใช้ยาจะได้ราคาผักปลอดภัย' });
    if (f.nf < 0.95) {
      var k = f.limiting;
      tips.push({ tone: 'bad', text: 'ดินขาด' + MF.NUTRIENT_NAMES[k] + ' (' + k + ') ผลผลิตลด ' + pct(1 - f.nf) + ' ลองใช้ ' + MF.NUTRIENT_FIX[k] });
    }
    if (f.excess) tips.push({ tone: 'bad', text: 'ใส่ไนโตรเจนมากเกินไป ต้นอ่อนแอ ล้มง่าย แมลงชอบ' });
    if (!tips.some(function (t) { return t.tone === 'bad'; })) tips.unshift({ tone: 'good', text: 'ดูแลได้ดีมาก ' + crop.name + 'งามเต็มแปลง' });
    return tips;
  }

  function harvest(state) {
    var cost = careCost(state);
    if (state.stage !== 'care' || cost > state.money) return false;
    state.money -= cost;
    state.seasonCost += cost;
    state.stats.cost += cost;

    var season = seasonOf(state).season;
    var w = state.weather.actual;
    var respond = state.weather.respond;
    var plots = state.plots.map(function (p, i) { return harvestPlot(state, p, i, season, w, respond); });
    var revenue = plots.reduce(function (s, r) { return s + r.revenue; }, 0);

    state.money += revenue;
    state.stats.revenue += revenue;
    state.plots.forEach(function (p) { p.lastUse = p.use; });
    state.results = { plots: plots, revenue: revenue, cost: state.seasonCost, profit: revenue - state.seasonCost };
    state.history.push({ season: state.season, revenue: revenue, cost: state.seasonCost, profit: revenue - state.seasonCost, money: state.money });
    state.stage = 'harvest';
    return true;
  }

  function nextSeason(state) {
    if (state.stage !== 'harvest') return;
    state.season++;
    if (state.season >= totalSeasons()) { state.over = 'complete'; state.stage = 'end'; return; }
    if (state.money < C.minMoneyToContinue) { state.over = 'bankrupt'; state.stage = 'end'; return; }
    beginSeason(state);
  }

  /* true only for an unfinished game from this version that fits the current game length */
  function isCurrentSave(s) {
    return !!s && s.v === SAVE_VERSION && !s.over && typeof s.season === 'number' &&
      s.season >= 0 && s.season < totalSeasons() && Array.isArray(s.plots) && s.plots.length === MF.PLOTS.length;
  }

  function stars(money) {
    return C.stars.filter(function (t) { return money >= t; }).length;
  }

  MF.engine = {
    newGame: newGame,
    seasonOf: seasonOf,
    totalSeasons: totalSeasons,
    isCrop: isCrop,
    useCost: useCost,
    fertAdd: fertAdd,
    available: available,
    nutrientFactor: nutrientFactor,
    planCost: planCost,
    eventOptions: eventOptions,
    setPlan: setPlan,
    startGrowing: startGrowing,
    weatherResponse: weatherResponse,
    responseCost: responseCost,
    careCost: careCost,
    setTop: setTop,
    setTreatment: setTreatment,
    setResponse: setResponse,
    treatmentOutcome: treatmentOutcome,
    harvest: harvest,
    nextSeason: nextSeason,
    stars: stars,
    isCurrentSave: isCurrentSave,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MF;
})(typeof window !== 'undefined' ? window : globalThis);
