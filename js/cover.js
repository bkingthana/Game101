/* The Magic Farmcare - the title cover. A 160 x 120 pixel picture, scaled up with CSS like the farm scene:
   magic hour over the Mekong at That Phanom. A giant sprout like the one in the Thanapun Farmcare logo grows
   on a hill of gold and green rice terraces, in front of the full moon rising over the Lao mountains, while
   Lung Phan waters it with sparkles. Phra That Phanom is floodlit on the near bank.
   The still parts are painted once into offscreen layers; each frame only adds the small moving things
   (stars, moonlight on the water, glow, fireflies, sparkles). createCover(canvas) has start() and stop()
   like createScene. */
(function (root) {
  var MF = (root.MF = root.MF || {});
  var S = MF.sprites;
  var W = 160, H = 120;
  var FRAME_MS = 70; // same pace as the farm scene

  var reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }
  function disc(ctx, x, y, r, c) {
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.round(Math.sqrt(r * r - dy * dy));
      rect(ctx, x - hw, y + dy, hw * 2 + 1, 1, c);
    }
  }
  function layer() {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    return cv;
  }

  /* ---------- layout ---------- */
  var HORIZON = 61;              // foot of the Lao mountains, the far bank
  var RIVER_TOP = 62, RIVER_BOTTOM = 70;
  var FIELDS = 73;               // where the paddies start below the near bank
  var MOON = { x: 80, y: 41, r: 19 };
  var SPROUT = { x: 80, base: 91, fork: 57 };
  var GLOW = { x: 80, y: 84 };   // the sprout lights the terraces around it
  var THAT_X = 19, THAT_Y = 50;  // Phra That Phanom, top-left of its sprite

  /* ---------- sky ---------- */
  // twilight in the east: night blue on top, the pink band of dusk at the horizon
  var SKY = [
    [0, '#0e1433'], [8, '#141c46'], [16, '#1d2558'], [24, '#2a2d6a'], [31, '#3b3277'],
    [38, '#4f3880'], [44, '#6a4088'], [49, '#8b4b8b'], [53, '#ae5a89'], [57, '#d27281'], [60, '#ea9078'],
  ];

  function paintSky(ctx) {
    SKY.forEach(function (b, i) {
      var bottom = i + 1 < SKY.length ? SKY[i + 1][0] : HORIZON + 2;
      rect(ctx, 0, b[0], W, bottom - b[0], b[1]);
      if (i === 0) return;
      // dithered seams: half the pixels on the first row, a quarter on the row above
      for (var x = b[0] % 2; x < W; x += 2) rect(ctx, x, b[0], 1, 1, SKY[i - 1][1]);
      for (var x2 = (b[0] * 2) % 4; x2 < W; x2 += 4) rect(ctx, x2, b[0] - 1, 1, 1, b[1]);
    });
  }

  function paintMoon(ctx) {
    var m = MOON;
    // halo: soft rings of moonlight
    [[16, 0.05], [11, 0.08], [7, 0.12], [4, 0.2], [2, 0.3]].forEach(function (g) {
      ctx.globalAlpha = g[1]; disc(ctx, m.x, m.y, m.r + g[0], '#ffe3a6');
    });
    ctx.globalAlpha = 1;
    disc(ctx, m.x, m.y, m.r, '#f7dc96');
    disc(ctx, m.x - 2, m.y - 2, m.r - 2, '#fff0c4');
    disc(ctx, m.x - 5, m.y - 6, m.r - 9, '#fff8de');
    // a few soft maria
    [[-9, 2, 3], [6, -8, 2], [9, 5, 3], [-3, 10, 2]].forEach(function (c) { disc(ctx, m.x + c[0], m.y + c[1], c[2], '#f1d68e'); });
  }

  /* ---------- the Lao bank: karst towers in silhouette, rim-lit by the moon ---------- */
  var FAR = [[3, 5, 18], [21, 7, 22], [39, 3, 13], [55, 3, 7], [106, 3, 8], [121, 4, 15], [139, 7, 23], [157, 5, 17]];
  var NEAR = [[11, 6, 10], [31, 4, 7], [131, 5, 9], [151, 6, 12]];

  function peak(peaks, x) {
    var best = 3 + Math.round(Math.sin(x / 6.3) + Math.sin(x / 2.7) * 0.6); // the low ridge the moon rises behind
    peaks.forEach(function (p) {
      var dx = Math.abs(x - p[0]);
      var v = dx <= p[1] ? p[2] - Math.round((dx / p[1]) * (dx / p[1]) * 2) : p[2] - 2 - (dx - p[1]) * 2.6;
      if (v > best) best = Math.round(v);
    });
    return best;
  }

  function paintMountains(ctx) {
    for (var x = 0; x < W; x++) {
      var far = peak(FAR, x);
      rect(ctx, x, HORIZON - far, 1, far + 1, '#3a3170');
      // the face toward the moon catches its light
      var toward = x < MOON.x ? peak(FAR, x + 1) : peak(FAR, x - 1);
      if (toward < far) rect(ctx, x, HORIZON - far, 1, Math.min(far, 3 + (far - toward)), '#5d4a92');
      else rect(ctx, x, HORIZON - far, 1, 1, '#54438a');
      var near = peak(NEAR, x) - 3;
      if (near > 0) rect(ctx, x, HORIZON - near, 1, near + 1, '#2b2660');
      // the far bank's tree line
      var trees = 1 + Math.round(1 + Math.sin(x / 1.9) * 0.8 + Math.sin(x / 4.7));
      rect(ctx, x, HORIZON + 1 - trees, 1, trees, '#221d4c');
    }
  }

  /* ---------- the Mekong ---------- */
  var WATER = ['#b0618a', '#9a5788', '#834e86', '#6e4683', '#5c3f7e', '#4e3a78', '#433573', '#3a316c', '#332d63'];

  function paintRiver(ctx) {
    for (var y = RIVER_TOP; y <= RIVER_BOTTOM; y++) {
      var c = WATER[y - RIVER_TOP];
      rect(ctx, 0, y, W, 1, c);
      // ripples of the sky's pink
      for (var i = 0; i < 6; i++) {
        var x = Math.floor(hash(y * 31 + i * 7) * W), w = 2 + Math.floor(hash(y * 17 + i) * 6);
        rect(ctx, x, y, w, 1, y - RIVER_TOP < 4 ? '#cd7f95' : '#7b5591');
      }
    }
  }

  /* ---------- the near bank: bushes, sugar palms and Phra That Phanom ---------- */
  var PALM = ['.k.k.k.', 'k.kkk.k', '.kkkkk.', 'kkkkkkk', '.k.k.k.'];

  function palm(ctx, x, h, c) {
    var base = FIELDS;
    rect(ctx, x, base - h, 1, h, c);
    PALM.forEach(function (row, y) {
      for (var i = 0; i < row.length; i++) if (row[i] === 'k') rect(ctx, x - 3 + i, base - h - 3 + y, 1, 1, c);
    });
  }

  var THAT = [
    '.....y.....',
    '.....y.....',
    '....yYy....',
    '.....y.....',
    '....yyY....',
    '....wwW....',
    '....wwW....',
    '...wwwWW...',
    '...wwwWW...',
    '...yyyYY...',
    '...wwwWW...',
    '..wwwwwWW..',
    '..yyyyyYY..',
    '..wwyyyWW..',
    '..wwyYyWW..',
    '..wwwwwWW..',
    '.yyyyyyyYY.',
    '.wwwwwwwWW.',
    '.wywywywYW.',
    'yyyyyyyyyYY',
    'wwwwwwwwwWW',
  ];
  var THAT_PAL = { w: '#fbf1d6', W: '#cdb48c', y: '#f2c43c', Y: '#b8861c' };

  function paintBank(ctx) {
    // floodlight glow around the stupa
    [[12, 0.07], [8, 0.1], [5, 0.12]].forEach(function (g) {
      ctx.globalAlpha = g[1]; disc(ctx, THAT_X + 5, THAT_Y + 12, g[0], '#ffcf7a');
    });
    ctx.globalAlpha = 1;
    // palms behind the bank
    palm(ctx, 116, 15, '#1a2238'); palm(ctx, 125, 11, '#1a2238'); palm(ctx, 147, 17, '#1a2238'); palm(ctx, 5, 13, '#1a2238');
    THAT.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (row[x] !== '.') rect(ctx, THAT_X + x, THAT_Y + y, 1, 1, THAT_PAL[row[x]]);
    });
    // the bank with bushes along the water
    for (var x = 0; x < W; x++) {
      var top = RIVER_BOTTOM + 1 - Math.round(1 + Math.sin(x / 2.3) * 0.9 + Math.sin(x / 6.1) * 1.2);
      rect(ctx, x, top, 1, FIELDS - top, '#1c2c2a');
      if (Math.sin(x / 2.3) > 0.6) rect(ctx, x, top, 1, 1, '#2c4038');
    }
  }

  /* ---------- the terraces ---------- */
  // five light levels for each material, from right by the sprout to out in the dark
  var MAT = {
    gold: ['#f2d062', '#d0a844', '#8f733e', '#5a4c3c', '#3c3536'],
    goldHi: ['#fff0a0', '#ecc860', '#ad8c46', '#6e5c40', '#4a3f38'],
    green: ['#b6dd52', '#8fbc3a', '#5a8a38', '#36553a', '#253a32'],
    greenHi: ['#e0f590', '#b6dc62', '#76a442', '#466a3e', '#2f4836'],
    lip: ['#fff0b0', '#e6cf86', '#a48e5a', '#685c4a', '#454040'],
    riser: ['#7a5632', '#5e4228', '#443226', '#2e2628', '#211d24'],
    soil: ['#c9965c', '#aa7f4c', '#7a5a3a', '#4e3c30', '#352a28'],
    soilHi: ['#e2b67a', '#c9965c', '#94704a', '#5e4a3a', '#3e322c'],
  };

  // light falls off with distance from the sprout, in steps; a narrow ordered dither softens each step
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function lightValue(x, y) {
    var dx = (x - GLOW.x) / 1.6, dy = y - GLOW.y;
    return (Math.sqrt(dx * dx + dy * dy) - 6) / 13;
  }
  function lightLevel(x, y) {
    var v = lightValue(x, y), f = Math.floor(v);
    var lv = f + (v - f > 0.5 + (BAYER[(y % 4) * 4 + (x % 4)] / 15 - 0.5) * 0.4 ? 1 : 0);
    return Math.max(0, Math.min(4, lv));
  }

  function hillTop(x) { return 90 + 0.0056 * (x - 80) * (x - 80); }
  var TERRACE = [0, 4, 9, 15, 22, 30, 39];
  var FLAT = [FIELDS, 75, 78, 82, 87, 93, 100, 108, 117, 130];

  // the paddies behind the hill are a patchwork of gold and green fields, each lit as a whole; the bunds
  // between them run toward a vanishing point above the river, so the fields widen toward the viewer
  var VANISH = { x: 80, y: 46 };
  function across(x, y) { return ((x - VANISH.x) * 28) / (y - VANISH.y); }
  var PATCHES = FLAT.slice(0, -1).map(function (top, b) {
    var cuts = [], u = -130 - Math.floor(hash(b * 41 + 5) * 16), n = 0;
    while (u < 130) {
      var w = Math.round(13 + hash(b * 59 + n * 7) * 14);
      cuts.push({ u0: u, u1: u + w, gold: hash(b * 23 + n * 13 + 1) < 0.5 });
      u += w; n++;
    }
    return cuts;
  });
  function patchAt(band, x, y) {
    var u = across(x + 0.5, y + 0.5), list = PATCHES[band];
    for (var i = 0; i < list.length; i++) if (u < list[i].u1) return i;
    return list.length - 1;
  }

  function paintFields(ctx) {
    for (var y = FIELDS; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var top = hillTop(x), band, row, height, lv, mat, c, cut = false;
        if (y >= top) { // on the terraced hill: gold and green steps
          var d = y - top;
          for (band = 0; band < TERRACE.length - 1 && d >= TERRACE[band + 1]; band++);
          row = Math.floor(d - TERRACE[band]);
          height = (TERRACE[band + 1] || 99) - TERRACE[band];
          mat = band % 2 ? 'green' : 'gold';
          lv = lightLevel(x, y);
        } else { // the flat paddies behind it
          for (band = 0; band < FLAT.length - 2 && y >= FLAT[band + 1]; band++);
          row = y - FLAT[band];
          height = FLAT[band + 1] - FLAT[band];
          var pi = patchAt(band, x, y), patch = PATCHES[band][pi], my = FLAT[band] + height / 2;
          mat = patch.gold ? 'gold' : 'green';
          cut = x > 0 && patchAt(band, x - 1, y) !== pi;
          var mid = VANISH.x + ((patch.u0 + patch.u1) / 2) * (my - VANISH.y) / 28;
          lv = Math.max(0, Math.min(4, Math.round(lightValue(mid, my)) + 1));
        }
        if (row === 0) c = MAT.lip[lv];
        else if (cut || (row === height - 1 && height > 3)) c = MAT.riser[lv];
        else {
          var h = hash(x * 131 + y * 977);
          c = h < 0.16 ? MAT[mat + 'Hi'][lv] : h > 0.9 ? MAT[mat][Math.min(4, lv + 1)] : MAT[mat][lv];
        }
        rect(ctx, x, y, 1, 1, c);
      }
    }
    // the mound of rich soil the sprout grows from
    for (var my = -5; my <= 2; my++) {
      var hw = Math.round(13 * Math.sqrt(Math.max(0, 1 - (my * my) / 30)));
      for (var mx = -hw; mx <= hw; mx++) {
        var px = SPROUT.x + mx, py = SPROUT.base + my, lv2 = lightLevel(px, py);
        var hi = my < -2 && mx < 4;
        rect(ctx, px, py, 1, 1, hash(px * 7 + py * 13) < 0.2 ? MAT.soil[Math.min(4, lv2 + 1)] : hi ? MAT.soilHi[lv2] : MAT.soil[lv2]);
      }
    }
    // rice in the dark foreground corners frames the picture
    var dark = { y: '#a8853a', Y: '#7a5e2e', l: '#4f7a3a', g: '#355e34', G: '#26442c' };
    [[-3, 108], [4, 111], [11, 113], [139, 113], [146, 110], [153, 108]].forEach(function (p) { S.draw(ctx, 'rice2', p[0], p[1], dark); });
  }

  /* ---------- the sprout ---------- */
  var LEAF = { hi: '#bfe55a', mid: '#9bc53d', dark: '#76a22e', rim: '#5a8624', vein: '#86b434', spec: '#eaffb0', line: '#ffffff', edge: '#1d3a1c' };

  function paintSprout() {
    var grid = {};
    function put(x, y, k) { grid[x + ',' + y] = k; }
    // the stem, leaning a little at the foot like the logo's
    for (var y = SPROUT.fork; y <= SPROUT.base - 1; y++) {
      var s = (y - SPROUT.fork) / (SPROUT.base - SPROUT.fork);
      var xc = SPROUT.x + Math.round(Math.pow(s, 2.4) * 3);
      put(xc - 2, y, 'hi'); put(xc - 1, y, 'hi'); put(xc, y, 'mid'); put(xc + 1, y, 'dark');
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
          var k = dv > w * 0.3 ? 'hi' : dv > -w * 0.4 ? 'mid' : dv > -w + 1 ? 'dark' : 'rim';
          if (Math.abs(dv + w * 0.05) < 0.55 && s > 0.12 && s < 0.82) k = 'vein';
          if (dv > w - 1.3 && s > 0.3 && s < 0.7) k = 'spec';
          put(x, y, k);
        }
      }
    }
    leaf(146, 25, 8, 0.3);
    leaf(34, 25, 8, 0.3);

    // a white outline like the logo's, and a dark one outside it so the leaves hold against the moon
    function ring(kind) {
      var add = [];
      Object.keys(grid).forEach(function (key) {
        var p = key.split(','), x = +p[0], y = +p[1];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var n = (x + o[0]) + ',' + (y + o[1]);
          if (!grid[n] && y + o[1] < SPROUT.base - 1) add.push(n);
        });
      });
      add.forEach(function (n) { grid[n] = kind; });
    }
    ring('line');
    ring('edge');
    var cv = layer(), ctx = cv.getContext('2d');
    Object.keys(grid).forEach(function (key) {
      var p = key.split(',');
      rect(ctx, +p[0], +p[1], 1, 1, LEAF[grid[key]]);
    });
    return cv;
  }

  // the soft glow around the sprout, painted once and drawn with a pulsing alpha
  function paintGlow() {
    var cv = layer(), ctx = cv.getContext('2d');
    [[34, 0.05], [27, 0.07], [21, 0.09], [16, 0.12]].forEach(function (g) {
      ctx.globalAlpha = g[1]; disc(ctx, SPROUT.x, SPROUT.fork - 4, g[0], '#e2ff8c');
    });
    ctx.globalAlpha = 1;
    return cv;
  }

  /* ---------- things that move ---------- */
  var STARS = [];
  (function () {
    for (var i = 0; STARS.length < 44 && i < 400; i++) {
      var x = 2 + Math.floor(hash(i * 7 + 3) * (W - 4)), y = 2 + Math.floor(Math.pow(hash(i * 11 + 1), 1.5) * 44);
      var dx = x - MOON.x, dy = y - MOON.y;
      if (dx * dx + dy * dy < (MOON.r + 9) * (MOON.r + 9)) continue;
      STARS.push({ x: x, y: y, kind: STARS.length % 9 === 0 ? 2 : STARS.length % 4 === 0 ? 1 : 0, c: STARS.length % 3 ? '#e6e9ff' : '#fff1c2' });
    }
  })();

  function drawStars(ctx, t) {
    STARS.forEach(function (s, i) {
      var tw = reduceMotion ? 1 : (Math.floor(t / 380) + i * 3) % 11;
      if (tw === 0) return; // a blink
      ctx.globalAlpha = s.y > 34 ? 0.6 : 1;
      rect(ctx, s.x, s.y, 1, 1, s.c);
      if (s.kind && tw % 4 !== 1) {
        var arm = s.kind === 2 && tw % 3 === 0 ? 2 : 1;
        ctx.globalAlpha *= 0.55;
        rect(ctx, s.x - arm, s.y, arm, 1, s.c); rect(ctx, s.x + 1, s.y, arm, 1, s.c);
        rect(ctx, s.x, s.y - arm, 1, arm, s.c); rect(ctx, s.x, s.y + 1, 1, arm, s.c);
      }
    });
    ctx.globalAlpha = 1;
  }

  // now and then a shooting star crosses the top of the sky
  function drawShootingStar(ctx, t) {
    if (reduceMotion) return;
    var p = (t % 9000) / 900;
    if (p >= 1) return;
    var n = Math.floor(t / 9000), x0 = 30 + hash(n * 3) * 100, y0 = 4 + hash(n * 5) * 10;
    for (var k = 0; k < 7; k++) {
      var q = p - k * 0.035;
      if (q < 0) continue;
      ctx.globalAlpha = (1 - k / 7) * (p < 0.8 ? 1 : (1 - p) * 5);
      rect(ctx, Math.round(x0 - q * 34), Math.round(y0 + q * 14), 1, 1, k ? '#cfd6ff' : '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  // the moon's path on the water, shimmering, and a few floating lanterns drifting downstream
  function drawWater(ctx, t) {
    var tt = reduceMotion ? 0 : t;
    for (var y = RIVER_TOP; y <= RIVER_BOTTOM; y++) {
      var row = y - RIVER_TOP;
      var w = 9 - Math.floor(row / 2) + ((row * 5 + Math.floor(tt / 190)) % 3) - 1;
      var off = Math.round(Math.sin(tt / 320 + row * 1.9));
      rect(ctx, MOON.x - Math.floor(w / 2) + off, y, w, 1, row < 3 ? '#fff0c0' : '#f3cf7c');
      if (row % 2) rect(ctx, MOON.x - w + off - 1, y, 2, 1, '#e0a77a');
    }
    for (var k = 0; k < 3; k++) {
      var lx = Math.floor((k * 57 + 20 + tt / 260) % (W + 10)) - 5, ly = RIVER_TOP + 2 + k * 2;
      var on = (Math.floor(tt / 240) + k) % 4;
      rect(ctx, lx, ly, 2, 1, '#6a4a2a');
      rect(ctx, lx, ly - 1, 1, 1, on ? '#ffd65a' : '#ff9a3a');
      ctx.globalAlpha = 0.5; rect(ctx, lx, ly + 1, 1, 1, '#ffb347'); ctx.globalAlpha = 1;
    }
  }

  function drawThatGlint(ctx, t, tapped) {
    if (!tapped && (reduceMotion || t % 6000 > 320)) return;
    var cx = THAT_X + 5, cy = THAT_Y;
    rect(ctx, cx, cy - 2, 1, 1, '#ffffff'); rect(ctx, cx - 2, cy, 1, 1, '#ffffff'); rect(ctx, cx + 2, cy, 1, 1, '#ffffff');
    rect(ctx, cx, cy, 1, 1, '#fff6c8');
  }

  // fireflies over the paddies
  var FLIES = [];
  for (var f = 0; f < 13; f++) FLIES.push({ x: 8 + hash(f * 19 + 2) * 144, y: 76 + hash(f * 23 + 9) * 36, a: hash(f * 29) * 6.28, s: 0.6 + hash(f * 31) * 0.8 });

  function drawFireflies(ctx, t) {
    var tt = reduceMotion ? 0 : t;
    FLIES.forEach(function (fl, i) {
      var x = Math.round(fl.x + Math.sin(tt / (1700 / fl.s) + fl.a) * 6), y = Math.round(fl.y + Math.cos(tt / (2300 / fl.s) + fl.a * 1.3) * 3);
      var glow = reduceMotion ? 1 : Math.sin(tt / 520 + fl.a * 3);
      if (glow < -0.4) return;
      if (glow > 0.2) {
        ctx.globalAlpha = 0.35;
        rect(ctx, x - 1, y, 3, 1, '#c8f060'); rect(ctx, x, y - 1, 1, 3, '#c8f060');
        ctx.globalAlpha = 1;
      }
      rect(ctx, x, y, 1, 1, glow > 0.2 ? '#f6ffb8' : '#b9d860');
    });
  }

  // sparkles rising from the leaves into the sky
  function drawSparkles(ctx, t, burstAt) {
    var tt = reduceMotion ? 1300 : t;
    var n = burstAt && t - burstAt < 1400 ? 18 : 9; // twice as many right after a tap
    for (var i = 0; i < n; i++) {
      var period = 2600 + hash(i * 13) * 1600;
      var p = ((tt + hash(i * 7) * period) % period) / period;
      var cycle = Math.floor((tt + hash(i * 7) * period) / period);
      var x0 = 58 + hash(i * 17 + cycle * 5) * 44;
      var x = Math.round(x0 + Math.sin(p * 6 + i) * 3), y = Math.round(58 - p * 46);
      ctx.globalAlpha = p < 0.2 ? p / 0.2 : p > 0.7 ? (1 - p) / 0.3 : 1;
      if (i % 3 === 0) S.draw(ctx, 'sparkle', x - 2, y - 2, { w: i % 2 ? '#fff6c2' : '#f2ffd0' });
      else rect(ctx, x, y, 1, 1, i % 2 ? '#fff6c2' : '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  // Lung Phan on the terrace beside the sprout, his watering can pouring sparkles on the soil
  var LUNG = { x: 93, y: 73 }; // the spout is at (0, 13) in the sprite

  // a sprite with a dark 1px outline, so a small figure stands out on the busy terraces
  function outlined(name, color) {
    var src = S.canvas(name), cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = src.width + 2; cv.height = src.height + 2;
    [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(function (o) { ctx.drawImage(src, o[0], o[1]); });
    ctx.globalCompositeOperation = 'source-in';
    rect(ctx, 0, 0, cv.width, cv.height, color);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(src, 1, 1);
    return cv;
  }

  function drawLung(ctx, t, sprite) {
    var tt = reduceMotion ? 0 : t;
    ctx.drawImage(sprite, LUNG.x - 1, LUNG.y - 1);
    // the stream from the spout
    for (var k = 0; k < 4; k++) {
      var p = ((tt / 600) + k / 4) % 1;
      var x = Math.round(LUNG.x - 1 - p * 4), y = Math.round(LUNG.y + 14 + p * p * 4);
      ctx.globalAlpha = 1 - p * 0.5;
      rect(ctx, x, y, 1, 1, k % 2 ? '#fff6c2' : '#c8f4ff');
    }
    ctx.globalAlpha = 1;
  }

  // the game's crops float around the sprout in bubbles of light
  var CROPS = [['rice2', 34, 26], ['corn2', 50, 6], ['shallot2', 102, 6], ['kale2', 118, 26]];

  function paintBubble() {
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = 17; cv.height = 17;
    ctx.globalAlpha = 0.16; disc(ctx, 8, 8, 8, '#e9ffd2');
    ctx.globalAlpha = 0.55;
    for (var a = 0; a < 64; a++) {
      var x = Math.round(8 + Math.cos(a / 64 * 6.283) * 8), y = Math.round(8 + Math.sin(a / 64 * 6.283) * 8);
      rect(ctx, x, y, 1, 1, '#f2ffe2');
    }
    ctx.globalAlpha = 1;
    rect(ctx, 4, 3, 2, 1, '#ffffff'); rect(ctx, 3, 4, 1, 2, '#ffffff');
    return cv;
  }

  function drawCrops(ctx, t, bubble) {
    CROPS.forEach(function (c, i) {
      var bob = reduceMotion ? 0 : Math.round(Math.sin(t / 900 + i * 1.6) * 1.4);
      ctx.drawImage(bubble, c[1] - 4, c[2] - 3 + bob);
      S.draw(ctx, c[0], c[1], c[2] + bob);
    });
  }

  /* ---------- the controller ---------- */
  function createCover(canvas) {
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var layers = null, running = false, last = 0, thatHandler = null, thatAt = 0, burstAt = 0;

    function build() {
      var sky = layer(), land = layer();
      var sc = sky.getContext('2d'), lc = land.getContext('2d');
      paintSky(sc); paintMoon(sc);
      paintMountains(lc); paintRiver(lc); paintBank(lc); paintFields(lc);
      layers = { sky: sky, land: land, sprout: paintSprout(), glow: paintGlow(), bubble: paintBubble(), lung: outlined('lungCover', '#14201a') };
    }

    function render(t) {
      if (!layers) build();
      ctx.drawImage(layers.sky, 0, 0);
      drawStars(ctx, t);
      drawShootingStar(ctx, t);
      ctx.drawImage(layers.land, 0, 0);
      drawWater(ctx, t);
      drawThatGlint(ctx, t, thatAt && t - thatAt < 1500);
      ctx.globalAlpha = reduceMotion ? 0.85 : 0.75 + 0.25 * Math.sin(t / 650);
      ctx.drawImage(layers.glow, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(layers.sprout, 0, 0);
      drawCrops(ctx, t, layers.bubble);
      drawLung(ctx, t, layers.lung);
      drawFireflies(ctx, t);
      drawSparkles(ctx, t, burstAt);
    }

    function loop(now) {
      if (!running) return;
      if (now - last >= FRAME_MS) { last = now; render(now); }
      requestAnimationFrame(loop);
    }

    canvas.addEventListener('click', function (e) {
      var b = canvas.getBoundingClientRect();
      var x = ((e.clientX - b.left) / b.width) * W, y = ((e.clientY - b.top) / b.height) * H;
      var now = performance.now();
      if (thatHandler && x >= THAT_X - 2 && x <= THAT_X + 13 && y >= THAT_Y - 4 && y <= THAT_Y + 23) {
        thatAt = now;
        thatHandler();
      } else if (!reduceMotion && Math.abs(x - SPROUT.x) < 30 && y > 26 && y < SPROUT.base + 3) {
        burstAt = now; // the sprout answers a tap with a shower of sparkles
      } else return;
      if (!running || reduceMotion) render(now);
    });

    return {
      start: function () {
        if (running) return;
        running = true;
        render(performance.now());
        if (!reduceMotion) requestAnimationFrame(loop);
      },
      stop: function () { running = false; },
      onThatPhanom: function (fn) { thatHandler = fn; },
    };
  }

  MF.createCover = createCover;
})(typeof window !== 'undefined' ? window : globalThis);
