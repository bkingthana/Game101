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
    { base: '#9a8468', furrow: '#7d6a52' }, // Mekong silt
  ];
  var SKY = {
    rain: ['#8fb4cf', '#a9c7dc', '#c3d8e6'],
    cool: ['#7cc0ee', '#a3d4f4', '#cbe7f9'],
    hot: ['#f2b36a', '#f6cd8a', '#f9e2ae'],
    storm: ['#66757f', '#7f8d97', '#99a6ae'],
    fog: ['#b9c6cb', '#c9d3d6', '#d8e0e2'],
    drought: ['#ee9c50', '#f3b874', '#f7d39b'],
    night: ['#28366e', '#33427c', '#43538c'], // darkened further by the night overlay
    dawn: ['#5d5f9e', '#9b78b0', '#e597a8', '#f8b98f', '#ffdca0'],
    dusk: ['#3e3570', '#6e4a8a', '#c25f7d', '#ef8a5a', '#ffbe6a'],
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
    if (colors.length === 3) {
      rect(ctx, 0, 0, W, 11, colors[0]);
      rect(ctx, 0, 11, W, 10, colors[1]);
      rect(ctx, 0, 21, W, 13, colors[2]);
      return;
    }
    // sunrise and sunset skies: more bands, dithered where they meet
    var top = 0;
    colors.forEach(function (c, i) {
      var bottom = Math.round(((i + 1) / colors.length) * 34);
      rect(ctx, 0, top, W, bottom - top, c);
      if (i > 0) for (var x = 0; x < W; x += 2) rect(ctx, x + (top % 2), top, 1, 1, colors[i - 1]);
      top = bottom;
    });
  }

  function disc(ctx, x, y, r, c) {
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.round(Math.sqrt(r * r - dy * dy));
      rect(ctx, x - hw, y + dy, hw * 2 + 1, 1, c);
    }
  }

  // a low sun at sunrise or sunset: bigger, with a soft glow around it
  function drawLowSun(ctx, sun) {
    ctx.globalAlpha = 0.14; disc(ctx, sun.x, sun.y, 14, sun.glow);
    ctx.globalAlpha = 0.22; disc(ctx, sun.x, sun.y, 10, sun.glow);
    ctx.globalAlpha = 1;
    disc(ctx, sun.x, sun.y, 7, sun.colors[1]);
    disc(ctx, sun.x, sun.y - 2, 4, sun.colors[0]);
  }

  function drawSun(ctx, x, y, big, colors) {
    var r = big ? 6 : 4, c = colors || ['#fff1a8', '#ffd84a'];
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.round(Math.sqrt(r * r - dy * dy));
      rect(ctx, x - hw, y + dy, hw * 2 + 1, 1, dy < -r / 2 ? c[0] : c[1]);
    }
    if (big) {
      ctx.globalAlpha = 0.35;
      rect(ctx, x - r - 4, y, 2, 1, '#fff1a8'); rect(ctx, x + r + 3, y, 2, 1, '#fff1a8');
      rect(ctx, x, y - r - 4, 1, 2, '#fff1a8'); rect(ctx, x, y + r + 3, 1, 2, '#fff1a8');
      ctx.globalAlpha = 1;
    }
  }

  function drawCloud(ctx, x, y, dark, tint) {
    var c = tint ? tint[0] : dark ? '#8a979f' : '#ffffff', s = tint ? tint[1] : dark ? '#6f7c84' : '#dfeaf0';
    rect(ctx, x + 3, y, 8, 2, c);
    rect(ctx, x + 1, y + 2, 14, 2, c);
    rect(ctx, x, y + 4, 18, 2, c);
    rect(ctx, x + 1, y + 6, 16, 1, s);
  }

  /* limestone karst peaks on the Lao bank, as seen across the Mekong from Nakhon Phanom:
     steep sides, rounded tops, two layers of haze */
  var FAR_PEAKS = [[8, 5, 15], [30, 7, 19], [52, 4, 13], [74, 6, 18], [100, 8, 16], [124, 5, 20], [150, 7, 15]];
  var NEAR_PEAKS = [[18, 5, 9], [42, 6, 12], [64, 4, 8], [88, 7, 11], [112, 5, 9], [138, 6, 12]];

  function peakHeight(peaks, x) {
    var best = 0;
    peaks.forEach(function (p) {
      var dx = Math.abs(x - p[0]), top = p[1], h = p[2];
      var v = dx <= top ? h - Math.round((dx / top) * (dx / top) * 2) : h - 2 - (dx - top) * 3;
      if (v > best) best = v;
    });
    return best;
  }

  // far peaks, near peaks, lit faces, tree line
  var HILLS = {
    day: ['#93a0c6', '#6f80ab', '#8796bd', '#3f6b4f'],
    dawn: ['#a991bd', '#7a6aa2', '#d39ab4', '#3e5a55'],
    dusk: ['#7c6095', '#4e4170', '#b0709a', '#2e3f3a'],
  };

  function drawMountains(ctx, time) {
    var c = HILLS[time] || HILLS.day;
    for (var x = 0; x < W; x++) {
      var far = peakHeight(FAR_PEAKS, x);
      if (far > 0) rect(ctx, x, 34 - far, 1, far, c[0]);
      var near = peakHeight(NEAR_PEAKS, x);
      if (near > 0) {
        rect(ctx, x, 34 - near, 1, near, c[1]);
        if (peakHeight(NEAR_PEAKS, x - 1) < near) rect(ctx, x, 34 - near, 1, 2, c[2]); // sunlit left faces
      }
      // tree line along the far bank
      var trees = 2 + Math.round(1.2 * Math.sin(x / 2.3) + Math.sin(x / 5.1));
      rect(ctx, x, 34 - trees, 1, trees, c[3]);
    }
  }

  function drawGround(ctx, season) {
    var base = season === 'hot' ? '#8fae4a' : season === 'cool' ? '#5aa846' : '#4f9e42';
    rect(ctx, 0, 34, W, H - 34, base);
    for (var i = 0; i < 260; i++) {
      var x = Math.floor(hash(i * 7 + 1) * W), y = 35 + Math.floor(hash(i * 13 + 5) * (H - 35));
      rect(ctx, x, y, 1, 1, hash(i) > 0.5 ? '#3f8a37' : '#74bd56');
    }
    // dirt path from the signboard to the fields
    rect(ctx, 19, 41, 51, 2, '#a8875a');
    rect(ctx, 66, 41, 4, 30, '#a8875a');
  }

  /* Phra That Phanom in the distance: the square white stupa with gold bands and a gold spire,
     a few kilometres from the company in That Phanom. Lit from the left like the mountains. */
  var THAT = [
    '......y......',
    '......y......',
    '......y......',
    '.....yyY.....',
    '.....yyY.....',
    '.....yyY.....',
    '.....wwW.....',
    '.....wwW.....',
    '.....wwW.....',
    '....wwwWW....',
    '....wwwWW....',
    '...wwwwWWW...',
    '...yyyyYYY...',
    '...wwwwWWW...',
    '....wwwWW....',
    '...yyyyYYY...',
    '..yyyyyyyYY..',
    '..wwwwwwwWW..',
    '..wwwyyyWWW..',
    '..wwwyYyWWW..',
    '..wwwyYyWWW..',
    '..wwwwwwWWW..',
    '.yyyyyyyyyYY.',
    '.wwwwwwwwwWW.',
    '.wywywywywYW.',
    '.wwwwwwwwwWW.',
    'yyyyyyyyyyyYY',
    'wwwwwwwwwwwWW',
  ];
  var THAT_PAL = { w: '#f6f2e4', W: '#cdc5ad', y: '#ecbb32', Y: '#b8861c' };
  var THAT_X = 88, THAT_Y = 10; // top-left; the terrace sits on the far bank at y 37

  function drawThatPhanom(ctx, t, view, thatAt) {
    var hazy = view.weather === 'humid' || view.weather === 'flood';
    if (hazy) ctx.globalAlpha = 0.6;
    THAT.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        if (row[x] !== '.') rect(ctx, THAT_X + x, THAT_Y + y, 1, 1, THAT_PAL[row[x]]);
      }
    });
    // temple trees at its foot
    rect(ctx, THAT_X - 4, THAT_Y + 24, 4, 4, '#3f6b4f'); rect(ctx, THAT_X - 3, THAT_Y + 23, 2, 1, '#3f6b4f');
    rect(ctx, THAT_X + 13, THAT_Y + 25, 5, 3, '#3f6b4f'); rect(ctx, THAT_X + 14, THAT_Y + 24, 3, 1, '#3f6b4f');
    ctx.globalAlpha = 1;
    // the gold tip catches the sun now and then, and right after a tap
    var tapped = thatAt && t - thatAt < 1500;
    if (!hazy && (tapped || (!reduceMotion && t % 7000 < 350))) {
      var cx = THAT_X + 6, cy = THAT_Y;
      rect(ctx, cx, cy - 2, 1, 1, '#ffffff'); rect(ctx, cx - 2, cy, 1, 1, '#ffffff'); rect(ctx, cx + 2, cy, 1, 1, '#ffffff');
      rect(ctx, cx, cy, 1, 1, '#fff6c8');
      if (tapped) { rect(ctx, cx - 3, cy + 3, 1, 1, '#fff6c8'); rect(ctx, cx + 3, cy + 5, 1, 1, '#fff6c8'); }
    }
  }

  /* Thanapun Farmcare signboard at the head of the path */
  function drawSign(ctx) {
    var x = 13, y = 20;
    rect(ctx, x + 6, y + 14, 2, 7, '#55321c');
    rect(ctx, x - 1, y - 1, 16, 16, '#3b2a20');
    rect(ctx, x, y, 14, 14, '#f4ecd2');
    S.draw(ctx, 'brandSmall', x + 1, y + 1);
  }

  function drawPalm(ctx, t) {
    var sway = reduceMotion ? 0 : Math.round(Math.sin(t / 900));
    var bx = 46;
    for (var i = 0; i < 26; i++) {
      var x = bx + Math.round(Math.sin(i / 9) * 2) + (i > 18 ? sway : 0);
      rect(ctx, x, 40 - i, 2, 1, i % 3 ? '#8a5530' : '#6e4426');
    }
    var tx = bx + 2 + sway, ty = 14;
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

  /* The Mekong runs down the right side, widening toward the viewer. It rises and turns muddy in
     the rainy season (up to the grass) and drops in the hot season, leaving a sandbar. Water hyacinth drifts
     downstream, faster and thicker when the river is high. */
  var RIVER = {
    rain: { shift: -4, water: '#7f876a', deep: '#6c7558', light: '#c3c7a2', bankColor: '#6b5a3e', ripples: 12, weeds: 4, speed: 1.7 },
    cool: { shift: 0, water: '#5b93a6', deep: '#4d8496', light: '#8bbdca', ripples: 9, weeds: 1, speed: 1 },
    hot: { shift: 5, water: '#6aa2b0', deep: '#5d94a3', light: '#9fcad3', ripples: 8, weeds: 1, speed: 0.8 },
  };

  function riverEdge(y, shift) { return Math.round(146 - (y - 33) * 0.21) + shift; }

  function drawRiver(ctx, t, season, night) {
    var r = RIVER[season] || RIVER.cool;
    var tt = reduceMotion ? 0 : t;
    for (var y = 33; y < H; y++) {
      var bank = riverEdge(y, 0), edge = riverEdge(y, r.shift);
      var sand = Math.min(bank, edge) - 2;
      rect(ctx, sand, y, W - sand, 1, r.bankColor || '#d6c08c'); // high water leaves only wet mud
      rect(ctx, edge, y, W - edge, 1, r.water);
      // the deeper channel, its edge wavering with the current
      var deep = edge + Math.round((W - edge) * 0.5 + Math.sin(y / 3 - tt / 600) * 1.5);
      rect(ctx, deep, y, W - deep, 1, r.deep);
      rect(ctx, edge, y, 1, 1, r.light); // wet edge of the water
    }
    // small wave crests riding the current toward the viewer
    for (var i = 0; i < r.ripples; i++) {
      var ry = 35 + Math.floor((i * 5.3 + tt * r.speed / 90) % 62);
      var rx = riverEdge(ry, r.shift) + 2 + Math.floor(hash(i * 5) * (W - riverEdge(ry, r.shift) - 6));
      rect(ctx, rx, ry + 1, 1, 1, r.light); rect(ctx, rx + 1, ry, 2, 1, r.light); rect(ctx, rx + 3, ry + 1, 1, 1, r.light);
    }
    // water hyacinth clumps with a lilac flower
    for (var k = 0; k < r.weeds; k++) {
      var wy = 34 + Math.floor((k * 17 + 8 + tt * r.speed / 140) % 64);
      var we = riverEdge(wy, r.shift);
      var wx = we + 2 + Math.floor(hash(k * 13 + 3) * Math.max(1, W - we - 8));
      rect(ctx, wx + 1, wy, 3, 1, '#4f9a3c');
      rect(ctx, wx, wy + 1, 5, 1, '#2f6e32');
      rect(ctx, wx + 1, wy + 1, 1, 1, '#6fbf4a');
      rect(ctx, wx + 1, wy + 2, 3, 1, '#2f6e32');
      rect(ctx, wx + 2, wy - 1, 1, 1, '#b48ad6');
    }
    // long-tail boat drifting on the river (moored at night, when the fire boats come)
    if (night) return;
    var by = Math.round(58 + Math.sin(tt / 2400) * 10), bob = reduceMotion ? 0 : Math.round(Math.sin(tt / 500));
    var bx = riverEdge(by, r.shift) + 6;
    rect(ctx, bx, by + bob, 11, 2, '#5a3a22');
    rect(ctx, bx + 1, by - 1 + bob, 9, 1, '#8a5530');
    rect(ctx, bx + 10, by - 2 + bob, 1, 1, '#8a5530');
    rect(ctx, bx - 2, by + 1 + bob, 2, 1, '#7d8a92');
    rect(ctx, bx + 4, by - 3 + bob, 1, 2, '#2f4f8a');
    rect(ctx, bx + 4, by - 4 + bob, 1, 1, '#f1c79a');
    rect(ctx, bx + 3, by - 5 + bob, 3, 1, '#f0c43c');
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
        var spot = { leafPurple: '#8c3a78', leafDowny: '#f3ee9a', leafRust: '#ffffff', leafRot: '#4a2c16' }[ev.sprite] || '#7a3b1c';
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

  /* ---------- farm life ---------- */

  var BUFFALO = { h: '#3d3d44', H: '#5d5d68', W: '#d8cfb8' };

  // a water buffalo grazing on the bank with an egret riding on its back, and Lung Phan on the path
  function drawLife(ctx, t, view) {
    var tt = reduceMotion ? 0 : t;
    var bx = 117 + Math.round(Math.sin(tt / 9000) * 8);
    var right = Math.cos(tt / 9000) > 0;
    var lookUp = !reduceMotion && tt % 7000 > 5600;
    var name = (lookUp ? 'buffaloUp' : 'buffaloGraze') + (right ? 'R' : '');
    S.draw(ctx, name, bx, 34, BUFFALO);
    S.draw(ctx, 'egretStand', bx + (right ? 4 : 6), 29);

    // egrets wade in rice paddies during the rainy season
    if (view.season === 'rain') {
      view.plots.forEach(function (p, i) {
        if (p.use === 'rice') S.draw(ctx, 'egretStand', PLOT_RECTS[i].x + 50, PLOT_RECTS[i].y + 14);
      });
    }

    // Lung Phan walks the path; at night he stops by the river to watch the fire boats
    var fx = view.night ? 62 : 41 + Math.round(Math.sin(tt / 7000) * 19);
    var walking = !view.night && !reduceMotion;
    S.draw(ctx, walking && Math.floor(t / 220) % 2 ? 'farmerB' : 'farmerA', fx, 35);
    if (view.stage === 'care' && !view.night) { rect(ctx, fx + 4, 38, 2, 3, '#7d8a92'); rect(ctx, fx + 5, 37, 1, 1, '#c9412f'); } // sprayer tank
  }

  // a small flock of egrets crosses the sky now and then
  function drawBirds(ctx, t, view) {
    if (reduceMotion || view.weather === 'flood') return;
    var p = (t % (view.time === 'dusk' ? 12000 : 26000)) / 9000;
    if (p >= 1) return;
    var flap = Math.floor(t / 180) % 2 ? 'egretUp' : 'egretDown';
    [[0, 0], [-7, 3], [-12, -2]].forEach(function (o, n) {
      var x = -12 + p * (W + 24) + o[0], y = 17 + Math.round(Math.sin(p * 6 + n) * 1.5) + o[1];
      S.draw(ctx, (Math.floor(t / 180) + n) % 2 ? 'egretUp' : flap, x, y);
    });
  }

  /* ---------- Ok Phansa night: Lai Ruea Fai, the illuminated boats of Nakhon Phanom ---------- */

  // lights tracing a stupa on a raft
  var FIRE_BOAT = [
    '.......y.......',
    '.......o.......',
    '......y.y......',
    '......o.o......',
    '.....y...y.....',
    '....o.....o....',
    '....yoyoyoy....',
    '...o.......o...',
    '...y..yoy..y...',
    '...o..o.o..o...',
    '..yoyoyoyoyoy..',
    '..o.........o..',
    '.yoyoyoyoyoyoy.',
    'kkkkkkkkkkkkkkk',
    '.kkkkkkkkkkkkk.',
  ];

  function drawNight(ctx, t, view) {
    var tt = reduceMotion ? 0 : t;
    ctx.globalAlpha = 0.58;
    rect(ctx, 0, 0, W, H, '#0a1030');
    ctx.globalAlpha = 1;

    // stars above the mountains, and the full moon of Ok Phansa rising over Laos
    for (var i = 0; i < 26; i++) {
      var sx = Math.floor(hash(i * 7 + 3) * W), sy = Math.floor(hash(i * 11 + 1) * 22);
      if (sy >= 33 - peakHeight(FAR_PEAKS, sx)) continue;
      if (!reduceMotion && (Math.floor(t / 450) + i) % 7 === 0) continue;
      rect(ctx, sx, sy, 1, 1, i % 4 ? '#e8ecff' : '#fff3c4');
    }
    for (var dy = -4; dy <= 4; dy++) {
      var hw = Math.round(Math.sqrt(16 - dy * dy));
      rect(ctx, 126 - hw, 9 + dy, hw * 2 + 1, 1, '#fff3c9');
    }
    rect(ctx, 124, 8, 2, 1, '#e6d9a8'); rect(ctx, 127, 11, 1, 1, '#e6d9a8');

    // Phra That Phanom is floodlit at night: a soft halo around its outline, then the stupa itself
    ctx.globalAlpha = 0.22;
    [[-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, -2]].forEach(function (o) {
      THAT.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) if (row[x] !== '.') rect(ctx, THAT_X + x + o[0], THAT_Y + y + o[1], 1, 1, '#f6c95a');
      });
    });
    ctx.globalAlpha = 0.9;
    THAT.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (row[x] !== '.') rect(ctx, THAT_X + x, THAT_Y + y, 1, 1, THAT_PAL[row[x]]);
    });
    ctx.globalAlpha = 1;

    var r = RIVER[view.season] || RIVER.cool;
    // little floating lights drifting downstream
    for (var k = 0; k < 7; k++) {
      var ly = 36 + Math.floor((k * 9.1 + tt / 160) % 60);
      var lx = riverEdge(ly, r.shift) + 2 + Math.floor(hash(k * 29 + 7) * (W - riverEdge(ly, r.shift) - 4));
      rect(ctx, lx, ly, 1, 1, (Math.floor(t / 300) + k) % 3 ? '#ffcf4a' : '#ff8a2a');
    }

    // the fire boat drifts down the river, its lights flickering and reflected in the water
    var by = 50 + Math.floor((tt / 1400) % 30), bx = riverEdge(by, r.shift) + 3;
    var top = by - FIRE_BOAT.length + 2, flick = Math.floor(t / 260) % 2;
    FIRE_BOAT.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch === '.') continue;
        var c = ch === 'k' ? '#1c140e' : ((ch === 'y') !== !!((x + y + flick) % 2) ? '#ffd65a' : '#ff8a2a');
        rect(ctx, bx + x, top + y, 1, 1, c);
      }
    });
    ctx.globalAlpha = 0.5;
    for (var c2 = 1; c2 < 14; c2 += 2) {
      var len = 3 + Math.floor(hash(c2 * 13 + Math.floor(t / 300)) * 4);
      for (var k = 0; k < len; k += 2) {
        var wob = reduceMotion ? 0 : Math.round(Math.sin(t / 250 + c2 + k) * 0.8);
        rect(ctx, bx + c2 + wob, top + FIRE_BOAT.length + k, 1, 1, c2 % 4 ? '#ffb347' : '#ffd65a');
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- sunrise and sunset ----------
     In Nakhon Phanom the sun comes up over the Lao mountains across the Mekong (right) and goes
     down behind the farm (left). Morning light is pink and soft; evening light is warm, the land
     falls into shade and Phra That Phanom keeps the last gold. */
  var SUN = {
    dawn: { x: 151, y: 16, colors: ['#fff6d8', '#ffc76a'], glow: '#ffd59a', clouds: ['#f7c6c6', '#d99aa8'] },
    dusk: { x: 61, y: 25, colors: ['#ffe2a0', '#ff8a3d'], glow: '#ff9a5a', clouds: ['#f0a08e', '#b86a7c'] },
  };

  function drawLight(ctx, t, view) {
    var tt = reduceMotion ? 0 : t, r = RIVER[view.season] || RIVER.cool;
    if (view.time === 'dawn') {
      ctx.globalAlpha = 0.12;
      rect(ctx, 0, 31, W, H - 31, '#ff9f8a');
      // mist on the river and the sun's path on the water
      ctx.globalAlpha = 0.35;
      rect(ctx, riverEdge(36, r.shift), 35, W, 2, '#ffe6d6');
      ctx.globalAlpha = 0.8;
      for (var y = 34; y < 64; y += 2) {
        var w = 1 + ((y + Math.floor(tt / 300)) % 3), x = SUN.dawn.x - Math.floor(w / 2) + Math.round(Math.sin(tt / 400 + y) * 1.2);
        if (x > riverEdge(y, r.shift)) rect(ctx, x, y, w, 1, y < 46 ? '#fff0c0' : '#ffc76a');
      }
      ctx.globalAlpha = 1;
    } else if (view.time === 'dusk') {
      ctx.globalAlpha = 0.3;
      rect(ctx, 0, 31, W, H - 31, '#50204a');
      ctx.globalAlpha = 0.6;
      THAT.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) if (row[x] !== '.') rect(ctx, THAT_X + x, THAT_Y + y, 1, 1, THAT_PAL[row[x]]);
      });
      ctx.globalAlpha = 1;
    }
  }

  function skyFor(view) {
    if (view.night) return SKY.night;
    if (SUN[view.time] && !view.weather) return SKY[view.time];
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
    var running = false, last = 0, tapHandler = null, thatHandler = null, thatAt = 0;

    function render(t) {
      var sky = skyFor(view);
      drawSky(ctx, sky);
      var stormy = view.weather === 'flood' || view.weather === 'rainLight' || view.weather === 'humid';
      var low = !view.weather && SUN[view.time]; // sunrise or sunset
      if (!view.night) {
        if (low) drawLowSun(ctx, low);
        else if (!stormy) drawSun(ctx, 112, 9, view.season === 'hot' || view.weather === 'drought');
        var drift = reduceMotion ? 0 : t / 260;
        drawCloud(ctx, ((drift + 20) % (W + 40)) - 30, 4, stormy, low && low.clouds);
        drawCloud(ctx, ((drift * 0.6 + 100) % (W + 40)) - 30, 12, stormy, low && low.clouds);
        if (view.weather === 'flood') drawCloud(ctx, ((drift * 0.8 + 60) % (W + 40)) - 30, 1, true);
      }
      drawMountains(ctx, low ? view.time : 'day');
      drawGround(ctx, view.season);
      drawThatPhanom(ctx, t, view, thatAt);
      drawRiver(ctx, t, view.season, view.night);
      drawSign(ctx);
      drawPalm(ctx, t);
      view.plots.forEach(function (p, i) { drawPlot(ctx, i, p || {}, t, view); });
      drawLife(ctx, t, view);
      drawWeather(ctx, view, t);
      if (low) drawLight(ctx, t, view);
      if (view.night) drawNight(ctx, t, view);
      else drawBirds(ctx, t, view);
      drawSparkles(ctx, view, t);
    }

    function loop(now) {
      if (!running) return;
      if (now - last >= FRAME_MS) { last = now; render(now); }
      requestAnimationFrame(loop);
    }

    canvas.addEventListener('click', function (e) {
      if (!tapHandler && !thatHandler) return;
      var b = canvas.getBoundingClientRect();
      var x = ((e.clientX - b.left) / b.width) * W, y = ((e.clientY - b.top) / b.height) * H;
      if (thatHandler && x >= THAT_X - 2 && x <= THAT_X + 15 && y >= THAT_Y - 4 && y <= THAT_Y + 29) {
        thatAt = performance.now();
        if (!running || reduceMotion) render(thatAt);
        thatHandler();
        return;
      }
      for (var i = 0; i < PLOT_RECTS.length; i++) {
        var r = PLOT_RECTS[i];
        if (tapHandler && x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) { tapHandler(i); return; }
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
      onThatPhanom: function (fn) { thatHandler = fn; },
    };
  }

  MF.createScene = createScene;
})(typeof window !== 'undefined' ? window : globalThis);
