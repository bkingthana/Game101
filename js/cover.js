/* The Magic Farmcare - the title cover, a 160 x 120 pixel picture scaled up with CSS like the farm scene.
   A 90s-style title picture in the Thanapun Farmcare colours. Three versions for the owner to choose from,
   picked with ?cover=A|B|C in the page address (B when there is none):
     A  Lung Phan from the waist up, smiling over a woven basket of harvest, in front of banded fields
     B  one isometric farm plot floating in the sky: vegetable and rice rows, a thatched hut, a water jar
     C  the plot from B with a small Lung Phan standing on it, holding the basket
   Lung Phan wears the hat, shirt and skin colours of his in-game sprites; everything else is in CI colours.
   Still parts are painted once; each frame redraws only the small moving bits. createCover(canvas) has
   start() and stop() like createScene, and draws one still frame when the viewer prefers reduced motion. */
(function (root) {
  var MF = (root.MF = root.MF || {});
  var P = MF.sprites.PAL; // Lung Phan's in-game colours
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
  var LUNG = { hat: [P.y, P.Y], shirt: [P.l, P.g, P.G], skin: [P.n, P.N], hair: P.h, eye: P.k, pants: P.C };

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

  function drift(ctx, img, x0, y, speed, t) {
    var span = W + img.width, x = ((x0 + (reduceMotion ? 0 : t) * speed) % span + span) % span - img.width;
    ctx.drawImage(img, Math.round(x), y);
  }

  /* ---------- the floating plot (B and C) ---------- */
  // an isometric diamond: p runs from the left corner to the top corner, q from the left corner to the bottom
  var ISO = { x: 24, y: 58, a: 56, b: 28, depth: 16 };
  function iso(p, q) { return [ISO.x + ISO.a * (p + q), ISO.y - ISO.b * p + ISO.b * q]; }
  function unIso(x, y) {
    var s = (x - ISO.x) / ISO.a, d = (y - ISO.y) / ISO.b;
    return [(s - d) / 2, (s + d) / 2];
  }
  // where things grow: green vegetable rows on the upper-left half, golden rice on the lower-right half,
  // a grass bund between them and round the edge, and a grass yard at the back corner for the hut
  function plotZone(p, q) {
    if (p < 0.05 || p > 0.95 || q < 0.05 || q > 0.95) return 'grass';
    if (p > 0.66 && q < 0.5) return 'yard';
    if (q < 0.47) return 'veg';
    if (q < 0.55) return 'bund';
    return 'rice';
  }
  var VEG_ROWS = [0.13, 0.215, 0.3, 0.385], RICE_ROWS = [0.61, 0.69, 0.77, 0.85];

  function paintPlot(ctx) {
    var g = new Grid(), d = ISO.depth;
    // the soil showing on the two sides, in layers with wavy edges and a few stones
    for (var x = ISO.x; x <= ISO.x + 2 * ISO.a; x++) {
      var left = x <= ISO.x + ISO.a;
      var top = left ? ISO.y + (x - ISO.x) * 0.5 : ISO.y + ISO.b - (x - ISO.x - ISO.a) * 0.5;
      top = Math.ceil(top);
      var steps = left ? [C.green[1], C.brown[0], C.brown[1], C.brown[2]] : [C.green[2], C.brown[1], C.brown[2], C.brown[3]];
      var wave = Math.round(Math.sin(x / 3.7) * 0.8 + Math.sin(x / 8.3));
      var hang = hash(x * 13) < 0.35 ? 1 + Math.floor(hash(x * 7) * 3) : 0; // ragged roots and clods under the plot
      for (var k = 1; k <= d + hang; k++) {
        var c = k <= 2 ? steps[0] : k <= 6 + wave ? steps[1] : k <= 11 + wave ? steps[2] : steps[3];
        if (k > 3 && k < d && hash(x * 31 + k * 17) < 0.06) c = left ? C.brown[0] : C.brown[1]; // pebbles
        if (k > d) c = C.brown[3];
        g.set(x, top + k, c);
      }
    }
    // the top: grass, furrowed soil under the crops
    for (var y = ISO.y - ISO.b; y <= ISO.y + ISO.b; y++) {
      for (var x2 = ISO.x; x2 <= ISO.x + 2 * ISO.a; x2++) {
        var pq = unIso(x2 + 0.5, y + 0.5), p = pq[0], q = pq[1];
        if (p < 0 || p > 1 || q < 0 || q > 1) continue;
        var zone = plotZone(p, q), h = hash(x2 * 131 + y * 977), c2;
        if (zone === 'veg' || zone === 'rice') {
          var rows = zone === 'veg' ? VEG_ROWS : RICE_ROWS, near = 1;
          rows.forEach(function (r) { near = Math.min(near, Math.abs(q - r)); });
          c2 = near < 0.025 ? C.brown[2] : zone === 'rice' ? C.gold[2] : C.brown[1];
        } else {
          c2 = h < 0.1 ? C.green[0] : h > 0.94 ? C.green[2] : C.green[1];
        }
        g.set(x2, y, c2);
      }
    }
    // a lit lip along the two front edges
    for (var x3 = ISO.x + 1; x3 < ISO.x + 2 * ISO.a; x3++) {
      var ty = x3 <= ISO.x + ISO.a ? ISO.y + (x3 - ISO.x) * 0.5 : ISO.y + ISO.b - (x3 - ISO.x - ISO.a) * 0.5;
      g.set(x3, Math.ceil(ty), C.green[0]);
    }
    g.outline(C.ink).paint(ctx);
  }

  // a small field hut on stilts with a thatched roof, drawn in the same isometric view
  function paintHut() {
    var g = new Grid(), ox = 12, oy = 26; // the footprint's front corner inside the hut's own canvas
    function at(u, v, h) { return [ox - 10 * u + 10 * v, oy - 5 * u - 5 * v - h]; }
    var stilt = 3, wall = 11, ridge = 19;
    // stilts
    [[0, 0], [1, 0], [0, 1]].forEach(function (s) { var b = at(s[0], s[1], 0); g.rect(b[0], b[1] - stilt, 1, stilt + 1, C.brown[3]); });
    // the long wall in the light and the gable wall in the shade, with a door
    g.poly([at(0, 0, stilt), at(1, 0, stilt), at(1, 0, wall), at(0, 0, wall)], function (x, y) { return (x + y) % 5 === 0 ? C.brown[1] : C.brown[0]; });
    g.poly([at(0, 0, stilt), at(0, 1, stilt), at(0, 1, wall), at(0, 0.5, ridge - 1), at(0, 0, wall)], C.brown[1]);
    g.poly([at(0, 0.36, stilt), at(0, 0.64, stilt), at(0, 0.64, wall - 2), at(0, 0.36, wall - 2)], C.dark);
    // the roof: the far slope's edge over the gable, then the near slope, thatch in rows along the ridge
    g.poly([at(-0.15, 0.5, ridge), at(-0.15, 1.18, wall - 1), at(-0.05, 1.18, wall - 2), at(-0.05, 0.5, ridge - 1)], C.gold[2]);
    g.poly([at(-0.15, -0.18, wall - 1), at(1.15, -0.18, wall - 1), at(1.15, 0.5, ridge), at(-0.15, 0.5, ridge)], function (x, y, nx, ny) {
      return ny < -0.75 ? C.gold[0] : (y + Math.round(x / 2)) % 3 === 0 ? C.gold[2] : C.gold[1];
    });
    var cv = canvas(28, 34);
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
  var VEG = ['..lll..', '.llgll.', 'llgglgl', 'ggglggG', '.gGgGG.', '..GGG..'];
  var RICE = ['.y..y.', 'yYyyYy', '.yYyy.', 'y.yYy.', '..yy..', '..Yg..', '..gG..'];
  function lean(rows, n) { return rows.map(function (r, i) { return i < n ? '.' + r.slice(0, -1) : r; }); }
  var CROP_PAL = { l: C.green[0], g: C.green[1], G: C.green[2], y: C.gold[0], Y: C.gold[1] };

  function plotThings() {
    var list = [];
    VEG_ROWS.forEach(function (q) {
      for (var p = 0.1; p < 0.62; p += 0.085) list.push({ kind: 'veg', p: p, q: q });
    });
    RICE_ROWS.forEach(function (q) {
      for (var p = 0.08; p < 0.93; p += 0.062) list.push({ kind: 'rice', p: p, q: q });
    });
    list.push({ kind: 'hut', p: 0.86, q: 0.2 });
    list.push({ kind: 'jar', p: 0.7, q: 0.4 });
    list.forEach(function (o) { var s = iso(o.p, o.q); o.x = s[0]; o.y = s[1]; });
    return list;
  }

  function buildPlot() {
    var L = {
      plot: canvas(W, H), veg: [sprite(VEG, CROP_PAL), sprite(lean(VEG, 2), CROP_PAL)],
      rice: [sprite(RICE, CROP_PAL), sprite(lean(RICE, 4), CROP_PAL)], hut: paintHut(), jar: paintJar(),
      things: plotThings(), clouds: [cloud(30), cloud(22), cloud(36)],
    };
    paintPlot(L.plot.getContext('2d'));
    return L;
  }

  function bob(t, period) { return reduceMotion ? 0 : Math.round(Math.sin((t / period) * Math.PI * 2) * 1.5); }

  // draw the plot and everything on it back to front; a gust of wind runs across the crops
  function drawPlot(ctx, t, L, dy, extra) {
    ctx.drawImage(L.plot, 0, dy);
    var things = extra ? L.things.concat(extra) : L.things;
    things.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (o) {
      var x = Math.round(o.x), y = Math.round(o.y) + dy;
      var gust = !reduceMotion && Math.sin(t / 700 - (o.p + o.q) * 5) > 0.55 ? 1 : 0;
      if (o.kind === 'veg') ctx.drawImage(L.veg[gust], x - 3, y - 4);
      else if (o.kind === 'rice') ctx.drawImage(L.rice[gust], x - 3, y - 6);
      else if (o.draw) o.draw(ctx, x, y, t);
      else ctx.drawImage(L[o.kind].img, x - L[o.kind].ox, y - L[o.kind].oy);
    });
  }

  function plotSky(ctx) { bands(ctx, [[0, C.sky[2]], [24, C.sky[1]], [62, C.sky[0]], [98, C.cream]], 0, H); }

  var B = {
    build: function () {
      var L = buildPlot();
      L.sky = canvas(W, H); plotSky(L.sky.getContext('2d'));
      return L;
    },
    draw: function (ctx, t, L) {
      ctx.drawImage(L.sky, 0, 0);
      drift(ctx, L.clouds[0], 6, 10, 0.004, t);
      drift(ctx, L.clouds[1], 120, 34, 0.0028, t);
      drawPlot(ctx, t, L, bob(t, 3600));
      drift(ctx, L.clouds[2], 70, 98, 0.006, t);
    },
  };

  /* ---------- C: Lung Phan standing on the plot ---------- */
  // small Lung Phan facing us, his basket of rice, corn and greens held in front
  var LUNG_SMALL = [
    '.....yy.....',
    '...yyYYyy...',
    '.yyyyyyyyyy.',
    'YYYYYYYYYYYY',
    '...hnnnnh...',
    '...nknnkn...',
    '...nnnnnn...',
    '...nhhhhn...',
    '....nnnn....',
    '..GgggggG...',
    '.ggggggggg..',
    'ng4.15.3.gn.',
    'n444115333n.',
    '.bbbbbbbbb..',
    '.bBbBbBbBb..',
    '..bBbBbBb...',
    '...ggggg....',
    '...CC.CC....',
    '...CC.CC....',
    '...hh.hh....',
  ];
  var LUNG_SMALL_PAL = {
    y: LUNG.hat[0], Y: LUNG.hat[1], h: LUNG.hair, n: LUNG.skin[0], k: LUNG.eye, g: LUNG.shirt[1], G: LUNG.shirt[2],
    C: LUNG.pants, b: C.brown[1], B: C.brown[2], 1: C.gold[0], 5: C.gold[1], 3: C.green[1], 4: C.green[2],
  };

  function outlined(img, c) {
    var cv = canvas(img.width + 2, img.height + 2), ctx = cv.getContext('2d');
    [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(function (o) { ctx.drawImage(img, o[0], o[1]); });
    ctx.globalCompositeOperation = 'source-in';
    rect(ctx, 0, 0, cv.width, cv.height, c);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, 1, 1);
    return cv;
  }

  var Cvar = {
    build: function () {
      var L = B.build();
      L.lung = outlined(sprite(LUNG_SMALL, LUNG_SMALL_PAL), C.ink);
      var spot = iso(0.36, 0.51);
      L.lungAt = { kind: 'lung', p: 0.36, q: 0.51, x: spot[0], y: spot[1], draw: function (ctx, x, y, t) {
        var breathe = !reduceMotion && Math.floor(t / 900) % 2 ? 1 : 0;
        ctx.drawImage(L.lung, x - 7, y - L.lung.height + 2 + breathe, L.lung.width, L.lung.height - breathe);
      } };
      return L;
    },
    draw: function (ctx, t, L) {
      ctx.drawImage(L.sky, 0, 0);
      drift(ctx, L.clouds[0], 6, 10, 0.004, t);
      drift(ctx, L.clouds[1], 120, 34, 0.0028, t);
      drawPlot(ctx, t, L, bob(t, 3600), [L.lungAt]);
      drift(ctx, L.clouds[2], 70, 98, 0.006, t);
    },
  };

  /* ---------- A: Lung Phan's portrait ---------- */
  function paintLung() {
    var hat = LUNG.hat, shirt = LUNG.shirt, skin = LUNG.skin, out = [];
    // body: green shirt with an open collar and the gold patch from his coach portrait
    var body = new Grid();
    body.poly([[42, 121], [44, 84], [50, 74], [68, 67], [92, 67], [110, 74], [116, 84], [118, 121]], function (x, y, nx, ny) {
      return nx < -0.62 ? shirt[0] : nx > 0.55 ? shirt[2] : shirt[1];
    });
    body.poly([[72, 66], [88, 66], [80, 76]], skin[1]);
    body.line(72, 67, 79, 76, shirt[2]); body.line(88, 67, 81, 76, shirt[2]);
    body.rect(92, 77, 5, 4, hat[0]); body.rect(92, 80, 5, 1, hat[1]);
    out.push(body.outline(C.ink));
    // forearms reaching round to the basket
    var arms = new Grid();
    arms.poly([[44, 84], [52, 84], [56, 97], [47, 99]], skin[0]);
    arms.poly([[116, 84], [108, 84], [104, 97], [113, 99]], skin[1]);
    arms.rect(43, 80, 10, 6, shirt[1]); arms.rect(107, 80, 10, 6, shirt[2]); // sleeves
    out.push(arms.outline(C.ink));
    // the head: ears, face, hair under the hat
    var head = new Grid();
    head.ellipse(64.5, 49, 3.5, 4.5, skin[1]); head.ellipse(95.5, 49, 3.5, 4.5, skin[1]);
    head.rect(73, 58, 14, 9, skin[1]); // neck
    head.ellipse(80, 46, 15.5, 17, function (x, y, nx, ny) { return nx > 0.62 || ny > 0.78 ? skin[1] : skin[0]; });
    out.push(head.outline(C.ink));
    // the straw hat: a wide shallow cone, weave lines, a dark band where it meets the head
    var cap = new Grid();
    cap.poly([[80, 4], [124, 30], [120, 35], [40, 35], [36, 30]], function (x, y, nx, ny) {
      if (y >= 32) return hat[1];
      var ring = Math.abs(((y - 4) * 46) / 26 - Math.abs(x - 80));
      if (Math.abs(x - 80) % 9 === 0 && y > 9) return hat[1];
      return nx < -0.2 && ring > 4 ? '#f6d566' : hat[0];
    });
    out.push(cap.outline(C.ink));
    return out;
  }

  // the face itself, drawn over the head pixel by pixel: shadow of the brim, brows, eyes, nose, moustache, smile
  function paintFace(ctx, eyesShut) {
    var n = LUNG.skin, h = LUNG.hair, k = LUNG.eye;
    function px(x, y, c) { rect(ctx, x, y, 1, 1, c); }
    for (var x = 66; x <= 94; x++) { px(x, 36, n[1]); if (x > 67 && x < 93) px(x, 37, n[1]); } // brim shadow
    rect(ctx, 65, 36, 2, 9, h); rect(ctx, 93, 36, 2, 9, h); // hair at the temples
    rect(ctx, 69, 41, 6, 1, h); px(69, 42, h); rect(ctx, 85, 41, 6, 1, h); px(90, 42, h); // brows
    if (eyesShut) {
      rect(ctx, 70, 45, 4, 1, k); rect(ctx, 86, 45, 4, 1, k);
    } else {
      rect(ctx, 70, 43, 3, 4, k); rect(ctx, 87, 43, 3, 4, k);
      px(70, 43, C.white); px(87, 43, C.white); // catchlights
    }
    px(68, 46, n[1]); px(92, 46, n[1]); // smile lines at the eyes
    rect(ctx, 79, 47, 2, 3, n[1]); px(78, 50, n[1]); px(81, 50, n[1]); // nose
    rect(ctx, 73, 51, 14, 2, h); px(72, 52, h); px(87, 52, h); px(80, 51, n[1]); // moustache
    rect(ctx, 74, 54, 12, 1, k); // the smile
    rect(ctx, 75, 55, 10, 2, C.white); px(74, 55, k); px(85, 55, k);
    rect(ctx, 76, 57, 8, 1, C.brown[2]); px(75, 57, k); px(84, 57, k);
    rect(ctx, 77, 58, 6, 1, k);
    px(70, 51, n[1]); px(89, 51, n[1]); // cheeks
  }

  // the woven basket and the harvest in it
  function paintBasket() {
    var out = [];
    var goods = new Grid();
    // rice ears fanning out on the left
    [[50, 74], [55, 71], [60, 70], [65, 72]].forEach(function (tip, i) {
      goods.line(60, 92, tip[0], tip[1], C.gold[2]);
      goods.ellipse(tip[0] + (i < 2 ? -1 : 1), tip[1] + 2, 2, 3.5, function (x, y) { return (x + y) % 2 ? C.gold[0] : C.gold[1]; });
    });
    // two corn cobs in their husks
    [[74, 79, -0.25], [84, 80, 0.2]].forEach(function (c) {
      goods.ellipse(c[0], c[1], 4.5, 10, function (x, y, nx) { return (x + y * 2) % 4 === 0 ? C.gold[2] : nx < -0.3 ? C.gold[0] : C.gold[1]; });
      goods.poly([[c[0] - 5, c[1] + 3], [c[0] - 1, c[1] + 12], [c[0] - 7, c[1] + 12]], C.green[1]);
      goods.poly([[c[0] + 5, c[1] + 3], [c[0] + 1, c[1] + 12], [c[0] + 7, c[1] + 12]], C.green[2]);
    });
    // a head of cabbage on the right
    goods.ellipse(99, 85, 11, 9, function (x, y, nx, ny) {
      var vein = Math.abs(x - 99 - ny * 3) < 0.6 || Math.abs(y - 86 + nx * 4) < 0.6;
      return vein ? C.green[0] : lit(C.green, nx, ny, 0.3);
    });
    out.push(goods.outline(C.ink));
    var basket = new Grid();
    basket.poly([[45, 92], [115, 92], [109, 121], [51, 121]], function (x, y) {
      var row = Math.floor((y - 92) / 3), weft = (y - 92) % 3 === 2;
      if (weft) return C.brown[2];
      return (x + row * 2) % 4 < 2 ? (x < 64 ? C.brown[0] : C.brown[1]) : C.brown[2];
    });
    basket.rect(43, 89, 74, 4, function (x, y) { return (x + y) % 3 === 0 ? C.brown[1] : C.brown[0]; }); // rim
    out.push(basket.outline(C.ink));
    // hands over the rim
    var hands = new Grid();
    hands.ellipse(49, 92, 4, 3.5, LUNG.skin[0]); hands.ellipse(111, 92, 4, 3.5, LUNG.skin[1]);
    out.push(hands.outline(C.ink));
    return out;
  }

  var A = {
    build: function () {
      var L = { bg: canvas(W, H), clouds: [cloud(34), cloud(24)] };
      var bg = L.bg.getContext('2d');
      bands(bg, [[0, C.sky[2]], [20, C.sky[1]], [44, C.sky[0]]], 0, 64);
      // a plain distant line of trees, then fields in bands
      var trees = new Grid();
      for (var x = 0; x < W; x++) {
        var top = 58 - Math.round(Math.abs(Math.sin(x / 7.5)) * 4 + Math.sin(x / 3.1));
        for (var y = top; y < 66; y++) trees.set(x, y, y === top ? C.green[1] : C.green[2]);
      }
      trees.paint(bg);
      bands(bg, [[66, C.green[1]], [80, C.gold[1]], [92, C.green[0]], [104, C.green[1]]], 66, H);
      for (var r = 70; r < H; r += 5) rect(bg, 0, r, W, 1, r < 80 || r >= 104 ? C.green[2] : r < 92 ? C.gold[2] : C.green[1]);
      L.figure = canvas(W, H);
      var fc = L.figure.getContext('2d');
      paintLung().forEach(function (g) { g.paint(fc); });
      L.face = canvas(W, H); paintFace(L.face.getContext('2d'), false);
      L.blink = canvas(W, H); paintFace(L.blink.getContext('2d'), true);
      L.basket = canvas(W, H);
      paintBasket().forEach(function (g) { g.paint(L.basket.getContext('2d')); });
      return L;
    },
    draw: function (ctx, t, L) {
      ctx.drawImage(L.bg, 0, 0);
      drift(ctx, L.clouds[0], 10, 8, 0.004, t);
      drift(ctx, L.clouds[1], 110, 24, 0.003, t);
      // he breathes: shoulders and head rise a pixel, the basket stays in his hands
      var up = !reduceMotion && Math.sin(t / 700) > 0.2 ? -1 : 0;
      var shut = !reduceMotion && t % 4200 < 140;
      ctx.drawImage(L.figure, 0, up);
      ctx.drawImage(shut ? L.blink : L.face, 0, up);
      ctx.drawImage(L.basket, 0, 0);
    },
  };

  /* ---------- the controller ---------- */
  var VARIANTS = { A: A, B: B, C: Cvar };

  function choice(v) {
    if (!v) {
      var m = /[?&]cover=([abc])\b/i.exec((root.location && root.location.search) || '');
      v = m ? m[1] : 'B';
    }
    v = String(v).toUpperCase();
    return VARIANTS[v] ? v : 'B';
  }

  // createCover(canvas) draws the version chosen in the address; createCover(canvas, 'A') forces one
  function createCover(cv, which) {
    cv.width = W;
    cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var art = VARIANTS[choice(which)], layers = null, running = false, last = 0;

    function render(t) {
      if (!layers) layers = art.build();
      art.draw(ctx, t, layers);
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
