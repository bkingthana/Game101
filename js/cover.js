/* The Magic Farmcare - the title cover, a 160 x 120 pixel picture scaled up with CSS like the farm scene.
   A 90s-style title picture in the Thanapun Farmcare colours: one isometric farm plot floating in the sky,
   with rows of green vegetables and golden rice, a thatched field hut and a clay water jar. Nothing in it
   carries a brand, badge or label.
   Still parts are painted once; each frame redraws only the small moving bits: the plot bobbing, clouds
   drifting and a gust of wind through the crops. createCover(canvas) has start() and stop() like
   createScene, and draws one still frame when the viewer prefers reduced motion. */
(function (root) {
  var MF = (root.MF = root.MF || {});
  var W = 160, H = 120;
  var FRAME_MS = 70; // same pace as the farm scene

  var reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // CI colours, each with a lighter and a darker step (brown has one more for the shady side of the soil)
  var C = {
    sky: ['#c9e9f6', '#9ad4ec', '#6dbfe2'],
    green: ['#c2e070', '#9bc53d', '#5e8a1f'],
    gold: ['#f0d987', '#d9b44a', '#a8862f'],
    brown: ['#c9a070', '#aa7f4c', '#7a5631', '#5c4026'],
    ink: '#4d4d4d', dark: '#2f2f2f', cream: '#f4ecd2', white: '#ffffff',
  };

  /* ---------- pixel toolkit ---------- */
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function canvas(w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

  // flat colour bands, each seam blended over three rows with an ordered dither (25%, 50%, 75%)
  function bands(ctx, list, y0, y1) {
    for (var y = y0; y < y1; y++) {
      var b = 0;
      while (b + 1 < list.length && y >= list[b + 1][0]) b++;
      for (var x = 0; x < W; x++) {
        var i = b, next = list[b + 1] && list[b + 1][0];
        if (next !== undefined && next - y <= 3 && bayer(x, y) < (4 - (next - y)) / 4) i = b + 1;
        rect(ctx, x, y, 1, 1, list[i][1]);
      }
    }
  }

  /* A shape raster: shapes are filled into a sparse grid, then outlined with a chunky dark ring and painted.
     A colour argument may be a function (x, y, nx, ny) of the pixel and its position inside the shape. */
  function Grid() { this.px = {}; }
  Grid.prototype.set = function (x, y, c) { this.px[x + ',' + y] = c; };
  Grid.prototype.has = function (x, y) { return this.px[x + ',' + y] !== undefined; };
  Grid.prototype.fill = function (x0, y0, x1, y1, test, c) {
    for (var y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (var x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        var n = test(x + 0.5, y + 0.5);
        if (n) this.set(x, y, typeof c === 'function' ? c(x, y, n[0], n[1]) : c);
      }
    }
    return this;
  };
  Grid.prototype.rect = function (x, y, w, h, c) {
    return this.fill(x, y, x + w - 1, y + h - 1, function (px, py) { return [((px - x) / w) * 2 - 1, ((py - y) / h) * 2 - 1]; }, c);
  };
  Grid.prototype.ellipse = function (cx, cy, rx, ry, c) {
    return this.fill(cx - rx, cy - ry, cx + rx, cy + ry, function (px, py) {
      var nx = (px - cx) / rx, ny = (py - cy) / ry;
      return nx * nx + ny * ny <= 1 ? [nx, ny] : null;
    }, c);
  };
  Grid.prototype.poly = function (pts, c) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    return this.fill(x0, y0, x1, y1, function (px, py) {
      var inside = false;
      for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if ((pts[i][1] > py) !== (pts[j][1] > py) && px < ((pts[j][0] - pts[i][0]) * (py - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0]) inside = !inside;
      }
      return inside ? [(px - x0) / Math.max(1, x1 - x0) * 2 - 1, (py - y0) / Math.max(1, y1 - y0) * 2 - 1] : null;
    }, c);
  };
  Grid.prototype.line = function (x0, y0, x1, y1, c) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (var i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
    return this;
  };
  Grid.prototype.outline = function (c) {
    var self = this, add = [];
    Object.keys(this.px).forEach(function (k) {
      var p = k.split(','), x = +p[0], y = +p[1];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { if (!self.has(x + o[0], y + o[1])) add.push([x + o[0], y + o[1]]); });
    });
    add.forEach(function (p) { self.set(p[0], p[1], c); });
    return this;
  };
  Grid.prototype.paint = function (ctx, dx, dy) {
    var px = this.px;
    Object.keys(px).forEach(function (k) {
      var p = k.split(',');
      rect(ctx, +p[0] + (dx || 0), +p[1] + (dy || 0), 1, 1, px[k]);
    });
  };

  // light from the upper left: pick the light, base or dark step of a colour from the position in a shape
  function lit(col, nx, ny, edge) {
    var v = -(nx * 0.75 + ny * 0.65);
    return v > (edge || 0.45) ? col[0] : v < -0.5 ? col[2] : col[1];
  }

  // a tiny picture from text rows, one character per pixel
  function sprite(rows, pal) {
    var cv = canvas(rows[0].length, rows.length), ctx = cv.getContext('2d');
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (row[x] !== '.') rect(ctx, x, y, 1, 1, pal[row[x]]);
    });
    return cv;
  }

  // a 90s cloud: round white puffs on a flat bottom with a soft blue underside
  function cloud(w) {
    var h = Math.round(w * 0.42), cv = canvas(w, h), ctx = cv.getContext('2d'), g = new Grid();
    var puffs = [[0.2, 0.68, 0.2], [0.42, 0.42, 0.27], [0.68, 0.55, 0.22], [0.85, 0.75, 0.15]];
    puffs.forEach(function (p) { g.ellipse(p[0] * w, p[1] * h, p[2] * w, p[2] * w * 0.95, C.white); });
    Object.keys(g.px).forEach(function (k) { var y = +k.split(',')[1]; if (y >= h - 1) delete g.px[k]; else if (y >= h - 3) g.px[k] = C.sky[0]; });
    g.paint(ctx);
    return cv;
  }

  // a cloud sliding slowly to the right and coming round again; x0 is where it starts (and stays when still)
  function drift(ctx, img, x0, y, speed, t) {
    var span = W + img.width, x = ((x0 + img.width + (reduceMotion ? 0 : t) * speed) % span) - img.width;
    ctx.drawImage(img, Math.round(x), y);
  }

  /* ---------- the floating plot ---------- */
  // an isometric diamond: p runs from the left corner to the top corner, q from the left corner to the bottom
  var ISO = { x: 18, y: 63, a: 62, b: 31, depth: 17 };
  function iso(p, q) { return [ISO.x + ISO.a * (p + q), ISO.y - ISO.b * p + ISO.b * q]; }
  function unIso(x, y) {
    var s = (x - ISO.x) / ISO.a, d = (y - ISO.y) / ISO.b;
    return [(s - d) / 2, (s + d) / 2];
  }
  // where things grow: green vegetable rows on the upper-left half, golden rice on the lower-right half,
  // a grass bund between them and round the edge, and a grass yard at the back corner for the hut
  function plotZone(p, q) {
    if (p < 0.05 || p > 0.95 || q < 0.05 || q > 0.95) return 'grass';
    if (p > 0.6 && q < 0.5) return 'yard';
    if (q < 0.47) return 'veg';
    if (q < 0.55) return 'bund';
    return 'rice';
  }
  var VEG_ROWS = [0.15, 0.27, 0.39], RICE_ROWS = [0.64, 0.76, 0.88];

  function paintPlot(ctx) {
    var g = new Grid(), d = ISO.depth, bottom = {};
    // the top: grass, and furrowed soil under the crop rows
    for (var y = ISO.y - ISO.b; y <= ISO.y + ISO.b; y++) {
      for (var x = ISO.x; x <= ISO.x + 2 * ISO.a; x++) {
        var pq = unIso(x + 0.5, y + 0.5), p = pq[0], q = pq[1];
        if (p < 0 || p > 1 || q < 0 || q > 1) continue;
        var zone = plotZone(p, q), h = hash(x * 131 + y * 977), c;
        if (zone === 'veg' || zone === 'rice') {
          var rows = zone === 'veg' ? VEG_ROWS : RICE_ROWS, near = 1;
          rows.forEach(function (r) { near = Math.min(near, Math.abs(q - r)); });
          c = near < 0.03 ? C.brown[2] : near > 0.045 ? C.brown[1] : C.brown[0];
        } else if (zone === 'yard' && p > 0.63 && p < 0.96 && q > 0.32 && q < 0.38) {
          c = C.green[2]; // the hut's shadow, away from the light
        } else {
          c = h < 0.1 ? C.green[0] : h > 0.94 ? C.green[2] : C.green[1];
        }
        g.set(x, y, c);
        bottom[x] = Math.max(bottom[x] === undefined ? -1 : bottom[x], y);
      }
    }
    // the front edge of the grass catches the light, and the soil shows below it in wavy layers with stones
    Object.keys(bottom).forEach(function (key) {
      var x = +key, top = bottom[x], left = x < ISO.x + ISO.a;
      g.set(x, top, C.green[0]);
      var steps = left ? [C.green[1], C.brown[0], C.brown[1], C.brown[2]] : [C.green[2], C.brown[1], C.brown[2], C.brown[3]];
      var wave = Math.round(Math.sin(x / 3.7) * 0.8 + Math.sin(x / 8.3));
      var corner = Math.abs(x - ISO.x - ISO.a) < 4; // keep the bottom corner a clean point
      var hang = !corner && hash(x * 13) < 0.35 ? 1 + Math.floor(hash(x * 7) * 3) : 0; // ragged roots and clods under the plot
      for (var k = 1; k <= d + hang; k++) {
        var c = k <= 2 ? steps[0] : k <= 6 + wave ? steps[1] : k <= 11 + wave ? steps[2] : steps[3];
        if (k > 3 && k < d && hash(x * 31 + k * 17) < 0.06) c = left ? C.brown[0] : C.brown[1]; // pebbles
        if (k > d) c = C.brown[3];
        g.set(x, top + k, c);
      }
    });
    g.outline(C.ink).paint(ctx);
  }

  // a small field hut on stilts with a thatched gable roof, in the same isometric view: the gable end with
  // its door faces left into the light, the long wall is in the shade on the right
  function paintHut() {
    var g = new Grid(), ox = 12, oy = 33; // the front corner of the footprint inside the hut's own canvas
    function at(u, v, h) { return [ox - 9 * u + 16 * v, oy - 4.5 * u - 8 * v - h]; }
    var stilt = 3, wall = 11, ridge = 19;
    [[0, 0], [1, 0], [0, 1]].forEach(function (s) { var b = at(s[0], s[1], 0); g.rect(Math.round(b[0]), Math.round(b[1]) - stilt, 1, stilt + 1, C.brown[3]); });
    // the long wall (shade) and the gable end (light) with its door
    g.poly([at(0, 0, stilt), at(0, 1, stilt), at(0, 1, wall), at(0, 0, wall)], function (x) { return x % 3 === 0 ? C.brown[2] : C.brown[1]; });
    g.poly([at(0, 0, stilt), at(1, 0, stilt), at(1, 0, wall), at(0.5, 0, ridge - 1), at(0, 0, wall)], function (x) { return x % 3 === 1 ? C.brown[1] : C.brown[0]; });
    g.poly([at(0.3, 0, stilt), at(0.7, 0, stilt), at(0.7, 0, wall - 1), at(0.3, 0, wall - 1)], C.dark);
    // thatch: the far slope, then the near slope over the long wall, a dark ridge between them
    function thatch(cols) { return function (x, y) { return (y + Math.floor(x / 2)) % 3 === 0 ? cols[1] : cols[0]; }; }
    g.poly([at(0.5, -0.12, ridge), at(0.5, 1.12, ridge), at(1.18, 1.12, wall - 1), at(1.18, -0.12, wall - 1)], thatch([C.gold[0], C.gold[1]]));
    g.poly([at(-0.18, -0.12, wall - 1), at(-0.18, 1.12, wall - 1), at(0.5, 1.12, ridge), at(0.5, -0.12, ridge)], thatch([C.gold[1], C.gold[2]]));
    g.line(at(0.5, -0.12, ridge)[0], at(0.5, -0.12, ridge)[1], at(0.5, 1.12, ridge)[0], at(0.5, 1.12, ridge)[1], C.gold[2]);
    var cv = canvas(34, 38);
    g.outline(C.ink).paint(cv.getContext('2d'));
    return { img: cv, ox: ox, oy: oy };
  }

  // a big clay water jar with a dark glaze
  function paintJar() {
    var g = new Grid();
    g.ellipse(6, 8.5, 5.5, 6, function (x, y, nx, ny) { return lit([C.brown[1], C.brown[2], C.brown[3]], nx, ny, 0.35); });
    g.rect(3, 2, 6, 2, C.brown[2]);
    g.rect(4, 2, 4, 1, C.sky[2]); // water at the mouth
    g.set(3, 6, C.cream); g.set(3, 7, C.cream); g.set(4, 5, C.cream); // glint
    var cv = canvas(14, 17);
    g.outline(C.ink).paint(cv.getContext('2d'), 1, 1);
    return { img: cv, ox: 7, oy: 15 };
  }

  // crops, with a second frame leaning in the wind
  var VEG = ['..lll..', '.llglg.', 'lglgllg', 'gglgggG', 'GgggGGG', '.GGGGG.'];
  var RICE = ['..yy..', '.yyYy.', 'yyYyYy', 'yY.yY.', '.Y.Y..', '..YG..', '..GG..'];
  function lean(rows, n) { return rows.map(function (r, i) { return i < n ? '.' + r.slice(0, -1) : r; }); }
  var CROP_PAL = { l: C.green[0], g: C.green[1], G: C.green[2], y: C.gold[0], Y: C.gold[2] };

  function plotThings() {
    var list = [];
    VEG_ROWS.forEach(function (q) {
      for (var p = 0.1; p < 0.56; p += 0.1) list.push({ kind: 'veg', p: p, q: q });
    });
    RICE_ROWS.forEach(function (q) {
      for (var p = 0.09; p < 0.93; p += 0.07) list.push({ kind: 'rice', p: p, q: q });
    });
    list.push({ kind: 'hut', p: 0.64, q: 0.33, depth: [0.78, 0.25] }); // its footprint runs to p 0.93 and back to q 0.17
    list.push({ kind: 'jar', p: 0.8, q: 0.43 });
    list.forEach(function (o) {
      var s = iso(o.p, o.q);
      o.x = s[0]; o.y = s[1];
      o.sort = o.depth ? iso(o.depth[0], o.depth[1])[1] : o.y; // a big thing sorts by the middle of its footprint
    });
    return list.sort(function (a, b) { return a.sort - b.sort || a.x - b.x; }); // back to front, once
  }

  // draw the plot and everything on it back to front; a gust of wind runs across the crops
  function drawPlot(ctx, t, L, dy) {
    ctx.drawImage(L.plot, 0, dy);
    L.things.forEach(function (o) {
      var x = Math.round(o.x), y = Math.round(o.y) + dy;
      var gust = !reduceMotion && Math.sin(t / 700 - (o.p + o.q) * 5) > 0.55 ? 1 : 0;
      if (o.kind === 'veg') ctx.drawImage(L.veg[gust], x - 3, y - 4);
      else if (o.kind === 'rice') ctx.drawImage(L.rice[gust], x - 3, y - 6);
      else ctx.drawImage(L[o.kind].img, x - L[o.kind].ox, y - L[o.kind].oy);
    });
  }

  function build() {
    var L = {
      sky: canvas(W, H), plot: canvas(W, H), veg: [sprite(VEG, CROP_PAL), sprite(lean(VEG, 2), CROP_PAL)],
      rice: [sprite(RICE, CROP_PAL), sprite(lean(RICE, 4), CROP_PAL)], hut: paintHut(), jar: paintJar(),
      things: plotThings(), clouds: [cloud(30), cloud(22), cloud(36)],
    };
    bands(L.sky.getContext('2d'), [[0, C.sky[2]], [30, C.sky[1]], [78, C.sky[0]]], 0, H);
    paintPlot(L.plot.getContext('2d'));
    return L;
  }

  function bob(t, period) { return reduceMotion ? 0 : Math.round(Math.sin((t / period) * Math.PI * 2) * 1.5); }

  // the sky, two clouds behind the plot, the plot bobbing slowly, one cloud drifting past in front
  function draw(ctx, t, L) {
    ctx.drawImage(L.sky, 0, 0);
    drift(ctx, L.clouds[0], 8, 10, 0.004, t);
    drift(ctx, L.clouds[1], 122, 30, 0.0028, t);
    drawPlot(ctx, t, L, bob(t, 3600));
    drift(ctx, L.clouds[2], 54, 100, 0.006, t);
  }

  /* ---------- the controller ---------- */
  function createCover(cv) {
    cv.width = W;
    cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var layers = null, running = false, last = 0;

    function render(t) {
      if (!layers) layers = build();
      draw(ctx, t, layers);
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
