/* The Magic Farmcare - share pictures: the result card players post to LINE or Facebook, and the
   link preview (img/og-image.png). Drawn on a canvas from the same pixel art and fonts as the game. */
(function (root) {
  var MF = (root.MF = root.MF || {});
  var S = MF.sprites;

  var C = {
    frame: '#12241b', edge: '#0a130d', paper: '#fbfbf2', ink: '#1b2a1e', inkSoft: '#55654f',
    gold: '#f2b632', onFrame: '#e6eed6', onFrameSoft: '#a5b99f',
  };
  var FONT = { pixel: '"Pixelify Sans", "Chakra Petch", sans-serif', body: '"Chakra Petch", "Noto Sans Thai", sans-serif', num: '"Jersey 10", "Chakra Petch", sans-serif' };
  // the farm at sunrise with a full harvest, as on the title screen
  var SCENE = { season: 'cool', time: 'dawn', weather: null, plots: [{ use: 'rice', phase: 2 }, { use: 'corn', phase: 2 }, { use: 'shallot', phase: 2 }, { use: 'kale', phase: 2 }] };

  function fontsReady() {
    if (!root.document || !document.fonts || !document.fonts.load) return Promise.resolve();
    var loads = ['700 40px "Pixelify Sans"', '700 40px "Chakra Petch"', '400 40px "Chakra Petch"', '400 40px "Jersey 10"'].map(function (f) {
      return document.fonts.load(f, 'กขค 0123');
    });
    var timeout = new Promise(function (r) { setTimeout(r, 1500); });
    return Promise.race([Promise.all(loads).catch(function () {}), timeout]);
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx: ctx };
  }

  function text(ctx, str, x, y, font, color, align) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function sprite(ctx, name, x, y, scale, over) {
    var c = S.canvas(name, over);
    ctx.drawImage(c, x, y, c.width * scale, c.height * scale);
  }

  // the game's own scene renderer, scaled up, in a dark frame like the game screen
  function scene(ctx, x, y, scale) {
    var c = document.createElement('canvas');
    MF.createScene(c).setView(SCENE);
    ctx.fillStyle = C.edge;
    ctx.fillRect(x - 8, y - 8, c.width * scale + 16, c.height * scale + 22);
    ctx.drawImage(c, x, y, c.width * scale, c.height * scale);
  }

  // the real logo; when the game is opened as a local file that image would block saving the
  // picture, so the pixel emblem stands in
  function logo(ctx, x, y, w) {
    var img = document.getElementById('brand-img');
    if (img && img.complete && img.naturalWidth && !/^file:/.test(img.src)) {
      ctx.drawImage(img, x, y, w, Math.round((w * img.naturalHeight) / img.naturalWidth));
    } else {
      var e = S.canvas('brand'), scale = Math.floor(w / e.width);
      sprite(ctx, 'brand', x + (w - e.width * scale) / 2, y, scale);
    }
  }

  function title(ctx, x, y, big, align) {
    text(ctx, 'The Magic', x, y, '700 ' + Math.round(big * 0.44) + 'px ' + FONT.pixel, C.onFrame, align);
    var fy = y + Math.round(big * 0.95);
    text(ctx, 'Farmcare', x + 6, fy + 6, '700 ' + big + 'px ' + FONT.pixel, C.edge, align);
    text(ctx, 'Farmcare', x, fy, '700 ' + big + 'px ' + FONT.pixel, C.gold, align);
  }

  function host() { return MF.CONFIG.shareUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''); }

  /* Result card, 1080 x 1350 (fits LINE, Facebook and Instagram feeds).
     r: { rank, stars, money, bankrupt, badge: { name, over } } */
  function resultCard(r) {
    return fontsReady().then(function () {
      var W = 1080, H = 1350, k = makeCanvas(W, H), ctx = k.ctx;
      ctx.fillStyle = C.frame;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.gold;
      ctx.fillRect(18, 18, W - 36, 6); ctx.fillRect(18, H - 24, W - 36, 6);

      logo(ctx, (W - 112) / 2, 46, 112);
      text(ctx, 'p r e s e n t s', W / 2, 196, '500 22px ' + FONT.pixel, C.onFrameSoft);
      title(ctx, W / 2, 262, 118);
      scene(ctx, 60, 420, 6);

      // result panel
      var py = 1044, ph = 206;
      ctx.fillStyle = C.edge; ctx.fillRect(52, py - 8, W - 104, ph + 22);
      ctx.fillStyle = C.paper; ctx.fillRect(60, py, W - 120, ph);
      if (r.badge) {
        var b = S.canvas(r.badge.name, r.badge.over), bs = 8;
        sprite(ctx, r.badge.name, 100 + (120 - b.width * bs) / 2, py + (ph - b.height * bs) / 2, bs, r.badge.over);
      }
      var tx = r.badge ? 250 : 100;
      text(ctx, r.rank, tx, py + 74, '700 50px ' + FONT.body, C.ink, 'left');
      if (!r.bankrupt) for (var i = 0; i < 3; i++) sprite(ctx, i < r.stars ? 'star' : 'starOff', tx + i * 70, py + 104, 6);
      else text(ctx, 'เงินทุนหมดก่อนครบปี', tx, py + 140, '400 32px ' + FONT.body, C.inkSoft, 'left');
      text(ctx, 'เงินสุดท้าย', W - 100, py + 54, '400 26px ' + FONT.body, C.inkSoft, 'right');
      text(ctx, r.money.toLocaleString('en-US'), W - 100, py + 152, '400 118px ' + FONT.num, C.ink, 'right');
      text(ctx, 'บาท', W - 100, py + 186, '400 26px ' + FONT.body, C.inkSoft, 'right');

      text(ctx, 'มาแข่งกัน เล่นฟรีที่ ' + host(), W / 2, H - 46, '600 34px ' + FONT.body, C.onFrame);
      return k.canvas;
    });
  }

  /* Link preview, 1200 x 630, shown when the game's link is posted in LINE or Facebook. */
  function poster() {
    return fontsReady().then(function () {
      var W = 1200, H = 630, k = makeCanvas(W, H), ctx = k.ctx;
      ctx.fillStyle = C.frame;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.gold;
      ctx.fillRect(0, H - 10, W, 10);
      logo(ctx, 64, 52, 92);
      title(ctx, 60, 238, 96, 'left');
      text(ctx, 'เกมวางแผนการเกษตร ปลูก ดูแล เก็บเกี่ยว', 62, 400, '600 28px ' + FONT.body, C.onFrame, 'left');
      text(ctx, 'ครบ 3 ฤดูใน 1 ปี ด้วยความรู้เกษตรจริง', 62, 442, '600 28px ' + FONT.body, C.onFrame, 'left');
      text(ctx, 'โดย ธนาพันธ์ ฟาร์มแคร์ · เล่นฟรีบนมือถือ', 62, 548, '400 26px ' + FONT.body, C.onFrameSoft, 'left');
      scene(ctx, 640, 150, 3.3);
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
