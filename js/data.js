/* The Magic Farmcare - game data: seasons, weather, crops, fertilizer, chemicals, pest events.
   All balance numbers live here so they can be tuned without touching the engine. */
(function (root) {
  var MF = (root.MF = root.MF || {});

  MF.CONFIG = {
    startMoney: 20000,
    years: 1,
    stars: [40000, 50000, 60000],
    minMoneyToContinue: 1000,
    forecastAccuracy: 0.7,
    naturalRecovery: 3,
    offStageEfficiency: 0.6, // fertilizer used outside its best timing
    excessNRatio: 1.5, // N above need x 1.5 = too much
    yieldJitter: 0.07,
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
  };

  MF.LAND_USES = {
    fallow: { name: 'พักดิน หว่านปอเทือง', cost: 300, add: { N: 22, P: 4, K: 6 }, note: 'ไถกลบเป็นปุ๋ยพืชสด เพิ่มไนโตรเจนให้ดิน' },
    idle: { name: 'ปล่อยว่าง', cost: 0, note: 'ไม่ปลูกอะไร ดินฟื้นตัวเองเล็กน้อย' },
  };

  /* best: 'basal' (รองพื้น ตอนปลูก) / 'top' (แต่งหน้า ช่วงดูแล) / 'any' */
  MF.FERTS = {
    f16200: { name: '16-20-0', tag: 'ปุ๋ยรองพื้น', desc: 'เร่งราก ตั้งตัวเร็ว นิยมใช้ในนาข้าว', cost: 450, add: { N: 12, P: 16, K: 0 }, best: 'basal', color: '#c9412f' },
    f151515: { name: '15-15-15', tag: 'ปุ๋ยสูตรเสมอ', desc: 'บำรุงครบทั้ง N P K ใช้ได้ทุกช่วง', cost: 550, add: { N: 12, P: 12, K: 12 }, best: 'any', color: '#2f74c9' },
    f4600: { name: '46-0-0', tag: 'ยูเรีย · ปุ๋ยแต่งหน้า', desc: 'เร่งต้น เร่งใบเขียว ใส่ตอนพืชกำลังโต', cost: 450, add: { N: 30, P: 0, K: 0 }, best: 'top', color: '#2f8f45' },
    f0060: { name: '0-0-60', tag: 'โพแทสเซียม · ปุ๋ยแต่งหน้า', desc: 'เพิ่มน้ำหนักเมล็ด หัวใหญ่ ใส่ช่วงสร้างผลผลิต', cost: 500, add: { N: 0, P: 0, K: 30 }, best: 'top', color: '#d07d18' },
    organic: { name: 'อินทรีย์', tag: 'ปุ๋ยมูลไก่อัดเม็ด', desc: 'ธาตุอาหารน้อย แต่ช่วยให้ดินร่วนซุย ดินเสื่อมช้าลง', cost: 300, add: { N: 6, P: 6, K: 6 }, best: 'basal', soilCare: true, color: '#7a5230' },
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
    bt: { name: 'เชื้อบีที (Bt)', group: 'bio', cost: 300, desc: 'ชีวภัณฑ์กำจัดหนอน ปลอดภัยต่อคนและแมลงที่มีประโยชน์' },
    cypermethrin: { name: 'ไซเปอร์เมทริน', group: 'insect', cost: 250, desc: 'ยาฆ่าแมลงแบบสัมผัส ออกฤทธิ์กว้าง ฆ่าแมลงดีไปด้วย' },
    tricyclazole: { name: 'ไตรไซคลาโซล', group: 'fungus', cost: 450, desc: 'ยากันรา ใช้เฉพาะโรคไหม้ข้าว' },
    metalaxyl: { name: 'เมทาแลกซิล', group: 'fungus', cost: 400, desc: 'ยากันรา ใช้เฉพาะโรคราน้ำค้าง' },
    mancozeb: { name: 'แมนโคเซบ', group: 'fungus', cost: 300, desc: 'ยากันราแบบป้องกัน ใช้กับโรคใบจุดได้หลายชนิด' },
    bispyribac: { name: 'บิสไพริแบค-โซเดียม', group: 'weed', cost: 400, desc: 'ยาฆ่าหญ้าในนาข้าว ไม่ทำลายต้นข้าว' },
    atrazine: { name: 'อะทราซีน', group: 'weed', cost: 350, desc: 'ยาคุมวัชพืชในไร่ข้าวโพด' },
    glyphosate: { name: 'ไกลโฟเซต', group: 'weed', cost: 300, desc: 'ยาฆ่าหญ้าแบบไม่เลือกทำลาย ใช้ก่อนปลูกเท่านั้น' },
  };

  MF.EVENT_TYPES = { insect: 'แมลงศัตรูพืช', disease: 'โรคพืช', weed: 'วัชพืช' };

  /* loss = share of yield lost if nothing is done.
     correct: products that work (90%). partial: {id: effectiveness}. harmful: {id: extra crop loss}. */
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
      loss: 0.5, correct: ['metalaxyl'], partial: { mancozeb: 0.3 }, harmful: {},
      tip: 'ราน้ำค้างระบาดตอนอากาศชื้น ใช้เมทาแลกซิล และควรคลุกเมล็ดพันธุ์ก่อนปลูก',
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
      loss: 0.4, correct: ['imidacloprid'], partial: { cypermethrin: 0.3 }, harmful: {},
      tip: 'เพลี้ยไฟเป็นแมลงปากดูด ใช้ยาดูดซึมอย่างอิมิดาโคลพริด และสลับกลุ่มยาเพื่อไม่ให้ดื้อยา',
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
      loss: 0.4, correct: ['mancozeb'], partial: {}, harmful: {},
      tip: 'โรคใบจุดสีม่วงเกิดจากเชื้อรา ใช้แมนโคเซบฉีดพ่นป้องกัน',
    },
  };

  /* Four plots with different soil and terrain. */
  MF.PLOTS = [
    { name: 'แปลง 1', terrain: 'ที่ลุ่ม ดินเหนียว', note: 'อุ้มน้ำดี เสี่ยงน้ำท่วม', soil: { N: 50, P: 30, K: 45 }, droughtMult: 0.8, floodMult: 1.4, irrigateCost: 400 },
    { name: 'แปลง 2', terrain: 'ที่ดอน ดินร่วนปนทราย', note: 'น้ำไม่ขัง แต่แห้งเร็ว', soil: { N: 35, P: 40, K: 30 }, droughtMult: 1.3, floodMult: 0.3, irrigateCost: 400 },
    { name: 'แปลง 3', terrain: 'ดินร่วน', note: 'ดินดี ปลูกได้หลากหลาย', soil: { N: 45, P: 40, K: 45 }, droughtMult: 1, floodMult: 1, irrigateCost: 400 },
    { name: 'แปลง 4', terrain: 'ดินทราย ติดสระน้ำ', note: 'ดินจืด แต่มีน้ำใช้ตลอดปี', soil: { N: 25, P: 25, K: 25 }, droughtMult: 0.3, floodMult: 0.8, irrigateCost: 150 },
  ];

  MF.NUTRIENT_NAMES = { N: 'ไนโตรเจน', P: 'ฟอสฟอรัส', K: 'โพแทสเซียม' };
  MF.NUTRIENT_FIX = { N: '46-0-0 หรือปอเทือง', P: '16-20-0', K: '0-0-60' };

  function money(n) { return n.toLocaleString('en-US'); }

  /* Coach dialogue from Lung Phan of the Thanapun Farmcare shop. */
  MF.TUTORIAL = {
    welcome: [
      'สวัสดีครับ ผมลุงพันธ์ จากร้านธนาพันธ์ ฟาร์มแคร์ ยินดีต้อนรับสู่ไร่ของคุณ',
      'คุณมีทุน ' + money(MF.CONFIG.startMoney) + ' บาท และเวลา 1 ปี (3 ฤดู) ทำเงินให้ถึง ' + MF.CONFIG.stars.map(money).join(' / ') + ' บาท เพื่อรับดาว 1-3 ดวง',
      'แต่ละฤดูมี 3 ช่วง: เตรียมปลูก, ดูแล, เก็บเกี่ยว ตอนนี้เป็นฤดูฝน เหมาะกับข้าวและข้าวโพด',
      'แตะที่แปลงเพื่อเลือกพืชและปุ๋ยรองพื้น อย่าลืมดูพยากรณ์อากาศด้านบนก่อนตัดสินใจ',
    ],
    plotSheet: [
      'แถบสีคือธาตุอาหารในดิน N = ไนโตรเจน ทำให้ต้นโต ใบเขียว, P = ฟอสฟอรัส ช่วยราก, K = โพแทสเซียม ทำให้ผลผลิตหนัก หัวใหญ่',
      'ขีดสีดำคือระดับที่พืชต้องการ ถ้าแถบสั้นกว่าขีด ผลผลิตจะลดลง ให้เลือกปุ๋ยที่เติมธาตุที่ขาด',
    ],
    care: [
      'ช่วงดูแล: อาจเจอแมลง โรค หรือวัชพืช อ่านอาการแล้วเลือกยาให้ตรงกับปัญหา ใช้ผิดเสียเงินฟรี บางชนิดยังทำให้แย่ลง',
      'ช่วงนี้ใส่ปุ๋ยแต่งหน้าได้อีก 1 ครั้งต่อแปลง เช่น 46-0-0 เร่งต้น หรือ 0-0-60 เพิ่มน้ำหนัก แต่อย่าใส่ไนโตรเจนมากเกินไป พืชจะอ่อนแอ',
    ],
    harvest: ['นี่คือผลผลิตของฤดูนี้ ลุงสรุปไว้ให้ว่าอะไรทำให้ผลผลิตลดลง เอาไปปรับใช้ฤดูหน้านะครับ'],
    cool: ['ฤดูหนาวมาแล้ว หอมแดงชอบอากาศเย็น ลงทุนสูงแต่กำไรดี ส่วนข้าวโพดก็ปลูกหลังนาได้'],
    hot: ['ฤดูร้อนเป็นฤดูสุดท้าย น้ำน้อย แดดจัด ทุกพืชได้ผลผลิตต่ำ ถ้าจะปลูก แปลงติดสระสูบน้ำได้ถูกกว่า แปลงที่ไม่คุ้มก็ปล่อยว่างประหยัดทุนได้'],
  };
})(typeof window !== 'undefined' ? window : globalThis);
