/* Renders img/og-image.png (the link preview for LINE and Facebook) with the game's own share code
   in headless Chromium. Optionally also saves a sample rank card for every rank into a folder.
   Run: NODE_PATH="$(npm root -g)" node scripts/make-og-image.js [sample-folder] */
var fs = require('fs');
var path = require('path');
var chromium = require('playwright').chromium;

var rootDir = path.join(__dirname, '..');

function save(dataUrl, file) {
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', path.relative(rootDir, file) || file);
}

function dataUrl(file) { return 'data:image/png;base64,' + fs.readFileSync(path.join(rootDir, 'img', file)).toString('base64'); }

var SAMPLES = [
  { tier: 3, rank: 'เกษตรกรมหัศจรรย์', stars: 3, money: 70250, profit: 50250, totalKg: 6136, correct: 6, treated: 6, icon: { name: 'trophy', over: { k: '#8a6414' } }, cropIcon: { name: 'shallot2' } },
  { tier: 2, rank: 'ชาวไร่มืออาชีพ', stars: 2, money: 58900, profit: 38900, totalKg: 5480, correct: 5, treated: 6, icon: { name: 'corn2' }, cropIcon: { name: 'corn2' } },
  { tier: 1, rank: 'ชาวไร่มือใหม่', stars: 1, money: 47300, profit: 27300, totalKg: 4210, correct: 3, treated: 5, icon: { name: 'rice2' }, cropIcon: { name: 'rice2' } },
  { tier: 0, rank: 'ชาวไร่ฝึกหัด', stars: 0, money: 36400, profit: 16400, totalKg: 2950, correct: 2, treated: 5, icon: { name: 'sproutPot', over: { k: '#55321c' } }, cropIcon: { name: 'rice2' } },
  { tier: 'bankrupt', rank: 'ล้มละลาย', stars: 0, money: 640, profit: -19360, totalKg: 900, correct: 0, treated: 4, icon: { name: 'wilt' }, cropIcon: { name: 'corn2' } },
];

(async function () {
  var launch = { executablePath: process.env.CHROMIUM_PATH || undefined };
  if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
  var browser = await chromium.launch(launch);
  try {
    var page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
    await page.goto('file://' + path.join(rootDir, 'index.html'));
    // file:// images would taint the canvas, so hand the logos and the LINE QR over as data URLs
    await page.evaluate(function (logos) {
      return Promise.all(Object.keys(logos).map(function (id) {
        return new Promise(function (resolve) { var img = document.getElementById(id); img.onload = resolve; img.src = logos[id]; });
      }));
    }, { 'brand-img': dataUrl('logo-thanapun-dark.png'), 'brand-img-color': dataUrl('logo-thanapun-color.png'), 'line-qr-img': dataUrl('line-qr.png') });
    await page.evaluate(function () { return document.fonts.ready; });
    save(await page.evaluate(function () { return MF.share.poster().then(function (c) { return c.toDataURL('image/png'); }); }), path.join(rootDir, 'img', 'og-image.png'));
    if (process.argv[2]) {
      fs.mkdirSync(process.argv[2], { recursive: true });
      for (var i = 0; i < SAMPLES.length; i++) {
        save(await page.evaluate(function (r) {
          return MF.share.resultCard(r).then(function (c) { return c.toDataURL('image/png'); });
        }, SAMPLES[i]), path.resolve(process.argv[2], 'card-' + SAMPLES[i].tier + '.png'));
      }
    }
  } finally {
    await browser.close();
  }
})().catch(function (e) { console.error(e); process.exit(1); });
