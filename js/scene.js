/* The Magic Farmcare - the farm scene. A 160 x 100 pixel canvas scaled up with CSS.
   createScene(canvas) returns a small controller; the UI pushes a "view" object into it. */
(function (root) {
  var MF = (root.MF = root.MF || {});
  var S = MF.sprites;
  var W = 160, H = 100;
  var FRAME_MS = 70;

  var PLOT_RECTS = [
    { x: 8, y: 44, w: 58, h: 24 },
    { x: 72, y: 44, w: 58, h: 24 },
    { x: 8, y: 72, w: 58, h: 24 },
    { x: 72, y: 72, w: 58, h: 24 },
  ];
  var SOIL = [
    { base: '#6e4426', furrow: '#55321c' }, // clay, lowland
    { base: '#b98a55', furrow: '#9a6f40' }, // sandy loam, upland
    { base: '#8a5a33', furrow: '#6e4426' }, // loam
    { base: '#cfae79', furrow: '#b38f5c' }, // sand by the pond
  ];
  var SKY = {
    rain: ['#8fb4cf', '#a9c7dc', '#c3d8e6'],
    cool: ['#7cc0ee', '#a3d4f4', '#cbe7f9'],
    hot: ['#f2b36a', '#f6cd8a', '#f9e2ae'],
    storm: ['#66757f', '#7f8d97', '#99a6ae'],
    fog: ['#b9c6cb', '#c9d3d6', '#d8e0e2'],
    drought: ['#ee9c50', '#f3b874', '#f7d39b'],
  };
  var PLANT_ORDER = [0, 8, 4, 11, 2, 6, 9, 1, 5, 10, 3, 7];
  var DIGITS = {
    1: ['010', '110', '010', '010', '111'],
    2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '111', '001', '111'],
    4: ['101', '101', '111', '001', '001'],
  };

  var reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  // cheap deterministic hash for texture dots
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }

  function drawSky(ctx, colors) {
    rect(ctx, 0, 0, W, 11, colors[0]);
    rect(ctx, 0, 11, W, 10, colors[1]);
    rect(ctx, 0, 21, W, 13, colors[2]);
  }

  function drawSun(ctx, x, y, big) {
    var r = big ? 6 : 4;
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.round(Math.sqrt(r * r - dy * dy));
      rect(ctx, x - hw, y + dy, hw * 2 + 1, 1, dy < -r / 2 ? '#fff1a8' : '#ffd84a');
    }
    if (big) {
      ctx.globalAlpha = 0.35;
      rect(ctx, x - r - 4, y, 2, 1, '#fff1a8'); rect(ctx, x + r + 3, y, 2, 1, '#fff1a8');
      rect(ctx, x, y - r - 4, 1, 2, '#fff1a8'); rect(ctx, x, y + r + 3, 1, 2, '#fff1a8');
      ctx.globalAlpha = 1;
    }
  }

  function drawCloud(ctx, x, y, dark) {
    var c = dark ? '#8a979f' : '#ffffff', s = dark ? '#6f7c84' : '#dfeaf0';
    rect(ctx, x + 3, y, 8, 2, c);
    rect(ctx, x + 1, y + 2, 14, 2, c);
    rect(ctx, x, y + 4, 18, 2, c);
    rect(ctx, x + 1, y + 6, 16, 1, s);
  }

  function drawHills(ctx) {
    for (var x = 0; x < W; x++) {
      var h1 = Math.round(26 + 4 * Math.sin(x / 13) + 2 * Math.sin(x / 5.3));
      rect(ctx, x, h1, 1, 36 - h1, '#5e8f6a');
      var h2 = Math.round(30 + 3 * Math.sin(x / 9 + 2) + 1.5 * Math.sin(x / 3.7));
      rect(ctx, x, h2, 1, 36 - h2, '#3f7a4f');
    }
  }

  function drawGround(ctx, season) {
    var base = season === 'hot' ? '#8fae4a' : season === 'cool' ? '#5aa846' : '#4f9e42';
    rect(ctx, 0, 34, W, H - 34, base);
    for (var i = 0; i < 260; i++) {
      var x = Math.floor(hash(i * 7 + 1) * W), y = 35 + Math.floor(hash(i * 13 + 5) * (H - 35));
      rect(ctx, x, y, 1, 1, hash(i) > 0.5 ? '#3f8a37' : '#74bd56');
    }
    // dirt path from the front steps to the fields
    rect(ctx, 14, 41, 56, 2, '#a8875a');
    rect(ctx, 66, 41, 4, 30, '#a8875a');
  }

  function drawHouse(ctx) {
    S.draw(ctx, 'house', 3, 13);
  }

  /* signboard of the Thanapun Farmcare shop next to the house */
  function drawSign(ctx) {
    var x = 38, y = 20;
    rect(ctx, x + 6, y + 14, 2, 7, '#55321c');
    rect(ctx, x - 1, y - 1, 16, 16, '#3b2a20');
    rect(ctx, x, y, 14, 14, '#f4ecd2');
    S.draw(ctx, 'brandSmall', x + 1, y + 1);
  }

  function drawPalm(ctx, t) {
    var sway = reduceMotion ? 0 : Math.round(Math.sin(t / 900));
    for (var i = 0; i < 26; i++) {
      var x = 146 + Math.round(Math.sin(i / 9) * 2) + (i > 18 ? sway : 0);
      rect(ctx, x, 40 - i, 2, 1, i % 3 ? '#8a5530' : '#6e4426');
    }
    var tx = 148 + sway, ty = 14;
    var fronds = [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1], [-1, -1], [1, -1]];
    fronds.forEach(function (f, n) {
      for (var j = 1; j < 10; j++) {
        var x = tx + f[0] * j, y = ty + f[1] * Math.round(j / 2) + (f[1] >= 0 ? Math.floor(j * j / 20) : 0);
        rect(ctx, x, y, 1, 1, n % 2 ? '#256b34' : '#3f9b45');
        if (j % 2) rect(ctx, x, y + 1, 1, 1, '#256b34');
      }
    });
    rect(ctx, tx - 1, ty, 3, 2, '#6e4426');
    rect(ctx, tx - 1, ty + 2, 1, 1, '#c48f22'); rect(ctx, tx + 1, ty + 2, 1, 1, '#c48f22');
  }

  function drawPond(ctx, t, low) {
    var x0 = 134, y0 = 72, w = 23, h = 24;
    for (var dy = 0; dy < h; dy++) {
      var inset = Math.round(4 * Math.pow(Math.abs(dy - h / 2) / (h / 2), 2));
      rect(ctx, x0 + inset, y0 + dy, w - inset * 2, 1, '#3a6b3a');
      rect(ctx, x0 + inset + 1, y0 + dy, w - inset * 2 - 2, 1, low && dy < 5 ? '#8a6a45' : '#2f73c0');
    }
    var ph = reduceMotion ? 0 : Math.floor(t / 400) % 3;
    rect(ctx, x0 + 5 + ph, y0 + 9, 4, 1, '#6cb8ec');
    rect(ctx, x0 + 11 - ph, y0 + 15, 5, 1, '#6cb8ec');
    rect(ctx, x0 + 6, y0 + 18, 3, 2, '#86cc5a');
    rect(ctx, x0 + 14, y0 + 6, 3, 2, '#86cc5a');
    rect(ctx, x0 + 15, y0 + 5, 1, 1, '#f39ac0');
  }

  function drawPlot(ctx, i, p, t, view) {
    var r = PLOT_RECTS[i], soil = SOIL[i];
    rect(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, '#3b2a20');
    rect(ctx, r.x, r.y, r.w, r.h, soil.base);
    for (var fy = r.y + 2; fy < r.y + r.h; fy += 4) rect(ctx, r.x + 1, fy, r.w - 2, 1, soil.furrow);

    if (p.dry) {
      for (var c = 0; c < 9; c++) {
        var cx = r.x + 3 + Math.floor(hash(i * 31 + c) * (r.w - 8)), cy = r.y + 2 + Math.floor(hash(i * 17 + c * 3) * (r.h - 5));
        rect(ctx, cx, cy, 3, 1, '#3b2a20'); rect(ctx, cx + 2, cy + 1, 1, 2, '#3b2a20');
      }
    }

    // plants
    if (p.use && p.use !== 'idle') {
      var phase = p.phase || 0;
      var name = p.use + phase;
      var count = Math.max(0, Math.round(12 * (p.density == null ? 1 : p.density)));
      for (var n = 0; n < count; n++) {
        var slot = PLANT_ORDER[n];
        var col = slot % 6, row = Math.floor(slot / 6);
        var sway = !reduceMotion && phase > 0 && Math.sin(t / 500 + slot * 1.7) > 0.7 ? 1 : 0;
        S.draw(ctx, name, r.x + 2 + col * 9 + sway, r.y + 2 + row * 11);
      }
    }

    // pests
    if (p.event) {
      var ev = p.event;
      if (ev.type === 'weed') {
        for (var k = 0; k < 6; k++) S.draw(ctx, 'miniWeed', r.x + 5 + k * 9, r.y + (k % 2 ? 16 : 6));
      } else if (ev.type === 'disease') {
        var spot = ev.sprite === 'leafPurple' ? '#8c3a78' : ev.sprite === 'leafDowny' ? '#f3ee9a' : '#7a3b1c';
        var blink = reduceMotion ? 1 : Math.floor(t / 300) % 2;
        for (var d = 0; d < 16; d++) {
          if ((d + blink) % 3 === 0) continue;
          rect(ctx, r.x + 3 + Math.floor(hash(i * 50 + d) * (r.w - 6)), r.y + 2 + Math.floor(hash(i * 70 + d) * (r.h - 4)), 1, 1, spot);
        }
      } else {
        var mini = ev.sprite === 'worm' ? 'miniWorm' : ev.sprite === 'thrips' ? 'miniThrips' : 'miniBug';
        for (var b = 0; b < 4; b++) {
          var tt = reduceMotion ? 0 : t / 1400;
          var bx = r.x + 6 + ((Math.sin(tt * (1 + b * 0.3) + b * 2) + 1) / 2) * (r.w - 14);
          var by = r.y + 4 + ((Math.cos(tt * (0.8 + b * 0.25) + b) + 1) / 2) * (r.h - 9);
          S.draw(ctx, mini, bx, by);
        }
      }
    }

    if (p.flooded) {
      ctx.globalAlpha = 0.55;
      rect(ctx, r.x, r.y + Math.floor(r.h * (1 - p.flooded)), r.w, Math.ceil(r.h * p.flooded), '#2f73c0');
      ctx.globalAlpha = 1;
      var off = reduceMotion ? 0 : Math.floor(t / 250) % 6;
      for (var wv = 0; wv < 5; wv++) rect(ctx, r.x + 3 + ((wv * 12 + off) % (r.w - 6)), r.y + r.h - 4 - (wv % 2) * 6, 4, 1, '#9fd2f5');
    }

    // number badge
    rect(ctx, r.x, r.y, 7, 8, '#0b150f');
    var dg = DIGITS[i + 1];
    for (var yy = 0; yy < 5; yy++) for (var xx = 0; xx < 3; xx++) if (dg[yy][xx] === '1') rect(ctx, r.x + 2 + xx, r.y + 2 + yy, 1, 1, '#f2b632');

    if (view.selected === i) {
      var on = reduceMotion || Math.floor(t / 350) % 2 === 0;
      ctx.strokeStyle = on ? '#f2b632' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3);
    }
  }

  function drawWeather(ctx, view, t) {
    var w = view.weather;
    if (!w) return;
    var tt = reduceMotion ? 0 : t;
    if (w === 'rainLight' || w === 'flood') {
      var heavy = w === 'flood';
      var n = heavy ? 70 : 26;
      ctx.fillStyle = heavy ? '#d7ebf8' : '#e8f3fa';
      for (var i = 0; i < n; i++) {
        var x = (hash(i * 3 + 1) * W + tt * (heavy ? 0.02 : 0.01)) % W;
        var y = (hash(i * 7 + 2) * H + tt * (heavy ? 0.12 : 0.07)) % H;
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, heavy ? 3 : 2);
      }
    } else if (w === 'drought') {
      ctx.globalAlpha = 0.25;
      for (var j = 0; j < 6; j++) {
        var hy = (40 + j * 10 - (tt / 60) % 10);
        for (var hx = 0; hx < W; hx += 8) rect(ctx, hx + (Math.floor(hy) % 2) * 4, Math.floor(hy), 4, 1, '#fff3c4');
      }
      ctx.globalAlpha = 1;
    } else if (w === 'humid') {
      ctx.globalAlpha = 0.45;
      for (var k = 0; k < 4; k++) {
        var fx = ((tt / (90 + k * 30)) + k * 47) % (W + 60) - 60;
        rect(ctx, Math.floor(fx), 36 + k * 15, 60, 4, '#f4f7f8');
        rect(ctx, Math.floor(fx) + 10, 40 + k * 15, 40, 2, '#f4f7f8');
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawSparkles(ctx, view, t) {
    var age = view.sparkleAt ? t - view.sparkleAt : Infinity;
    var ambient = view.ambientSparkles;
    if (age > 1600 && !ambient) return;
    var count = age <= 1600 ? 14 : 5;
    for (var i = 0; i < count; i++) {
      var phase = ((t / 600 + hash(i * 11) * 10) % 1);
      if (phase > 0.7) continue;
      var x = 10 + hash(i * 19 + Math.floor(t / 600 + hash(i * 11) * 10)) * (W - 20);
      var y = 40 + hash(i * 23 + Math.floor(t / 600 + hash(i * 11) * 10)) * (H - 46);
      ctx.globalAlpha = phase < 0.35 ? phase / 0.35 : (0.7 - phase) / 0.35;
      S.draw(ctx, 'sparkle', x, y, { w: i % 3 ? '#fff6c2' : '#ffffff' });
    }
    ctx.globalAlpha = 1;
  }

  function skyFor(view) {
    if (view.weather === 'flood') return SKY.storm;
    if (view.weather === 'humid') return SKY.fog;
    if (view.weather === 'drought') return SKY.drought;
    return SKY[view.season] || SKY.cool;
  }

  function createScene(canvas) {
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var view = { season: 'rain', plots: [{}, {}, {}, {}], selected: null };
    var running = false, last = 0, tapHandler = null;

    function render(t) {
      var sky = skyFor(view);
      drawSky(ctx, sky);
      var stormy = view.weather === 'flood' || view.weather === 'rainLight' || view.weather === 'humid';
      if (!stormy) drawSun(ctx, 112, 9, view.season === 'hot' || view.weather === 'drought');
      var drift = reduceMotion ? 0 : t / 260;
      drawCloud(ctx, ((drift + 20) % (W + 40)) - 30, 4, stormy);
      drawCloud(ctx, ((drift * 0.6 + 100) % (W + 40)) - 30, 12, stormy);
      if (view.weather === 'flood') drawCloud(ctx, ((drift * 0.8 + 60) % (W + 40)) - 30, 1, true);
      drawHills(ctx);
      drawGround(ctx, view.season);
      drawHouse(ctx);
      drawSign(ctx);
      drawPalm(ctx, t);
      drawPond(ctx, t, view.weather === 'drought');
      view.plots.forEach(function (p, i) { drawPlot(ctx, i, p || {}, t, view); });
      drawWeather(ctx, view, t);
      drawSparkles(ctx, view, t);
    }

    function loop(now) {
      if (!running) return;
      if (now - last >= FRAME_MS) { last = now; render(now); }
      requestAnimationFrame(loop);
    }

    canvas.addEventListener('click', function (e) {
      if (!tapHandler) return;
      var b = canvas.getBoundingClientRect();
      var x = ((e.clientX - b.left) / b.width) * W, y = ((e.clientY - b.top) / b.height) * H;
      for (var i = 0; i < PLOT_RECTS.length; i++) {
        var r = PLOT_RECTS[i];
        if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) { tapHandler(i); return; }
      }
    });

    return {
      setView: function (v) {
        view = v;
        if (!running || reduceMotion) render(performance.now());
      },
      sparkle: function () { view.sparkleAt = performance.now(); },
      start: function () {
        if (running) return;
        running = true;
        render(performance.now());
        if (!reduceMotion) requestAnimationFrame(loop);
      },
      stop: function () { running = false; },
      onTap: function (fn) { tapHandler = fn; },
    };
  }

  MF.createScene = createScene;
})(typeof window !== 'undefined' ? window : globalThis);
