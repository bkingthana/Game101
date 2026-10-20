/* Balance check: plays thousands of games with scripted strategies and prints final money.
   Run: node scripts/sim.js [games]   (FERTS=1 also prints how often each fertilizer is used) */
require('../js/data.js');
require('../js/engine.js');
var MF = globalThis.MF;
var E = MF.engine;

var GAMES = Number(process.argv[2]) || 2000;

function deficit(plot, use) {
  var need = MF.CROPS[use].need;
  return { N: need.N - plot.soil.N, P: need.P - plot.soil.P, K: need.K - plot.soil.K };
}

function bestBasal(plot, use) {
  var d = deficit(plot, use);
  if (d.P > 5) return 'f16200';
  if (d.K > 5 || d.N > 5) return 'f151515';
  return 'organic';
}

function bestTop(plot, use) {
  var av = E.available(plot, false).total;
  var need = MF.CROPS[use].need;
  if (need.K - av.K > 5) return 'f0060';
  if (need.N - av.N > 5) return 'f4600';
  return null;
}

/* yield value minus fertilizer cost for a basal + top pair, over every fertilizer in the game */
function pairValue(plot, use, sid, basal, top) {
  var crop = MF.CROPS[use];
  var nut = E.nutrientFactor(crop, E.available({ soil: plot.soil, basal: basal, top: top }, true).total);
  return crop.baseYield * crop.suit[sid] * nut.nf * (nut.excess ? 0.86 : 1) * crop.price -
    (basal ? MF.FERTS[basal].cost : 0) - (top ? MF.FERTS[top].cost : 0);
}
var FERT_IDS = [null].concat(Object.keys(MF.FERTS));
function optBasal(plot, use, s) {
  var sid = E.seasonOf(s).season.id, best = null;
  FERT_IDS.forEach(function (b) {
    FERT_IDS.forEach(function (t) {
      var v = pairValue(plot, use, sid, b, t);
      if (!best || v > best.v + 0.5) best = { v: v, b: b };
    });
  });
  return best.b;
}
function optTop(plot, use, s) {
  var sid = E.seasonOf(s).season.id, best = null;
  FERT_IDS.forEach(function (t) {
    var v = pairValue(plot, use, sid, plot.basal, t);
    if (!best || v > best.v + 0.5) best = { v: v, t: t };
  });
  return best.t;
}

// a working product among the four shown for this pest
function correctFor(ev) { var ok = MF.EVENTS[ev.id].correct; return ev.options.filter(function (p) { return ok.indexOf(p) >= 0; })[0]; }

// expected weather mix given the forecast and its accuracy
function weatherProbs(s) {
  var season = E.seasonOf(s).season, f = s.weather.forecast, acc = MF.CONFIG.forecastAccuracy;
  var others = season.weather.filter(function (w) { return w[0] !== f; });
  var tot = others.reduce(function (a, w) { return a + w[1]; }, 0);
  var probs = {};
  probs[f] = others.length ? acc : 1;
  others.forEach(function (w) { probs[w[0]] = ((1 - acc) * w[1]) / tot; });
  return probs;
}

// rough expected profit of a crop on a plot this season, for a player who fertilizes and treats well
function expectedProfit(s, i, use) {
  var crop = MF.CROPS[use], info = MF.PLOTS[i], sid = E.seasonOf(s).season.id, pr = weatherProbs(s);
  var wl = (pr.drought || 0) * crop.drought * info.droughtMult * 0.15 + (pr.flood || 0) * crop.flood * info.floodMult * 0.25;
  var water = (pr.drought || 0) * info.irrigateCost + (pr.flood || 0) * 400;
  var river = crop.flood * ((info.riverRise && info.riverRise[sid]) || 0);
  var price = crop.price * (crop.veg ? 1 + MF.CONFIG.safeVegBonus * 0.6 : 1);
  var rev = crop.baseYield * crop.suit[sid] * (1 - wl) * (1 - river) * 0.98 * price;
  return rev - crop.seedCost - 1000 - water - 180;
}

// seed coating pays for itself; soil fungus control is worth it where the soil stays wet
function expertPrevent(i, use) {
  return E.preventionsFor(use).filter(function (id) { return id === 'seedcoat' || MF.PLOTS[i].wet; });
}

function planBest(s, crops, prevent, basalFn) {
  basalFn = basalFn || bestBasal;
  var picks = s.plots.map(function (p, i) {
    var ranked = crops.map(function (u) { return { use: u, v: expectedProfit(s, i, u) }; })
      .sort(function (a, b) { return b.v - a.v; });
    return { i: i, ranked: ranked };
  }).sort(function (a, b) { return b.ranked[0].v - a.ranked[0].v; });
  picks.forEach(function (pk) {
    var p = s.plots[pk.i];
    E.setPlan(s, pk.i, 'idle', null);
    for (var k = 0; k < pk.ranked.length; k++) {
      var c = pk.ranked[k];
      if (c.v < 200) break;
      E.setPlan(s, pk.i, c.use, basalFn(p, c.use, s), prevent ? expertPrevent(pk.i, c.use) : []);
      if (E.planCost(s) <= s.money - 1500) return;
      E.setPlan(s, pk.i, 'idle', null);
    }
  });
}

var ALL_CROPS = Object.keys(MF.CROPS);
var GRAINS = ['rice', 'corn', 'shallot'];

