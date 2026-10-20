/* The Magic Farmcare - Isan-flavored background music and 8-bit sound effects, all made with the
   Web Audio API (no audio files). Browsers only allow sound after the player taps something, so
   unlock() is called from a button. */
(function (root) {
  var MF = (root.MF = root.MF || {});

  var ctx = null, master = null, musicBus = null, sfxBus = null, vibrato = null;
  var musicOn = true, sfxOn = true;
  var timer = null, step = 0, nextTime = 0;

  /* ---------- background music: a khaen and phin "lai" in the style of mor lam sing ----------
     Part A: the khaen (bamboo mouth organ) holds its drone, breathing on every beat, and leads the
     tune while the phin answers on its open strings and the ching-chap cymbals keep time.
     Part B: the phin picks a fast riff against its open string, a ponglang (log xylophone) takes
     the tune, and drums and bass bring the mor lam sing beat. Every note is from the khaen's
     lai yai, the A minor pentatonic (A C D E G). */
  var BPM = 128, S16 = 60 / BPM / 4, BAR = 16, SECTION = 8 * BAR;
  var FORM = ['A', 'A', 'B', 'B'];
  var SONG = FORM.length * SECTION;
  // tunes in eighth notes, 8 bars each; 0 = rest (the khaen holds through rests)
  var KHAEN_TUNE = [
    69, 0, 72, 74, 76, 0, 74, 72,
    69, 0, 0, 67, 69, 0, 0, 0,
    72, 74, 76, 79, 76, 74, 72, 74,
    76, 0, 0, 0, 74, 72, 69, 0,
    81, 0, 79, 76, 79, 0, 76, 74,
    76, 79, 76, 74, 72, 0, 69, 72,
    74, 0, 72, 69, 67, 69, 72, 74,
    69, 0, 0, 0, 0, 0, 0, 0,
  ];
  var PONG_TUNE = [
    81, 81, 79, 76, 79, 0, 76, 74,
    76, 0, 74, 72, 69, 0, 0, 0,
    72, 72, 74, 76, 79, 76, 74, 72,
    74, 0, 72, 69, 72, 0, 0, 0,
    81, 0, 84, 81, 79, 76, 79, 81,
    79, 76, 74, 76, 79, 0, 0, 0,
    76, 74, 72, 74, 76, 79, 76, 74,
    69, 0, 72, 0, 69, 0, 0, 0,
  ];
  // phin riff in sixteenths over two bars: melody notes alternating with the open E string
  var PHIN_RIFF = [
    69, 64, 72, 64, 74, 64, 72, 64, 69, 64, 67, 64, 69, 64, 72, 74,
    76, 64, 74, 64, 72, 64, 74, 64, 69, 64, 67, 64, 64, 0, 69, 0,
  ];
  var BASS = [45, 0, 0, 45, 0, 0, 52, 0, 45, 0, 0, 45, 0, 52, 55, 0];

  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // the output chain for a context: master, music and effects buses, and the khaen's reed wobble
  function makeBuses(c) {
    var m = c.createGain(); m.gain.value = 0.7; m.connect(c.destination);
    var mus = c.createGain(); mus.gain.value = 0.16; mus.connect(m);
    var fx = c.createGain(); fx.gain.value = 0.45; fx.connect(m);
    var lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 5.3; depth.gain.value = 6; // cents
    lfo.connect(depth); lfo.start();
    return { master: m, music: mus, sfx: fx, vibrato: depth };
  }

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      var b = makeBuses(ctx);
      master = b.master; musicBus = b.music; sfxBus = b.sfx; vibrato = b.vibrato;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(bus, f, start, dur, type, vol, slideTo) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(bus);
    o.start(start); o.stop(start + dur + 0.02);
  }

  var noiseBuf = null;
  function noise(bus, start, dur, vol, filterType, filterFreq) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = filterType || 'highpass'; f.frequency.value = filterFreq || 6000;
    g.gain.setValueAtTime(vol || 0.3, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(start); src.stop(start + dur + 0.02);
  }

  /* ---------- Isan instruments ---------- */

  // khaen: two slightly detuned reeds through a soft filter; the drone breathes with the beat
  function khaen(f, t, dur, vol, drone) {
    var lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = drone ? 1300 : 2300; lp.Q.value = 0.8;
    [-5, 5].forEach(function (cents) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents;
      vibrato.connect(o.detune);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (drone ? 0.08 : 0.03));
    if (drone) {
      for (var b = 1; b * 4 * S16 < dur - 0.15; b++) {
        g.gain.linearRampToValueAtTime(vol * 0.68, t + (b * 4 - 2) * S16);
        g.gain.linearRampToValueAtTime(vol, t + b * 4 * S16);
      }
    }
    g.gain.linearRampToValueAtTime(vol * 0.85, t + dur - 0.08);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g); g.connect(musicBus);
  }

  // phin: a bright pluck whose tone closes quickly, with the slight pitch drop of a struck string
  function pluck(f, t, vol) {
    var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.012, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(5200, t);
    lp.frequency.exponentialRampToValueAtTime(650, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(lp); lp.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.45);
  }

  // ponglang: a wooden bar, its fundamental plus a short inharmonic knock
  function ponglang(f, t, vol) {
    [[1, vol, 0.3], [3.9, vol * 0.2, 0.07]].forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * p[0];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p[1], t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
      o.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + p[2] + 0.02);
    });
  }

  function kick(t, vol) { tone(musicBus, 130, t, 0.16, 'sine', vol, 46); }
  function drum(t, vol) { noise(musicBus, t, 0.12, vol, 'lowpass', 2600); tone(musicBus, 210, t, 0.1, 'sine', vol * 0.6, 130); }
  // ching (open, ringing) and chap (closed, short): the small cymbals of Thai and Lao music
  function ching(t, vol) {
    noise(musicBus, t, 0.3, vol, 'bandpass', 8200);
    tone(musicBus, 3150, t, 0.45, 'sine', vol * 0.35);
    tone(musicBus, 4730, t, 0.35, 'sine', vol * 0.25);
  }
  function chap(t, vol) { noise(musicBus, t, 0.05, vol, 'highpass', 6000); }

  // how many eighths a khaen tune note lasts: until the next note, at most a half bar
  function hold(tune, e) {
    var n = 1;
    while (n < 4 && e + n < tune.length && !tune[e + n]) n++;
    return n;
  }

  function musicStep(i, t) {
    var pos = i % SONG, part = FORM[Math.floor(pos / SECTION)], inPart = pos % SECTION;
    var bar = Math.floor(inPart / BAR), s = inPart % BAR, e = bar * 8 + s / 2;
    // the khaen's drone pipes, A and E, blown afresh every bar
    if (s === 0) {
      khaen(freq(57), t, BAR * S16 + 0.12, 0.17, true);
      khaen(freq(64), t, BAR * S16 + 0.12, 0.12, true);
    }
    if (part === 'A') {
      if (s % 2 === 0 && KHAEN_TUNE[e]) khaen(freq(KHAEN_TUNE[e]), t, hold(KHAEN_TUNE, e) * 2 * S16, 0.3, false);
      if (s % 4 === 2) pluck(freq(s % 8 === 2 ? 64 : 69), t, 0.14);
      if (s === 0) kick(t, 0.5);
      if (s % 4 === 0) chap(t, 0.1);
      if (s % 4 === 2) ching(t, 0.07);
    } else {
      var p = PHIN_RIFF[(bar % 2) * BAR + s];
      if (p) pluck(freq(p), t, p === 64 ? 0.16 : 0.24);
      if (s % 2 === 0 && PONG_TUNE[e]) ponglang(freq(PONG_TUNE[e]), t, 0.36);
      if (BASS[s]) tone(musicBus, freq(BASS[s]), t, 0.3, 'triangle', 0.45);
      if (s === 0 || s === 8 || s === 11) kick(t, 0.62);
      if (s === 4 || s === 12) drum(t, 0.22);
      if (s % 4 === 0) chap(t, 0.12);
      if (s % 4 === 2) ching(t, 0.08);
    }
  }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.25) {
      musicStep(step, nextTime);
      nextTime += S16;
      step++;
    }
  }

  function startMusic() {
    if (!musicOn || timer || !ensure()) return;
    nextTime = ctx.currentTime + 0.05;
    timer = setInterval(schedule, 40);
  }

  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  var SFX = {
    tap: function (t) { tone(sfxBus, 880, t, 0.05, 'square', 0.25); },
    select: function (t) { tone(sfxBus, 660, t, 0.05, 'square', 0.3); tone(sfxBus, 990, t + 0.05, 0.06, 'square', 0.3); },
    coin: function (t) { tone(sfxBus, 988, t, 0.06, 'square', 0.35); tone(sfxBus, 1319, t + 0.06, 0.16, 'square', 0.35); },
    plant: function (t) { noise(sfxBus, t, 0.12, 0.4, 'lowpass', 500); tone(sfxBus, 220, t, 0.15, 'triangle', 0.6, 110); },
    spray: function (t) { noise(sfxBus, t, 0.35, 0.25, 'bandpass', 3200); },
    harvest: function (t) { [72, 76, 79, 84].forEach(function (m, i) { tone(sfxBus, freq(m), t + i * 0.07, 0.12, 'square', 0.35); }); },
    good: function (t) { [76, 79, 84].forEach(function (m, i) { tone(sfxBus, freq(m), t + i * 0.08, 0.14, 'triangle', 0.6); }); },
    bad: function (t) { [67, 64, 60].forEach(function (m, i) { tone(sfxBus, freq(m), t + i * 0.1, 0.14, 'square', 0.3); }); },
    season: function (t) { [79, 84, 88, 91].forEach(function (m, i) { tone(sfxBus, freq(m), t + i * 0.09, 0.25, 'triangle', 0.5); }); },
    star: function (t) { tone(sfxBus, freq(96), t, 0.25, 'square', 0.3); tone(sfxBus, freq(100), t + 0.08, 0.3, 'triangle', 0.4); },
    pop: function (t) { noise(sfxBus, t, 0.3, 0.18, 'lowpass', 1200); tone(sfxBus, 900, t, 0.25, 'triangle', 0.12, 300); },
    // temple bell: a soft strike with a long ring
    bell: function (t) { tone(sfxBus, freq(81), t, 1.6, 'sine', 0.5); tone(sfxBus, freq(93), t, 0.9, 'sine', 0.18); tone(sfxBus, freq(100), t, 0.4, 'triangle', 0.08); },
    fanfare: function (t) { [72, 76, 79, 84, 79, 84, 88].forEach(function (m, i) { tone(sfxBus, freq(m), t + i * 0.11, i === 6 ? 0.5 : 0.12, 'square', 0.35); }); },
  };

  MF.audio = {
    unlock: function () { if (ensure() && musicOn) startMusic(); },
    play: function (name) {
      if (!sfxOn || !SFX[name] || !ensure()) return;
      SFX[name](ctx.currentTime + 0.01);
    },
    // before unlock() this only records the setting, so no AudioContext is created without a tap
    setMusic: function (on) { musicOn = !!on; if (!musicOn) stopMusic(); else if (ctx) startMusic(); },
    setSfx: function (on) { sfxOn = !!on; },
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    // renders the first seconds of the music offline (scripts/render-music.js uses it for a preview)
    renderPreview: function (seconds, rate) {
      var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      var sr = rate || 22050, off = new OAC(1, Math.ceil(sr * seconds), sr);
      var saved = [ctx, musicBus, vibrato, noiseBuf];
      var b = makeBuses(off);
      ctx = off; musicBus = b.music; vibrato = b.vibrato; noiseBuf = null;
      try {
        for (var i = 0, t = 0.05; t < seconds - 0.5; i++, t += S16) musicStep(i, t);
      } finally {
        ctx = saved[0]; musicBus = saved[1]; vibrato = saved[2]; noiseBuf = saved[3];
      }
      return off.startRendering();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
