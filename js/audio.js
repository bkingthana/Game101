/* The Magic Farmcare - slow-life Mekong riverside music and 8-bit sound effects, all made with the
   Web Audio API (no audio files). Browsers only allow sound after the player taps something, so
   unlock() is called from a button. */
(function (root) {
  var MF = (root.MF = root.MF || {});

  var ctx = null, master = null, musicBus = null, sfxBus = null, vibrato = null;
  var musicOn = true, sfxOn = true;
  var timer = null, step = 0, nextTime = 0, riverStop = null;

  /* ---------- background music: an evening by the Mekong ----------
     A slow lai in the mode of lai sutsanaen (G A C D E), the calm "mother" lai of the khaen, with
     the khaen's drone pipes on G and D under everything and the river lapping at the bank.
     Part A: the wot (round bamboo panpipe) sings the tune over slow, ringing phin arpeggios.
     Part B: the khaen takes the tune, the ponglang echoes it an octave up, and a soft frame drum
     and ching mark the beat. */
  var BPM = 72, E8 = 60 / BPM / 2, BAR = 8, SECTION = 8 * BAR;
  var FORM = ['A', 'B', 'A', 'B'];
  var SONG = FORM.length * SECTION;
  // tunes in eighth notes, 8 bars each; 0 = the note before keeps sounding
  var WOT_TUNE = [
    74, 0, 0, 0, 76, 0, 74, 72,
    69, 0, 0, 0, 0, 0, 67, 69,
    72, 0, 0, 74, 76, 0, 79, 0,
    76, 0, 0, 0, 0, 0, 0, 0,
    79, 0, 81, 0, 79, 0, 76, 0,
    74, 0, 0, 72, 69, 0, 0, 0,
    72, 0, 69, 0, 67, 0, 64, 0,
    67, 0, 0, 0, 0, 0, 0, 0,
  ];
  var KHAEN_TUNE = [
    67, 0, 69, 72, 74, 0, 0, 0,
    72, 0, 69, 0, 67, 0, 0, 0,
    64, 0, 67, 0, 69, 0, 72, 0,
    69, 0, 0, 0, 0, 0, 0, 0,
    74, 0, 76, 0, 79, 0, 76, 74,
    72, 0, 0, 0, 74, 0, 72, 69,
    67, 0, 69, 0, 72, 0, 69, 0,
    67, 0, 0, 0, 0, 0, 0, 0,
  ];
  // phin arpeggios over two bars, low G and D strings with the tune's notes above
  var PHIN_ARP = [55, 62, 67, 69, 67, 62, 64, 62, 55, 62, 67, 72, 69, 67, 64, 62];

  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // a soft, dark hall reverb for the open riverside, made from decaying noise
  function impulse(c, secs) {
    var len = Math.floor(c.sampleRate * secs), buf = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        lp += 0.3 * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.pow(1 - i / len, 3);
      }
    }
    return buf;
  }

  // the output chain for a context: master, music (dry plus reverb) and effects buses, and the
  // slow wobble the reeds and the panpipe share
  function makeBuses(c) {
    var m = c.createGain(); m.gain.value = 0.7; m.connect(c.destination);
    var mus = c.createGain(); mus.gain.value = 0.2; mus.connect(m);
    var verb = c.createConvolver(), wet = c.createGain();
    verb.buffer = impulse(c, 2.8); wet.gain.value = 0.35;
    mus.connect(verb); verb.connect(wet); wet.connect(m);
    var fx = c.createGain(); fx.gain.value = 0.45; fx.connect(m);
    var lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 5; depth.gain.value = 7; // cents
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

  /* ---------- instruments of the Mekong ---------- */

  // khaen: two slightly detuned reeds through a soft filter; the drone breathes with the beat
  function khaen(f, t, dur, vol, drone) {
    var lp = ctx.createBiquadFilter(), g = ctx.createGain(), beat = 2 * E8;
    lp.type = 'lowpass'; lp.frequency.value = drone ? 1100 : 2000; lp.Q.value = 0.7;
    [-5, 5].forEach(function (cents) {
      var o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents;
      vibrato.connect(o.detune);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (drone ? 0.25 : 0.06));
    if (drone) {
      for (var b = 1; b * beat < dur - 0.3; b++) {
        g.gain.linearRampToValueAtTime(vol * 0.72, t + (b - 0.5) * beat);
        g.gain.linearRampToValueAtTime(vol, t + b * beat);
      }
    }
    g.gain.linearRampToValueAtTime(vol * 0.85, t + dur - 0.12);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g); g.connect(musicBus);
  }

  // wot: the round Isan panpipe, a breathy bamboo flute that scoops up into each note
  function wot(f, t, dur, vol) {
    var g = ctx.createGain(), over = ctx.createGain();
    [[1, 'sine', g], [2, 'triangle', over]].forEach(function (h) {
      var o = ctx.createOscillator();
      o.type = h[1];
      o.frequency.setValueAtTime(f * h[0] * 0.985, t);
      o.frequency.linearRampToValueAtTime(f * h[0], t + 0.1);
      vibrato.connect(o.detune);
      o.connect(h[2]); o.start(t); o.stop(t + dur + 0.4);
    });
    over.gain.value = 0.16;
    over.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.12);
    g.gain.linearRampToValueAtTime(vol * 0.8, t + Math.max(0.2, dur - 0.1));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.35);
    g.connect(musicBus);
    noise(musicBus, t, 0.2, vol * 0.3, 'bandpass', f * 2); // breath at the start of the note
  }

  // phin: a plucked string whose tone mellows as it rings, with the slight pitch drop of a pluck
  function pluck(f, t, vol, ring) {
    var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.01, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(3400, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + ring * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    o.connect(lp); lp.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + ring + 0.05);
  }

  // ponglang: a wooden bar, its fundamental plus a short inharmonic knock
  function ponglang(f, t, vol) {
    [[1, vol, 0.5], [3.9, vol * 0.18, 0.08]].forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * p[0];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p[1], t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
      o.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + p[2] + 0.02);
    });
  }

  // a soft frame drum, and the ching's long ring
  function drum(t, vol) { tone(musicBus, 96, t, 0.4, 'sine', vol, 58); }
  function ching(t, vol) {
    noise(musicBus, t, 0.25, vol, 'bandpass', 8200);
    tone(musicBus, 3150, t, 0.9, 'sine', vol * 0.4);
    tone(musicBus, 4730, t, 0.6, 'sine', vol * 0.25);
  }

  // a few bird calls over the water
  function birds(t) {
    for (var n = 0; n < 3; n++) tone(musicBus, 2500 + n * 180, t + n * 0.14, 0.09, 'sine', 0.05, 3400 + n * 150);
  }

  // the Mekong lapping at the bank: soft noise that swells and falls; runs while the music plays
  function river(c, bus) {
    var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; src.loop = true;
    bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.6;
    g.gain.value = 0.09;
    var swells = [[0.11, 0.05], [0.37, 0.025]].map(function (s) {
      var lfo = c.createOscillator(), depth = c.createGain();
      lfo.frequency.value = s[0]; depth.gain.value = s[1];
      lfo.connect(depth); depth.connect(g.gain); lfo.start();
      return lfo;
    });
    src.connect(bp); bp.connect(g); g.connect(bus);
    src.start();
    return function () {
      try { src.stop(); swells.forEach(function (l) { l.stop(); }); } catch (e) { /* already stopped */ }
      g.disconnect();
    };
  }

  // how many eighths a tune note lasts: until the next note, at most a bar
  function hold(tune, k) {
    var n = 1;
    while (n < 8 && k + n < tune.length && !tune[k + n]) n++;
    return n;
  }

  function musicStep(i, t) {
    var pos = i % SONG, part = FORM[Math.floor(pos / SECTION)], inPart = pos % SECTION;
    var bar = Math.floor(inPart / BAR), e = inPart % BAR, k = bar * 8 + e;
    // the khaen's drone pipes, G and D, blown afresh every bar
    if (e === 0) {
      khaen(freq(55), t, BAR * E8 + 0.2, 0.11, true);
      khaen(freq(62), t, BAR * E8 + 0.2, 0.075, true);
    }
    if (part === 'A') {
      if (WOT_TUNE[k]) wot(freq(WOT_TUNE[k]), t, hold(WOT_TUNE, k) * E8, 0.32);
      pluck(freq(PHIN_ARP[(bar % 2) * 8 + e]), t, e === 0 ? 0.13 : 0.09, 1.4);
      if (e === 4) ching(t, 0.045);
      if (bar === 2 && e === 3) birds(t);
    } else {
      if (KHAEN_TUNE[k]) khaen(freq(KHAEN_TUNE[k]), t, hold(KHAEN_TUNE, k) * E8, 0.2, false);
      if (k >= 2 && KHAEN_TUNE[k - 2]) ponglang(freq(KHAEN_TUNE[k - 2] + 12), t, 0.09);
      if (e === 0) { pluck(freq(55), t, 0.12, 1.6); pluck(freq(62), t + 0.03, 0.1, 1.6); drum(t, 0.3); tone(musicBus, freq(43), t, 1.2, 'sine', 0.22); }
      if (e === 4) { pluck(freq(67), t, 0.1, 1.4); drum(t, 0.16); tone(musicBus, freq(50), t, 1.0, 'sine', 0.16); }
      if (e === 2 || e === 6) ching(t, 0.04);
      if (bar === 5 && e === 5) birds(t);
    }
  }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.3) {
      musicStep(step, nextTime);
      nextTime += E8;
      step++;
    }
  }

  function startMusic() {
    if (!musicOn || timer || !ensure()) return;
    nextTime = ctx.currentTime + 0.05;
    riverStop = river(ctx, musicBus);
    timer = setInterval(schedule, 50);
  }

  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
    if (riverStop) riverStop();
    riverStop = null;
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
        river(off, b.music);
        for (var i = 0, t = 0.05; t < seconds - 0.5; i++, t += E8) musicStep(i, t);
      } finally {
        ctx = saved[0]; musicBus = saved[1]; vibrato = saved[2]; noiseBuf = saved[3];
      }
      return off.startRendering();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
