/* The Magic Farmcare - share pictures: the result card players post to LINE or Facebook, and the
   link preview (img/og-image.png). They follow the Thanapun Farmcare corporate identity: white page,
   full-color logo, Kanit, the logo's green / gold / brown, rounded boxes, a field curve along the
   bottom and the standard contact footer. Only the game's own name, the That Phanom panorama and the
   title cover's floating plot (MF.coverFrame / MF.coverSky in cover.js) stay pixel art. */
(function (root) {
  var MF = (root.MF = root.MF || {});
  var S = MF.sprites;

  var C = {
    charcoal: '#4D4D4D', green: '#9BC53D', greenDark: '#5E8A1F', gold: '#D9B44A', brown: '#AA7F4C', sky: '#9AD4EC',
    greenTint: '#EEF6DD', skyTint: '#EAF6FB', goldTint: '#FBF3DC', bg: '#FFFFFF', muted: '#7A7A7A', border: '#E3E3E3',
  };
  var KANIT = '"Kanit", "Sarabun", "Leelawadee UI", Tahoma, sans-serif';
  var PIXEL = '"Pixelify Sans", ' + KANIT;
  var TAGLINE = 'เคียงข้างทุกการเติบโต';
  // the short contact line from the CI; numbers and names exactly as the company writes them
  var CONTACT = [['phone', 'โทร 042-532096'], ['chat', 'LINE @thanapun'], ['facebook', 'FB: Thanapun Farmcare']];
  // Lucide line icons (24 x 24, 2 px stroke)
  var ICONS = {
    phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    chat: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
    facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
    pin: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
  };

  function fontsReady() {
    if (!root.document || !document.fonts || !document.fonts.load) return Promise.resolve();
    var loads = ['300 40px "Kanit"', '400 40px "Kanit"', '500 40px "Kanit"', '600 40px "Kanit"', '700 40px "Kanit"', '700 40px "Pixelify Sans"'].map(function (f) {
      return document.fonts.load(f, 'กขค 0123');
    });
    var timeout = new Promise(function (r) { setTimeout(r, 2000); });
    return Promise.race([Promise.all(loads).catch(function () {}), timeout]);
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    return { canvas: c, ctx: ctx };
  }

  /* Safari (WebKit) ignores textAlign right and center for some Thai strings and draws them from x as
     if left-aligned, so the text is always drawn left-aligned from a start point worked out here from
     its measured width. Every piece of text on the share pictures goes through this. */
  function text(ctx, str, x, y, font, color, align) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    var a = align || 'center';
    var w = a === 'left' ? 0 : ctx.measureText(str).width;
    ctx.fillText(str, a === 'right' ? x - w : a === 'center' ? x - w / 2 : x, y);
  }

  function roundRect(ctx, x, y, w, h, r, keepPath) {
    if (!keepPath) ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function sprite(ctx, name, x, y, scale, over) {
    var c = S.canvas(name, over);
    ctx.drawImage(c, x, y, c.width * scale, c.height * scale);
  }

  // the full-color logo; when the game is opened as a local file that image would block saving the
  // picture, so the pixel emblem stands in
  function logo(ctx, x, y, w, onDark) {
    var img = document.getElementById(onDark ? 'brand-img' : 'brand-img-color');
    if (img && img.complete && img.naturalWidth && !/^file:/.test(img.src)) {
      var h = Math.round((w * img.naturalHeight) / img.naturalWidth);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, x, y, w, h);
      ctx.imageSmoothingEnabled = false;
      return h;
    }
    var e = S.canvas('brand'), scale = Math.floor(w / e.width);
    sprite(ctx, 'brand', x + (w - e.width * scale) / 2, y, scale);
    return e.height * scale;
  }

  // layered fields from the logo: green, gold and brown curves along the bottom edge
  function fieldCurve(ctx, W, H, depth) {
    [[C.green, 0, 1], [C.gold, 0.32, 0.62], [C.brown, 0.6, 0.3]].forEach(function (f) {
      var top = H - depth * f[2];
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, top + depth * 0.25);
      ctx.bezierCurveTo(W * (0.25 + f[1] * 0.2), top - depth * 0.25, W * (0.55 + f[1] * 0.2), top + depth * 0.45, W, top);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = f[0];
      ctx.fill();
    });
  }

  // "โทร … | LINE … | FB: …" with a line icon before each, centered or left-aligned at x
  function contactLine(ctx, x, y, size, align, color) {
    var ink = color || C.charcoal;
    var font = '400 ' + size + 'px ' + KANIT, icon = Math.round(size * 0.9), gap = Math.round(size * 0.3), sep = '   |   ';
    ctx.font = font;
    var parts = CONTACT.map(function (c) { return { icon: c[0], label: c[1], w: icon + gap + ctx.measureText(c[1]).width }; });
    var sepW = ctx.measureText(sep).width;
    var total = parts.reduce(function (s, p) { return s + p.w; }, 0) + sepW * (parts.length - 1);
    var cx = align === 'left' ? x : x - total / 2;
    parts.forEach(function (p, i) {
      ctx.save();
      ctx.translate(cx, y - icon * 0.82);
      ctx.scale(icon / 24, icon / 24);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(new Path2D(ICONS[p.icon]));
      ctx.restore();
      text(ctx, p.label, cx + icon + gap, y, font, ink, 'left');
      cx += p.w;
      if (i < parts.length - 1) { text(ctx, sep, cx, y, font, C.muted, 'left'); cx += sepW; }
    });
  }

  /* ---------- LINE QR ----------
     The shop's official LINE QR (img/line-qr.png) goes on the card. Where that image would block saving
     the picture (the game opened as a local file), a plain QR of the same link is drawn instead by the
     small encoder below: byte mode, error correction M, versions 1-10, best of the 8 masks. It follows
     the QR standard (ISO/IEC 18004) as laid out in Project Nayuki's MIT-licensed QR Code generator. */
  var QR_ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // error correction codewords per block, level M
  var QR_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  // the official image: 540 px with the code from 27 to 512
  var QR_IMG = { size: 540, from: 27, to: 512 };

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z;
  }

  function rsRemainder(data, degree) {
    var div = [], root = 1, i, j;
    for (i = 0; i < degree; i++) div.push(0);
    div[degree - 1] = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < degree; j++) { div[j] = gfMul(div[j], root); if (j + 1 < degree) div[j] ^= div[j + 1]; }
      root = gfMul(root, 2);
    }
    var out = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ out.shift();
      out.push(0);
      div.forEach(function (c, k) { out[k] ^= gfMul(c, f); });
    });
    return out;
  }

  function qrRawModules(v) {
    var n = (16 * v + 128) * v + 64;
    if (v >= 2) { var a = Math.floor(v / 7) + 2; n -= (25 * a - 10) * a - 55; if (v >= 7) n -= 36; }
    return n;
  }

  // true = dark, as rows of booleans
  function qrMatrix(str) {
    var bytes = unescape(encodeURIComponent(str)).split('').map(function (c) { return c.charCodeAt(0); });
    var v = 1;
    while (v <= 10 && Math.floor(qrRawModules(v) / 8) - QR_ECC[v] * QR_BLOCKS[v] < bytes.length + (v < 10 ? 2 : 3)) v++;
    if (v > 10) throw new Error('QR text too long');
    var size = v * 4 + 17, raw = Math.floor(qrRawModules(v) / 8), dataLen = raw - QR_ECC[v] * QR_BLOCKS[v];

    // data codewords: mode, length, bytes, terminator, padding
    var bits = [];
    var put = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, dataLen * 8 - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (var pad = 0xec; bits.length < dataLen * 8; pad ^= 0xec ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

    // split into blocks, add error correction, interleave
    var nb = QR_BLOCKS[v], ecc = QR_ECC[v], nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), blocks = [], k = 0;
    for (i = 0; i < nb; i++) {
      var d = data.slice(k, k + shortLen - ecc + (i < nShort ? 0 : 1));
      k += d.length;
      var e = rsRemainder(d, ecc);
      if (i < nShort) d.push(0);
      blocks.push(d.concat(e));
    }
    var words = [];
    for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (b, j) { if (i !== shortLen - ecc || j >= nShort) words.push(b[i]); });

    var m = [], fn = [];
    for (i = 0; i < size; i++) { m.push([]); fn.push([]); for (k = 0; k < size; k++) { m[i].push(false); fn[i].push(false); } }
    var set = function (x, y, dark) { m[y][x] = dark; fn[y][x] = true; };
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy)), x = c[0] + dx, y = c[1] + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    });
    var align = [];
    if (v > 1) {
      var na = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2;
      align = [6];
      for (var pos = size - 7; align.length < na; pos -= step) align.splice(1, 0, pos);
    }
    align.forEach(function (ax, ai) {
      align.forEach(function (ay, aj) {
        var last = align.length - 1;
        if ((ai === 0 && aj === 0) || (ai === 0 && aj === last) || (ai === last && aj === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    var bit = function (x, n) { return ((x >>> n) & 1) !== 0; };
    var format = function (mask) {
      var d = mask, r = d; // level M is 00
      for (var j = 0; j < 10; j++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var b = ((d << 10) | r) ^ 0x5412, q;
      for (q = 0; q <= 5; q++) set(8, q, bit(b, q));
      set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
      for (q = 9; q < 15; q++) set(14 - q, 8, bit(b, q));
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, bit(b, q));
      for (q = 8; q < 15; q++) set(8, size - 15 + q, bit(b, q));
      set(8, size - 8, true);
    };
    format(0);
    if (v >= 7) {
      var r = v;
      for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      var vb = (v << 12) | r;
      for (i = 0; i < 18; i++) { var a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit(vb, i)); set(b, a, bit(vb, i)); }
    }
    // codewords zigzag up and down two columns at a time
    var n = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && n < words.length * 8) { m[y][x] = bit(words[n >>> 3], 7 - (n & 7)); n++; }
      }
    }

    var MASKS = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; },
      function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return ((x * y) % 2) + ((x * y) % 3) === 0; },
      function (x, y) { return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; }, function (x, y) { return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; },
    ];
    var flip = function (mask) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
    };
    var best = 0, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      flip(mask); format(mask);
      var sc = qrPenalty(m);
      if (sc < bestScore) { bestScore = sc; best = mask; }
      flip(mask); // flipping again undoes it
    }
    flip(best); format(best);
    return m;
  }

  // the standard's mask penalty: long runs, 2x2 blocks, finder-like patterns, dark/light balance
  function qrPenalty(m) {
    var size = m.length, score = 0, dark = 0, x, y;
    var lines = [];
    for (y = 0; y < size; y++) { lines.push(m[y]); lines.push(m.map(function (row) { return row[y]; })); }
    lines.forEach(function (line) {
      var run = 1;
      for (var i = 1; i <= size; i++) {
        if (i < size && line[i] === line[i - 1]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      var s = line.map(function (b) { return b ? '1' : '0'; }).join('');
      score += 40 * ((s.match(/(?=10111010000)/g) || []).length + (s.match(/(?=00001011101)/g) || []).length);
    });
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      if (m[y][x]) dark++;
      if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
    var total = size * size;
    return score + 10 * (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1);
  }

  /* the LINE QR on a white rounded tile w wide, black on white with at least a 4-module quiet zone and
     the caption below; returns the tile's height */
  function lineQr(ctx, x, y, w, t) {
    var c = MF.CONFIG.contact || {};
    var img = document.getElementById('line-qr-img');
    var official = img && img.complete && img.naturalWidth && !/^file:/.test(img.src);
    var matrix = official ? null : qrMatrix(c.lineQr || c.line);
    var mods = official ? 29 : matrix.length;
    // whole pixels per module for the drawn code, so its edges stay sharp
    var cell = official ? w / (mods + 8) : Math.floor(w / (mods + 8)), code = cell * mods, quiet = (w - code) / 2;
    var capH = 28, h = w + capH;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = t.dark ? 'rgba(217,180,74,0.7)' : C.border; ctx.stroke();
    var qx = Math.round(x + quiet), qy = Math.round(y + quiet);
    if (official) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, QR_IMG.from, QR_IMG.from, QR_IMG.to - QR_IMG.from, QR_IMG.to - QR_IMG.from, qx, qy, code, code);
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.fillStyle = '#000000';
      matrix.forEach(function (row, j) {
        row.forEach(function (on, i) { if (on) ctx.fillRect(qx + i * cell, qy + j * cell, cell, cell); });
      });
    }
    text(ctx, 'ทักแชทลุงพันธ์', x + w / 2, y + h - 16, '600 19px ' + KANIT, C.charcoal);
    return h;
  }

  function host() { return MF.CONFIG.shareUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''); }

  /* ---------- rank card ----------
     Each rank gets its own look, like a collectible card: the higher the rank, the richer the metal,
     the bigger the burst of light, and the more trimmings (laurel, crown, sparkles). Colors come from
     the CI palette; the gold card sits on the CI's dark background. */
  var METAL = {
    gold: ['#FFF1BF', '#D9B44A', '#9C7420'],
    silver: ['#FFFFFF', '#BAC4CC', '#77838C'],
    bronze: ['#F6CFA6', '#B97A45', '#6F4321'],
    green: ['#E2F1B8', '#9BC53D', '#5E8A1F'],
    gray: ['#EDEDED', '#A6A6A6', '#6A6A6A'],
  };
  var TIERS = {
    // bg[1] is the lower card; glow is how much light sits behind the emblem
    3: { metal: 'gold', bg: ['#3A3A3A', '#232323'], ink: '#FFFFFF', soft: '#D9D9D9', glow: 0.22, leaf: '#D9B44A', laurel: true, crown: true, sparkles: 10, label: 'ระดับตำนาน', dark: true },
    2: { metal: 'silver', bg: ['#F4FAFD', '#DCEFF8'], ink: C.charcoal, soft: '#5F6B73', glow: 0.45, leaf: '#5E8A1F', laurel: true, sparkles: 5, label: 'ระดับมืออาชีพ' },
    1: { metal: 'bronze', bg: ['#FFFAEE', '#F6E6C6'], ink: C.charcoal, soft: '#7A6A55', glow: 0.3, leaf: '#AA7F4C', laurel: false, sparkles: 2, label: 'ระดับเริ่มเก่ง' },
    0: { metal: 'green', bg: ['#F7FBEF', '#E4F1CC'], ink: C.charcoal, soft: '#5E6B4E', glow: 0.25, leaf: '#9BC53D', laurel: false, sparkles: 0, label: 'ระดับเริ่มต้น' },
    bankrupt: { metal: 'gray', bg: ['#F5F5F5', '#E2E2E2'], ink: C.charcoal, soft: '#6E6E6E', glow: 0.2, leaf: '#9E9E9E', laurel: false, sparkles: 0, label: 'ปีหน้าเอาใหม่' },
  };

  function metalGradient(ctx, x0, y0, x1, y1, m) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1), c = METAL[m];
    g.addColorStop(0, c[0]); g.addColorStop(0.45, c[1]); g.addColorStop(1, c[2]);
    return g;
  }

  function shieldPath(ctx, cx, top, w, h) {
    var x = cx - w / 2, r = w * 0.16;
    ctx.beginPath();
    ctx.moveTo(x + r, top);
    ctx.lineTo(x + w - r, top);
    ctx.quadraticCurveTo(x + w, top, x + w, top + r);
    ctx.lineTo(x + w, top + h * 0.5);
    ctx.bezierCurveTo(x + w, top + h * 0.78, cx + w * 0.18, top + h * 0.9, cx, top + h);
    ctx.bezierCurveTo(cx - w * 0.18, top + h * 0.9, x, top + h * 0.78, x, top + h * 0.5);
    ctx.lineTo(x, top + r);
    ctx.quadraticCurveTo(x, top, x + r, top);
    ctx.closePath();
  }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // soft light behind the emblem so it stands out from the panorama; brighter for higher ranks
  function glow(ctx, cx, cy, radius, t) {
    var g = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
    g.addColorStop(0, t.dark ? 'rgba(255,214,110,0.55)' : 'rgba(255,255,255,' + (0.5 + t.glow) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // a pointed leaf from (x, y) pointing along angle a
  function leaf(ctx, x, y, a, len, wid) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  // two laurel branches rising from below the emblem, with paired leaves along each stem
  function laurel(ctx, cx, cy, radius, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    [1, -1].forEach(function (side) {
      var at = function (u) { return Math.PI / 2 + side * (0.4 + 2.15 * u); };
      ctx.beginPath();
      for (var j = 0; j <= 24; j++) {
        var b = at(j / 24), px = cx + Math.cos(b) * radius, py = cy + Math.sin(b) * radius;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      for (var i = 0; i < 8; i++) {
        var u = (i + 0.6) / 8.6, a = at(u), x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
        var along = Math.atan2(side * Math.cos(a), -side * Math.sin(a)); // the way the stem grows
        var len = 46 - i * 2.5, wid = 15 - i * 0.8;
        leaf(ctx, x, y, along - 0.75, len, wid);
        leaf(ctx, x, y, along + 0.75, len * 0.85, wid * 0.85);
      }
      leaf(ctx, cx + Math.cos(at(1)) * radius, cy + Math.sin(at(1)) * radius, Math.atan2(side * Math.cos(at(1)), -side * Math.sin(at(1))), 34, 12);
    });
  }

  /* ---------- That Phanom panorama behind the emblem ----------
     A pixel view from the Thai bank: Phra That Phanom, the Thanapun Farmcare signboard, the Mekong
     and the Lao mountains. The time of day follows the rank: a morning mist for a first try, sunrise,
     bright day, and the Ok Phansa night with a fire boat for the top rank. */
  var PW = 120, PH = 85, PS = 9; // drawn small, scaled up 9x; fills the card down to the emblem's ribbon
  var HORIZON = 57, BANK = 71;
  var THAT_BIG = [
    '.........y.........', '.........y.........', '.........y.........', '.........y.........',
    '........yyY........', '........yyY........', '........yyY........', '.......yyyYY.......',
    '........wwW........', '........wwW........', '........wyW........', '.......wwwWW.......',
    '.......wwyWW.......', '.......wwwWW.......', '......wwwwWWW......', '......wwwyWWW......',
    '......yyyyYYY......', '......wwwwWWW......', '.......wwwWW.......', '.......wwwWW.......',
    '......yyyyYYY......', '.....yyyyyYYYY.....', '.....wwwwwWWWW.....', '.....wwyyyyyWW.....',
    '.....wwyYYYyWW.....', '.....wwyYYYyWW.....', '.....wwyYYYyWW.....', '.....wwwwwwWWW.....',
    '.....wwwwwwWWW.....', '....yyyyyyyYYYY....', '....wwwwwwwWWWW....', '....wywywywywYW....',
    '....wwwwwwwWWWW....', '...yyyyyyyyyYYYY...', '...wwwwwwwwwWWWW...', '...wwywwywwywWWW...',
    '...wwwwwwwwwWWWW...', '..yyyyyyyyyyyYYYY..', '..wwwwwwwwwwwWWWW..', '.wwwwwwwwwwwwWWWWW.',
    'yyyyyyyyyyyyyYYYYYY', 'wwwwwwwwwwwwwWWWWWW',
  ];
  var BOAT_LIGHTS = ['.......y.......', '......y.y......', '.....y...y.....', '....y.....y....', '....yyyyyyy....',
    '...y.......y...', '...y..yyy..y...', '..yyyyyyyyyyy..', '..y.........y..', '.yyyyyyyyyyyyy.', 'kkkkkkkkkkkkkkk'];
  var FAR = [[8, 4, 12], [27, 6, 16], [48, 4, 11], [69, 5, 15], [92, 6, 13], [113, 4, 16]];
  var NEAR = [[18, 4, 8], [40, 5, 10], [60, 3, 7], [82, 5, 9], [104, 4, 8]];
  var PANO = {
    3: { sky: ['#11173a', '#1a2150', '#262c62', '#3a3670', '#56427a'], far: '#3a3f6e', near: '#2b2e57', trees: '#1b2630', water: '#18264a', light: '#ffcf6a', bank: '#1f2c35', night: true },
    2: { sky: ['#4fa6e6', '#68b6ee', '#82c5f2', '#a0d4f5', '#c2e4f8'], far: '#93a0c6', near: '#6f80ab', trees: '#3f6b4f', water: '#5b93a6', light: '#c9eaf2', bank: '#5aa846', sun: [100, 36, 5, '#fff1a8', '#ffd84a'], clouds: true },
    1: { sky: ['#5d5f9e', '#9b78b0', '#e597a8', '#f8b98f', '#ffdca0'], far: '#a991bd', near: '#7a6aa2', trees: '#3e5a55', water: '#8f8fb4', light: '#ffd59a', bank: '#6a9f48', sun: [97, 46, 7, '#fff6d8', '#ffb35a'], path: true },
    0: { sky: ['#b9dfe4', '#c9e7e3', '#d9eee0', '#e7f3da', '#f2f7da'], far: '#a8c3c8', near: '#86a8ae', trees: '#4f7a5a', water: '#86b8c2', light: '#eef8f5', bank: '#78bb58', sun: [86, 40, 4, '#fffbe6', '#fff0b8'], mist: true },
    bankrupt: { sky: ['#7f868c', '#8d9399', '#9ba1a6', '#a9aeb2', '#b7bbbe'], far: '#9aa0a5', near: '#83898f', trees: '#56635b', water: '#78838a', light: '#c3cacd', bank: '#71865f', rain: true },
  };
  var THAT_DAY = { w: '#f6f2e4', W: '#cdc5ad', y: '#ecbb32', Y: '#b8861c' };
  var THAT_NIGHT = { w: '#e9dcc0', W: '#b9a57e', y: '#ffd04a', Y: '#d79a1e' };

  function peak(list, x) {
    var best = 0;
    list.forEach(function (p) {
      var dx = Math.abs(x - p[0]), v = dx <= p[1] ? p[2] - Math.round((dx / p[1]) * (dx / p[1]) * 2) : p[2] - 2 - (dx - p[1]) * 3;
      if (v > best) best = v;
    });
    return best;
  }

  function px(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }

  function rows(c, art, x, y, pal) {
    art.forEach(function (row, j) {
      for (var i = 0; i < row.length; i++) if (row[i] !== '.') px(c, x + i, y + j, 1, 1, pal[row[i]]);
    });
  }

  function panorama(tier) {
    var p = PANO[tier], cv = document.createElement('canvas');
    cv.width = PW; cv.height = PH;
    var c = cv.getContext('2d'), horizon = HORIZON, bankTop = BANK;
    // sky in dithered bands
    p.sky.forEach(function (col, i) {
      var top = Math.round((i / p.sky.length) * horizon), bottom = Math.round(((i + 1) / p.sky.length) * horizon);
      px(c, 0, top, PW, bottom - top, col);
      if (i) for (var x = top % 2; x < PW; x += 2) px(c, x, top, 1, 1, p.sky[i - 1]);
    });
    if (p.night) {
      for (var s = 0; s < 48; s++) px(c, Math.floor(hash(s * 7 + 3) * PW), Math.floor(hash(s * 11 + 1) * 44), 1, 1, s % 4 ? '#e8ecff' : '#fff3c4');
      for (var dy = -4; dy <= 4; dy++) { var hw = Math.round(Math.sqrt(16 - dy * dy)); px(c, 100 - hw, 34 + dy, hw * 2 + 1, 1, '#fff3c9'); }
    }
    if (p.sun) {
      var su = p.sun;
      for (var sy = -su[2]; sy <= su[2]; sy++) { var sw = Math.round(Math.sqrt(su[2] * su[2] - sy * sy)); px(c, su[0] - sw, su[1] + sy, sw * 2 + 1, 1, sy < -su[2] / 2 ? su[3] : su[4]); }
    }
    if (p.clouds) {
      [[26, 32], [64, 40]].forEach(function (cl) {
        px(c, cl[0] + 3, cl[1], 6, 1, '#ffffff'); px(c, cl[0] + 1, cl[1] + 1, 11, 1, '#ffffff');
        px(c, cl[0], cl[1] + 2, 14, 1, '#ffffff'); px(c, cl[0] + 1, cl[1] + 3, 12, 1, '#dfeaf0');
      });
    }
    if (p.rain) { px(c, 6, 32, 30, 4, '#6f767c'); px(c, 10, 30, 18, 2, '#6f767c'); px(c, 70, 34, 34, 4, '#6f767c'); px(c, 76, 32, 20, 2, '#6f767c'); }
    // Lao mountains and the far bank
    for (var x2 = 0; x2 < PW; x2++) {
      var f = peak(FAR, x2), n = peak(NEAR, x2);
      if (f > 0) px(c, x2, horizon - f, 1, f, p.far);
      if (n > 0) px(c, x2, horizon - n, 1, n, p.near);
      var tr = 1 + Math.round(Math.sin(x2 / 2.3) + 0.6);
      px(c, x2, horizon - tr, 1, tr, p.trees);
    }
    // the Mekong
    px(c, 0, horizon, PW, bankTop - horizon, p.water);
    for (var r = 0; r < 26; r++) {
      var rx = Math.floor(hash(r * 5 + 2) * (PW - 4)), ry = horizon + 1 + Math.floor(hash(r * 13 + 7) * (bankTop - horizon - 2));
      px(c, rx, ry, 2 + (r % 3), 1, p.light);
    }
    if (p.path) for (var gy = horizon + 1; gy < bankTop; gy += 2) px(c, p.sun[0] - 2 + (gy % 3), gy, 3 + (gy % 2), 1, '#ffe2a8');
    if (p.mist) { c.globalAlpha = 0.6; px(c, 0, horizon - 1, PW, 3, '#ffffff'); c.globalAlpha = 1; }
    if (p.night) {
      // Lai Ruea Fai: the fire boat and little floating lights
      rows(c, BOAT_LIGHTS, 84, bankTop - BOAT_LIGHTS.length - 1, { y: '#ffd65a', k: '#120c08' });
      for (var b = 1; b < 14; b += 2) px(c, 84 + b, bankTop - 1, 1, 1, '#ffb347');
      for (var l = 0; l < 10; l++) px(c, 4 + Math.floor(hash(l * 31) * 110), horizon + 2 + Math.floor(hash(l * 17) * 10), 1, 1, l % 2 ? '#ffcf4a' : '#ff8a2a');
    } else {
      var by = horizon + 8;
      px(c, 84, by, 11, 2, '#5a3a22'); px(c, 85, by - 1, 9, 1, '#8a5530'); px(c, 88, by - 3, 1, 2, '#2f4f8a'); px(c, 87, by - 4, 3, 1, '#f0c43c');
    }
    // the Thai bank, with riverside lamps
    px(c, 0, bankTop, PW, PH - bankTop, p.bank);
    px(c, 0, bankTop, PW, 1, p.night ? '#3a4a52' : '#e9e2c8');
    [30, 46, 74, 96].forEach(function (lx) {
      px(c, lx, bankTop - 5, 1, 6, p.night ? '#4a565c' : '#6f7a80');
      px(c, lx - 1, bankTop - 6, 3, 1, p.night ? '#ffe08a' : '#9aa3a8');
    });
    if (p.rain) { c.globalAlpha = 0.5; for (var d = 0; d < 60; d++) px(c, Math.floor(hash(d * 3) * PW), Math.floor(hash(d * 9) * PH), 1, 2, '#e3e8ea'); c.globalAlpha = 1; }
    // Phra That Phanom on the left, floodlit at night, with temple trees
    px(c, 0, bankTop - 6, 26, 7, p.night ? '#1d2a2e' : p.trees);
    rows(c, THAT_BIG, 4, bankTop - THAT_BIG.length + 2, p.night ? THAT_NIGHT : THAT_DAY);
    // the Thanapun Farmcare signboard on the bank, right side
    px(c, 108, bankTop - 4, 2, 12, '#55321c');
    px(c, 101, bankTop - 18, 16, 16, '#3b2a20');
    px(c, 102, bankTop - 17, 14, 14, '#f4ecd2');
    S.draw(c, 'brandSmall', 103, bankTop - 16);
    return cv;
  }

  // cheap deterministic hash for scattered pixels
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }

  // sparkle spots around the emblem, kept clear of the ribbon and the stars
  var SPARKLES = [[-250, -190], [235, -230], [-335, -40], [312, -112], [-170, -250], [150, -255], [-345, 58], [338, 40], [-75, -262], [272, -8]];

  function crown(ctx, cx, bottom, w, m) {
    var h = w * 0.5, x = cx - w / 2;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, bottom - h * 0.55);
    ctx.lineTo(x + w * 0.25, bottom - h * 0.25);
    ctx.lineTo(cx, bottom - h);
    ctx.lineTo(x + w * 0.75, bottom - h * 0.25);
    ctx.lineTo(x + w, bottom - h * 0.55);
    ctx.lineTo(x + w, bottom);
    ctx.closePath();
    ctx.fillStyle = metalGradient(ctx, x, bottom - h, x + w, bottom, m);
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = METAL[m][2]; ctx.stroke();
    [[x, bottom - h * 0.55], [cx, bottom - h], [x + w, bottom - h * 0.55]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = METAL[m][2]; ctx.stroke();
    });
  }

  function sparkle(ctx, x, y, s, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // the rank name on a ribbon across the bottom of the emblem
  function ribbon(ctx, cx, y, w, h, t, label) {
    var dark = METAL[t.metal][2];
    [-1, 1].forEach(function (side) {
      var ex = cx + side * (w / 2 + 50), ix = cx + side * (w / 2 - 20);
      ctx.beginPath();
      ctx.moveTo(ix, y + 18);
      ctx.lineTo(ex, y + 18);
      ctx.lineTo(ex - side * 30, y + 18 + h / 2);
      ctx.lineTo(ex, y + 18 + h);
      ctx.lineTo(ix, y + 18 + h);
      ctx.closePath();
      ctx.fillStyle = dark;
      ctx.fill();
    });
    // light metals carry charcoal lettering, darker ones white (bold and large, as the CI allows)
    var c = METAL[t.metal], light = t.metal === 'gold' || t.metal === 'silver' || t.metal === 'gray';
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, light ? c[0] : c[1]); g.addColorStop(1, light ? c[1] : c[2]);
    roundRect(ctx, cx - w / 2, y, w, h, 12);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = dark; ctx.stroke();
    text(ctx, label, cx, y + h * 0.68, '700 52px ' + KANIT, light ? '#2F2F2F' : '#FFFFFF');
  }

  function emblem(ctx, cx, cy, r, t) {
    var w = 300, h = 340, top = cy - h / 2 - 20;
    if (t.laurel) laurel(ctx, cx, cy - 10, 215, t.leaf);
    // drop shadow, metal rim, darker inner field
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    shieldPath(ctx, cx, top, w, h);
    ctx.fillStyle = metalGradient(ctx, cx - w / 2, top, cx + w / 2, top + h, t.metal);
    ctx.fill();
    ctx.restore();
    shieldPath(ctx, cx, top + 20, w - 40, h - 46);
    ctx.fillStyle = METAL[t.metal][2];
    ctx.fill();
    shieldPath(ctx, cx, top + 28, w - 56, h - 62);
    var inner = ctx.createLinearGradient(0, top, 0, top + h);
    inner.addColorStop(0, t.dark ? '#4A4A4A' : '#FFFFFF');
    inner.addColorStop(1, t.dark ? '#2B2B2B' : C.skyTint);
    ctx.fillStyle = inner;
    ctx.fill();
    // the icon: a trophy for the top rank, otherwise the crop the player grew most
    var icon = r.icon, c = S.canvas(icon.name, icon.over), scale = Math.floor(Math.min(190 / c.width, 200 / c.height));
    sprite(ctx, icon.name, cx - (c.width * scale) / 2, top + 40 + (220 - c.height * scale) / 2, scale, icon.over);
    if (t.crown) crown(ctx, cx, top + 6, 150, t.metal);
  }

  function statTile(ctx, x, y, w, h, t, icon, value, label) {
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = t.dark ? 'rgba(217,180,74,0.5)' : C.border; ctx.stroke();
    if (icon) {
      var c = S.canvas(icon.name, icon.over), s = Math.floor(52 / c.height);
      sprite(ctx, icon.name, x + 22, y + (h - c.height * s) / 2, s, icon.over);
    }
    var tx = x + (icon ? 80 : 24);
    text(ctx, value, tx, y + Math.round(h * 0.5), '600 32px ' + KANIT, t.ink, 'left');
    text(ctx, label, tx, y + Math.round(h * 0.82), '300 22px ' + KANIT, t.soft, 'left');
  }

  /* Rank card, 1080 x 1350 (4:5 for LINE and Facebook feeds).
     r: { tier (0-3 or 'bankrupt'), rank, stars, money, profit, totalKg, correct, treated, icon, cropIcon } */
  function resultCard(r) {
    return fontsReady().then(function () {
      var W = 1080, H = 1350, k = makeCanvas(W, H), ctx = k.ctx, t = TIERS[r.tier];
      var HEAD = 236, PANO_H = PH * PS;
      ctx.fillStyle = t.bg[1];
      ctx.fillRect(0, 0, W, H);

      // That Phanom from the top of the card down to the ribbon, fading into the card below;
      // the stupa is floodlit at night
      ctx.drawImage(panorama(r.tier), 0, 0, PW * PS, PANO_H);
      if (PANO[r.tier].night) {
        var halo = ctx.createRadialGradient(122, 468, 10, 122, 468, 230);
        halo.addColorStop(0, 'rgba(255,208,90,0.42)');
        halo.addColorStop(1, 'rgba(255,208,90,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 200, 360, 500);
      }
      var fade = ctx.createLinearGradient(0, PANO_H - 120, 0, PANO_H);
      fade.addColorStop(0, hexA(t.bg[1], 0)); fade.addColorStop(1, hexA(t.bg[1], 1));
      ctx.fillStyle = fade;
      ctx.fillRect(0, PANO_H - 120, W, 121);

      // header: the logo straight on the sky, darkened toward the top so the full-color logo with a
      // white wordmark (the CI's version for dark backgrounds) and the titles read clearly
      var shade = ctx.createLinearGradient(0, 0, 0, HEAD + 120);
      shade.addColorStop(0, 'rgba(47,47,47,0.82)');
      shade.addColorStop(0.55, 'rgba(47,47,47,0.55)');
      shade.addColorStop(1, 'rgba(47,47,47,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, HEAD + 120);
      logo(ctx, 64, 34, 180, true);
      text(ctx, 'The Magic Farmcare', W - 66, 98, '700 50px ' + PIXEL, C.gold, 'right');
      text(ctx, 'การ์ดผลงานประจำปี · ' + t.label, W - 66, 142, '300 26px ' + KANIT, '#E6E6E6', 'right');
      ctx.font = '500 28px ' + KANIT;
      var home = 'ต้นตำรับจาก อ.ธาตุพนม จ.นครพนม', hw = ctx.measureText(home).width;
      text(ctx, home, W - 66, 192, '500 28px ' + KANIT, '#FFFFFF', 'right');
      ctx.save();
      ctx.translate(W - 66 - hw - 34, 166);
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(ICONS.pin));
      ctx.beginPath(); ctx.arc(12, 10, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // the logo's fields along the bottom, inside a metal border like a trading card
      ctx.save();
      roundRect(ctx, 26, 26, W - 52, H - 52, 34);
      ctx.clip();
      fieldCurve(ctx, W, H - 26, 40);
      ctx.restore();
      roundRect(ctx, 26, 26, W - 52, H - 52, 34);
      ctx.lineWidth = 10;
      ctx.strokeStyle = metalGradient(ctx, 0, 0, W, H, t.metal);
      ctx.stroke();
      // keep the corners outside the border clean
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      roundRect(ctx, 21, 21, W - 42, H - 42, 39, true);
      ctx.fillStyle = t.dark ? '#1b1b1b' : '#ffffff';
      ctx.fill('evenodd');
      ctx.restore();

      var cx = W / 2, cy = 520;
      glow(ctx, cx, cy - 20, 330, t);
      emblem(ctx, cx, cy, r, t);
      SPARKLES.slice(0, t.sparkles).forEach(function (p, i) {
        if (cy + p[1] > HEAD + 34) sparkle(ctx, cx + p[0], cy + p[1], 14 + (i % 3) * 8, t.dark ? '#FFF1BF' : '#FFFFFF');
      });
      ribbon(ctx, cx, cy + 100, 620, 92, t, r.rank);

      // stars and money
      if (r.tier !== 'bankrupt') {
        for (var s = 0; s < 3; s++) sprite(ctx, s < r.stars ? 'star' : 'starOff', cx - 145 + s * 105, 728, 9);
      } else {
        text(ctx, 'เงินทุนหมดก่อนครบปี', cx, 784, '500 36px ' + KANIT, t.soft);
      }
      text(ctx, 'เงินสุดท้าย', cx, 846, '300 28px ' + KANIT, t.soft);
      ctx.font = '700 120px ' + KANIT;
      var amount = r.money.toLocaleString('en-US'), aw = ctx.measureText(amount).width;
      ctx.font = '400 40px ' + KANIT;
      var bw = ctx.measureText(' บาท').width, ax = cx - (aw + bw) / 2;
      text(ctx, amount, ax, 944, '700 120px ' + KANIT, t.dark ? C.gold : t.ink, 'left');
      text(ctx, ' บาท', ax + aw, 944, '400 40px ' + KANIT, t.soft, 'left');

      // three stats from this player's year
      var tw = 290, gap = 25, tx0 = (W - tw * 3 - gap * 2) / 2, ty = 962, th = 90;
      statTile(ctx, tx0, ty, tw, th, t, r.cropIcon, r.totalKg.toLocaleString('en-US') + ' กก.', 'ผลผลิตทั้งปี');
      statTile(ctx, tx0 + tw + gap, ty, tw, th, t, { name: 'bottle', over: { x: '#2f74c9' } }, r.correct + '/' + r.treated + ' ครั้ง', 'เลือกยาถูก');
      statTile(ctx, tx0 + (tw + gap) * 2, ty, tw, th, t, { name: 'coin' }, (r.profit >= 0 ? '+' : '') + r.profit.toLocaleString('en-US'), 'กำไรทั้งปี (บาท)');

      // footer from the CI on the left, the shop's LINE QR on the right, both lined up with the stat tiles
      var qw = 200, qx = W - tx0 - qw, qy = 1060;
      var qh = lineQr(ctx, qx, qy, qw, t), mid = qy + qh / 2;
      text(ctx, 'มาแข่งกัน เล่นฟรีที่ ' + host(), tx0 + 4, mid - 34, '500 30px ' + KANIT, t.dark ? C.gold : C.greenDark, 'left');
      text(ctx, TAGLINE, tx0 + 4, mid + 12, '600 26px ' + KANIT, t.dark ? '#FFFFFF' : C.charcoal, 'left');
      contactLine(ctx, tx0 + 4, mid + 56, 21, 'left', t.dark ? t.soft : C.charcoal);
      return k.canvas;
    });
  }

  /* ---------- link preview ---------- */

  var BLURB = 'เกมวางแผนการเกษตร ครบ 3 ฤดูใน 1 ปี เล่นฟรี';
  var TITLE_INK = { edge: '#0a130d', page: '#12241b' }; // the title screen's darkest greens

  // "Farmcare" as the title screen letters it: cream to gold bands, a hard dark drop shadow
  function goldTitle(ctx, str, x, y, size, align) {
    var top = y - size * 0.72, shadow = Math.round(size * 0.06);
    var g = ctx.createLinearGradient(0, top, 0, y);
    g.addColorStop(0, '#fff8dc'); g.addColorStop(0.42, '#fff8dc'); g.addColorStop(0.42, '#f6d579');
    g.addColorStop(0.68, '#f6d579'); g.addColorStop(0.68, '#e3a224'); g.addColorStop(1, '#e3a224');
    text(ctx, str, x + shadow, y + shadow, '700 ' + size + 'px ' + PIXEL, TITLE_INK.edge, align);
    text(ctx, str, x, y, '700 ' + size + 'px ' + PIXEL, g, align);
  }

  /* Link preview, 1200 x 630, shown when the game's link is posted in LINE or Facebook: the title
     cover's sky across the whole picture like a 90s game box, with a big floating plot and big pixel lettering. */
  function poster() {
    return fontsReady().then(function () {
      var W = 1200, H = 630, k = makeCanvas(W, H), ctx = k.ctx;
      MF.coverSky(ctx, 0, 0, W, H, 5);
      MF.coverFrame(ctx, 528, 38, 4, { sky: false });
      // the full-color logo is made for white, so it sits on a white badge
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, 60, 40, 116, 136, 16);
      ctx.fill();
      logo(ctx, 72, 52, 92);
      text(ctx, 'The Magic', 74, 252, '700 48px ' + PIXEL, C.charcoal, 'left');
      goldTitle(ctx, 'Farmcare', 68, 352, 100, 'left');
      text(ctx, BLURB, 76, 430, '600 27px ' + KANIT, C.charcoal, 'left');
      text(ctx, TAGLINE, 76, 476, '600 24px ' + KANIT, C.greenDark, 'left');
      contactLine(ctx, 76, 548, 19, 'left');
      // a game-box border: dark outside, a gold line inside
      ctx.lineWidth = 12; ctx.strokeStyle = TITLE_INK.page; ctx.strokeRect(6, 6, W - 12, H - 12);
      ctx.lineWidth = 4; ctx.strokeStyle = C.gold; ctx.strokeRect(16, 16, W - 32, H - 32);
      return k.canvas;
    });
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('toBlob failed')); }, 'image/png');
    });
  }

  MF.share = { resultCard: resultCard, poster: poster, toBlob: toBlob };
})(typeof window !== 'undefined' ? window : globalThis);
