/* Renders img/og-image.png (the link preview for LINE and Facebook) with the game's own share code
   in headless Chromium. Optionally also saves a sample result card.
   Run: NODE_PATH="$(npm root -g)" node scripts/make-og-image.js [sample-card.png] */
var fs = require('fs');
var path = require('path');
var chromium = require('playwright').chromium;

var rootDir = path.join(__dirname, '..');

function save(dataUrl, file) {
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote', path.relative(rootDir, file) || file);
}

(async function () {
  var launch = { executablePath: process.env.CHROMIUM_PATH || undefined };
  if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
  var browser = await chromium.launch(launch);
  try {
    var page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
    await page.goto('file://' + path.join(rootDir, 'index.html'));
    // a file:// image would taint the canvas, so hand the logo over as a data URL
    var logo = 'data:image/png;base64,' + fs.readFileSync(path.join(rootDir, 'img', 'logo-thanapun-color.png')).toString('base64');
    await page.evaluate(function (src) {
      return new Promise(function (resolve) { var img = document.getElementById('brand-img-color'); img.onload = resolve; img.src = src; });
    }, logo);
    await page.evaluate(function () { return document.fonts.ready; });
    save(await page.evaluate(function () { return MF.share.poster().then(function (c) { return c.toDataURL('image/png'); }); }), path.join(rootDir, 'img', 'og-image.png'));
    if (process.argv[2]) {
      save(await page.evaluate(function () {
        return MF.share.resultCard({ rank: 'เกษตรกรมหัศจรรย์', stars: 3, money: 70250, badge: { name: 'trophy', over: { k: '#8a6414' } } })
          .then(function (c) { return c.toDataURL('image/png'); });
      }), path.resolve(process.argv[2]));
    }
  } finally {
    await browser.close();
  }
})().catch(function (e) { console.error(e); process.exit(1); });
