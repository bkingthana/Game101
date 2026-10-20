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
  function contactLine(ctx, x, y, size, align) {
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
      ctx.strokeStyle = C.charcoal;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(new Path2D(ICONS[p.icon]));
      ctx.restore();
      text(ctx, p.label, cx + icon + gap, y, font, C.charcoal, 'left');
      cx += p.w;
      if (i < parts.length - 1) { text(ctx, sep, cx, y, font, C.muted, 'left'); cx += sepW; }
    });
  }

  function host() { return MF.CONFIG.shareUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''); }

  /* Result card, 1080 x 1350 (4:5 for LINE and Facebook feeds).
     r: { rank, stars, money, bankrupt, badge: { name, over } } */
  function resultCard(r) {
    return fontsReady().then(function () {
      var W = 1080, H = 1350, k = makeCanvas(W, H), ctx = k.ctx;
      ctx.fillStyle = C.skyTint;
      ctx.fillRect(0, 0, W, 360);

      var lh = logo(ctx, 72, 56, 150);
      text(ctx, 'p r e s e n t s', 72 + 75, 56 + lh + 40, '300 22px ' + KANIT, C.muted);
      gameTitle(ctx, 640, 150, 128);
      text(ctx, 'เกมปลูก ดูแล เก็บเกี่ยว ริมแม่น้ำโขง', 640, 318, '400 30px ' + KANIT, C.charcoal);

      scene(ctx, 140, 392, 5);

      // the result on a gold-tint box
      var py = 924, ph = 214;
      roundRect(ctx, 90, py, W - 180, ph, 16);
      ctx.fillStyle = C.goldTint;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.gold;
      ctx.stroke();
      if (r.badge) {
        var b = S.canvas(r.badge.name, r.badge.over), bs = 8;
        sprite(ctx, r.badge.name, 130 + (120 - b.width * bs) / 2, py + (ph - b.height * bs) / 2, bs, r.badge.over);
      }
      var tx = r.badge ? 280 : 130;
      text(ctx, r.rank, tx, py + 82, '600 46px ' + KANIT, C.charcoal, 'left');
      if (!r.bankrupt) for (var i = 0; i < 3; i++) sprite(ctx, i < r.stars ? 'star' : 'starOff', tx + i * 66, py + 112, 6);
      else text(ctx, 'เงินทุนหมดก่อนครบปี', tx, py + 150, '400 30px ' + KANIT, C.muted, 'left');
      text(ctx, 'เงินสุดท้าย', W - 130, py + 58, '300 26px ' + KANIT, C.charcoal, 'right');
      text(ctx, r.money.toLocaleString('en-US'), W - 130, py + 156, '700 96px ' + KANIT, C.charcoal, 'right');
      text(ctx, 'บาท', W - 130, py + 192, '300 26px ' + KANIT, C.charcoal, 'right');

      text(ctx, 'มาแข่งกัน เล่นฟรีที่ ' + host(), W / 2, 1192, '500 32px ' + KANIT, C.greenDark);
      text(ctx, TAGLINE, W / 2, 1240, '600 28px ' + KANIT, C.charcoal);
      contactLine(ctx, W / 2, 1282, 24);
      fieldCurve(ctx, W, H, 44);
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
