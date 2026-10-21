/* The Magic Farmcare - screens, panels, bottom sheets, the coach and saving. */
(function (root) {
  var MF = root.MF, E = MF.engine, S = MF.sprites, A = MF.audio;
  var doc = root.document;
  function $(id) { return doc.getElementById(id); }

  var KEYS = { save: 'tmf.save.v2', settings: 'tmf.settings.v1', best: 'tmf.best.v2' };
  // localStorage can be missing or blocked (private mode, previews), so every access is guarded
  var store = {
    get: function (k, fallback) { try { var v = root.localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set: function (k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* not saved */ } },
    del: function (k) { try { root.localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  var settings = Object.assign({ music: true, sfx: true, seen: {}, tutorialOff: false }, store.get(KEYS.settings, {}));
  var reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var state = null;
  var screen = 'title';
  var scene = null, titleScene = null;
  var draft = null; // plot sheet draft: { i, use, basal, prevent }
  var sheetKind = null, lastFocus = null;
  var coachQueue = [], coachLines = [], coachKey = null;
  var shownMoney = 0;

  var USES = ['rice', 'corn', 'shallot', 'waterspinach', 'kale', 'dill', 'fallow', 'idle'];
  var SEASON_SHORT = { rain: 'ฝน', cool: 'หนาว', hot: 'ร้อน' };
  var RANKS = ['ชาวไร่ฝึกหัด', 'ชาวไร่มือใหม่', 'ชาวไร่มืออาชีพ', 'เกษตรกรมหัศจรรย์'];
  var END_MSG = [
    'ยังไม่ถึงเป้า ' + MF.CONFIG.stars[0].toLocaleString('en-US') + ' บาท ลองอ่านคำแนะนำของลุงพันธ์ทุกฤดู แล้วเล่นอีกรอบนะ',
    'ผ่านเป้าแรกแล้ว ลองปลูกพืชให้ตรงฤดู และใส่ปุ๋ยตามธาตุที่ดินขาด จะได้มากกว่านี้',
    'เก่งมาก อีกนิดเดียวจะได้ 3 ดาว ลองปลูกหอมแดงหน้าหนาว และเลือกยาให้ถูกทุกครั้ง',
    'สุดยอด คุณคือเกษตรกรมหัศจรรย์ของธนาพันธ์ ฟาร์มแคร์',
  ];

  /* ---------- small helpers ---------- */

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function saveSettings() { store.set(KEYS.settings, settings); }
  function saveGame() { if (state && !state.over) store.set(KEYS.save, state); }
  function sfx(name) { A.play(name); }

  function useName(use) { return MF.CROPS[use] ? MF.CROPS[use].name : MF.LAND_USES[use].name; }
  function useIcon(use, scale) { return S.img(use === 'idle' ? 'idle' : use + '2', scale); }

  function suitInfo(s) {
    if (s >= 0.9) return { n: 3, text: 'เหมาะมาก', tone: 'good' };
    if (s >= 0.6) return { n: 2, text: 'พอได้', tone: 'mid' };
    return { n: 1, text: 'ไม่เหมาะ', tone: 'bad' };
  }

  function starRow(n, max, scale) {
    var out = '';
    for (var i = 0; i < max; i++) out += S.img(i < n ? 'star' : 'starOff', scale);
    return out;
  }

  var ONE_YEAR = MF.CONFIG.years === 1;

  function lengthText() { return MF.CONFIG.years + ' ปี ' + E.totalSeasons() + ' ฤดู'; }

  function goalText() {
    return MF.CONFIG.stars.map(function (v, i) { return (i + 1) + ' ดาวที่ ' + fmt(v); }).join(' · ') + ' บาท';
  }

  function seasonLabel() {
    var si = E.seasonOf(state);
    return { year: si.year, name: si.season.name, months: si.season.months, id: si.season.id };
  }

  /* what the crop can use of each nutrient: soil + fertilizer, with P cut on acid soil (pUse) */
  function usable(soil, add, pUse) {
    return { N: soil.N + add.N, P: (soil.P + add.P) * (pUse || 1), K: soil.K + add.K };
  }

  function lackingOf(soil, add, need, pUse) {
    var u = usable(soil, add, pUse);
    return ['N', 'P', 'K'].filter(function (k) { return u[k] < need[k]; });
  }

  // "ดินเปรี้ยว" from MF.ACIDITY.sour up, "ดินเริ่มเปรี้ยว" below it
  function acidBadge(level) {
    if (!level) return '';
    var sour = level >= MF.ACIDITY.sour;
    return ' <span class="acid-badge' + (sour ? '' : ' mild') + '">' + (sour ? 'ดินเปรี้ยว' : 'ดินเริ่มเปรี้ยว') + '</span>';
  }

  /* N P K bars. base = soil, add = fertilizer, need = crop target. The bar scale tops out at 120.
     opts.pUse: share of P the crop can use on acid soil. opts.gap: a line saying what is still short and by how much. */
  function soilBars(soil, add, need, opts) {
    opts = opts || {};
    var lacking = need ? lackingOf(soil, add, need, opts.pUse) : [];
    var u = usable(soil, add, opts.pUse);
    var notes = '';
    if (opts.pUse && opts.pUse < 1) notes += '<p class="soil-gap bad">ดินเปรี้ยว พืชใช้ฟอสฟอรัสได้แค่ ' + Math.round(opts.pUse * 100) + '%</p>';
    if (need && opts.gap) {
      notes += lacking.length
        ? '<p class="soil-gap bad">ยังขาด ' + lacking.map(function (k) { return k + ' ' + Math.ceil(need[k] - u[k]); }).join(' · ') + ' เลือกสูตรที่มี ' + lacking.join(' ') + '</p>'
        : '<p class="soil-gap good">ธาตุอาหารพอแล้ว</p>';
    }
    return '<div class="soil">' + ['N', 'P', 'K'].map(function (k) {
      var base = Math.min(soil[k], 120), extra = Math.max(0, Math.min(add[k], 120 - base));
      var short = lacking.indexOf(k) >= 0;
      return '<div class="soil-row soil-' + k + '">' +
        '<b class="nut nut-' + k + '">' + k + '</b>' +
        '<span class="bar">' +
          '<i class="bar-base" style="width:' + (base / 1.2) + '%"></i>' +
          '<i class="bar-add" style="left:' + (base / 1.2) + '%;width:' + (extra / 1.2) + '%"></i>' +
          (need ? '<em class="bar-need" style="left:' + (need[k] / 1.2) + '%"></em>' : '') +
        '</span>' +
        '<span class="soil-val' + (short ? ' short' : '') + '">' + Math.round(soil[k]) +
          (add[k] ? '<small>+' + Math.round(add[k]) + '</small>' : '') + '</span>' +
      '</div>';
    }).join('') + notes +
    '<p class="soil-legend">N ไนโตรเจน · P ฟอสฟอรัส · K โพแทสเซียม' + (need ? ' · ขีดดำ = ระดับที่พืชต้องการ' : '') + '</p></div>';
  }

  function npkMini(soil) {
    return '<span class="npk">' + ['N', 'P', 'K'].map(function (k) {
      return '<span class="npk-item soil-' + k + '"><b>' + k + '</b><i style="--v:' + Math.min(100, soil[k]) + '%"></i></span>';
    }).join('') + '</span>';
  }

  function plotNum(i) { return '<span class="plot-num">' + (i + 1) + '</span>'; }

  /* fertilizer ids in picker order: full effect at this stage first, then 'any', then the 60% ones */
  function fertOrder(stage) {
    var rank = function (id) { var b = MF.FERTS[id].best; return b === stage ? 0 : b === 'any' ? 1 : 2; };
    return Object.keys(MF.FERTS).sort(function (a, b) { return rank(a) - rank(b); });
  }

  // "N+12 P+16": what one bag adds at this stage
  function addText(add) {
    return ['N', 'P', 'K'].filter(function (k) { return Math.round(add[k]) > 0; }).map(function (k) { return k + '+' + Math.round(add[k]); }).join(' ');
  }

  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- HUD and scene ---------- */

  function setMoney(animate) {
    var el = $('hud-money'), target = state.money;
    if (!animate || reduceMotion) { shownMoney = target; el.textContent = fmt(target); return; }
    var from = shownMoney, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / 700);
      el.textContent = fmt(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); else shownMoney = target;
    })(t0);
  }

  function renderHud(animateMoney) {
    var s = seasonLabel();
    setMoney(animateMoney);
    $('hud-year').textContent = ONE_YEAR ? 'ฤดูที่ ' + (state.season + 1) + ' / ' + E.totalSeasons() : 'ปีที่ ' + s.year + ' / ' + MF.CONFIG.years;
    $('hud-season-name').textContent = s.name;
    var track = '';
    for (var i = 0; i < E.totalSeasons(); i++) {
      var id = MF.SEASONS[i % 3].id;
      var cls = i < state.season ? 'done' : i === state.season ? 'now' : '';
      track += '<li class="pip pip-' + id + ' ' + cls + '" title="' + (ONE_YEAR ? '' : 'ปีที่ ' + (Math.floor(i / 3) + 1) + ' ') + MF.SEASONS[i % 3].name + '"></li>';
    }
    $('season-track').innerHTML = track;
    Array.prototype.forEach.call(doc.querySelectorAll('#stagebar li'), function (li) {
      var order = ['plan', 'care', 'harvest'];
      var cur = order.indexOf(state.stage), me = order.indexOf(li.getAttribute('data-stage'));
      li.className = me === cur ? 'now' : me < cur ? 'done' : '';
      if (me === cur) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    renderSoundButton();
  }

  function renderSoundButton() {
    var on = settings.music || settings.sfx;
    $('btn-sound').innerHTML = S.img(on ? 'soundOn' : 'soundOff', 3);
    $('btn-sound').setAttribute('aria-label', on ? 'ปิดเสียง' : 'เปิดเสียง');
  }

  function sceneView() {
    var sid = E.seasonOf(state).season.id;
    var stage = state.stage;
    var weather = null;
    if (stage === 'care') {
      weather = state.weather.actual;
      if (weather === 'normal') weather = sid === 'rain' ? 'rainLight' : null;
    }
    var plots = state.plots.map(function (p, i) {
      var v = { use: p.use };
      if (stage === 'plan') v.phase = 0;
      if (stage === 'care') {
        v.phase = 1;
        if (p.event) v.event = { type: MF.EVENTS[p.event.id].type, sprite: MF.EVENTS[p.event.id].sprite };
        v.dry = weather === 'drought' && !state.weather.respond && E.isCrop(p.use);
        if (weather === 'flood') v.flooded = state.weather.respond ? 0.15 : Math.min(0.85, 0.35 * MF.PLOTS[i].floodMult + 0.2);
        var rise = MF.PLOTS[i].riverRise && MF.PLOTS[i].riverRise[sid];
        if (rise && E.isCrop(p.use)) v.flooded = Math.max(v.flooded || 0, rise);
      }
      if (stage === 'harvest' && state.results) {
        var r = state.results.plots[i];
        v.use = r.use; v.phase = 2;
        if (MF.CROPS[r.use]) v.density = Math.max(0.15, Math.min(1, r.kg / MF.CROPS[r.use].baseYield));
      }
      return v;
    });
    return {
      season: sid, stage: stage, weather: weather, plots: plots, selected: draft ? draft.i : null, sparkleAt: scene && scene.lastSparkle,
      night: sid === 'rain' && stage === 'harvest', // the rainy season ends at Ok Phansa: fire boats on the Mekong
      // a season runs from morning (planting) through the day (care) to evening (harvest)
      time: stage === 'plan' ? 'dawn' : stage === 'harvest' && sid !== 'rain' ? 'dusk' : 'day',
    };
  }

  function updateScene() {
    if (!scene || !state) return;
    var v = sceneView();
    scene.setView(v);
  }

  function sparkle() {
    if (!scene) return;
    scene.lastSparkle = performance.now();
    updateScene();
  }

  /* ---------- stage panels ---------- */

  function renderPlan() {
    var s = seasonLabel();
    var fw = MF.WEATHER[state.weather.forecast];
    var html = '<div class="card forecast-card">' +
      '<div class="wc-icon">' + S.img(fw.icon, 4) + '</div>' +
      '<div class="wc-text"><span class="eyebrow">พยากรณ์อากาศ ' + esc(s.name) + ' (' + esc(s.months) + ') · แม่นยำราว 70%</span>' +
      '<h3>' + esc(fw.name[s.id]) + '</h3><p>' + esc(fw.desc) + '</p></div></div>';

    html += '<h2 class="section-title">เลือกพืชและปุ๋ยรองพื้น <small>แตะแปลงเพื่อเลือก</small></h2><ul class="plot-list">';
    state.plots.forEach(function (p, i) {
      var info = MF.PLOTS[i];
      var picked = p.use !== 'idle' || p.basal;
      html += '<li><button class="plot-row' + (picked ? ' picked' : '') + '" data-action="open-plot" data-i="' + i + '" data-key="plot-' + i + '">' +
        plotNum(i) +
        '<span class="plot-main"><span class="plot-name">' + esc(info.name) + ' <small>' + esc(info.terrain) + '</small>' + acidBadge(p.acid) + '</span>' + npkMini(p.soil) +
        (p.lastUse ? '<span class="plot-last">ฤดูที่แล้ว: ' + esc(useName(p.lastUse)) + '</span>' : '') + '</span>' +
        '<span class="plot-pick">' + useIcon(p.use, 3) + '<span class="pick-text"><b>' + esc(useName(p.use)) + '</b>' +
        (p.basal ? '<small>+ ' + esc(MF.FERTS[p.basal].name) + '</small>' : '') +
        (p.prevent && p.prevent.length ? '<small>+ ' + esc(p.prevent.map(function (id) { return MF.PREVENTIONS[id].short; }).join(', ')) + '</small>' : '') +
        (p.amend && p.amend.length ? '<small>+ ' + esc(p.amend.map(function (id) { return MF.AMENDMENTS[id].short; }).join(', ')) + '</small>' : '') + '</span></span>' +
        '</button></li>';
    });
    html += '</ul>';
    $('panel').innerHTML = html;

    var cost = E.planCost(state);
    var left = state.money - cost;
    $('action-info').innerHTML = '<span>ค่าใช้จ่ายตอนปลูก</span><b class="num big">' + fmt(cost) + '</b>' +
      '<span class="' + (left < 0 ? 'neg' : '') + '">' + (left < 0 ? 'เงินไม่พอ' : 'เหลือ ' + fmt(left)) + '</span>';
    var btn = $('btn-primary');
    btn.textContent = 'เริ่มปลูก';
    btn.disabled = left < 0;
  }

  function renderCare() {
    var s = seasonLabel();
    var w = MF.WEATHER[state.weather.actual];
    var resp = E.weatherResponse(state);
    var respCost = E.responseCost(state);
    var surprise = state.weather.actual !== state.weather.forecast;
    var tone = state.weather.actual === 'normal' ? 'good' : 'bad';

    var html = '<div class="card weather-card tone-' + tone + '">' +
      '<div class="wc-icon">' + S.img(w.icon, 4) + '</div>' +
      '<div class="wc-text"><span class="eyebrow">สภาพอากาศจริงฤดูนี้' + (surprise ? ' · ไม่ตรงพยากรณ์' : '') + '</span>' +
      '<h3>' + esc(w.name[s.id]) + '</h3><p>' + esc(w.desc) + '</p></div>';
    if (resp && respCost > 0) {
      var on = state.weather.respond;
      html += '<button class="toggle" data-action="toggle-response" data-key="resp" aria-pressed="' + on + '">' +
        '<span class="check" aria-hidden="true"></span>' +
        '<span class="toggle-text"><b>' + esc(resp.label) + '</b><small>ลดความเสียหายทุกแปลงที่ปลูกพืช</small></span>' +
        '<span class="price num">' + fmt(respCost) + '</span></button>';
    }
    html += '</div>';

    var events = state.plots.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.event; });
    html += '<h2 class="section-title">ปัญหาในแปลง <small>' + (events.length ? 'พบ ' + events.length + ' แปลง' : 'ไม่พบปัญหา') + '</small></h2>';
    if (!events.length) {
      html += '<div class="card calm-card">' + S.img('lung', 3) + '<p>ไม่พบแมลง โรค หรือวัชพืชในฤดูนี้ แปลงสวยดี</p></div>';
    }
    events.forEach(function (x) {
      var e = MF.EVENTS[x.p.event.id], i = x.i;
      var choice = x.p.event.choice;
      html += '<article class="card event-card">' +
        '<header class="event-head"><div class="event-icon">' + S.eventIcon(e.sprite, 4) + '</div>' +
        '<div><span class="tag tag-' + e.type + '">' + esc(MF.EVENT_TYPES[e.type]) + '</span> <span class="event-where">' + plotNum(i) + esc(useName(x.p.use)) + '</span>' +
        '<h3>' + esc(e.name) + '</h3></div></header>' +
        '<p class="symptom"><b>อาการ</b> ' + esc(e.symptom) + '</p>' +
        '<p class="risk">ถ้าปล่อยไว้ ผลผลิตอาจเสียหายราว ' + Math.round(e.loss * 100) + '%' +
        (e.cure ? ' · ' + (e.soil ? 'เป็นโรคในดิน ' : 'เชื้อเข้าในต้นแล้ว ') + 'ใช้ยาถูกก็ยังเสียหายราว ' + Math.round(e.loss * (1 - e.cure) * 100) + '%' : '') + '</p>' +
        '<div class="shop-label">' + S.img('brand', 2) + '<span><b>ธนาพันธ์ ฟาร์มแคร์</b>เลือกยา 1 ชนิด</span></div><div class="options">';
      x.p.event.options.forEach(function (pid) {
        var pr = MF.PRODUCTS[pid];
        html += '<button class="opt" data-action="treat" data-i="' + i + '" data-p="' + pid + '" data-key="treat-' + i + '-' + pid + '" aria-pressed="' + (choice === pid) + '">' +
          '<span class="opt-icon">' + S.img('bottle', 3, { x: S.GROUP_COLORS[pr.group] }) + '</span>' +
          '<span class="opt-text"><b>' + esc(pr.name) + '</b><small>' + esc(MF.PRODUCT_GROUPS[pr.group]) + ' · ' + esc(pr.desc) + '</small></span>' +
          '<span class="price num">' + fmt(pr.cost) + '</span></button>';
      });
      html += '<button class="opt opt-none" data-action="treat" data-i="' + i + '" data-p="none" data-key="treat-' + i + '-none" aria-pressed="' + (choice === 'none') + '">' +
        '<span class="opt-icon">' + S.img('none', 3) + '</span><span class="opt-text"><b>ไม่ฉีดพ่น</b><small>ประหยัดเงิน แต่เสี่ยงเสียผลผลิต</small></span><span class="price num">0</span></button>';
      html += '</div></article>';
    });

    var crops = state.plots.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return E.isCrop(x.p.use); });
    if (crops.length) {
      html += '<h2 class="section-title">ปุ๋ยแต่งหน้า <small>ใส่ได้แปลงละ 1 ครั้ง</small></h2><div class="card top-card">';
      crops.forEach(function (x) {
        var crop = MF.CROPS[x.p.use];
        var basal = E.fertAdd(x.p.basal, 'basal'), top = E.fertAdd(x.p.top, 'top');
        var add = { N: basal.N + top.N, P: basal.P + top.P, K: basal.K + top.K };
        // acidity this season, with the top-dressing picked so far (21-0-0 can tip the soil into sour)
        var acidNow = E.seasonAcid(x.p), pUse = E.acidEffect(acidNow).pUse;
        var nut = E.nutrientFactor(crop, usable(x.p.soil, add, pUse));
        var lacking = lackingOf(x.p.soil, add, crop.need, pUse);
        var hint = nut.excess ? '<span class="hint bad">N มากเกินไป</span>' : lacking.length ? '<span class="hint bad">ยังขาด ' + lacking.join(' ') + '</span>' : '<span class="hint good">ธาตุอาหารพอแล้ว</span>';
        html += '<div class="top-row"><div class="top-head">' + plotNum(x.i) + '<b>' + esc(crop.name) + '</b>' + acidBadge(acidNow) + hint + '</div>' +
          soilBars(x.p.soil, add, crop.need, { pUse: pUse }) + '<div class="chips">' +
          '<button class="chip" data-action="top" data-i="' + x.i + '" data-f="" data-key="top-' + x.i + '-none" aria-pressed="' + !x.p.top + '">ไม่ใส่</button>';
        fertOrder('top').forEach(function (fid) {
          var f = MF.FERTS[fid];
          html += '<button class="chip" data-action="top" data-i="' + x.i + '" data-f="' + fid + '" data-key="top-' + x.i + '-' + fid + '" aria-pressed="' + (x.p.top === fid) + '">' +
            '<b>' + esc(f.name) + '</b><span class="num">' + fmt(f.cost) + '</span>' + (f.best === 'basal' ? '<small>ได้ผล 60%</small>' : '') + '</button>';
        });
        html += '</div></div>';
      });
      html += '</div>';
    }
    $('panel').innerHTML = html;

    var cost = E.careCost(state);
    var left = state.money - cost;
    var undecided = events.filter(function (x) { return !x.p.event.choice; }).length;
    $('action-info').innerHTML = '<span>ค่ายา ปุ๋ย และน้ำ</span><b class="num big">' + fmt(cost) + '</b>' +
      '<span class="' + (left < 0 ? 'neg' : '') + '">' + (left < 0 ? 'เงินไม่พอ' : undecided ? 'ยังไม่เลือกยา ' + undecided + ' แปลง' : 'เหลือ ' + fmt(left)) + '</span>';
    var btn = $('btn-primary');
    btn.textContent = 'เก็บเกี่ยว';
    btn.disabled = left < 0;
  }

  function renderHarvest() {
    var s = seasonLabel();
    var res = state.results;
    var html = '<div class="receipt"><div class="receipt-head"><b>ใบสรุปผลผลิต</b><span>' + (ONE_YEAR ? '' : 'ปีที่ ' + s.year + ' · ') + esc(s.name) + ' (' + esc(s.months) + ')</span></div>';
    res.plots.forEach(function (r, i) {
      var crop = MF.CROPS[r.use];
      html += '<div class="r-plot"><div class="r-line">' + plotNum(i) + '<span class="r-icon">' + useIcon(r.use, 3) + '</span>' +
        '<span class="r-name"><b>' + esc(useName(r.use)) + '</b>' +
        (crop ? '<small class="num">' + fmt(r.kg) + ' กก. × ' + (r.price || crop.price) + ' บาท</small>' +
          (r.safe ? '<span class="safe-tag">ผักปลอดภัย</span>' : '') : '<small>ไม่มีผลผลิตขาย</small>') + '</span>' +
        '<span class="r-amt num big">' + (crop ? fmt(r.revenue) : '-') + '</span></div>';
      if (r.tips.length) {
        html += '<ul class="tips">' + r.tips.slice(0, 4).map(function (t) { return '<li class="tip-' + t.tone + '">' + esc(t.text) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div>';
    });
    html += '<dl class="r-sum">' +
      '<div><dt>รายได้จากการขายผลผลิต</dt><dd class="num big">' + fmt(res.revenue) + '</dd></div>' +
      '<div><dt>ต้นทุนฤดูนี้ (เมล็ด ปุ๋ย ยา น้ำ)</dt><dd class="num big">−' + fmt(res.cost) + '</dd></div>' +
      '<div class="r-profit ' + (res.profit >= 0 ? 'pos' : 'neg') + '"><dt>กำไรสุทธิ</dt><dd class="num big">' + (res.profit >= 0 ? '+' : '−') + fmt(Math.abs(res.profit)) + '</dd></div>' +
      '<div><dt>เงินคงเหลือ</dt><dd class="num big">' + fmt(state.money) + '</dd></div>' +
      '</dl></div>';
    $('panel').innerHTML = html;

    var last = state.season >= E.totalSeasons() - 1;
    $('action-info').innerHTML = '<span>กำไรฤดูนี้</span><b class="num big ' + (res.profit >= 0 ? 'pos' : 'neg') + '">' + (res.profit >= 0 ? '+' : '−') + fmt(Math.abs(res.profit)) + '</b>';
    var btn = $('btn-primary');
    btn.textContent = last ? 'ดูผลสรุป' : 'ฤดูถัดไป';
    btn.disabled = false;
  }

  function renderGame(opts) {
    opts = opts || {};
    renderHud(opts.animateMoney);
    if (state.stage === 'plan') renderPlan();
    else if (state.stage === 'care') renderCare();
    else if (state.stage === 'harvest') renderHarvest();
    if (opts.scrollTop) $('panel').scrollTop = 0;
    updateScene();
  }

  /* re-render while keeping scroll position and the focused control */
  function rerenderPanel() {
    var panel = $('panel'), top = panel.scrollTop;
    var key = doc.activeElement && doc.activeElement.getAttribute && doc.activeElement.getAttribute('data-key');
    renderGame();
    panel.scrollTop = top;
    if (key) { var el = panel.querySelector('[data-key="' + key + '"]'); if (el) el.focus({ preventScroll: true }); }
  }

  /* ---------- bottom sheet ---------- */

  function openSheet(kind, html) {
    var sheet = $('sheet');
    if (sheet.hidden) lastFocus = doc.activeElement;
    sheetKind = kind;
    $('sheet-body').innerHTML = html;
    $('sheet-body').scrollTop = 0;
    sheet.hidden = false;
    $('sheet-backdrop').hidden = false;
    requestAnimationFrame(function () { sheet.classList.add('open'); });
    var first = sheet.querySelector('[data-autofocus]') || sheet.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }

  function refreshSheet(html) {
    var body = $('sheet-body'), top = body.scrollTop;
    var key = doc.activeElement && doc.activeElement.getAttribute && doc.activeElement.getAttribute('data-key');
    body.innerHTML = html;
    body.scrollTop = top;
    if (key) { var el = body.querySelector('[data-key="' + key + '"]'); if (el) el.focus({ preventScroll: true }); }
  }

  function closeSheet() {
    var sheet = $('sheet');
    if (sheet.hidden) return;
    sheet.classList.remove('open');
    sheet.hidden = true;
    $('sheet-backdrop').hidden = true;
    sheetKind = null;
    draft = null;
    updateScene();
    if (lastFocus && lastFocus.focus && doc.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  function plotSheetHtml() {
    var d = draft, p = state.plots[d.i], info = MF.PLOTS[d.i];
    var s = seasonLabel();
    var crop = MF.CROPS[d.use];
    var add = crop ? E.fertAdd(d.basal, 'basal') : (d.use === 'fallow' ? MF.LAND_USES.fallow.add : { N: 0, P: 0, K: 0 });
    // acidity this season if planted as drafted (dolomite takes it down; a 21-0-0 top-dressing later can push it up)
    var pUse = crop ? E.acidEffect(E.seasonAcid({ acid: p.acid, amend: d.amend, basal: d.basal, top: null })).pUse : 1;

    var html = '<div class="sheet-head">' + plotNum(d.i) + '<div class="sheet-title"><h2>' + esc(info.name) + ' · ' + esc(info.terrain) + '</h2>' +
      '<p>' + esc(info.note) + (p.lastUse ? ' · ฤดูที่แล้วปลูก' + esc(useName(p.lastUse)) : '') + acidBadge(p.acid) + '</p></div>' +
      '<button class="icon-btn close-btn" data-action="close-sheet" aria-label="ปิด">×</button></div>';
    html += '<h3 class="sheet-sub">ธาตุอาหารในดิน' + (crop ? ' เทียบกับที่' + esc(crop.name) + 'ต้องการ' : '') + '</h3>' +
      soilBars(p.soil, add, crop ? crop.need : null, { pUse: pUse, gap: true });

    html += '<h3 class="sheet-sub">จะปลูกอะไรใน' + esc(s.name) + '</h3><div class="choice-grid crops">';
    USES.forEach(function (u) {
      if (u === 'fallow') html += '</div><div class="choice-grid rest">';
      var c = MF.CROPS[u];
      var suit = c ? suitInfo(c.suit[s.id]) : null;
      html += '<button class="choice" data-action="pick-use" data-use="' + u + '" data-key="use-' + u + '" aria-pressed="' + (d.use === u) + '">' +
        '<span class="choice-icon">' + useIcon(u, 4) + '</span><b>' + esc(c ? c.name : MF.LAND_USES[u].name) + '</b>' +
        '<small class="num">' + (E.useCost(u) ? fmt(E.useCost(u)) + ' บาท' : 'ฟรี') + '</small>' +
        (suit ? '<span class="suit suit-' + suit.tone + '">' + starRow(suit.n, 3, 1) + ' ' + suit.text + '</span>' : '') +
        '</button>';
    });
    html += '</div>';
    var note = crop ? crop.note + ' · ขาย ' + crop.price + ' บาท/กก.' + (crop.veg ? ' ถ้าไม่ใช้ยาเคมี ขายเป็นผักปลอดภัยได้เพิ่ม ' + Math.round(MF.CONFIG.safeVegBonus * 100) + '%' : '') : MF.LAND_USES[d.use].note;
    html += '<p class="crop-note">' + esc(note) + '</p>';

    if (crop) {
      // grouped by timing: what works fully at planting (with "none" first), then the top-dressing ones at 60%
      var ferts = fertOrder('basal');
      var groups = [
        ['เหมาะใส่ตอนปลูก', ferts.filter(function (id) { return MF.FERTS[id].best !== 'top'; })],
        ['ปุ๋ยแต่งหน้า ใส่ตอนปลูกได้ผลแค่ 60%', ferts.filter(function (id) { return MF.FERTS[id].best === 'top'; })],
      ];
      html += '<h3 class="sheet-sub">ปุ๋ยรองพื้น <small>ใส่ตอนปลูก</small></h3>' +
        '<p class="fert-note">ราคาในเกมเทียบสัดส่วนจากราคาเฉลี่ยร้านค้าในไทย ไม่ใช่ราคาขายจริง</p>';
      groups.forEach(function (g, gi) {
        html += '<p class="fert-group">' + g[0] + '</p><div class="fert-list">';
        if (gi === 0) {
          html += '<button class="fert" data-action="pick-basal" data-f="" data-key="basal-none" aria-pressed="' + !d.basal + '">' +
            '<span class="sack">' + S.img('none', 3) + '</span><span class="fert-text"><b>ไม่ใส่ปุ๋ยรองพื้น</b><small>ใช้ธาตุอาหารที่มีในดินอย่างเดียว</small></span><span class="price num">0</span></button>';
        }
        g[1].forEach(function (fid) {
          var f = MF.FERTS[fid];
          var gives = 'ได้ ' + addText(E.fertAdd(fid, 'basal')) + (f.best === 'any' ? ' · ใช้ได้ทุกช่วง' : '');
          html += '<button class="fert" data-action="pick-basal" data-f="' + fid + '" data-key="basal-' + fid + '" aria-pressed="' + (d.basal === fid) + '">' +
            '<span class="sack">' + S.img('sack', 3, { x: f.color }) + '</span>' +
            '<span class="fert-text"><b>' + esc(f.name) + ' · ' + esc(f.tag) + '</b><small>' + esc(f.desc) + '</small><small class="timing">' + gives + '</small></span>' +
            '<span class="price num">' + fmt(f.cost) + '</span></button>';
        });
        html += '</div>';
      });
    }

    var prevents = E.preventionsFor(d.use);
    if (prevents.length) {
      var soilRisk = info.wet && crop.events.some(function (ev) { return MF.EVENTS[ev].soil; });
      html += '<h3 class="sheet-sub">ป้องกันโรคตั้งแต่ปลูก <small>เลือกได้หลายอย่าง</small></h3>' +
        (soilRisk ? '<p class="crop-note">แปลงนี้ดินชื้น โรคในดินเกิดง่ายกว่าแปลงอื่น</p>' : '') + '<div class="fert-list">';
      prevents.forEach(function (id) {
        var pv = MF.PREVENTIONS[id];
        var cuts = crop.events.filter(function (ev) { return pv.prevents[ev]; }).map(function (ev) {
          return MF.EVENTS[ev].name + ' ' + Math.round(pv.prevents[ev] * 100) + '%';
        });
        html += '<button class="fert" data-action="toggle-prevent" data-p="' + id + '" data-key="prevent-' + id + '" aria-pressed="' + (d.prevent.indexOf(id) >= 0) + '">' +
          '<span class="sack">' + S.img(pv.icon, 3, { x: pv.color }) + '</span>' +
          '<span class="fert-text"><b>' + esc(pv.name) + '</b><small>' + esc(pv.desc) + '</small><small class="timing">ลดโอกาสเกิด' + esc(cuts.join(', ')) + '</small></span>' +
          '<span class="price num">' + fmt(pv.cost) + '</span></button>';
      });
      html += '</div>';
    }

    // soil fixes, offered once the soil has started to turn acid
    var acid = p.acid || 0;
    if (E.canAmend(d.use) && acid > 0) {
      var nextUp = Object.keys(MF.FERTS).reduce(function (m, id) { return Math.max(m, MF.FERTS[id].acidify || 0); }, 0);
      var acidNote = acid >= MF.ACIDITY.sour ? 'ดินแปลงนี้เปรี้ยวแล้ว พืชใช้ฟอสฟอรัสได้น้อยลงและผลผลิตลด'
        : acid + nextUp >= MF.ACIDITY.sour ? 'ดินแปลงนี้เริ่มเปรี้ยว ถ้าใส่ 21-0-0 อีกฤดูนี้ ดินจะเปรี้ยว พืชใช้ฟอสฟอรัสได้น้อยลง'
        : 'ดินแปลงนี้เริ่มเปรี้ยว ยังไม่กระทบผลผลิต แต่ถ้าใส่ 21-0-0 ต่อไปจะเปรี้ยว';
      html += '<h3 class="sheet-sub">ปรับปรุงดิน <small>ใส่ตอนปลูก</small></h3><p class="crop-note">' + acidNote + '</p><div class="fert-list">';
      Object.keys(MF.AMENDMENTS).forEach(function (id) {
        var am = MF.AMENDMENTS[id];
        html += '<button class="fert" data-action="toggle-amend" data-a="' + id + '" data-key="amend-' + id + '" aria-pressed="' + (d.amend.indexOf(id) >= 0) + '">' +
          '<span class="sack">' + S.img(am.icon, 3, { x: am.color }) + '</span>' +
          '<span class="fert-text"><b>' + esc(am.name) + '</b><small>' + esc(am.desc) + '</small><small class="timing">ลดความเปรี้ยวของดินได้มาก</small></span>' +
          '<span class="price num">' + fmt(am.cost) + '</span></button>';
      });
      html += '</div>';
    }

    var thisCost = E.plotCost({ use: d.use, basal: d.basal, prevent: d.prevent, amend: d.amend });
    var others = E.planCost(state) - E.plotCost(p);
    var over = others + thisCost > state.money;
    html += '<div class="sheet-foot"><div class="sheet-total"><span>ค่าใช้จ่ายแปลงนี้ (บาท)</span><b class="num big">' + fmt(thisCost) + '</b>' +
      (over ? '<span class="neg">เงินไม่พอ</span>' : '') + '</div>' +
      '<button class="btn btn-primary" data-action="confirm-plot" data-key="confirm"' + (over ? ' disabled' : '') + '>ตกลง</button></div>';
    return html;
  }

  function openPlot(i) {
    if (state.stage !== 'plan') return;
    var p = state.plots[i];
    draft = { i: i, use: p.use, basal: p.basal, prevent: (p.prevent || []).slice(), amend: (p.amend || []).slice() };
    sfx('tap');
    openSheet('plot', plotSheetHtml());
    updateScene();
    coach('plotSheet');
  }

  function menuHtml() {
    return '<div class="sheet-head"><div class="sheet-title"><h2>เมนู</h2></div><button class="icon-btn close-btn" data-action="close-sheet" aria-label="ปิด">×</button></div>' +
      '<div class="menu-list">' +
      '<button class="btn" data-action="close-sheet" data-autofocus>เล่นต่อ</button>' +
      '<button class="btn" data-action="toggle-music" data-key="m-music">เพลง: ' + (settings.music ? 'เปิด' : 'ปิด') + '</button>' +
      '<button class="btn" data-action="toggle-sfx" data-key="m-sfx">เสียงเอฟเฟกต์: ' + (settings.sfx ? 'เปิด' : 'ปิด') + '</button>' +
      '<button class="btn" data-action="howto">วิธีเล่น</button>' +
      '<button class="btn" data-action="replay-tutorial">ให้ลุงพันธ์สอนอีกครั้ง</button>' +
      '<button class="btn" data-action="confirm-restart">เริ่มเกมใหม่</button>' +
      '<button class="btn" data-action="go-title">กลับหน้าหลัก</button>' +
      '</div><p class="menu-note">เกมบันทึกอัตโนมัติทุกครั้งที่ตัดสินใจ</p>';
  }

  function confirmHtml(text, action) {
    return '<div class="sheet-head"><div class="sheet-title"><h2>เริ่มเกมใหม่?</h2></div></div>' +
      '<p class="confirm-text">' + esc(text) + '</p>' +
      '<div class="confirm-actions"><button class="btn" data-action="close-sheet" data-autofocus>ยกเลิก</button>' +
      '<button class="btn btn-danger" data-action="' + action + '">เริ่มใหม่</button></div>';
  }

  function howtoHtml() {
    var rows = [
      ['sun', 'เตรียมปลูก', 'ดูพยากรณ์อากาศ แตะแต่ละแปลงเพื่อเลือกพืชให้เหมาะกับฤดู และเลือกปุ๋ยรองพื้นตามธาตุที่ดินขาด'],
      ['bug', 'ดูแล', 'อากาศจริงจะเปิดเผย อาจเจอแมลง โรค หรือวัชพืช เลือกยาให้ตรงปัญหา และใส่ปุ๋ยแต่งหน้าได้อีกแปลงละครั้ง'],
      ['coin', 'เก็บเกี่ยว', 'ขายผลผลิตตามราคาคงที่ ดูสรุปว่าอะไรทำให้ผลผลิตลด แล้วปรับแผนฤดูถัดไป'],
      ['star', 'เป้าหมาย', 'เริ่ม ' + fmt(MF.CONFIG.startMoney) + ' บาท เล่น ' + lengthText() + ' (ฝน หนาว ร้อน) ได้ ' + goalText() + ' ถ้าเงินเหลือไม่ถึง ' + fmt(MF.CONFIG.minMoneyToContinue) + ' บาทจะล้มละลาย'],
    ];
    return '<div class="sheet-head"><div class="sheet-title"><h2>วิธีเล่น</h2><p>1 ฤดูมี 3 ช่วง เล่นจบราว 5 นาที</p></div><button class="icon-btn close-btn" data-action="close-sheet" aria-label="ปิด">×</button></div>' +
      '<ol class="howto">' + rows.map(function (r) {
        return '<li><span class="howto-icon">' + S.img(r[0], r[0] === 'coin' || r[0] === 'star' ? 4 : 3) + '</span><div><b>' + r[1] + '</b><p>' + r[2] + '</p></div></li>';
      }).join('') + '</ol>' +
      '<div class="howto-tips"><b>เคล็ดลับจากลุงพันธ์</b><ul>' +
      '<li>ข้าวและผักบุ้งชอบฤดูฝน หอมแดง คะน้า ผักชีลาวชอบฤดูหนาว ข้าวโพดปลูกได้ทั้งฝนและหนาว</li>' +
      '<li>แปลงที่ลุ่มเสี่ยงน้ำท่วม แปลงที่ดอนเสี่ยงแล้ง แปลงริมโขงดินดี สูบน้ำได้ถูก แต่หน้าฝนน้ำโขงขึ้น</li>' +
      '<li>ผักกินใบที่ไม่ใช้ยาเคมี หรือใช้ชีวภัณฑ์ (เชื้อบีที ไตรโคเดอร์มา) ขายเป็นผักปลอดภัย ได้ราคาเพิ่ม ' + Math.round(MF.CONFIG.safeVegBonus * 100) + '%</li>' +
      '<li>ปลูกพืชเดิมซ้ำแปลงเดิม โรคและแมลงจะมากขึ้น ใส่ไนโตรเจนมากไปก็เช่นกัน</li>' +
      '<li>เลือกปุ๋ยตามธาตุที่ดินขาด ไม่ใช่ตามชนิดพืช: ขาด N มากใช้ 46-0-0 ขาดไม่มากใช้ 21-0-0 ขาด N กับ P แต่ K พอใช้ 30-20-0 ขาด P ใช้ 16-20-0 ขาด K ใช้ 0-0-60 ขาดครบทั้งสามตัวใช้ 15-15-15</li>' +
      '<li>ปุ๋ยถุงถูกไม่ได้คุ้มเสมอ เช่น 21-0-0 ถุงถูกกว่ายูเรียราว 30% แต่ไนโตรเจนไม่ถึงครึ่ง เงินเท่ากันได้ N น้อยกว่า และใส่ติดกัน 2 ฤดูดินจะเปรี้ยว พืชใช้ฟอสฟอรัสได้น้อยลง แก้ด้วยปูนโดโลไมท์ตอนปลูก</li>' +
      '<li>ราคาปุ๋ยในเกมเทียบสัดส่วนจากราคาเฉลี่ยร้านค้าในไทย ให้เห็นว่าสูตรไหนแพงหรือถูกกว่ากันราวเท่าไหร่ ไม่ใช่ราคาขายจริง</li>' +
      '<li>โรคในดิน เช่น เน่าคอดิน รากเน่า รักษาตอนเป็นแล้วได้ผลไม่เต็มที่ คลุกเมล็ดหรือใส่ไตรโคเดอร์มาตั้งแต่ปลูกช่วยป้องกัน</li>' +
      '<li>ฤดูร้อนน้ำน้อย ทุกพืชได้ผลผลิตต่ำ แปลงริมโขงสูบน้ำได้ถูกกว่า</li>' +
      '</ul></div>';
  }

  /* ---------- coach (tutorial) ---------- */

  function coach(key) {
    if (settings.tutorialOff || settings.seen[key] || !MF.TUTORIAL[key]) return;
    if (coachKey === key || coachQueue.indexOf(key) >= 0) return;
    if (coachKey) { coachQueue.push(key); return; }
    coachKey = key;
    coachLines = MF.TUTORIAL[key].slice();
    showCoachLine();
  }

  function showCoachLine() {
    $('coach-text').textContent = coachLines[0];
    $('coach-next').textContent = coachLines.length > 1 ? 'ถัดไป' : 'เข้าใจแล้ว';
    $('coach').hidden = false;
  }

  function coachNext() {
    coachLines.shift();
    if (coachLines.length) { sfx('tap'); showCoachLine(); return; }
    settings.seen[coachKey] = true;
    saveSettings();
    coachKey = null;
    $('coach').hidden = true;
    if (coachQueue.length) coach(coachQueue.shift());
  }

  function coachSkip() {
    settings.tutorialOff = true;
    saveSettings();
    coachQueue = []; coachLines = []; coachKey = null;
    $('coach').hidden = true;
  }

  function seasonCoach() {
    if (state.stage !== 'plan') return;
    var id = E.seasonOf(state).season.id;
    if (state.season === 0) coach('welcome');
    if (id === 'cool') coach('cool');
    if (id === 'hot') coach('hot');
    if (state.plots.some(function (p) { return (p.acid || 0) > 0; })) coach('acid');
  }

  /* ---------- screens ---------- */

  function show(name) {
    screen = name;
    $('toast').hidden = true;
    $('screen-title').hidden = name !== 'title';
    $('screen-game').hidden = name !== 'game';
    $('screen-end').hidden = name !== 'end';
    if (titleScene) { if (name === 'title') titleScene.start(); else titleScene.stop(); }
    if (scene) { if (name === 'game') scene.start(); else scene.stop(); }
    root.scrollTo(0, 0);
  }

  function renderTitle() {
    var save = store.get(KEYS.save, null);
    var cont = $('btn-continue');
    if (E.isCurrentSave(save)) {
      var si = E.seasonOf(save);
      cont.hidden = false;
      $('continue-info').textContent = (ONE_YEAR ? '' : 'ปีที่ ' + si.year + ' · ') + si.season.name + ' · ' + fmt(save.money) + ' บาท';
    } else {
      cont.hidden = true;
    }
    var best = store.get(KEYS.best, []);
    $('best-line').innerHTML = best.length
      ? '<span>สถิติสูงสุด</span> <b class="num big">' + fmt(best[0].money) + ' บาท</b> ' + starRow(E.stars(best[0].money), 3, 2)
      : '<span>ยังไม่มีสถิติ เริ่มเล่นรอบแรกได้เลย</span>';
    show('title');
  }

  function startNewGame() {
    closeSheet();
    store.del(KEYS.save);
    state = E.newGame((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    saveGame();
    enterGame();
    track('game_start');
  }

  function continueGame() {
    var save = store.get(KEYS.save, null);
    if (!E.isCurrentSave(save)) { startNewGame(); return; }
    state = save;
    enterGame();
  }

  function enterGame() {
    shownMoney = state.money;
    show('game');
    renderGame({ scrollTop: true });
    seasonCoach();
    if (state.stage === 'care') coach('care');
  }

  function primaryAction() {
    if (state.stage === 'plan') {
      if (!E.startGrowing(state)) { toast('เงินไม่พอสำหรับแผนนี้'); return; }
      sfx('plant');
      saveGame();
      sparkle();
      renderGame({ animateMoney: true, scrollTop: true });
      if (state.weather.actual !== state.weather.forecast) toast('อากาศจริงไม่ตรงพยากรณ์');
      coach('care');
    } else if (state.stage === 'care') {
      if (!E.harvest(state)) { toast('เงินไม่พอ ลองลดยาหรือปุ๋ยบางรายการ'); return; }
      sfx(state.results.profit >= 0 ? 'harvest' : 'bad');
      saveGame();
      sparkle();
      renderGame({ animateMoney: true, scrollTop: true });
      if (E.seasonOf(state).season.id === 'rain') toast('คืนวันออกพรรษา มีไหลเรือไฟที่แม่น้ำโขง');
      coach('harvest');
    } else if (state.stage === 'harvest') {
      E.nextSeason(state);
      if (state.stage === 'end') { finishGame(); return; }
      sfx('season');
      saveGame();
      renderGame({ scrollTop: true });
      seasonCoach();
    }
  }

  function finishGame() {
    var stars = E.stars(state.money);
    var best = store.get(KEYS.best, []);
    var d = new Date();
    var entry = { money: state.money, stars: stars, over: state.over, date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
    best.push(entry);
    best.sort(function (a, b) { return b.money - a.money; });
    best = best.slice(0, 5);
    store.set(KEYS.best, best);
    store.del(KEYS.save);
    renderEnd(entry, best);
    track('game_end', { stars: stars, bankrupt: !!state.over });
    show('end');
    sfx(stars >= 2 ? 'fanfare' : stars === 1 ? 'good' : 'bad');
  }

  function moneyChart() {
    var hist = state.history;
    var goals = MF.CONFIG.stars;
    var top = Math.max(goals[goals.length - 1] * 1.1, Math.max.apply(null, hist.map(function (h) { return h.money; }).concat([MF.CONFIG.startMoney])));
    var lines = MF.CONFIG.stars.map(function (v) {
      return '<span class="goal-line" style="bottom:' + (v / top) * 100 + '%"><em>' + v / 1000 + 'k</em></span>';
    }).join('');
    var bars = hist.map(function (h) {
      var sid = MF.SEASONS[h.season % 3].id;
      return '<div class="bar-col"><span class="bar-val num">' + Math.round(h.money / 1000) + 'k</span>' +
        '<span class="mbar mbar-' + sid + '" style="height:' + Math.max(1, (h.money / top) * 100) + '%"></span>' +
        '<span class="bar-lab">' + SEASON_SHORT[sid] + (ONE_YEAR ? '' : '<small>ปี ' + (Math.floor(h.season / 3) + 1) + '</small>') + '</span></div>';
    }).join('');
    return '<div class="money-chart" role="img" aria-label="กราฟเงินคงเหลือหลังเก็บเกี่ยวแต่ละฤดู">' +
      '<div class="chart-area" style="grid-template-columns:repeat(' + E.totalSeasons() + ',minmax(0,1fr))">' + lines + bars + '</div>' +
      '<p class="chart-note">เส้นประ = เป้าหมาย ' + goals.map(function (v, i) { return (i + 1) + ' ดาว (' + v / 1000 + 'k)'; }).join(' · ') + ' บาท</p></div>';
  }

  function renderEnd(entry, best) {
    var stars = entry.stars;
    var bankrupt = state.over === 'bankrupt';
    var st = state.stats;
    var html = '<div class="end-wrap">' + (stars === 3 && !reduceMotion ? '<canvas class="end-fx" aria-hidden="true"></canvas>' : '') +
      '<div class="end-head"><span class="eyebrow">' + (bankrupt ? 'เงินทุนหมดก่อนครบ ' + MF.CONFIG.years + ' ปี' : 'ครบ ' + lengthText() + 'แล้ว') + '</span>' +
      (bankrupt ? '' : '<div class="end-badge">' + badgeImg(stars) + '</div>') +
      '<h1>' + (bankrupt ? 'ล้มละลาย' : RANKS[stars]) + '</h1></div>' +
      '<div class="end-stars">' + [0, 1, 2].map(function (i) { return '<span class="end-star" style="--d:' + i * 0.35 + 's">' + S.img(i < stars ? 'star' : 'starOff', 6) + '</span>'; }).join('') + '</div>' +
      '<div class="end-money"><small>เงินสุดท้าย</small><b class="num big">' + fmt(state.money) + '</b><small>บาท</small></div>' +
      '<div class="end-coach">' + S.img('lung', 4) + '<p><b>ลุงพันธ์</b>' +
      esc(bankrupt ? 'เงินเหลือไม่พอซื้อเมล็ดพันธุ์ฤดูต่อไป ลองวางแผนปุ๋ยและยาให้คุ้มค่ากว่านี้ แล้วกลับมาใหม่นะ' : END_MSG[stars]) + '</p></div>' +
      '<div class="end-share"><button class="btn btn-primary" data-action="share-card">แชร์รูปผลคะแนน<small>ส่งให้เพื่อนใน LINE หรือโพสต์ Facebook</small></button>' +
      '<button class="btn btn-line" data-action="share-line">ชวนเพื่อนเล่นทาง LINE</button></div>' + buyListHtml() + contactHtml();
    if (state.history.length) html += '<section class="card chart-card"><h2>เงินในมือหลังเก็บเกี่ยว</h2>' + moneyChart() + '</section>';
    html += '<section class="card stats-card"><h2>สถิติรอบนี้</h2><dl class="stats">' +
      Object.keys(MF.CROPS).filter(function (k) { return st.kg[k] > 0; }).map(function (k) {
        return '<div><dt>' + S.img(k + '2', 2) + ' ' + esc(MF.CROPS[k].name) + '</dt><dd class="num">' + fmt(st.kg[k]) + ' กก.</dd></div>';
      }).join('') +
      '<div><dt>เลือกยาถูกต้อง</dt><dd class="num">' + st.correct + ' / ' + st.treated + ' ครั้ง</dd></div>' +
      '<div><dt>รายได้รวม</dt><dd class="num">' + fmt(st.revenue) + '</dd></div>' +
      '<div><dt>ต้นทุนรวม</dt><dd class="num">' + fmt(st.cost) + '</dd></div>' +
      '</dl></section>';
    html += '<section class="card best-card"><h2>สถิติสูงสุดในเครื่องนี้</h2><ol class="best-list">' + best.map(function (b) {
      var mine = b === entry;
      return '<li class="' + (mine ? 'mine' : '') + '"><span class="num big">' + fmt(b.money) + '</span>' + starRow(E.stars(b.money), 3, 2) + '<small>' + esc(b.date) + (mine ? ' · รอบนี้' : '') + '</small></li>';
    }).join('') + '</ol></section>';
    html += '<div class="end-actions"><button class="btn btn-primary" data-action="new-game">เล่นอีกครั้ง</button><button class="btn" data-action="go-title">หน้าหลัก</button></div>' +
      '<div class="end-credit"><span>The Magic Farmcare นำเสนอโดย</span><img src="' + $('brand-img').src + '" width="76" height="80" alt="ธนาพันธ์ ฟาร์มแคร์"></div></div>';
    $('screen-end').innerHTML = html;
    var fx = $('screen-end').querySelector('.end-fx');
    if (fx) fireworks(fx);
    prepareShare(entry, stars, bankrupt);
  }

  /* ---------- sharing ---------- */

  // the card is drawn as soon as the end screen opens, so the share sheet can open straight from the tap
  var shareInfo = null;
  function prepareShare(entry, stars, bankrupt) {
    var url = MF.CONFIG.shareUrl;
    shareInfo = {
      blob: null,
      text: bankrupt
        ? 'ปลูกพืชใน The Magic Farmcare ปีนี้เงินทุนหมดก่อนครบปี ใครเก่งกว่ามาลองดู ' + url
        : 'ได้ยศ ' + RANKS[stars] + ' ' + stars + ' ดาว เงิน ' + fmt(entry.money) + ' บาท ในเกม The Magic Farmcare ของธนาพันธ์ ฟาร์มแคร์ มาแข่งกันที่ ' + url,
    };
    var info = shareInfo;
    if (!MF.share) return;
    // the crop this player harvested most goes on the card
    var st = state.stats;
    var crops = Object.keys(MF.CROPS).filter(function (k) { return st.kg[k] > 0; }).sort(function (a, b) { return st.kg[b] - st.kg[a]; });
    var top = crops[0] || 'rice';
    MF.share.resultCard({
      tier: bankrupt ? 'bankrupt' : stars, rank: bankrupt ? 'ล้มละลาย' : RANKS[stars], stars: stars, money: entry.money,
      profit: entry.money - MF.CONFIG.startMoney,
      totalKg: crops.reduce(function (sum, k) { return sum + st.kg[k]; }, 0),
      correct: st.correct, treated: st.treated,
      icon: bankrupt ? { name: 'wilt' } : stars === 3 ? badgeSprite(3) : stars === 0 ? badgeSprite(0) : { name: top + '2' },
      cropIcon: { name: top + '2' },
    }).then(MF.share.toBlob).then(function (b) { info.blob = b; }).catch(function () {});
  }

  function shareCard() {
    var info = shareInfo;
    if (!info || !info.blob) { toast('กำลังเตรียมรูป ลองกดอีกครั้ง'); return; }
    track('share', { via: 'card' });
    var file = null;
    try { file = new File([info.blob], 'the-magic-farmcare.png', { type: 'image/png' }); } catch (e) { /* old browsers */ }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], text: info.text, title: 'The Magic Farmcare' }).catch(function (e) {
        if (e && e.name !== 'AbortError') saveCard(info);
      });
    } else {
      saveCard(info);
    }
  }

  // no share sheet (desktop, some browsers): download the picture and copy the message with the link
  function saveCard(info) {
    if (root.claude) {
      // the claude.ai preview cannot save files; the public site can
      copyText(info.text, 'ลิงก์ทดสอบนี้บันทึกรูปไม่ได้ แชร์รูปได้จากเว็บ ' + MF.CONFIG.shareUrl.replace(/^https?:\/\//, ''));
      return;
    }
    try {
      var a = doc.createElement('a');
      a.href = URL.createObjectURL(info.blob);
      a.download = 'the-magic-farmcare.png';
      doc.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    } catch (e) { /* downloads blocked */ }
    copyText(info.text, 'บันทึกรูปแล้ว นำไปโพสต์ได้เลย', 'บันทึกรูปและคัดลอกข้อความพร้อมลิงก์แล้ว นำไปโพสต์ได้เลย');
  }

  function copyText(text, plain, copied) {
    var fail = function () { toast(plain); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(copied || plain); }, fail);
      else fail();
    } catch (e) { fail(); }
  }

  function shareLine() {
    var text = shareInfo ? shareInfo.text : 'มาเล่น The Magic Farmcare กัน ' + MF.CONFIG.shareUrl;
    track('share', { via: 'line' });
    root.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  /* "ซื้ออะไรดี": what this player's year went short of, as generic names (formulas, active ingredients),
     worst first, with a button that opens a chat to the shop's LINE with the list already typed in */
  function buyListHtml() {
    var c = MF.CONFIG.contact || {};
    var list = E.buyList(state, 5);
    if (!list.length && !c.line) return '';
    var href = list.length && c.lineId ? 'https://line.me/R/oaMessage/' + c.lineId + '/?' + encodeURIComponent(buyMessage(list)) : c.line;
    var body = list.length
      ? '<p>จากแปลงของคุณปีนี้ ลุงพันธ์แนะนำให้เตรียมไว้ฤดูหน้า</p><ol class="buy-list">' + list.map(function (b) {
        return '<li><p><b>' + esc(b.label) + '</b><span>' + esc(b.fix) + '</span></p></li>';
      }).join('') + '</ol><p class="buy-note">เป็นชื่อสูตรปุ๋ยและชื่อสารสำคัญ ถามร้านเรื่องสินค้าและอัตราใช้ได้</p>'
      : '<p class="buy-good">' + (state.over === 'bankrupt' ? '' : 'ปีนี้เลือกปุ๋ยและยาได้ถูกต้องแทบไม่พลาดเลย เก่งมาก ') +
        'แวะมาคุยกับทีมร้านได้ที่ อ.ธาตุพนม หรือทักทาง LINE ก่อนเริ่มฤดูปลูกจริง</p>';
    return '<section class="card buy-card"><h2>ซื้ออะไรดี</h2>' + body +
      (href ? '<a class="btn btn-line" href="' + esc(href) + '" target="_blank" rel="noopener" data-action="buy-list-line" data-n="' + list.length + '">' +
        (list.length ? 'ส่งให้ลุงพันธ์ช่วยดูหน่อย' : 'ทักแชทลุงพันธ์') + '</a>' : '') + '</section>';
  }

  // the chat message: short, one line per item
  function buyMessage(list) {
    return 'สอบถามสินค้าตามรายการนี้ (จากเกม The Magic Farmcare)\n' + list.map(function (b, i) { return (i + 1) + '. ' + b.line; }).join('\n');
  }

  function contactHtml() {
    var c = MF.CONFIG.contact || {}, links = [];
    if (c.line) links.push('<a class="btn btn-line" href="' + esc(c.line) + '" target="_blank" rel="noopener" data-action="contact" data-via="line">แชทกับเราทาง LINE' + (c.lineId ? ' ' + esc(c.lineId) : '') + '</a>');
    if (c.phone) links.push('<a class="btn" href="tel:' + esc(c.phone.replace(/[^0-9+]/g, '')) + '" data-action="contact" data-via="phone">โทร ' + esc(c.phone) + '</a>');
    if (c.map) links.push('<a class="btn" href="' + esc(c.map) + '" target="_blank" rel="noopener" data-action="contact" data-via="map">แผนที่ร้าน (Google Maps)</a>');
    if (!links.length) return '';
    return '<section class="card contact-card"><h2>ปรึกษาเรื่องปุ๋ย ยา และเมล็ดพันธุ์</h2>' +
      '<p>ทีมธนาพันธ์ ฟาร์มแคร์ อ.ธาตุพนม จ.นครพนม ยินดีให้คำแนะนำ</p><div class="contact-links">' + links.join('') + '</div></section>';
  }

  // custom events for Vercel Web Analytics (ignored where analytics is not loaded)
  function track(name, data) {
    try { if (root.va) root.va('event', { name: name, data: data }); } catch (e) { /* analytics is optional */ }
  }

  // trophy for 3 stars, silver and bronze medals for 2 and 1, a sprout for a first try
  var MEDALS = { 2: { x: '#a9b4bd', y: '#eef3f6', k: '#5d6870' }, 1: { x: '#b06a35', y: '#e6a36d', k: '#6a3a18' } };
  function badgeSprite(stars) {
    if (stars === 3) return { name: 'trophy', over: { k: '#8a6414' } };
    if (MEDALS[stars]) return { name: 'medal', over: MEDALS[stars] };
    return { name: 'sproutPot', over: { k: '#55321c' } };
  }
  function badgeImg(stars) {
    var b = badgeSprite(stars);
    return S.img(b.name, 6, b.over);
  }

  /* pixel fireworks behind the title for a 3-star finish */
  function fireworks(canvas) {
    var ctx = canvas.getContext('2d'), FW = 96, FH = 72;
    canvas.width = FW; canvas.height = FH;
    var COLORS = ['#f2b632', '#ff8f70', '#ffffff', '#9ed8f5', '#8fe0a0', '#fbe3a0'];
    var parts = [], start = performance.now(), last = start, nextBurst = start + 300, bursts = 0;
    function burst() {
      var x = 12 + Math.random() * (FW - 24), y = 8 + Math.random() * 28, c = COLORS[bursts % COLORS.length];
      for (var i = 0; i < 32; i++) {
        var a = (i / 32) * Math.PI * 2, v = 0.012 + Math.random() * 0.008; // pixels per ms
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: i % 5 ? c : '#ffffff' });
      }
      bursts++;
      if (bursts <= 4) sfx('pop');
    }
    function step(now) {
      if (!canvas.isConnected) return;
      var dt = Math.min(50, now - last);
      last = now;
      if (now - start < 5500 && now >= nextBurst) { burst(); nextBurst = now + 500 + Math.random() * 400; }
      ctx.clearRect(0, 0, FW, FH);
      parts = parts.filter(function (p) { return p.life > 0; });
      parts.forEach(function (p) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.00002 * dt; p.life -= dt / 1500;
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, p.life) * 0.4; // short trail
        ctx.fillRect(Math.round(p.x - p.vx * 60), Math.round(p.y - p.vy * 60), 1, 1);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      });
      ctx.globalAlpha = 1;
      if (now - start < 5500 || parts.length) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- input ---------- */

  function onAction(el) {
    var a = el.getAttribute('data-action');
    var i = Number(el.getAttribute('data-i'));
    switch (a) {
      case 'open-plot': openPlot(i); break;
      case 'close-sheet': sfx('tap'); closeSheet(); break;
      case 'pick-use':
        draft.use = el.getAttribute('data-use');
        if (!MF.CROPS[draft.use]) draft.basal = null;
        draft.prevent = draft.prevent.filter(function (id) { return E.preventionsFor(draft.use).indexOf(id) >= 0; });
        if (!E.canAmend(draft.use)) draft.amend = [];
        sfx('select');
        refreshSheet(plotSheetHtml());
        break;
      case 'pick-basal':
        draft.basal = el.getAttribute('data-f') || null;
        sfx('select');
        refreshSheet(plotSheetHtml());
        break;
      case 'toggle-prevent':
        var pv = el.getAttribute('data-p'), at = draft.prevent.indexOf(pv);
        if (at >= 0) draft.prevent.splice(at, 1); else draft.prevent.push(pv);
        sfx('select');
        refreshSheet(plotSheetHtml());
        break;
      case 'toggle-amend':
        var am = el.getAttribute('data-a'), ai = draft.amend.indexOf(am);
        if (ai >= 0) draft.amend.splice(ai, 1); else draft.amend.push(am);
        sfx('select');
        refreshSheet(plotSheetHtml());
        break;
      case 'confirm-plot':
        E.setPlan(state, draft.i, draft.use, draft.basal, draft.prevent, draft.amend);
        sfx(draft.use === 'idle' ? 'tap' : 'coin');
        saveGame();
        closeSheet();
        rerenderPanel();
        break;
      case 'toggle-response':
        E.setResponse(state, !state.weather.respond);
        sfx(state.weather.respond ? 'coin' : 'tap');
        saveGame();
        rerenderPanel();
        break;
      case 'treat':
        var pid = el.getAttribute('data-p');
        E.setTreatment(state, i, pid);
        sfx(pid === 'none' ? 'tap' : 'spray');
        saveGame();
        rerenderPanel();
        break;
      case 'top':
        E.setTop(state, i, el.getAttribute('data-f') || null);
        sfx('select');
        saveGame();
        rerenderPanel();
        break;
      case 'toggle-music':
        settings.music = !settings.music;
        A.setMusic(settings.music);
        if (settings.music) A.unlock();
        saveSettings();
        refreshSheet(menuHtml());
        renderSoundButton();
        break;
      case 'toggle-sfx':
        settings.sfx = !settings.sfx;
        A.setSfx(settings.sfx);
        saveSettings();
        sfx('tap');
        refreshSheet(menuHtml());
        renderSoundButton();
        break;
      case 'howto': sfx('tap'); openSheet('howto', howtoHtml()); break;
      case 'replay-tutorial':
        settings.seen = {}; settings.tutorialOff = false; saveSettings();
        closeSheet();
        if (state && state.stage === 'plan') { coach('welcome'); } else if (state) coach(state.stage);
        break;
      case 'confirm-restart': sfx('tap'); openSheet('confirm', confirmHtml('เกมที่เล่นอยู่จะหายไป แล้วเริ่มฤดูฝนใหม่ด้วยทุน ' + fmt(MF.CONFIG.startMoney) + ' บาท', 'new-game')); break;
      case 'new-game': sfx('select'); startNewGame(); break;
      case 'share-card': sfx('tap'); shareCard(); break;
      case 'share-line': sfx('tap'); shareLine(); break;
      // links: the browser follows the href, this only counts the tap
      case 'buy-list-line': track('buy_list_line', { items: Number(el.getAttribute('data-n')) }); break;
      case 'contact': track('contact', { via: el.getAttribute('data-via') }); break;
      case 'go-title': sfx('tap'); closeSheet(); $('coach').hidden = true; coachKey = null; coachQueue = []; renderTitle(); break;
    }
  }

  function bind() {
    doc.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-action]');
      if (el && !el.disabled) onAction(el);
    });
    // the first tap anywhere is allowed to start sound
    doc.addEventListener('pointerdown', function () { A.unlock(); }, { once: true });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
    });

    $('btn-new').addEventListener('click', function () {
      A.unlock();
      if (store.get(KEYS.save, null)) openSheet('confirm', confirmHtml('มีเกมที่เล่นค้างไว้ ถ้าเริ่มใหม่ เกมเดิมจะหายไป', 'new-game'));
      else { sfx('select'); startNewGame(); }
    });
    $('btn-continue').addEventListener('click', function () { A.unlock(); sfx('select'); continueGame(); });
    $('btn-howto').addEventListener('click', function () { sfx('tap'); openSheet('howto', howtoHtml()); });
    $('btn-primary').addEventListener('click', function () { if (!this.disabled) primaryAction(); });
    $('btn-menu').addEventListener('click', function () { sfx('tap'); openSheet('menu', menuHtml()); });
    $('btn-sound').addEventListener('click', function () {
      var on = !(settings.music || settings.sfx);
      settings.music = on; settings.sfx = on;
      A.setMusic(on); A.setSfx(on);
      if (on) { A.unlock(); sfx('tap'); }
      saveSettings();
      renderSoundButton();
    });
    $('sheet-backdrop').addEventListener('click', closeSheet);
    $('coach-next').addEventListener('click', coachNext);
    $('coach-skip').addEventListener('click', coachSkip);
  }

  /* ---------- boot ---------- */

  /* a small nod to home: tapping Phra That Phanom in the background rings a temple bell */
  var THAT_WORDS = [
    'พระธาตุพนม ปูชนียสถานคู่บ้านคู่เมืองนครพนม',
    'สาธุ ขอให้ฝนตกต้องตามฤดูกาล พืชผลงอกงาม',
    'ธนาพันธ์ ฟาร์มแคร์ ตั้งอยู่ที่ อ.ธาตุพนม จ.นครพนม',
  ];
  var thatCount = 0;
  function thatPhanom() {
    sfx('bell');
    toast(THAT_WORDS[thatCount++ % THAT_WORDS.length]);
  }

  function boot(data) {
    A.setMusic(settings.music);
    A.setSfx(settings.sfx);
    $('hud-coin').innerHTML = S.img('coin', 3);
    $('btn-menu').innerHTML = S.img('menu', 3);
    $('coach-face').innerHTML = S.img('lung', 4);
    scene = MF.createScene($('scene'));
    scene.onTap(function (i) { if (state && state.stage === 'plan') openPlot(i); });
    titleScene = MF.createCover($('title-canvas')); // the title has its own picture, not the farm
    scene.onThatPhanom(thatPhanom);
    bind();

    // a live republish carries the open game over; an older version's game is dropped
    if (data && data.screen === 'game' && E.isCurrentSave(data.state)) {
      state = data.state;
      enterGame();
    } else {
      renderTitle();
    }
  }

  MF.ui = {
    boot: boot,
    // what a live republish should carry over to the new page
    snapshot: function () { return { state: state, screen: screen === 'end' ? 'title' : screen }; },
  };
})(window);
