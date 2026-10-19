/* Balance check: plays thousands of games with scripted strategies and prints final money.
   Run: node scripts/sim.js [games] */
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

function correctFor(ev) { return MF.EVENTS[ev.id].correct[0]; }

var strategies = {
  expert: {
    plan: function (s) {
      var season = E.seasonOf(s).season.id;
      s.plots.forEach(function (p, i) {
        var use;
        if (season === 'rain') use = i === 0 || s.weather.forecast === 'flood' ? 'rice' : 'corn';
        else if (season === 'cool') use = s.money - E.planCost(s) > 8000 ? 'shallot' : 'corn';
        else use = i === 3 ? 'corn' : 'idle'; // last season: only the pond plot pays for its water
        if (p.lastUse === use && use !== 'fallow' && season !== 'cool') use = use === 'rice' ? 'corn' : 'rice';
        E.setPlan(s, i, use, E.isCrop(use) ? bestBasal(p, use) : null);
        if (E.planCost(s) > s.money - 1500) E.setPlan(s, i, 'fallow', null);
      });
    },
    care: function (s) {
      if (E.weatherResponse(s)) E.setResponse(s, true);
      s.plots.forEach(function (p, i) {
        if (!E.isCrop(p.use)) return;
        if (p.event) E.setTreatment(s, i, correctFor(p.event));
        E.setTop(s, i, bestTop(p, p.use));
      });
      while (E.careCost(s) > s.money) {
        var p = s.plots.find(function (x) { return x.top; });
        if (!p) break;
        p.top = null;
      }
      if (E.careCost(s) > s.money) E.setResponse(s, false);
    },
  },
  // knows the seasons but sometimes picks the wrong chemical and skips top-dressing
  decent: {
    plan: function (s) { strategies.expert.plan(s); },
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

function play(strategy, seed) {
  var s = E.newGame(seed);
  while (s.stage !== 'end') {
    strategy.plan(s);
    if (!E.startGrowing(s)) throw new Error('plan over budget at season ' + s.season);
    strategy.care(s);
    if (!E.harvest(s)) throw new Error('care over budget at season ' + s.season);
    E.nextSeason(s);
  }
  return s;
}

function q(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; }

Object.keys(strategies).forEach(function (name) {
  var money = [], stars = [0, 0, 0, 0], bankrupt = 0;
  for (var g = 0; g < GAMES; g++) {
    var s = play(strategies[name], 1000 + g);
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
});
