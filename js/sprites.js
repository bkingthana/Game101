/* The Magic Farmcare - pixel art. Every sprite is drawn here as text rows, one character per pixel.
   '.' is transparent; 'x' is a slot that callers recolor (fertilizer sacks, chemical bottles, leaf spots). */
(function (root) {
  var MF = (root.MF = root.MF || {});

  var PAL = {
    k: '#1a1c1e', // outline
    g: '#3f9b45', G: '#256b34', l: '#86cc5a', L: '#c4e67e',
    y: '#f0c43c', Y: '#c48f22', o: '#e8792b',
    b: '#8a5530', B: '#55321c', s: '#b98250', S: '#6e4426',
    r: '#c43d4a', p: '#8c3a78', P: '#5f2a5c',
    w: '#ffffff', W: '#d6e0e6', c: '#6cb8ec', C: '#2f73c0',
    n: '#f1c79a', N: '#c98e5f', h: '#3b2a20', e: '#7d8a92',
    x: '#d9473a',
    // Thanapun Farmcare logo colors (from the brand color guide)
    q: '#93d7ed', m: '#9ccb3c', M: '#76a028', d: '#ddb75a', u: '#a97f51',
    // kale leaves (blue-green)
    K: '#2e7d6b', O: '#4fa88a',
  };

  var ART = {
    /* ---- crops on the field, 8 x 10 ---- */
    rice0: ['........', '........', '........', '........', '........', '........', '...l.l..', '..l.ll..', '...lg...', '...gG...'],
    rice1: ['........', '...l....', '.l.l..l.', '.l.gl.l.', '..lgglg.', '..ggglg.', '.g.ggg..', '..gggG..', '...gG...', '...GG...'],
    rice2: ['.yy..yy.', 'y..yy..y', '..yYYy..', '.yY.lYy.', 'y..lgl.y', '...lgl..', '..lggl..', '...ggg..', '...gG...', '...GG...'],
    corn0: ['........', '........', '........', '........', '........', '........', '...l....', '..lgl...', '...g....', '...G....'],
    corn1: ['........', '........', '....l...', '...lg...', '.l..g.l.', '..l.gl..', '...lgg..', '.lg.g...', '...gg...', '...GG...'],
    corn2: ['...yy...', '..y.y...', '...g....', '.l.gl...', '..lgYy..', '...gYyl.', '.l.gYG..', '..lgg...', '...gg...', '...GG...'],
    shallot0: ['........', '........', '........', '........', '........', '........', '........', '..l..l..', '...lgl..', '...rpr..'],
    shallot1: ['........', '........', '........', '..l...l.', '..l..l..', '...l.l..', '..l.gl..', '...lgl..', '...rrr..', '..rprpr.'],
    shallot2: ['........', '........', '..y...y.', '..l..y..', '...l.l..', '..y.gl..', '...lgl..', '..rrrrr.', '.rprrrpr', '..rpprr.'],
    fallow0: ['........', '........', '........', '........', '........', '........', '........', '..l..l..', '..g.lg..', '...gG...'],
    fallow1: ['........', '........', '........', '..l..l..', '.lgl.lg.', '..g..g..', '..gl.g..', '..g.lg..', '...gg...', '...GG...'],
    fallow2: ['..y..y..', '.yoy.yy.', '..y.oy..', '..gl.g..', '.lg.lgl.', '..g..g..', '..gl.g..', '..g.lg..', '...gg...', '...GG...'],
    waterspinach0: ['........', '........', '........', '........', '........', '........', '........', '..l..l..', '...ll...', '...gG...'],
    waterspinach1: ['........', '........', '........', '...l....', '.lgl.gl.', '..gl.lg.', '.lg.gl..', '..lggg..', '.l.gG.l.', '...GG...'],
    waterspinach2: ['........', '..w..l..', '.lgl.gll', 'lggl.lgg', '.lgglgg.', 'lgl.lggl', '.lgglgl.', 'lggglggl', '.lgGGgl.', '..GGGG..'],
    kale0: ['........', '........', '........', '........', '........', '........', '........', '..K..K..', '...KK...', '...gG...'],
    kale1: ['........', '........', '........', '..KK....', '.KOKK.K.', '.KKOKKK.', '..KKOK..', '...Kg...', '...gg...', '...GG...'],
    kale2: ['........', '.KK..KK.', 'KOKKKKOK', 'KKOKKOKK', '.KKOKOK.', 'KKKOKOKK', '.KK.g.K.', '...gg...', '...gg...', '...GG...'],
    dill0: ['........', '........', '........', '........', '........', '........', '...l....', '..l.l...', '...l....', '...g....'],
    dill1: ['........', '........', '...l....', '.l.l.l..', '..lLl...', '.l.l.l..', '..lll...', '...l.l..', '...g....', '...g....'],
    dill2: ['..l.L.l.', '.lLlLlL.', 'L.lLl.lL', '.lLlLlL.', 'l.LlLl.l', '.l.lLl..', '..lLlL..', '...lL...', '...gl...', '...gg...'],
    idle: ['........', '........', '........', '........', '........', '........', '........', '.ssssss.', 'sSsSsSss', 'SSSSSSSS'],

    /* ---- tiny pests that crawl over a plot ---- */
    miniBug: ['.BB.', 'BbbB', '.b.b'],
    miniWorm: ['lglgk', '.k.k.'],
    miniThrips: ['YY.', '.Yk'],
    miniWeed: ['L...L', '.L.L.', 'L.L.L', '.LLL.', '..L..'],

    /* ---- icons, 12 x 12 ---- */
    bug: [
      '............', '...B....B...', '....B..B....', '....bbbb....', '..ssbbbbss..', '.sssbBBbsss.',
      '.ss.bbbb.ss.', '....bBBb....', '...b.bb.b...', '..b..bb..b..', '.....bb.....', '............'],
    worm: [
      '............', '............', '............', '..........B.', '........BkkB', '.gGgGgGgGkwk',
      'gglgglgglgkk', 'ggggggggggk.', '.k..k..k..k.', '............', '............', '............'],
    thrips: [
      '............', '.....kk.....', '......kk....', '.....YYk....', '....YyyY....', '...W.YY.W...',
      '..WW.YY.WW..', '.WW.YyyY.WW.', '.....YY.....', '.....YY.....', '......Y.....', '............'],
    leaf: [
      '..........gg', '........gglg', '......ggglgg', '.....gggxggg', '....ggxxgggg', '...gggxgggxg',
      '..gggggggxx.', '..ggxgggggg.', '.gxxxggggg..', '.ggxgggg....', '.gggg.......', 'G...........'],
    weed: [
      '............', '.l......l...', '.l..l...l.l.', '.gl.l..lg.l.', '..g.lg.l..g.', '..gl.g.lgg..',
      '...g.gllg...', '...gglggg...', '....ggGg....', '.....GG.....', '....SSSS....', '............'],
    sun: [
      '.....yy.....', '..y..yy..y..', '...y....y...', '....yyyy....', '...yooooy...', 'yy.yooooy.yy',
      '...yooooy...', '....yyyy....', '...y....y...', '..y..yy..y..', '.....yy.....', '............'],
    rain: [
      '............', '....WWW.....', '..WWwwwW....', '.WwwwwwwWW..', 'WwwwwwwwwwW.', 'WWWWWWWWWWW.',
      '............', '.c..c..c..c.', 'c..c..c..c..', '............', '.c..c..c....', '............'],
    drought: [
      '.......yy...', '......yooy..', '......yooy..', '.......yy...', '............', 'SSSSSSSSSSSS',
      'SsSssSsssSsS', 'sSsSSsSsSssS', 'SssSsSSssSsS', 'sSSsSsSsSSsS', 'SSSSSSSSSSSS', '............'],
    flood: [
      '............', '...l....l...', '...gl..lg...', '....g..g....', 'cccccccccccc', 'cCccCccCccCc',
      'CcCCcCCcCCcC', 'cccccccccccc', 'CCCCCCCCCCCC', 'cCCcCCcCCcCC', 'CCCCCCCCCCCC', '............'],
    fog: [
      '............', '.WWWWWW.....', '............', '...WWWWWWWW.', '............', 'WWWWW..WWWW.',
      '............', '..WWWWWWW...', '............', '.WWWW.WWWWW.', '............', '............'],

    /* fertilizer sack 12 x 14, band recolored per formula */
    sack: [
      '..kkkkkkkk..', '.kWwwwwwwWk.', '.kwwwwwwwwk.', 'kwwwwwwwwwwk', 'kwxxxxxxxxwk', 'kwxxxxxxxxwk', 'kwxxxxxxxxwk',
      'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kWwwwwwwwwWk', '.kWWWWWWWWk.', '..kkkkkkkk..'],
    /* chemical bottle 10 x 14 */
    bottle: [
      '...kkkk...', '...kWWk...', '...kkkk...', '..kxxxxk..', '.kxxxxxxk.', 'kxxwxxxxxk', 'kxwwxxxxxk',
      'kxxxxxxxxk', 'kxwwwwwwxk', 'kxwkwkwwxk', 'kxwwwwwwxk', 'kxxxxxxxxk', 'kxxxxxxxxk', '.kkkkkkkk.'],
    none: [
      '............', '..kk....kk..', '..kkk..kkk..', '...kkkkkk...', '....kkkk....', '....kkkk....',
      '...kkkkkk...', '..kkk..kkk..', '..kk....kk..', '............', '............', '............'],

    /* Lung Phan, the coach, 16 x 16 */
    lung: [
      '.......yy.......', '.....yyYYyy.....', '...yyyYyyYyyy...', '.yyYyyyyyyyyYyy.', 'YYYYYYYYYYYYYYYY', '....hhhhhhhh....',
      '....hnnnnnnh....', '....nnknnknn....', '....nnnnnnnn....', '....nnhhhhnn....', '.....nnnnnn.....', '....GgGnnGgG....',
      '...gggggggggg...', '..gggggyyggggg..', '..gggggyyggggg..', '..gggggggggggg..'],
    /* Thanapun Farmcare emblem, pixel version of the real logo: sprout over sky, hills and soil */
    brand: [
      '.www.qqqqqq.www.', 'wmmmwwqqqqwwmmmw', 'wMMmmmwqqwmmmMMw', '.wwMMmmwwmmMMww.', '.qqwwmmmmmmwwqq.', 'qqqqqwwmmwwqqqqq',
      'qqqqqqwmmwqqqqmm', 'qqqqqqwmmwqmmmmm', 'uuqqqqwmmwmmmmmd', 'uuuuuuwmmwmmmmdd', 'uuuuuuwmmwmmmddd', '.uuuuuuwwuudddd.',
      '.uuuuuuuuuuuddd.', '..uuuuuuuuuudd..', '...uuuuuuuuud...', '.....uuuuuu.....'],
    brandSmall: [
      '.ww.qqqq.ww.', 'wmmwwqqwwmmw', 'wmmmmwwmmmmw', '.wwmmmmmmww.', 'qqqwwmmwwqqq', 'qqqqwmmwqqmm',
      'uuqqwmmwmmmm', 'uuuuwmmwmmmd', 'uuuuwmmwmmdd', '.uuuuwwuddd.', '..uuuuuuud..', '....uuuu....'],

    coin: ['..yyyy..', '.yYYYYy.', 'yYyyyyYy', 'yYyYYyYy', 'yYyYYyYy', 'yYyyyyYy', '.yYYYYy.', '..yyyy..'],
    star: ['....y....', '....y....', '...yyy...', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '..yy.yy..', '.yy...yy.', '.y.....y.'],
    starOff: ['....e....', '....e....', '...eWe...', 'eeeeWeeee', '.eWWWWWe.', '..eWWWe..', '..ee.ee..', '.ee...ee.', '.e.....e.'],
    soundOn: ['....w....', '...ww..w.', 'wwwww.w..', 'wwwww..w.', 'wwwww..w.', 'wwwww..w.', 'wwwww.w..', '...ww..w.', '....w....'],
    soundOff: ['....w....', '...ww....', 'wwwww....', 'wwwww.w.w', 'wwwww..w.', 'wwwww.w.w', 'wwwww....', '...ww....', '....w....'],
    menu: ['.........', 'wwwwwwwww', 'wwwwwwwww', '.........', 'wwwwwwwww', 'wwwwwwwww', '.........', 'wwwwwwwww', 'wwwwwwwww'],
    sparkle: ['..w..', '..w..', 'ww.ww', '..w..', '..w..'],

    /* farm life in the scene */
    egretUp: ['w...w', '.w.w.', '..wwy'],
    egretDown: ['.....', 'wwwwy', 'w....'],
    egretStand: ['.wy', 'w..', '.w.', 'www', '.e.', '.e.'],
    // water buffalo facing left: grazing, and looking up (h body, H back, W horns; colors set in the scene)
    buffaloGraze: ['.............', '....HHHHHHH..', '..WhhhhhhhhH.', 'WW.hhhhhhhhhh', '.hhhhhhhhhhh.', 'hhh.hhhhhhhh.', 'hh..h.h..h.h.', '....h.h..h.h.'],
    buffaloUp: ['W..W.........', '.WW.HHHHHHH..', '.hhhhhhhhhhH.', 'hhhhhhhhhhhhh', 'hh.hhhhhhhhh.', '...hhhhhhhhh.', '....h.h..h.h.', '....h.h..h.h.'],
    // Lung Phan in his straw hat, two walking frames
    farmerA: ['.yyy.', 'yyYyy', '.nnn.', '.gGg.', 'ngggn', '.GGG.', '.C.C.', '.h.h.'],
    farmerB: ['.yyy.', 'yyYyy', '.nnn.', '.gGg.', 'ngggn', '.GGG.', '..CC.', '..hh.'],

    /* end-of-game badges: trophy (3 stars), medal (1-2 stars, metal colors set by the UI), sprout (0) */
    trophy: ['..kkkkkkkkkk..', 'kkkywyyyyyYkkk', 'k.kywyyyyyYk.k', 'k.kywyyyyyYk.k', 'kk.kwyyyyYk.kk', '.k.kyyyyyYk.k.', '..kkkyyyYkkk..',
      '....kkyYkk....', '.....kyYk.....', '.....kyYk.....', '....kkyYkk....', '...kyyyyyYk...', '..kgggggggGk..', '..kgLLgggLGk..', '..kkkkkkkkkk..'],
    medal: ['.ggg....ggg.', '.gGg....gGg.', '..ggg..ggg..', '..gGg..gGg..', '...gggggg...', '....kkkk....', '..kkxxxxkk..', '.kxxwxxxxxk.',
      '.kxwxxyxxxk.', 'kxxxxyyyxxxk', 'kxxyyyyyyyxk', 'kxxxyyyyyxxk', '.kxxyyxyyxk.', '.kxxyxxxyxk.', '..kkxxxxkk..', '....kkkk....'],
    sproutPot: ['..ll....ll..', '.llll..llll.', '.lllgllglll.', '..llggggll..', '.....gg.....', '.....gG.....', '..kkkkkkkk..',
      '..kbbbbbbk..', '...kbbbbk...', '...kbSSbk...', '....kkkk....'],
  };
  // right-facing copies
  ['buffaloGraze', 'buffaloUp'].forEach(function (n) {
    ART[n + 'R'] = ART[n].map(function (row) { return row.split('').reverse().join(''); });
  });

  var cache = {};

  function size(name) {
    var a = ART[name];
    return { w: a[0].length, h: a.length };
  }

  function paletteKey(over) { return over ? JSON.stringify(over) : ''; }

  /* Render a sprite once at 1x to an offscreen canvas and cache it. */
  function canvas(name, over) {
    var key = name + paletteKey(over);
    if (cache[key]) return cache[key];
    var art = ART[name];
    if (!art) throw new Error('Unknown sprite ' + name);
    var w = art[0].length, h = art.length;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = art[y][x];
        if (ch === '.' || ch === undefined) continue;
        ctx.fillStyle = (over && over[ch]) || PAL[ch] || '#ff00ff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    cache[key] = cv;
    return cv;
  }

  var urlCache = {};
  /* Data URL for <img> tags; scale it up with CSS image-rendering: pixelated. */
  function url(name, over) {
    var key = name + paletteKey(over);
    if (!urlCache[key]) urlCache[key] = canvas(name, over).toDataURL();
    return urlCache[key];
  }

  function draw(ctx, name, x, y, over) {
    ctx.drawImage(canvas(name, over), Math.round(x), Math.round(y));
  }

  /* <img> markup for the UI; scale = CSS pixels per art pixel */
  function img(name, scale, over, cls) {
    var s = size(name);
    return '<img class="px ' + (cls || '') + '" src="' + url(name, over) + '" width="' + s.w * scale + '" height="' + s.h * scale + '" alt="">';
  }

  var LEAF_SPOTS = { leafBlast: '#8a5530', leafDowny: '#e9e39a', leafPurple: '#8c3a78', leafRust: '#ffffff', leafRot: '#4a2c16' };

  /* Icon for a pest event (the three leaf diseases share one leaf with different spots). */
  function eventIcon(spriteName, scale) {
    if (LEAF_SPOTS[spriteName]) return img('leaf', scale, { x: LEAF_SPOTS[spriteName] });
    return img(spriteName, scale);
  }

  var GROUP_COLORS = { insect: '#c9412f', bio: '#2f9c8f', fungus: '#2f74c9', weed: '#5f8f2a' };

  MF.sprites = {
    PAL: PAL,
    ART: ART,
    size: size,
    canvas: canvas,
    url: url,
    draw: draw,
    img: img,
    eventIcon: eventIcon,
    GROUP_COLORS: GROUP_COLORS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
