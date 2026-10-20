/* The Magic Farmcare - slow-life Mekong riverside music and 8-bit sound effects, all made with the
   Web Audio API (no audio files). Browsers only allow sound after the player taps something, so
   unlock() is called from a button. */
(function (root) {
  var MF = (root.MF = root.MF || {});

  var ctx = null, master = null, musicBus = null, sfxBus = null;
  var musicOn = true, sfxOn = true;
  var timer = null, step = 0, nextTime = 0, live = null;

  /* ---------- background music: an evening by the Mekong ----------
     A slow lai at 72 BPM in lai sutsanaen (G A C D E), the khaen's oldest and most revered mode,
     with the khaen's drone pipes on G and D breathing under everything and the river lapping at
     the bank. The form is a short opening breath (drone, phin and a far-off temple gong), then
     A B A B:
     A: the wot (round bamboo panpipe) sings the tune over a slow, ringing phin, one ching a bar.
     B: the khaen takes the tune, the ponglang answers it an octave up, and a soft hand drum,
        a low phin bass and the ching keep an unhurried beat.
     A temple gong marks the long cycle, as in Lao and Thai music: at the start and halfway. */
  var BPM = 72, E8 = 60 / BPM / 2, BAR = 8;
  var PARTS = [['I', 2], ['A', 8], ['B', 8], ['A', 8], ['B', 8]]; // [part, bars]
  var PART_AT = [], PASS = [], SONG = 0;
  PARTS.forEach(function (p, n) {
    PART_AT.push(SONG);
    SONG += p[1] * BAR;
    PASS.push(PARTS.slice(0, n).filter(function (q) { return q[0] === p[0]; }).length);
  });
  // tunes in eighth notes, 8 bars each; 0 = the note before keeps sounding, R = a breath
  var R = -1;
  var WOT_TUNE = [
    74, 0, 0, 0, 76, 0, 74, 72,
    69, 0, 0, 0, 0, R, 67, 69,
    72, 0, 0, 74, 76, 0, 79, 0,
    76, 0, 0, 0, 0, 0, R, 0,
    79, 0, 81, 0, 79, 0, 76, 0,
    74, 0, 0, 72, 69, 0, 0, R,
    72, 0, 69, 0, 67, 0, 64, 0,
    67, 0, 0, 0, 0, 0, R, 0,
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
  // the phin's slow figure over two bars: the open G and D strings with the tune's notes above
  var PHIN_FIGURE = [55, 0, 62, 67, 69, 0, 62, 0, 55, 0, 62, 0, 72, 69, 67, 0];
  // the mode across the khaen's range, for the khaen's grace notes
  var MODE = [55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];

  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function above(m) {
    for (var i = 0; i < MODE.length; i++) if (MODE[i] > m) return MODE[i];
    return m;
  }

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

  // the output chain for a context: master, music (dry plus reverb) and effects buses, plus what
  // the music shares: a long noise for breath and water, the wot's tone colour, a slow vibrato
  function makeBuses(c) {
    var m = c.createGain(); m.gain.value = 0.7; m.connect(c.destination);
    var mus = c.createGain(); mus.gain.value = 0.27; mus.connect(m);
    var verb = c.createConvolver(), wet = c.createGain();
    verb.buffer = impulse(c, 2.6); wet.gain.value = 0.35;
    mus.connect(verb); verb.connect(wet); wet.connect(m);
    var fx = c.createGain(); fx.gain.value = 0.45; fx.connect(m);
    var lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 5; depth.gain.value = 9; // cents
    lfo.connect(depth); lfo.start();
    var len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // the wot's pipes are closed at the bottom: nearly pure, with a touch of the odd overtones
    var wotWave = c.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.02, 0.09, 0, 0.025]));
    return { master: m, music: mus, sfx: fx, kit: { c: c, bus: mus, vib: depth, noise: buf, wotWave: wotWave, out: null, drone: null } };
  }

  // the music's context, output and shared parts (renderPreview swaps in an offline one)
  var M = null;

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
      master = b.master; musicBus = b.music; sfxBus = b.sfx; M = b.kit;
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

  // a gain that starts silent: a new gain node passes 1 until its first event, which lets the
  // first sample of a just-started oscillator through as a click
  function amp(c) { var g = c.createGain(); g.gain.value = 0; return g; }

  // a struck or plucked partial: a quick, click-free attack and a natural (exponential) decay
  function ring(f, t, dur, vol, type, attack, bendFrom) {
    var o = M.c.createOscillator(), g = amp(M.c);
    o.type = type || 'sine';
    o.frequency.setValueAtTime(bendFrom || f, t);
    if (bendFrom) o.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.08, dur / 3));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(M.out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // filtered noise from the shared buffer with a short swell and a slower fade
  function hiss(t, rise, dur, vol, type, f, q) {
    var c = M.c, src = c.createBufferSource(), flt = c.createBiquadFilter(), g = amp(c);
    src.buffer = M.noise; src.loop = true;
    flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(M.out);
    src.start(t, Math.random() * 3); src.stop(t + dur + 0.02);
  }

  // khaen drone: the two drone pipes, G3 and D4, held for the whole song. A khaen sounds on both
  // the in- and out-breath, so it never stops, but it softens for a moment each time the breath
  // turns. Two reeds per pipe, a few cents apart, give the slow shimmer of real bamboo reeds.
  function drone(c, out, t0) {
    var lp = c.createBiquadFilter(), g = amp(c), oscs = [], level = 1;
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
    [[55, 0.05], [62, 0.032]].forEach(function (pipe) {
      var pg = c.createGain();
      pg.gain.value = pipe[1];
      [-4, 4].forEach(function (cents) {
        var o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = freq(pipe[0]); o.detune.value = cents;
        o.connect(pg); o.start(t0);
        oscs.push(o);
      });
      pg.connect(lp);
    });
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 2);
    lp.connect(g); g.connect(out);
    return {
      breathe: function (t) {
        if (t < t0 + 2.4) return;
        g.gain.setValueAtTime(level, t - 0.3);
        g.gain.linearRampToValueAtTime(level * 0.72, t);
        g.gain.linearRampToValueAtTime(level, t + 0.45);
      },
      stop: function (t) { oscs.forEach(function (o) { o.stop(t); }); },
    };
  }

  // khaen lead: two reeds of one pipe, bright as the reed speaks and then mellow; long notes start
  // with the quick flick from the note above that khaen players ornament with. It is the same
  // player as the drone, so a held note softens where the drone's breath turns (every two beats);
  // e is the note's eighth in the bar.
  function khaen(m, t, dur, vol, e) {
    var c = M.c, lp = c.createBiquadFilter(), g = amp(c), f = freq(m);
    var grace = dur >= 4 * E8 && above(m) !== m ? freq(above(m)) : 0;
    lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
    [-5, 5].forEach(function (cents) {
      var o = c.createOscillator();
      o.type = 'sawtooth'; o.detune.value = cents;
      o.frequency.setValueAtTime(grace || f, t);
      if (grace) o.frequency.setValueAtTime(f, t + 0.07);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    for (var b = t + (4 - e % 4) * E8; b < t + dur - 0.5; b += 4 * E8) {
      g.gain.linearRampToValueAtTime(vol, b - 0.3);
      g.gain.linearRampToValueAtTime(vol * 0.75, b);
      g.gain.linearRampToValueAtTime(vol, b + 0.45);
    }
    g.gain.linearRampToValueAtTime(vol * 0.85, t + dur - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    lp.connect(g); g.connect(M.out);
  }

  // wot: the round Isan panpipe. Each note scoops up into pitch with a puff of breath, the breath
  // stays under the tone, and vibrato blooms on the long notes; each pipe rings on a little after
  // the next one starts.
  function wot(f, t, dur, vol) {
    var c = M.c, o = c.createOscillator(), g = amp(c), vg = amp(c);
    o.setPeriodicWave(M.wotWave);
    o.frequency.setValueAtTime(f * 0.978, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    vg.gain.setValueAtTime(0, t);
    vg.gain.setValueAtTime(0, t + 0.5);
    vg.gain.linearRampToValueAtTime(1, t + 1.3);
    M.vib.connect(vg); vg.connect(o.detune);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    if (dur > 1) {
      g.gain.linearRampToValueAtTime(vol * 0.8, t + 0.4);
      g.gain.linearRampToValueAtTime(vol * 0.92, t + dur * 0.7);
    }
    g.gain.linearRampToValueAtTime(vol * 0.75, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
    o.connect(g); g.connect(M.out);
    o.start(t); o.stop(t + dur + 0.32);
    // the breath: a puff as the note starts, then a soft hiss that follows the tone
    var src = c.createBufferSource(), bp = c.createBiquadFilter(), bg = amp(c);
    src.buffer = M.noise; src.loop = true;
    bp.type = 'bandpass'; bp.frequency.value = Math.min(3200, f * 2.5); bp.Q.value = 1.1;
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(vol * 0.55, t + 0.03);
    bg.gain.linearRampToValueAtTime(vol * 0.2, t + 0.2);
    bg.gain.linearRampToValueAtTime(vol * 0.15, t + dur);
    bg.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2);
    src.connect(bp); bp.connect(bg); bg.connect(M.out);
    src.start(t, Math.random() * 3); src.stop(t + dur + 0.25);
  }

  // phin: a plucked metal string whose tone mellows as it rings, with the small pitch drop of a pick
  function pluck(f, t, vol, dur) {
    var c = M.c, o = c.createOscillator(), lp = c.createBiquadFilter(), g = amp(c);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.008, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(2800, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + dur * 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(M.out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ponglang: a log-xylophone bar, its warm fundamental plus a short woody overtone
  function ponglang(f, t, vol) {
    ring(f, t, 0.7, vol, 'sine', 0.003);
    ring(f * 3.9, t, 0.13, vol * 0.32, 'sine', 0.002);
  }

  // ching: the small bronze cups; a soft tick and a long, quiet ring near G and D, the drone's notes
  function ching(t, vol) {
    ring(3120, t, 1.3, vol, 'sine', 0.002);
    ring(4718, t, 0.8, vol * 0.5, 'sine', 0.002);
    ring(6630, t, 0.4, vol * 0.25, 'sine', 0.002);
    hiss(t, 0.002, 0.07, vol * 0.8, 'highpass', 5000, 0.7);
  }

  // a soft goblet drum: a round "dum" on the strong beats and a light "tak" before the bar line
  function drum(t, vol) { ring(82, t, 0.45, vol, 'sine', 0.005, 130); }
  function tak(t, vol) { ring(330, t, 0.14, vol, 'sine', 0.002, 400); hiss(t, 0.002, 0.05, vol * 0.25, 'bandpass', 1800, 1); }

  // a low phin bass note: a rounded triangle so phone speakers still hear its overtones
  function bass(m, t, dur, vol) { ring(freq(m), t, dur, vol, 'triangle', 0.01); }

  // the temple gong (khong) far across the water: a deep hum that beats slowly as it dies away
  function gong(f, t, vol) {
    [[1, 1, 5.5], [1.004, 0.7, 5], [2.01, 0.3, 3], [2.98, 0.16, 1.8], [4.12, 0.06, 0.9]].forEach(function (p) {
      ring(f * p[0], t, p[2], vol * p[1], 'sine', 0.02);
    });
  }

  // small birds calling over the water at dusk
  function birds(t, n, f0) {
    for (var j = 0; j < n; j++) {
      var s = t + j * 0.16 + Math.random() * 0.04, f = f0 * (1 + Math.random() * 0.06);
      var o = M.c.createOscillator(), g = amp(M.c);
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, s + 0.035);
      o.frequency.exponentialRampToValueAtTime(f * 0.92, s + 0.09);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.06, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.1);
      o.connect(g); g.connect(M.out);
      o.start(s); o.stop(s + 0.12);
    }
  }

  // the Mekong at the bank: a soft wash of moving water that swells and drifts, runs all the time
  function river(c, out, t0) {
    var src = c.createBufferSource(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain(), lfos = [];
    src.buffer = M.noise; src.loop = true;
    hp.type = 'highpass'; hp.frequency.value = 140; hp.Q.value = 0.5;
    lp.type = 'lowpass'; lp.frequency.value = 760; lp.Q.value = 0.5;
    g.gain.value = 0.088;
    [[0.09, 0.04, g.gain], [0.31, 0.018, g.gain], [0.06, 180, lp.frequency]].forEach(function (s) {
      var lfo = c.createOscillator(), depth = c.createGain();
      lfo.frequency.value = s[0]; depth.gain.value = s[1];
      lfo.connect(depth); depth.connect(s[2]); lfo.start(t0);
      lfos.push(lfo);
    });
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
    src.start(t0);
    return { stop: function (t) { src.stop(t); lfos.forEach(function (l) { l.stop(t); }); } };
  }
  // and now and then a small wave laps against the bank
  function lap(t) { hiss(t, 0.06 + Math.random() * 0.05, 0.35 + Math.random() * 0.35, 0.22 + Math.random() * 0.2, 'bandpass', 350 + Math.random() * 750, 1.2); }

  // a playing of the music: its own output (so it can fade out cleanly), the drone and the river
  function begin(t) {
    var c = M.c, out = amp(c);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + 0.6);
    out.connect(M.bus);
    M.out = out;
    M.drone = drone(c, out, t);
    var water = river(c, out, t), drn = M.drone;
    return function end() {
      var now = c.currentTime;
      if (out.gain.cancelAndHoldAtTime) out.gain.cancelAndHoldAtTime(now);
      else out.gain.cancelScheduledValues(now);
      out.gain.setTargetAtTime(0, now, 0.12);
      drn.stop(now + 0.8); water.stop(now + 0.8);
      setTimeout(function () { out.disconnect(); }, 900);
    };
  }

  // how many eighths a tune note lasts: until the next note or breath
  function hold(tune, k) {
    var n = 1;
    while (k + n < tune.length && tune[k + n] === 0) n++;
    return n;
  }

  function musicStep(i, t) {
    var pos = i % SONG, n = PARTS.length - 1;
    while (PART_AT[n] > pos) n--;
    var part = PARTS[n][0], pass = PASS[n], inPart = pos - PART_AT[n];
    var bar = Math.floor(inPart / BAR), e = inPart % BAR, k = bar * BAR + e;
    if (e % 4 === 0) M.drone.breathe(t);
    if ((e === 1 || e === 5) && Math.random() < 0.7) lap(t + Math.random() * E8);
    // the gong opens the song and the second wot verse (at the khaen verse it would only muddy the drum)
    if (bar === 0 && e === 0 && (part === 'I' || (part === 'A' && pass === 1))) gong(freq(43), t, 0.11);
    if (part !== 'B') {
      var p = PHIN_FIGURE[(bar % 2) * 8 + e];
      if (p) pluck(freq(p), t, e === 0 ? 0.19 : 0.135, p < 60 ? 2 : 1.6);
      if (part === 'I' && bar === 1 && e === 6) birds(t, 3, 2600);
    }
    if (part === 'A') {
      if (WOT_TUNE[k] > 0) wot(freq(WOT_TUNE[k]), t, hold(WOT_TUNE, k) * E8, 0.15);
      if (e === 4) ching(t, 0.045);
      if (pass === 0 ? bar === 2 && e === 3 : bar === 6 && e === 5) birds(t, 3, pass === 0 ? 2500 : 2900);
    }
    if (part === 'B') {
      if (KHAEN_TUNE[k] > 0) khaen(KHAEN_TUNE[k], t, hold(KHAEN_TUNE, k) * E8, 0.13, e);
      var echo = k >= 2 ? KHAEN_TUNE[k - 2] : 0;
      if (echo > 0) ponglang(freq(echo + 12 > 86 ? echo : echo + 12), t, 0.16);
      if (e === 0) { pluck(freq(55), t, 0.17, 2); pluck(freq(62), t + 0.035, 0.14, 2); drum(t, 0.3); bass(43, t, 1.4, 0.12); }
      if (e === 4) { pluck(freq(67), t, 0.14, 1.6); drum(t, 0.17); bass(50, t, 1.1, 0.09); }
      if (e === 7) tak(t, 0.05);
      if (e === 2 || e === 6) ching(t, 0.038);
      if (pass === 0 ? bar === 5 && e === 5 : bar === 1 && e === 3) birds(t, 2, 2700);
    }
  }

  function schedule() {
    // after a stall (a hidden tab, a busy phone) skip ahead rather than play the missed notes at once
    while (nextTime < ctx.currentTime) { nextTime += E8; step++; }
    while (nextTime < ctx.currentTime + 0.4) {
      musicStep(step, nextTime);
      nextTime += E8;
      step++;
    }
  }

  function startMusic() {
    if (!musicOn || timer || !ensure()) return;
    nextTime = ctx.currentTime + 0.1;
    step = Math.ceil(step / BAR) * BAR; // pick up again at the start of a bar
    live = begin(nextTime);
    timer = setInterval(schedule, 50);
    schedule();
  }

  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
    if (live) live();
    live = null;
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
      var saved = M;
      M = makeBuses(off).kit;
      try {
        begin(0.05);
        for (var i = 0, t = 0.05; t < seconds - 0.5; i++, t += E8) musicStep(i, t);
      } finally {
        M = saved;
      }
      return off.startRendering();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
