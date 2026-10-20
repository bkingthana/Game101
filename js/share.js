/* The Magic Farmcare - share pictures: the result card players post to LINE or Facebook, and the
   link preview (img/og-image.png). They follow the Thanapun Farmcare corporate identity: white page,
   full-color logo, Kanit, the logo's green / gold / brown, rounded boxes, a field curve along the
   bottom and the standard contact footer. Only the game's own name and farm scene stay pixel art. */
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
  // the farm at sunrise with a full harvest, as on the title screen
  var SCENE = { season: 'cool', time: 'dawn', weather: null, plots: [{ use: 'rice', phase: 2 }, { use: 'corn', phase: 2 }, { use: 'shallot', phase: 2 }, { use: 'kale', phase: 2 }] };
  // Lucide line icons (24 x 24, 2 px stroke)
  var ICONS = {
    phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
    chat: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
    facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
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

  function text(ctx, str, x, y, font, color, align) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
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

  // the game's own scene renderer, scaled by a whole number, in a rounded frame
  function scene(ctx, x, y, scale) {
    var c = document.createElement('canvas');
    MF.createScene(c).setView(SCENE);
    var w = c.width * scale, h = c.height * scale;
    ctx.save();
    roundRect(ctx, x, y, w, h, 14);
    ctx.clip();
    ctx.drawImage(c, x, y, w, h);
    ctx.restore();
  }

  // the full-color logo; when the game is opened as a local file that image would block saving the
  // picture, so the pixel emblem stands in
  function logo(ctx, x, y, w) {
    var img = document.getElementById('brand-img-color');
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

  // the game's name, in its pixel lettering
  function gameTitle(ctx, x, y, big, align) {
    text(ctx, 'The Magic', x, y, '700 ' + Math.round(big * 0.42) + 'px ' + PIXEL, C.charcoal, align);
    text(ctx, 'Farmcare', x, y + Math.round(big * 0.92), '700 ' + big + 'px ' + PIXEL, C.greenDark, align);
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
    3: { metal: 'gold', bg: ['#3A3A3A', '#232323'], ink: '#FFFFFF', soft: '#D9D9D9', ray: '#D9B44A', rays: 0.22, leaf: '#D9B44A', laurel: true, crown: true, sparkles: 10, label: 'ระดับตำนาน', dark: true },
    2: { metal: 'silver', bg: ['#F4FAFD', '#DCEFF8'], ink: C.charcoal, soft: '#5F6B73', ray: '#9AD4EC', rays: 0.45, leaf: '#5E8A1F', laurel: true, sparkles: 5, label: 'ระดับมืออาชีพ' },
    1: { metal: 'bronze', bg: ['#FFFAEE', '#F6E6C6'], ink: C.charcoal, soft: '#7A6A55', ray: '#D9B44A', rays: 0.3, leaf: '#AA7F4C', laurel: false, sparkles: 2, label: 'ระดับเริ่มเก่ง' },
    0: { metal: 'green', bg: ['#F7FBEF', '#E4F1CC'], ink: C.charcoal, soft: '#5E6B4E', ray: '#9BC53D', rays: 0.25, leaf: '#9BC53D', laurel: false, sparkles: 0, label: 'ระดับเริ่มต้น' },
    bankrupt: { metal: 'gray', bg: ['#F5F5F5', '#E2E2E2'], ink: C.charcoal, soft: '#6E6E6E', ray: '#BDBDBD', rays: 0.2, leaf: '#9E9E9E', laurel: false, sparkles: 0, label: 'ปีหน้าเอาใหม่' },
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

  function sunburst(ctx, cx, cy, t, W, H) {
    var glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 460);
    glow.addColorStop(0, t.dark ? 'rgba(217,180,74,0.45)' : 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = t.rays;
    ctx.fillStyle = t.ray;
    for (var i = 0; i < 18; i++) {
      var a = (i / 18) * Math.PI * 2 - Math.PI / 2, s = Math.PI / 36;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - s) * 900, cy + Math.sin(a - s) * 900);
      ctx.lineTo(cx + Math.cos(a + s) * 900, cy + Math.sin(a + s) * 900);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
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

  // sparkle spots around the emblem, kept clear of the ribbon and the stars
  var SPARKLES = [[-250, -190], [235, -230], [-335, -40], [312, -112], [-180, -300], [95, -282], [-345, 58], [338, 40], [-62, -338], [272, -8]];

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
    text(ctx, value, tx, y + 54, '600 34px ' + KANIT, t.ink, 'left');
    text(ctx, label, tx, y + 88, '300 22px ' + KANIT, t.soft, 'left');
  }

  /* Rank card, 1080 x 1350 (4:5 for LINE and Facebook feeds).
     r: { tier (0-3 or 'bankrupt'), rank, stars, money, profit, totalKg, correct, treated, icon, cropIcon } */
  function resultCard(r) {
    return fontsReady().then(function () {
      var W = 1080, H = 1350, k = makeCanvas(W, H), ctx = k.ctx, t = TIERS[r.tier];
      var bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, t.bg[0]); bg.addColorStop(1, t.bg[1]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      var cx = W / 2, cy = 470;
      sunburst(ctx, cx, cy, t, W, H);

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

      // header: logo (white wordmark on the dark card) and the game's name
      var img = document.getElementById(t.dark ? 'brand-img' : 'brand-img-color');
      if (img && img.complete && img.naturalWidth && !/^file:/.test(img.src)) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 70, 62, 96, Math.round((96 * img.naturalHeight) / img.naturalWidth));
        ctx.imageSmoothingEnabled = false;
      } else {
        sprite(ctx, 'brand', 78, 66, 5);
      }
      text(ctx, 'The Magic Farmcare', W - 70, 104, '700 40px ' + PIXEL, t.dark ? C.gold : C.greenDark, 'right');
      text(ctx, 'การ์ดผลงานประจำปี · ' + t.label, W - 70, 144, '300 26px ' + KANIT, t.soft, 'right');

      emblem(ctx, cx, cy, r, t);
      SPARKLES.slice(0, t.sparkles).forEach(function (p, i) {
        sparkle(ctx, cx + p[0], cy + p[1], 14 + (i % 3) * 8, t.dark ? '#FFF1BF' : '#FFFFFF');
      });
      ribbon(ctx, cx, cy + 100, 620, 92, t, r.rank);

      // stars and money
      if (r.tier !== 'bankrupt') {
        for (var s = 0; s < 3; s++) sprite(ctx, s < r.stars ? 'star' : 'starOff', cx - 145 + s * 105, 712, 9);
      } else {
        text(ctx, 'เงินทุนหมดก่อนครบปี', cx, 768, '500 36px ' + KANIT, t.soft);
      }
      text(ctx, 'เงินสุดท้าย', cx, 852, '300 28px ' + KANIT, t.soft);
      ctx.font = '700 128px ' + KANIT;
      var amount = r.money.toLocaleString('en-US'), aw = ctx.measureText(amount).width;
      ctx.font = '400 40px ' + KANIT;
      var bw = ctx.measureText(' บาท').width, ax = cx - (aw + bw) / 2;
      text(ctx, amount, ax, 968, '700 128px ' + KANIT, t.dark ? C.gold : t.ink, 'left');
      text(ctx, ' บาท', ax + aw, 968, '400 40px ' + KANIT, t.soft, 'left');

      // three stats from this player's year
      var tw = 290, gap = 25, tx0 = (W - tw * 3 - gap * 2) / 2, ty = 1006, th = 108;
      statTile(ctx, tx0, ty, tw, th, t, r.cropIcon, r.totalKg.toLocaleString('en-US') + ' กก.', 'ผลผลิตทั้งปี');
      statTile(ctx, tx0 + tw + gap, ty, tw, th, t, { name: 'bottle', over: { x: '#2f74c9' } }, r.correct + '/' + r.treated + ' ครั้ง', 'เลือกยาถูก');
      statTile(ctx, tx0 + (tw + gap) * 2, ty, tw, th, t, { name: 'coin' }, (r.profit >= 0 ? '+' : '') + r.profit.toLocaleString('en-US'), 'กำไรทั้งปี (บาท)');

      // footer from the CI
      text(ctx, 'มาแข่งกัน เล่นฟรีที่ ' + host(), cx, 1170, '500 32px ' + KANIT, t.dark ? C.gold : C.greenDark);
      text(ctx, TAGLINE, cx, 1216, '600 26px ' + KANIT, t.dark ? '#FFFFFF' : C.charcoal);
      contactLine(ctx, cx, 1256, 22, 'center', t.dark ? t.soft : C.charcoal);
      return k.canvas;
    });
  }

  /* Link preview, 1200 x 630, shown when the game's link is posted in LINE or Facebook. */
  function poster() {
    return fontsReady().then(function () {
      var W = 1200, H = 630, k = makeCanvas(W, H), ctx = k.ctx;
      logo(ctx, 64, 44, 120);
      gameTitle(ctx, 62, 270, 96, 'left');
      text(ctx, 'เกมวางแผนการเกษตร ปลูก ดูแล เก็บเกี่ยว', 64, 408, '500 28px ' + KANIT, C.charcoal, 'left');
      text(ctx, 'ครบ 3 ฤดูใน 1 ปี ด้วยความรู้เกษตรจริง เล่นฟรี', 64, 450, '500 28px ' + KANIT, C.charcoal, 'left');
      text(ctx, TAGLINE, 64, 512, '600 24px ' + KANIT, C.greenDark, 'left');
      contactLine(ctx, 64, 552, 20, 'left');
      scene(ctx, 680, 110, 3);
      fieldCurve(ctx, W, H, 34);
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
