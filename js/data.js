/* The Magic Farmcare - game data: seasons, weather, crops, fertilizer, chemicals, pest events.
   All balance numbers live here so they can be tuned without touching the engine. */
(function (root) {
  var MF = (root.MF = root.MF || {});

  MF.CONFIG = {
    startMoney: 20000,
    years: 1,
    stars: [45000, 55000, 65000],
    minMoneyToContinue: 1000,
    forecastAccuracy: 0.7,
    naturalRecovery: 3,
    offStageEfficiency: 0.6, // fertilizer used outside its best timing
    excessNRatio: 1.5, // N above need x 1.5 = too much
    yieldJitter: 0.07,
    safeVegBonus: 0.15, // leafy vegetables grown without chemical sprays sell for 15% more
    shareUrl: 'https://the-magic-farmcare.vercel.app', // the public link put on share cards
    // shop contact shown on the end screen; the card stays hidden until at least one is filled in
    contact: {
      lineId: '@thanapun',
      line: 'https://line.me/R/ti/p/@thanapun', // add-friend link of the LINE OA
      phone: '042-532096', // written as in the company CI
      map: 'https://maps.app.goo.gl/jhmKQMaDMEPxBMa6A',
    },
  };

  MF.SEASONS = [
    { id: 'rain', name: 'ฤดูฝน', months: 'พ.ค. – ต.ค.', weather: [['normal', 0.5], ['drought', 0.25], ['flood', 0.25]] },
    { id: 'cool', name: 'ฤดูหนาว', months: 'พ.ย. – ก.พ.', weather: [['normal', 0.6], ['humid', 0.25], ['drought', 0.15]] },
    { id: 'hot', name: 'ฤดูร้อน', months: 'มี.ค. – เม.ย.', weather: [['drought', 0.65], ['normal', 0.35]] },
  ];

  MF.WEATHER = {
    normal: {
      name: { rain: 'ฝนตกตามฤดู', cool: 'อากาศเย็นสบาย', hot: 'แดดจัด น้ำพอใช้' },
      desc: 'สภาพอากาศเป็นใจ พืชโตได้ตามปกติ',
      icon: 'sun',
    },
    drought: {
      name: { rain: 'ฝนทิ้งช่วง', cool: 'อากาศแห้งแล้ง', hot: 'ภัยแล้ง' },
      desc: 'ฝนไม่ตกหลายสัปดาห์ ดินแห้งแตก พืชขาดน้ำ',
      icon: 'drought',
      response: { label: 'สูบน้ำเข้าแปลง', costPerPlot: 400 },
    },
    flood: {
      name: { rain: 'น้ำท่วมขัง', cool: 'น้ำท่วมขัง', hot: 'น้ำท่วมขัง' },
      desc: 'ฝนตกหนักต่อเนื่อง น้ำขังในแปลง รากพืชเน่า',
      icon: 'flood',
      response: { label: 'ขุดร่องระบายน้ำ เสริมคันดิน', costPerPlot: 400 },
    },
    humid: {
      name: { rain: 'ความชื้นสูง', cool: 'หมอกลงจัด', hot: 'ความชื้นสูง' },
      desc: 'ความชื้นสูงต่อเนื่อง เชื้อราระบาดง่าย ควรเฝ้าระวังโรคพืช',
      icon: 'fog',
    },
  };

  /* Soil levels are 0-100. need = level the crop wants at full yield. uptake = what one season removes. */
  MF.CROPS = {
    rice: {
      name: 'ข้าว', seedCost: 1000, baseYield: 600, price: 10,
      suit: { rain: 1, cool: 0.65, hot: 0.5 },
      need: { N: 60, P: 35, K: 35 }, uptake: { N: 30, P: 12, K: 15 },
      drought: 0.45, flood: 0.15,
      events: ['bph', 'blast', 'barnyard'],
      note: 'ชอบน้ำมาก เหมาะกับฤดูฝน ทนน้ำขังได้ดี',
    },
    corn: {
      name: 'ข้าวโพดเลี้ยงสัตว์', seedCost: 1500, baseYield: 900, price: 8.5,
      suit: { rain: 1, cool: 0.9, hot: 0.55 },
      need: { N: 70, P: 35, K: 35 }, uptake: { N: 35, P: 14, K: 16 },
      drought: 0.35, flood: 0.6,
      events: ['faw', 'downy', 'cornweed'],
      note: 'ปลูกได้ทั้งฤดูฝนและหลังนา กินปุ๋ยไนโตรเจนมาก ไม่ชอบน้ำขัง',
    },
    shallot: {
      name: 'หอมแดง', seedCost: 5500, baseYield: 1000, price: 15,
      suit: { rain: 0.4, cool: 1, hot: 0.6 },
      need: { N: 45, P: 40, K: 60 }, uptake: { N: 20, P: 15, K: 30 },
      drought: 0.35, flood: 0.75,
      events: ['thrips', 'beetarmy', 'purple'],
      note: 'ชอบอากาศเย็น ต้องการโพแทสเซียมสูง ลงทุนมาก กำไรมาก เน่าง่ายถ้าฝนชุก',
    },
    /* leafy vegetables (veg: true) can sell as safe vegetables for a premium */
    waterspinach: {
      name: 'ผักบุ้ง', seedCost: 500, baseYield: 900, price: 5.5, veg: true,
      suit: { rain: 1, cool: 0.9, hot: 0.7 },
      need: { N: 60, P: 25, K: 25 }, uptake: { N: 25, P: 8, K: 10 },
      drought: 0.5, flood: 0.05,
      events: ['cutworm', 'whiterust'],
      note: 'ปลูกได้ทั้งปี ทนน้ำขัง ต้นทุนต่ำ กำไรน้อยแต่ปลอดภัย ไม่ทนแล้ง ต้องมีน้ำ',
    },
    kale: {
      name: 'คะน้า', seedCost: 900, baseYield: 600, price: 12, veg: true,
      suit: { rain: 0.55, cool: 1, hot: 0.45 },
      need: { N: 75, P: 30, K: 35 }, uptake: { N: 30, P: 10, K: 12 },
      drought: 0.45, flood: 0.6,
      events: ['dbm', 'aphid', 'kaledowny'],
      note: 'ชอบอากาศเย็น กินปุ๋ยไนโตรเจนมาก ฝนชุกเสียหาย ระวังหนอนใยผัก',
    },
    dill: {
      name: 'ผักชีลาว', seedCost: 1200, baseYield: 330, price: 28, veg: true,
      suit: { rain: 0.4, cool: 1, hot: 0.35 },
      need: { N: 55, P: 30, K: 35 }, uptake: { N: 20, P: 8, K: 12 },
      drought: 0.4, flood: 0.8,
      events: ['aphid', 'dampingoff', 'leafspot', 'powdery', 'rootrot'],
      note: 'ผักที่คนอีสานนิยม ราคาดี ชอบอากาศเย็น ไม่ทนน้ำขังและความชื้น เสี่ยงสูง กำไรสูง',
    },
  };

  MF.LAND_USES = {
    fallow: { name: 'พักดิน หว่านปอเทือง', cost: 300, add: { N: 22, P: 4, K: 6 }, acidCut: 1, note: 'ไถกลบเป็นปุ๋ยพืชสด เพิ่มไนโตรเจนให้ดิน และช่วยลดดินเปรี้ยวได้เล็กน้อย' },
    idle: { name: 'ปล่อยว่าง', cost: 0, note: 'ไม่ปลูกอะไร ดินฟื้นตัวเองเล็กน้อย' },
  };

  /* best: 'basal' (รองพื้น ตอนปลูก) / 'top' (แต่งหน้า ช่วงดูแล) / 'any'
     add: soil units one bag gives. Compound formulas give about 0.8 x their percentage (rounded down);
     46-0-0 and 0-0-60 give 30, the most one bag lifts a nutrient; 21-0-0 is scaled like 46-0-0 per % of N
     (21 x 30/46), so a baht buys less N with it than with urea, as at real prices.
     cost: game price per bag = average Thai retail price per 50 kg bag / Thai retail urea (979 baht, 2026)
     x urea's game price 490, rounded to 10. Every item, organic and dolomite included, is on that one basis.
     README ("ราคาปุ๋ยในเกม") has the figures and the older world raw-material derivation. These are not shop prices.
     tag/desc say which nutrient gap a formula fills: choose by what the soil is short of, not by crop.
     tip: a note for the harvest summary of the first plot that used it in a season.
     acidify: soil acidity added in a season it is used (MF.ACIDITY). acidCut: acidity it removes after the season. */
  MF.FERTS = {
    f16200: { name: '16-20-0', tag: 'เน้นฟอสฟอรัส', desc: 'ใช้เมื่อดินขาด P เป็นหลัก ขาด N เล็กน้อย และ K พอแล้ว ช่วยเร่งราก', cost: 490, add: { N: 12, P: 16, K: 0 }, best: 'basal', color: '#c9412f' },
    f30200: { name: '30-20-0', tag: 'N และ P สูง', desc: 'ใช้เมื่อดินขาดทั้ง N และ P แต่ K พอแล้ว', cost: 620, add: { N: 24, P: 16, K: 0 }, best: 'basal', color: '#1f8fa8' },
    f151515: { name: '15-15-15', tag: 'ปุ๋ยสูตรเสมอ', desc: 'ใช้เมื่อดินขาด N P K พอๆ กัน ใส่ได้ทุกช่วง', cost: 550, add: { N: 12, P: 12, K: 12 }, best: 'any', color: '#2f74c9' },
    f2088: { name: '20-8-8', tag: 'เน้นไนโตรเจน', desc: 'ใช้เมื่อดินขาด N เป็นหลัก และขาด P K เล็กน้อย ใส่ได้ทุกช่วง', cost: 490, add: { N: 16, P: 6, K: 6 }, best: 'any', color: '#9c8f1a' },
    organic: { name: 'อินทรีย์', tag: 'ปุ๋ยมูลไก่อัดเม็ด', desc: 'ธาตุอาหารน้อย แต่ดินร่วนซุย เสื่อมช้าลง และช่วยลดดินเปรี้ยวได้เล็กน้อย', cost: 230, add: { N: 6, P: 6, K: 6 }, best: 'basal', soilCare: true, acidCut: 1, color: '#7a5230' },
    f4600: { name: '46-0-0', tag: 'ยูเรีย', desc: 'ใช้เมื่อดินขาด N มาก เงินเท่ากันได้ N มากที่สุด ใส่ตอนพืชกำลังโต', cost: 490, add: { N: 30, P: 0, K: 0 }, best: 'top', color: '#2f8f45' },
    f2100: {
      name: '21-0-0', tag: 'แอมโมเนียมซัลเฟต', desc: 'ใช้เมื่อดินขาด N ไม่มาก ถุงถูกกว่ายูเรียราว 30% แต่ N ไม่ถึงครึ่ง เงินเท่ากันได้ N น้อยกว่า ใส่ติดกัน 2 ฤดูดินเปรี้ยว',
      cost: 340, add: { N: 14, P: 0, K: 0 }, best: 'top', acidify: 2, color: '#717a86',
      tip: '21-0-0 ให้กำมะถันด้วย แต่ทำให้ดินเปรี้ยวขึ้นทุกฤดูที่ใส่ ใส่ติดกัน 2 ฤดู พืชจะใช้ฟอสฟอรัสได้น้อยลงและผลผลิตลด สลับไปใช้ยูเรีย หรือใส่ปูนโดโลไมท์ตอนปลูก',
    },
    f2577: { name: '25-7-7', tag: 'N สูง มี P K', desc: 'ใช้เมื่อดินขาด N และขาด P K นิดหน่อย ใส่ช่วงพืชกำลังโต', cost: 580, add: { N: 20, P: 5, K: 5 }, best: 'top', color: '#c2417f' },
    f0060: { name: '0-0-60', tag: 'โพแทสเซียม', desc: 'ใช้เมื่อดินขาด K ช่วยให้เมล็ดหนัก หัวใหญ่ ใส่ช่วงสร้างผลผลิต', cost: 440, add: { N: 0, P: 0, K: 30 }, best: 'top', color: '#d07d18' },
  };

  /* Soil acidity, per plot (0 = normal). Each season a plot gets a fertilizer with acidify (21-0-0) it rises by
     that much, and that harvest already uses the new level. Dolomite bought at planting lowers it before the crop
     grows; organic fertilizer and the ปอเทือง fallow lower it a little after the season (acidCut).
     From `sour` up the soil is acid (pH low): the crop can use only part of the P in the soil and fertilizer
     (pUse, P is locked up by iron and aluminium) and loses some yield (loss). */
  MF.ACIDITY = {
    sour: 4,
    max: 8,
    levels: [
      { from: 4, pUse: 0.7, loss: 0.05 },
      { from: 6, pUse: 0.55, loss: 0.08 },
    ],
  };

  /* Soil fixes bought at planting, one bag per plot, for crops and the fallow. Offered once a plot's soil has
     started to turn acid. Priced like the fertilizers: Thai retail per 50 kg / retail urea x 490. */
  MF.AMENDMENTS = {
    dolomite: {
      name: 'ปูนโดโลไมท์', short: 'โดโลไมท์', icon: 'sack', cost: 100, color: '#b9a88a', acidCut: 6,
      desc: 'แก้ดินเปรี้ยว และเพิ่มแคลเซียมกับแมกนีเซียมให้ดิน หว่านตอนเตรียมแปลงก่อนปลูก',
    },
  };

  MF.PRODUCT_GROUPS = {
    insect: 'ยาแมลง',
    bio: 'ชีวภัณฑ์',
    fungus: 'ยาโรคพืช',
    weed: 'ยาฆ่าหญ้า',
  };

  MF.PRODUCTS = {
    pymetrozine: { name: 'ไพมีโทรซีน', group: 'insect', cost: 450, desc: 'ยาเพลี้ย ทำให้แมลงปากดูดหยุดกิน' },
    imidacloprid: { name: 'อิมิดาโคลพริด', group: 'insect', cost: 350, desc: 'ยาดูดซึม กำจัดแมลงปากดูด เช่น เพลี้ยไฟ' },
    emamectin: { name: 'อีมาเมกตินเบนโซเอต', group: 'insect', cost: 500, desc: 'ยากำจัดหนอนผีเสื้อ เช่น หนอนกระทู้' },
    bt: { name: 'เชื้อบีที (Bt)', group: 'bio', cost: 300, desc: 'กำจัดหนอน ปลอดภัยต่อคนและแมลงที่มีประโยชน์' },
    cypermethrin: { name: 'ไซเปอร์เมทริน', group: 'insect', cost: 250, desc: 'ยาฆ่าแมลงแบบสัมผัส ออกฤทธิ์กว้าง ฆ่าแมลงดีไปด้วย' },
    spinetoram: { name: 'สไปนีโทแรม', group: 'insect', cost: 550, distractor: false, desc: 'ยาแมลงกลุ่มใหม่ ใช้กำจัดเพลี้ยไฟ' },
    abamectin: { name: 'อะบาเมกติน', group: 'insect', cost: 350, distractor: false, desc: 'ยากำจัดแมลงและไร ใช้กำจัดเพลี้ยไฟ' },
    fipronil: { name: 'ฟิโพรนิล', group: 'insect', cost: 400, distractor: false, desc: 'ยาแมลงแบบดูดซึม ใช้กำจัดเพลี้ยไฟ' },
    /* dill diseases, from BK's notes for Nakhon Phanom */
    carboxin: { name: 'คาร์บ็อกซิน', group: 'fungus', cost: 450, distractor: false, desc: 'ยากันราแบบดูดซึม ใช้กับโรคเน่าคอดินในระยะกล้า' },
    trichoderma: { name: 'เชื้อราไตรโคเดอร์มา', group: 'bio', cost: 250, distractor: false, desc: 'เชื้อราดีช่วยป้องกันเชื้อโรคในดิน ได้ผลดีที่สุดเมื่อคลุกดินตั้งแต่เตรียมแปลง' },
    propineb: { name: 'โพรพิเนบ', group: 'fungus', cost: 300, distractor: false, desc: 'ยากันราแบบสัมผัส ฉีดเคลือบใบป้องกันโรคใบจุดก่อนฝนชุก' },
    azoxydifeno: { name: 'อะซอกซีสโตรบิน + ไดฟีโนโคนาโซล', group: 'fungus', cost: 650, distractor: false, desc: 'ยากันราสูตรผสมแบบดูดซึม ทั้งป้องกันและรักษาโรคใบจุด' },
    hexaconazole: { name: 'เฮกซะโคนาโซล', group: 'fungus', cost: 400, distractor: false, desc: 'ยากันราแบบดูดซึม ใช้กับโรคราแป้ง' },
    propiconazole: { name: 'โพรพิโคนาโซล', group: 'fungus', cost: 450, distractor: false, desc: 'ยากันราแบบดูดซึม ใช้กับโรคราแป้ง' },
    sulfur: { name: 'กำมะถันผง (ชนิดละลายน้ำ)', group: 'fungus', cost: 200, distractor: false, heatBurn: 0.15, desc: 'ใช้กับโรคราแป้ง ราคาถูก ห้ามพ่นตอนอากาศร้อนจัด ใบจะไหม้' },
    fosetyl: { name: 'ฟอสอีทิล-อะลูมิเนียม', group: 'fungus', cost: 500, distractor: false, desc: 'ยากันราแบบดูดซึม ใช้กับโรครากเน่าโคนเน่า' },
    etridiazole: { name: 'อีทริไดอะโซล', group: 'fungus', cost: 450, distractor: false, desc: 'ยากันราในดิน ใช้กับโรครากเน่าโคนเน่า' },
    tricyclazole: { name: 'ไตรไซคลาโซล', group: 'fungus', cost: 450, desc: 'ยากันรา ใช้เฉพาะโรคไหม้ข้าว' },
    metalaxyl: { name: 'เมทาแลกซิล', group: 'fungus', cost: 400, desc: 'ยากันรา ใช้เฉพาะโรคราน้ำค้าง' },
    mancozeb: { name: 'แมนโคเซบ', group: 'fungus', cost: 300, desc: 'ยากันราแบบป้องกัน ราคาถูก ใช้ก่อนเกิดโรค ถ้าโรคเป็นแล้วได้ผลน้อย' },
    difenoconazole: { name: 'ไดฟีโนโคนาโซล', group: 'fungus', cost: 550, distractor: false, desc: 'ยากันราแบบดูดซึม ทั้งป้องกันและรักษาโรคใบจุด ราคาสูงกว่ายาพื้นฐาน' },
    bispyribac: { name: 'บิสไพริแบค-โซเดียม', group: 'weed', cost: 400, desc: 'ยาฆ่าหญ้าในนาข้าว ไม่ทำลายต้นข้าว' },
    atrazine: { name: 'อะทราซีน', group: 'weed', cost: 350, desc: 'ยาคุมวัชพืชในไร่ข้าวโพด' },
    glyphosate: { name: 'ไกลโฟเซต', group: 'weed', cost: 300, desc: 'ยาฆ่าหญ้าแบบไม่เลือกทำลาย ใช้ก่อนปลูกเท่านั้น' },
  };

  MF.EVENT_TYPES = { insect: 'แมลงศัตรูพืช', disease: 'โรคพืช', weed: 'วัชพืช' };

  /* loss = share of yield lost if nothing is done.
     correct: products that work (90%). partial: {id: effectiveness}. harmful: {id: extra crop loss}.
     A product with distractor: false is only offered where an event lists it, never as a random wrong
     answer, because it may genuinely work on pests this table does not model it for.
     notWrong: products that are never offered as a wrong answer for that one event, for the same reason.
     soil: soil-borne disease, more likely on wet plots. cure: how much the right product saves once the
     disease shows (default 0.9); soil-borne diseases are better prevented at planting (MF.PREVENTIONS). */
  MF.EVENTS = {
    bph: {
      crop: 'rice', type: 'insect', sprite: 'bug', name: 'เพลี้ยกระโดดสีน้ำตาล',
      symptom: 'แมลงตัวเล็กสีน้ำตาลเกาะดูดน้ำเลี้ยงที่โคนต้น ข้าวเหลืองแห้งเป็นวงๆ',
      loss: 0.45, correct: ['pymetrozine'], partial: { imidacloprid: 0.4 }, harmful: { cypermethrin: 0.15 },
      tip: 'เพลี้ยกระโดดเป็นแมลงปากดูด ใช้ไพมีโทรซีนที่ออกฤทธิ์เฉพาะ อย่าใช้ไซเปอร์เมทรินเพราะฆ่าแมงมุมที่กินเพลี้ย ทำให้ระบาดหนักกว่าเดิม',
    },
    blast: {
      crop: 'rice', type: 'disease', sprite: 'leafBlast', name: 'โรคไหม้ข้าว',
      symptom: 'แผลรูปตาสีน้ำตาล กลางแผลสีเทา กระจายบนใบข้าว ระบาดเมื่ออากาศเย็นและชื้น',
      loss: 0.4, correct: ['tricyclazole'], partial: { mancozeb: 0.4 }, harmful: {},
      tip: 'โรคไหม้ข้าวเกิดจากเชื้อรา ใช้ไตรไซคลาโซล และลดปุ๋ยไนโตรเจนช่วงที่มีหมอกหรือความชื้นสูง',
    },
    barnyard: {
      crop: 'rice', type: 'weed', sprite: 'weed', name: 'หญ้าข้าวนก',
      symptom: 'หญ้าหน้าตาคล้ายต้นข้าวขึ้นแซมในแปลง แย่งปุ๋ยและแสงแดด',
      loss: 0.25, correct: ['bispyribac'], partial: {}, harmful: { glyphosate: 0.7, atrazine: 0.3 },
      tip: 'ในนาข้าวต้องใช้ยาฆ่าหญ้าแบบเลือกทำลาย เช่น บิสไพริแบค-โซเดียม ถ้าใช้ไกลโฟเซต ต้นข้าวจะตายไปด้วย',
    },
    faw: {
      crop: 'corn', type: 'insect', sprite: 'worm', name: 'หนอนกระทู้ข้าวโพดลายจุด',
      symptom: 'ใบเป็นรูพรุน มีขุยมูลหนอนในยอด หัวหนอนมีลายรูปตัว Y กลับหัว',
      loss: 0.45, correct: ['emamectin'], partial: { bt: 0.6, cypermethrin: 0.3 }, harmful: {},
      tip: 'หนอนกระทู้ลายจุดหลบอยู่ในยอด ใช้อีมาเมกตินเบนโซเอตพ่นให้ลงกรวยยอด',
    },
    downy: {
      crop: 'corn', type: 'disease', sprite: 'leafDowny', name: 'โรคราน้ำค้างข้าวโพด',
      symptom: 'ใบเป็นทางสีเหลืองซีดยาวตามใบ ใต้ใบมีผงสีขาวตอนเช้า ต้นแคระแกร็น',
      loss: 0.5, correct: ['metalaxyl'], partial: { mancozeb: 0.3 }, harmful: {}, cure: 0.7,
      tip: 'ราน้ำค้างระบาดตอนอากาศชื้น เชื้อเข้าไปในต้นแล้วรักษาได้ไม่เต็มที่ ใช้เมทาแลกซิล และควรคลุกเมล็ดพันธุ์ก่อนปลูก',
    },
    cornweed: {
      crop: 'corn', type: 'weed', sprite: 'weed', name: 'วัชพืชในไร่ข้าวโพด',
      symptom: 'ผักโขมหนามและหญ้าตีนกาขึ้นหนาแน่น ช่วงที่ต้นข้าวโพดยังเล็ก',
      loss: 0.25, correct: ['atrazine'], partial: {}, harmful: { glyphosate: 0.6, bispyribac: 0.2 },
      tip: 'อะทราซีนใช้คุมวัชพืชในไร่ข้าวโพดได้ ส่วนไกลโฟเซตจะทำให้ข้าวโพดตายไปด้วย',
    },
    thrips: {
      crop: 'shallot', type: 'insect', sprite: 'thrips', name: 'เพลี้ยไฟหอม', dry: true,
      symptom: 'ใบหอมเป็นรอยขีดสีขาวเงิน ปลายใบแห้ง ใบบิดงอ ระบาดหนักช่วงอากาศแห้ง',
      loss: 0.4, correct: ['imidacloprid', 'spinetoram', 'abamectin', 'fipronil'], partial: { cypermethrin: 0.3 }, harmful: {},
      tip: 'เพลี้ยไฟเป็นแมลงปากดูด ใช้ได้หลายตัว เช่น อิมิดาโคลพริด สไปนีโทแรม อะบาเมกติน ฟิโพรนิล และควรสลับกลุ่มยาเพื่อไม่ให้ดื้อยา',
    },
    beetarmy: {
      crop: 'shallot', type: 'insect', sprite: 'worm', name: 'หนอนกระทู้หอม',
      symptom: 'หนอนเจาะเข้าไปในหลอดใบหอม กินเนื้อใบจนเหลือแต่เยื่อบางๆ',
      loss: 0.5, correct: ['emamectin', 'bt'], partial: { cypermethrin: 0.2 }, harmful: {},
      tip: 'หนอนกระทู้หอมดื้อยาง่าย ใช้เชื้อบีทีหรืออีมาเมกตินเบนโซเอต',
    },
    purple: {
      crop: 'shallot', type: 'disease', sprite: 'leafPurple', name: 'โรคใบจุดสีม่วง',
      symptom: 'แผลรูปไข่สีม่วงมีขอบเหลืองบนใบหอม ใบหักพับ ระบาดเมื่อมีหมอกหรือน้ำค้าง',
      loss: 0.4, correct: ['difenoconazole'], partial: { mancozeb: 0.4 }, harmful: {},
      tip: 'โรคใบจุดสีม่วงเกิดจากเชื้อรา แมนโคเซบใช้ป้องกันก่อนเกิดโรค ถ้าเป็นแล้วต้องใช้ไดฟีโนโคนาโซลที่ทั้งป้องกันและรักษาได้ แม้ราคาจะสูงกว่า',
    },
    cutworm: {
      crop: 'waterspinach', type: 'insect', sprite: 'worm', name: 'หนอนกระทู้ผัก',
      symptom: 'ใบถูกกัดกินจนเป็นรูพรุน หนอนออกกินตอนกลางคืน กลางวันหลบอยู่ใต้ดินโคนต้น',
      loss: 0.4, correct: ['bt', 'emamectin'], partial: { cypermethrin: 0.3 }, harmful: {},
      tip: 'หนอนกระทู้ผักออกกินตอนกลางคืน ใช้เชื้อบีทีหรืออีมาเมกตินเบนโซเอต ฉีดพ่นช่วงเย็น',
    },
    whiterust: {
      crop: 'waterspinach', type: 'disease', sprite: 'leafRust', name: 'โรคราสนิมขาว',
      symptom: 'ใต้ใบมีจุดนูนสีขาวคล้ายผงแป้ง ด้านบนใบเป็นจุดสีเหลือง ใบบิดเบี้ยว',
      loss: 0.35, correct: ['metalaxyl'], partial: { mancozeb: 0.4 }, harmful: {},
      tip: 'ราสนิมขาวระบาดตอนอากาศชื้น ใช้เมทาแลกซิล ส่วนแมนโคเซบใช้ป้องกันก่อนเกิดโรค',
    },
    dbm: {
      crop: 'kale', type: 'insect', sprite: 'worm', name: 'หนอนใยผัก',
      symptom: 'หนอนตัวเล็กสีเขียวกินผิวใบจนเป็นรูโปร่งแสง ถูกตัวแล้วดิ้นทิ้งตัวลงด้วยเส้นใย',
      loss: 0.5, correct: ['bt', 'spinetoram', 'emamectin'], partial: { cypermethrin: 0.1 }, harmful: {},
      tip: 'หนอนใยผักดื้อยาเร็วมาก ใช้เชื้อบีที สไปนีโทแรม หรืออีมาเมกตินเบนโซเอต สลับกลุ่มกัน และไม่ควรใช้ไซเปอร์เมทริน',
    },
    aphid: {
      crop: 'kale', type: 'insect', sprite: 'bug', name: 'เพลี้ยอ่อน',
      symptom: 'แมลงตัวเล็กสีเขียวอ่อนเกาะกลุ่มใต้ใบและยอดอ่อน ดูดน้ำเลี้ยงจนใบหงิกงอ',
      loss: 0.3, correct: ['imidacloprid'], partial: {}, harmful: {}, notWrong: ['pymetrozine', 'cypermethrin'],
      tip: 'เพลี้ยอ่อนเป็นแมลงปากดูด ใช้ยาดูดซึมอย่างอิมิดาโคลพริด',
    },
    kaledowny: {
      crop: 'kale', type: 'disease', sprite: 'leafDowny', name: 'โรคราน้ำค้างคะน้า',
      symptom: 'ใบมีจุดเหลืองเป็นเหลี่ยม ใต้ใบมีขุยราสีขาวเทาตอนเช้า ระบาดตอนอากาศเย็นและชื้น',
      loss: 0.4, correct: ['metalaxyl'], partial: { mancozeb: 0.4 }, harmful: {},
      tip: 'ราน้ำค้างใช้เมทาแลกซิล ส่วนแมนโคเซบใช้ป้องกันก่อนเกิดโรค',
    },
    dampingoff: {
      crop: 'dill', type: 'disease', sprite: 'leafRot', name: 'โรคเน่าคอดิน',
      symptom: 'ต้นกล้ามีแผลช้ำสีน้ำตาลที่โคนต้นแล้วหักพับลง เกิดเมื่อดินชื้นมากและระบายน้ำไม่ดี',
      loss: 0.45, correct: ['metalaxyl', 'carboxin'], partial: { trichoderma: 0.5 }, harmful: {}, soil: true, cure: 0.6,
      tip: 'โรคเน่าคอดินพบในระยะกล้า ใช้เมทาแลกซิลหรือคาร์บ็อกซินพ่นหรือราดโคนต้น ป้องกันระยะยาวด้วยการคลุกเมล็ดก่อนปลูก และผสมเชื้อราไตรโคเดอร์มากับดินขี้จอกตอนเตรียมแปลง',
    },
    leafspot: {
      crop: 'dill', type: 'disease', sprite: 'leafBlast', name: 'โรคใบจุด',
      symptom: 'จุดสีน้ำตาลหรือเหลืองบนใบและก้านใบ ถ้าระบาดหนักใบไหม้แห้งตาย พบมากช่วงฝนชุกหรือน้ำค้างจัด',
      loss: 0.4, correct: ['azoxydifeno'], partial: { propineb: 0.6, mancozeb: 0.6 }, harmful: {},
      tip: 'โพรพิเนบหรือแมนโคเซบใช้ฉีดเคลือบใบก่อนฝนชุก ถ้าโรคเป็นแล้วใช้อะซอกซีสโตรบิน + ไดฟีโนโคนาโซล และปลูกให้โปร่งเพื่อลดความชื้น',
    },
    powdery: {
      crop: 'dill', type: 'disease', sprite: 'leafRust', name: 'โรคราแป้ง', dry: true,
      symptom: 'มีผงสีขาวคล้ายแป้งเกาะตามใบและก้าน ระบาดดีตอนอากาศเย็นและแห้ง',
      loss: 0.35, correct: ['hexaconazole', 'propiconazole', 'sulfur'], partial: {}, harmful: {},
      tip: 'โรคราแป้งชอบอากาศเย็นและแห้ง ใช้เฮกซะโคนาโซล โพรพิโคนาโซล หรือกำมะถันผง แต่อย่าพ่นกำมะถันตอนอากาศร้อนจัด ใบจะไหม้',
    },
    rootrot: {
      crop: 'dill', type: 'disease', sprite: 'leafRot', name: 'โรครากเน่าโคนเน่า',
      symptom: 'ใบเหลืองจากใบล่างขึ้นมา โคนต้นช้ำสีน้ำตาลเข้ม รากเน่าเปื่อยหลุดง่าย เกิดในแปลงที่น้ำขังแฉะ',
      loss: 0.45, correct: ['fosetyl', 'etridiazole', 'metalaxyl'], partial: { trichoderma: 0.5 }, harmful: {}, notWrong: ['mancozeb'], soil: true, cure: 0.6,
      tip: 'โรครากเน่าโคนเน่าเกิดในดินแฉะน้ำขัง ใช้ฟอสอีทิล-อะลูมิเนียมหรืออีทริไดอะโซล ยกร่องให้น้ำระบายดี และใช้ไตรโคเดอร์มาป้องกันเชื้อในดิน',
    },
  };

  /* Four plots with different soil and terrain. */
  MF.PLOTS = [
    { name: 'แปลง 1', terrain: 'ที่ลุ่ม ดินเหนียว', wet: true, note: 'อุ้มน้ำดี เสี่ยงน้ำท่วม', soil: { N: 50, P: 30, K: 45 }, droughtMult: 0.8, floodMult: 1.4, irrigateCost: 400 },
    { name: 'แปลง 2', terrain: 'ที่ดอน ดินร่วนปนทราย', note: 'น้ำไม่ขัง แต่แห้งเร็ว', soil: { N: 35, P: 40, K: 30 }, droughtMult: 1.3, floodMult: 0.3, irrigateCost: 400 },
    { name: 'แปลง 3', terrain: 'ดินร่วน', note: 'ดินดี ปลูกได้หลากหลาย', soil: { N: 45, P: 40, K: 45 }, droughtMult: 1, floodMult: 1, irrigateCost: 400 },
    { name: 'แปลง 4', terrain: 'ริมโขง ดินตะกอน', wet: true, note: 'ดินตะกอนอุดมสมบูรณ์ สูบน้ำโขงได้ถูก แต่หน้าฝนน้ำโขงขึ้นท่วมพืชที่ไม่ทนน้ำ', soil: { N: 40, P: 35, K: 40 }, droughtMult: 0.3, floodMult: 1.5, irrigateCost: 150, riverRise: { rain: 0.4 } },
  ];

  /* Bought at planting, they lower the chance of the listed diseases (share of the chance removed).
     Shown only for crops that have one of those diseases. */
  MF.PREVENTIONS = {
    seedcoat: {
      name: 'คลุกเมล็ดด้วยสารกันรา', short: 'คลุกเมล็ด', icon: 'bottle', cost: 100, color: '#2f74c9',
      desc: 'คลุกเมล็ดพันธุ์ก่อนปลูก ป้องกันเชื้อราที่ทำลายต้นกล้า',
      prevents: { dampingoff: 0.8, downy: 0.7 },
    },
    tricho: {
      name: 'ไตรโคเดอร์มาผสมดินขี้จอก', short: 'ไตรโคเดอร์มา', icon: 'sack', cost: 250, color: '#2f9c8f',
      desc: 'ผสมเชื้อราไตรโคเดอร์มากับดินขี้จอกตอนเตรียมแปลง ป้องกันเชื้อโรคในดินอย่างยั่งยืน',
      prevents: { dampingoff: 0.6, rootrot: 0.6 },
    },
  };

  MF.NUTRIENT_NAMES = { N: 'ไนโตรเจน', P: 'ฟอสฟอรัส', K: 'โพแทสเซียม' };
  /* what to use for the nutrients a harvest came up short of; the key lists the short ones in N P K order */
  MF.NUTRIENT_FIX = {
    N: '46-0-0 ถ้าขาดไม่มาก 21-0-0 ก็พอ หรือปลูกปอเทือง',
    P: '16-20-0',
    K: '0-0-60',
    NP: '30-20-0 ที่ให้ทั้ง N และ P',
    NK: '20-8-8 หรือ 25-7-7 ถ้าขาด K มากใช้ 0-0-60 คู่กับ 46-0-0',
    PK: '15-15-15 หรือ 16-20-0 คู่กับ 0-0-60',
    NPK: '15-15-15 แล้วแต่งหน้าเพิ่มตามธาตุที่ยังขาด',
  };

  function money(n) { return n.toLocaleString('en-US'); }

  /* Coach dialogue from Lung Phan of the Thanapun Farmcare shop. */
  MF.TUTORIAL = {
    welcome: [
      'สวัสดีครับ ผมลุงพันธ์ จากธนาพันธ์ ฟาร์มแคร์ ยินดีต้อนรับสู่ไร่ของคุณ',
      'คุณมีทุน ' + money(MF.CONFIG.startMoney) + ' บาท และเวลา 1 ปี (3 ฤดู) ทำเงินให้ถึง ' + MF.CONFIG.stars.map(money).join(' / ') + ' บาท เพื่อรับดาว 1-3 ดวง',
      'แต่ละฤดูมี 3 ช่วง: เตรียมปลูก, ดูแล, เก็บเกี่ยว ตอนนี้เป็นฤดูฝน เหมาะกับข้าว ข้าวโพด และผักบุ้ง',
      'แปลง 4 อยู่ริมแม่น้ำโขง ดินตะกอนดี สูบน้ำได้ถูก แต่หน้าฝนน้ำโขงขึ้น พืชที่ไม่ทนน้ำจะเสียหาย',
      'แตะที่แปลงเพื่อเลือกพืชและปุ๋ยรองพื้น อย่าลืมดูพยากรณ์อากาศด้านบนก่อนตัดสินใจ',
    ],
    plotSheet: [
      'แถบสีคือธาตุอาหารในดิน N = ไนโตรเจน ทำให้ต้นโต ใบเขียว, P = ฟอสฟอรัส ช่วยราก, K = โพแทสเซียม ทำให้ผลผลิตหนัก หัวใหญ่',
      'ขีดสีดำคือระดับที่พืชต้องการ ถ้าแถบสั้นกว่าขีด ผลผลิตจะลดลง ใต้แถบบอกว่ายังขาดธาตุไหนเท่าไหร่',
      'เลือกปุ๋ยตามธาตุที่ดินขาด ไม่ใช่ตามชนิดพืช เช่น ขาด N กับ P แต่ K พอ ใช้ 30-20-0 ขาดครบทั้งสามตัวใช้ 15-15-15',
      'ราคาปุ๋ยในเกมเทียบสัดส่วนจากราคาเฉลี่ยร้านค้าในไทย ถุงที่ถูกกว่าไม่ได้คุ้มกว่าเสมอ ดูว่าได้ธาตุที่ดินขาดเท่าไหร่',
    ],
    care: [
      'ช่วงดูแล: อาจเจอแมลง โรค หรือวัชพืช อ่านอาการแล้วเลือกยาให้ตรงกับปัญหา ใช้ผิดเสียเงินฟรี บางชนิดยังทำให้แย่ลง',
      'ช่วงนี้ใส่ปุ๋ยแต่งหน้าได้อีก 1 ครั้งต่อแปลง ดูว่ายังขาดธาตุไหน ขาด N มากใช้ 46-0-0 ขาดไม่มากใช้ 21-0-0 ขาด K ใช้ 0-0-60 แต่อย่าใส่ไนโตรเจนมากเกินไป พืชจะอ่อนแอ',
    ],
    acid: [
      'แปลงที่มีป้ายดินเปรี้ยวหรือดินเริ่มเปรี้ยว ได้ 21-0-0 มา ดินเป็นกรดขึ้น ใส่ติดกัน 2 ฤดูดินจะเปรี้ยว พืชดึงฟอสฟอรัสไปใช้ได้น้อยลง และผลผลิตลด',
      'แตะที่แปลงแล้วเลือกใส่ปูนโดโลไมท์ตอนปลูก ดินจะหายเปรี้ยว หรือสลับไปใช้ยูเรีย ปุ๋ยอินทรีย์และปอเทืองก็ช่วยลดได้เล็กน้อย',
    ],
    harvest: ['นี่คือผลผลิตของฤดูนี้ ลุงสรุปไว้ให้ว่าอะไรทำให้ผลผลิตลดลง เอาไปปรับใช้ฤดูหน้านะครับ'],
    cool: [
      'ฤดูหนาวมาแล้ว หอมแดง คะน้า และผักชีลาวชอบอากาศเย็น ส่วนข้าวโพดก็ปลูกหลังนาได้',
      'ผักกินใบ ถ้าไม่ใช้ยาเคมี หรือใช้ชีวภัณฑ์ เช่น เชื้อบีที ไตรโคเดอร์มา จะขายเป็นผักปลอดภัย ได้ราคาเพิ่ม 15%',
      'ผักชีลาวเป็นโรคในดินง่าย โดยเฉพาะแปลงที่ชื้น โรคพวกนี้รักษาตอนเป็นแล้วได้ผลไม่เต็มที่ คลุกเมล็ดหรือใส่ไตรโคเดอร์มาตั้งแต่ปลูกจะช่วยลดโอกาสเกิดโรค',
    ],
    hot: ['ฤดูร้อนเป็นฤดูสุดท้าย น้ำน้อย แดดจัด ทุกพืชได้ผลผลิตต่ำ ถ้าจะปลูก แปลงริมโขงสูบน้ำได้ถูกกว่า แปลงที่ไม่คุ้มก็ปล่อยว่างประหยัดทุนได้'],
  };
})(typeof window !== 'undefined' ? window : globalThis);
