/* The Magic Farmcare - the title cover, a 160 x 120 pixel picture scaled up with CSS like the farm scene.
   A 90s-style title card in the Thanapun Farmcare colours: the logo's sprout rising from green, gold and
   brown hills in front of a big striped sun, under a sky of dithered colour bands.
   The sky, hills and sprout are painted once; each frame only redraws the sun, whose stripes scroll down
   slowly, three twinkling sparkles and a glint on a leaf. createCover(canvas) has start() and stop()
   like createScene; with reduced motion it draws one still frame. */
(function (root) {
  var MF = (root.MF = root.MF || {});
  var W = 160, H = 120;
  var FRAME_MS = 70; // same pace as the farm scene; the cover only changes every few frames

  var reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // company CI colours, with one lighter and one darker step of each
  var C = {
    ink: '#4d4d4d', white: '#ffffff',
    sky: ['#62b4dd', '#7cc4e6', '#9ad4ec', '#bfe4f3', '#e2f4fa'],
    sun: ['#fff4d0', '#f3dc8a', '#e6c463', '#d9b44a'],
    green: ['#c5e27a', '#9bc53d', '#5e8a1f'],
    gold: ['#efd889', '#d9b44a', '#b08d34'],
    brown: ['#c99c6a', '#aa7f4c', '#7d5a33'],
  };

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function layer() {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    return cv;
  }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

  /* ---------- layout ---------- */
  var SUN = { x: 80, y: 52, r: 34 };
  var SPROUT = { x: 80, fork: 48, base: 97 };

  // the three fields of the logo as round hills: green on the left, gold on the right, brown soil in front
  function greenTop(x) { return 71 + 0.0034 * (x - 28) * (x - 28); }
  function goldTop(x) { return 73 + 0.0034 * (x - 134) * (x - 134); }
  function brownTop(x) { return 94 + 0.0062 * (x - 80) * (x - 80); }

  /* ---------- sky: flat colour bands with ordered dither where they meet ---------- */
  var BANDS = [0, 14, 28, 42, 56]; // top row of each sky colour

  function paintSky(ctx) {
    for (var y = 0; y < H; y++) {
      var b = 0;
      while (b + 1 < BANDS.length && y >= BANDS[b + 1]) b++;
      for (var x = 0; x < W; x++) {
        var i = b, next = BANDS[b + 1];
        // three rows before each seam blend into the next colour: 25%, 50%, 75%
        if (next !== undefined && next - y <= 3 && bayer(x, y) < (4 - (next - y)) / 4) i = b + 1;
        rect(ctx, x, y, 1, 1, C.sky[i]);
      }
    }
  }

  /* ---------- sun: horizontal bands, with gaps across its lower half that scroll down ---------- */
  function drawSun(ctx, t) {
    var s = SUN, shift = reduceMotion ? 0 : Math.floor(t / 300) % 6;
    for (var dy = 1 - s.r; dy < s.r; dy++) {
      var y = s.y + dy;
      var hw = Math.round(Math.sqrt(s.r * s.r - dy * dy));
      var band = Math.min(3, Math.floor(((dy + s.r) / (2 * s.r)) * 4.4));
      if (dy > 2) {
        // the gaps grow toward the bottom, the classic 90s sun
        var k = (dy - 2 + 6 - shift) % 6, gap = 1 + Math.floor(((dy - 2) / (s.r - 2)) * 3.5);
        if (k < gap) continue;
      }
      rect(ctx, s.x - hw, y, hw * 2 + 1, 1, C.sun[band]);
    }
  }

  /* ---------- hills ---------- */
  function paintHills(ctx) {
    for (var x = 0; x < W; x++) {
      var g = Math.round(greenTop(x)), o = Math.round(goldTop(x)), b = Math.round(brownTop(x));
      for (var y = Math.min(g, o); y < H; y++) {
        var c;
        if (y >= b) c = field(C.brown, y - b, 5);
        else if (y >= o) c = field(C.gold, y - o, 4);
        else if (y >= g) c = field(C.green, y - g, 4);
        else continue;
        rect(ctx, x, y, 1, 1, c);
      }
    }
  }

  // a dark line where a hill meets the one behind it, a lit lip below that, then rows of crops (or furrows)
  // that follow the curve of the hill and widen toward the viewer
  function field(col, d, step) {
    if (d === 0) return C.ink;
    if (d <= 2) return col[0];
    var gap = step + Math.floor(d / 9);
    return (d - 3) % gap === gap - 1 ? col[2] : col[1];
  }

  /* ---------- the sprout ---------- */
  var LEAF = { hi: C.green[0], mid: C.green[1], dark: C.green[2], line: C.white, edge: C.ink };

  function paintSprout(ctx) {
    var grid = {};
    function put(x, y, k) { grid[x + ',' + y] = k; }
    // the stem
    for (var y = SPROUT.fork; y <= SPROUT.base; y++) {
      put(SPROUT.x - 3, y, 'hi'); put(SPROUT.x - 2, y, 'hi'); put(SPROUT.x - 1, y, 'mid'); put(SPROUT.x, y, 'mid'); put(SPROUT.x + 1, y, 'mid'); put(SPROUT.x + 2, y, 'dark');
    }
    // two leaves rising to the sides, curling up at the tips
    function leaf(angle, len, width, curl) {
      var a = (angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
      var nx = -dy, ny = dx;
      if (ny < 0) { nx = -nx; ny = -ny; }
      var bx = SPROUT.x, by = SPROUT.fork + 1;
      for (var y = by - len - width; y <= by + width; y++) {
        for (var x = bx - len - width; x <= bx + len + width; x++) {
          var rx = x + 0.5 - bx, ry = -(y + 0.5 - by);
          var u = rx * dx + ry * dy, v = rx * nx + ry * ny, s = u / len;
          if (s < 0 || s > 1) continue;
          var dv = v - curl * len * s * s;
          var w = width * Math.pow(Math.sin(Math.PI * Math.pow(s, 1.25)), 0.7);
          if (Math.abs(dv) > w) continue;
          put(x, y, dv > w * 0.25 ? 'hi' : dv > -w * 0.45 ? 'mid' : 'dark');
        }
      }
    }
    leaf(146, 29, 10, 0.3);
    leaf(34, 29, 10, 0.3);

    // a white outline like the logo's, then a chunky dark one outside it
    function ring(kind) {
      var add = [];
      Object.keys(grid).forEach(function (key) {
        var p = key.split(','), x = +p[0], y = +p[1];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var n = (x + o[0]) + ',' + (y + o[1]);
          if (!grid[n] && y + o[1] < SPROUT.base) add.push(n);
        });
      });
      add.forEach(function (n) { grid[n] = kind; });
    }
    ring('line');
    ring('edge');
    Object.keys(grid).forEach(function (key) {
      var p = key.split(',');
      rect(ctx, +p[0], +p[1], 1, 1, LEAF[grid[key]]);
    });
  }

  // the classic four-point twinkle
  function star(ctx, x, y, arm) {
    rect(ctx, x - arm, y, arm * 2 + 1, 1, C.white);
    rect(ctx, x, y - arm, 1, arm * 2 + 1, C.white);
  }

  // three magic sparkles around the sprout twinkle in turn
  var SPARKS = [[42, 30], [121, 20], [131, 42]];
  function drawSparks(ctx, t) {
    SPARKS.forEach(function (p, i) {
      var phase = reduceMotion ? 2 : (Math.floor(t / 280) + i * 5) % 15; // 0-3 big, 4-6 small, the rest off
      if (phase <= 6) star(ctx, p[0], p[1], phase < 4 ? 2 : 1);
    });
  }

  // and now and then a glint on the left leaf
  function drawGlint(ctx, t) {
    var p = t % 5000;
    if (!reduceMotion && p < 420) star(ctx, 64, 33, p > 120 && p < 300 ? 2 : 1);
  }

  /* ---------- the controller ---------- */
  function createCover(canvas) {
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var sky = null, front = null, running = false, last = 0;

    function render(t) {
      if (!sky) {
        sky = layer(); paintSky(sky.getContext('2d'));
        front = layer(); paintHills(front.getContext('2d')); paintSprout(front.getContext('2d'));
      }
      ctx.drawImage(sky, 0, 0);
      drawSun(ctx, t);
      ctx.drawImage(front, 0, 0);
      drawSparks(ctx, t);
      drawGlint(ctx, t);
    }

    function loop(now) {
      if (!running) return;
      if (now - last >= FRAME_MS) { last = now; render(now); }
      requestAnimationFrame(loop);
    }

    return {
      start: function () {
        if (running) return;
        running = true;
        render(performance.now());
        if (!reduceMotion) requestAnimationFrame(loop);
      },
      stop: function () { running = false; },
    };
  }

  MF.createCover = createCover;
})(typeof window !== 'undefined' ? window : globalThis);
