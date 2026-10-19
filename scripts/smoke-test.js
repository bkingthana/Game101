/* End-to-end check in headless Chromium at phone size: plays a whole game (every season) through the real UI,
   fails on any console error, and saves screenshots.
   Run: NODE_PATH="$(npm root -g)" node scripts/smoke-test.js [screenshot-dir] [page-url] */
var path = require('path');
var fs = require('fs');
var chromium = require('playwright').chromium;

var outDir = process.argv[2] || path.join(__dirname, '..', 'screenshots');
var url = process.argv[3] || 'file://' + path.join(__dirname, '..', 'index.html');
fs.mkdirSync(outDir, { recursive: true });

(async function () {
  var launch = { executablePath: process.env.CHROMIUM_PATH || undefined };
  if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
  var browser = await chromium.launch(launch);
  var context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  var page = await context.newPage();
  var errors = [];
  page.on('console', function (m) { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', function (e) { errors.push(String(e)); });

  async function shot(name) { await page.screenshot({ path: path.join(outDir, name + '.png') }); }
  async function dismissCoach() {
    for (var n = 0; n < 10 && (await page.isVisible('#coach')); n++) await page.click('#coach-next');
  }

  // A live republish hands the open game to the new page through window.claude.hot. A game from an
  // older version (here: the 3-year game, season 5) must not be resumed, or the HUD reads "ฤดูที่ 5 / 3".
  var oldPage = await context.newPage();
  oldPage.on('pageerror', function (e) { errors.push(String(e)); });
  await oldPage.addInitScript(function () {
    window.claude = { hot: { data: { screen: 'game', state: { v: 1, rng: 7, money: 61000, season: 4, stage: 'plan', over: null,
      plots: [0, 1, 2, 3].map(function () { return { soil: { N: 40, P: 40, K: 40 }, use: 'idle', basal: null, top: null, lastUse: 'rice', event: null }; }),
      weather: { actual: 'normal', forecast: 'normal', respond: false }, results: null, history: [], seasonCost: 0, tutorial: {},
      stats: { treated: 0, correct: 0, kg: { rice: 0, corn: 0, shallot: 0 }, revenue: 0, cost: 0 } } } } };
  });
  await oldPage.goto(url);
  await oldPage.waitForTimeout(400);
  if (await oldPage.isVisible('#screen-game')) errors.push('old-version game was resumed: HUD shows ' + (await oldPage.textContent('#hud-year')));
  if (!(await oldPage.isVisible('#screen-title'))) errors.push('title screen not shown after old-version live update');
  await oldPage.close();

  await page.goto(url);
  await page.waitForTimeout(600);
  await shot('01-title');

  await page.click('#btn-new');
  await page.waitForTimeout(300);
  await shot('02-welcome-coach');
  await dismissCoach();

  var seasons = await page.evaluate(function () { return MF.engine.totalSeasons(); });
  for (var season = 0; season < seasons; season++) {
    var info = await page.evaluate(function () {
      var s = JSON.parse(localStorage.getItem('tmf.save.v2'));
      return { season: s.season, money: s.money, id: ['rain', 'cool', 'hot'][s.season % 3] };
    });
    var plan = info.id === 'rain' ? ['rice', 'corn', 'corn', 'corn']
      : info.id === 'cool' ? (info.money > 30000 ? ['shallot', 'shallot', 'shallot', 'corn'] : ['corn', 'corn', 'shallot', 'corn'])
      : ['fallow', 'fallow', 'fallow', 'corn'];
    for (var i = 0; i < 4; i++) {
      await page.click('[data-action="open-plot"][data-i="' + i + '"]');
      await page.waitForTimeout(260);
      await dismissCoach();
      await page.click('[data-action="pick-use"][data-use="' + plan[i] + '"]');
      if (plan[i] !== 'fallow') await page.click('[data-action="pick-basal"][data-f="f151515"]');
      if (season === 0 && i === 0) await shot('03-plot-sheet');
      if (await page.isDisabled('[data-action="confirm-plot"]')) await page.click('[data-action="pick-use"][data-use="idle"]');
      await page.click('[data-action="confirm-plot"]');
      await page.waitForTimeout(80);
    }
    if (season === 0) await shot('04-plan');
    await page.click('#btn-primary');
    await page.waitForTimeout(250);
    await dismissCoach();

    // care: answer every pest correctly, respond to weather, top-dress with urea
    var fixes = await page.evaluate(function () {
      var s = JSON.parse(localStorage.getItem('tmf.save.v2'));
      return s.plots.map(function (p) { return p.event ? MF.EVENTS[p.event.id].correct[0] : null; });
    });
    for (var j = 0; j < 4; j++) {
      if (fixes[j]) await page.click('[data-action="treat"][data-i="' + j + '"][data-p="' + fixes[j] + '"]');
      if (await page.$('[data-action="top"][data-i="' + j + '"][data-f="f4600"]')) await page.click('[data-action="top"][data-i="' + j + '"][data-f="f4600"]');
    }
    var toggle = await page.$('[data-action="toggle-response"][aria-pressed="false"]');
    if (toggle) await toggle.click();
    while (await page.isDisabled('#btn-primary')) {
      var chip = await page.$('[data-action="top"][aria-pressed="true"]:not([data-f=""])');
      if (!chip) break;
      var idx = await chip.getAttribute('data-i');
      await page.click('[data-action="top"][data-i="' + idx + '"][data-f=""]');
    }
    if (season === 0 || fixes.some(Boolean)) await shot('05-care-s' + (season + 1));
    await page.click('#btn-primary');
    await page.waitForTimeout(400);
    await dismissCoach();
    if (season === 0) await shot('06-harvest');

    if (season === 1) {
      // reload mid-game: the title screen must offer to continue
      await page.reload();
      await page.waitForTimeout(400);
      if (!(await page.isVisible('#btn-continue'))) errors.push('continue button missing after reload');
      await page.click('#btn-continue');
      await page.waitForTimeout(200);
      await dismissCoach();
    }

    await page.click('#btn-primary');
    await page.waitForTimeout(300);
    await dismissCoach();
  }

  await page.waitForTimeout(1200);
  if (!(await page.isVisible('#screen-end'))) errors.push('end screen not shown');
  await shot('07-end');
  var finalMoney = await page.textContent('.end-money b');
  console.log('final money', finalMoney);

  await browser.close();
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('smoke test passed, screenshots in', outDir);
})().catch(function (e) { console.error(e); process.exit(1); });