// right product for every pest, water when needed, top-dressing chosen by topFn
function expertCare(s, topFn) {
  if (E.weatherResponse(s)) E.setResponse(s, true);
  s.plots.forEach(function (p, i) {
    if (!E.isCrop(p.use)) return;
    if (p.event) {
      var ok = MF.EVENTS[p.event.id].correct;
      var bio = p.event.options.filter(function (x) { return ok.indexOf(x) >= 0 && MF.PRODUCTS[x].group === 'bio'; })[0];
      E.setTreatment(s, i, MF.CROPS[p.use].veg && bio ? bio : correctFor(p.event));
    }
    E.setTop(s, i, topFn(p, p.use, s));
  });
  while (E.careCost(s) > s.money) {
    var p = s.plots.find(function (x) { return x.top; });
    if (!p) break;
    p.top = null;
  }
  if (E.careCost(s) > s.money) E.setResponse(s, false);
}

var strategies = {
  // picks the most profitable crop for each plot from every crop in the game
  expert: {
    plan: function (s) { planBest(s, ALL_CROPS, true); },
    care: function (s) { expertCare(s, bestTop); },
  },
  // same as expert, but picks basal and top-dressing from every fertilizer by yield value minus cost
  fertopt: {
    plan: function (s) { planBest(s, ALL_CROPS, true, optBasal); },
    care: function (s) { expertCare(s, optTop); },
  },
  // same skill, but only grows rice, corn and shallot (the game before vegetables)
  grains: {
    plan: function (s) { planBest(s, GRAINS, true); },
    care: function (s) { strategies.expert.care(s); },
  },
  // knows the seasons but sometimes picks the wrong chemical, skips top-dressing and never prevents
  decent: {
    plan: function (s) { planBest(s, ALL_CROPS, false); },
    care: function (s) {
      strategies.expert.care(s);
      s.plots.forEach(function (p, i) {
        if (p.event && Math.random() < 0.35) E.setTreatment(s, i, p.event.options[Math.floor(Math.random() * 4)]);
        if (Math.random() < 0.5) E.setTop(s, i, null);
      });
      if (Math.random() < 0.4) E.setResponse(s, false);
      while (E.careCost(s) > s.money) { s.plots.forEach(function (p) { p.top = null; if (p.event) p.event.choice = 'none'; }); E.setResponse(s, false); }
    },
  },
  naive: {
    plan: function (s) { s.plots.forEach(function (p, i) { E.setPlan(s, i, 'rice', null); }); while (E.planCost(s) > s.money) { var idx = s.plots.findIndex(function (p) { return p.use === 'rice'; }); E.setPlan(s, idx, 'idle', null); } },
    care: function () {},
  },
  random: {
    plan: function (s) {
      var uses = ['rice', 'corn', 'shallot', 'fallow', 'idle'];
      var ferts = [null].concat(Object.keys(MF.FERTS));
      s.plots.forEach(function (p, i) { E.setPlan(s, i, uses[Math.floor(Math.random() * 5)], ferts[Math.floor(Math.random() * ferts.length)]); });
      s.plots.forEach(function (p, i) { if (E.planCost(s) > s.money) E.setPlan(s, i, 'idle', null); });
    },
    care: function (s) {
      s.plots.forEach(function (p, i) { if (p.event) E.setTreatment(s, i, p.event.options[Math.floor(Math.random() * 4)]); });
      while (E.careCost(s) > s.money) { s.plots.forEach(function (p) { if (p.event) p.event.choice = 'none'; }); }
    },
  },
};

function play(strategy, seed, used) {
  var s = E.newGame(seed);
  while (s.stage !== 'end') {
    strategy.plan(s);
    if (!E.startGrowing(s)) throw new Error('plan over budget at season ' + s.season);
    strategy.care(s);
    s.plots.forEach(function (p) {
      if (!E.isCrop(p.use)) return;
      used.basal[p.basal || 'none'] = (used.basal[p.basal || 'none'] || 0) + 1;
      used.top[p.top || 'none'] = (used.top[p.top || 'none'] || 0) + 1;
    });
    if (!E.harvest(s)) throw new Error('care over budget at season ' + s.season);
    E.nextSeason(s);
  }
  return s;
}

function q(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; }

Object.keys(strategies).forEach(function (name) {
  var money = [], stars = [0, 0, 0, 0], bankrupt = 0, used = { basal: {}, top: {} };
  for (var g = 0; g < GAMES; g++) {
    var s = play(strategies[name], 1000 + g, used);
    money.push(s.money);
    stars[E.stars(s.money)]++;
    if (s.over === 'bankrupt') bankrupt++;
  }
  money.sort(function (a, b) { return a - b; });
  if (process.env.PCT) console.log(name, [0.05, 0.1, 0.25, 0.5, 0.75, 0.9].map(function (p) { return q(money, p); }).join(' '));
  var mean = Math.round(money.reduce(function (a, b) { return a + b; }, 0) / money.length);
  console.log(
    name.padEnd(7),
    'mean', String(mean).padStart(7),
    '| p10', String(q(money, 0.1)).padStart(7),
    'p50', String(q(money, 0.5)).padStart(7),
    'p90', String(q(money, 0.9)).padStart(7),
    '| stars 0/1/2/3:', stars.map(function (n) { return Math.round((n / GAMES) * 100) + '%'; }).join(' / '),
    '| bankrupt', Math.round((bankrupt / GAMES) * 100) + '%'
  );
  if (process.env.FERTS) {
    ['basal', 'top'].forEach(function (slot) {
      var u = used[slot], total = Object.keys(u).reduce(function (a, k) { return a + u[k]; }, 0);
      console.log('   ' + slot.padEnd(5), Object.keys(u).sort(function (a, b) { return u[b] - u[a]; }).map(function (k) {
        return (k === 'none' ? 'none' : MF.FERTS[k].name) + ' ' + Math.round((u[k] / total) * 100) + '%';
      }).join(', '));
    });
  }
});
