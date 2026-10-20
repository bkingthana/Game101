/* The Magic Farmcare - 8-bit music and sound effects made with the Web Audio API (no audio files).
   Browsers only allow sound after the player taps something, so unlock() is called from a button. */
(function (root) {
  var MF = (root.MF = root.MF || {});

  var ctx = null, master = null, musicBus = null, sfxBus = null;
  var musicOn = true, sfxOn = true;
  var timer = null, step = 0, nextTime = 0;

  var BPM = 108;
  var EIGHTH = 60 / BPM / 2;
  // pentatonic tune (C D E G A), the scale behind a lot of Thai folk melodies; 0 = rest
  var MELODY = [
    76, 0, 79, 81, 79, 76, 74, 0,
    72, 74, 76, 79, 76, 0, 74, 72,
    69, 72, 74, 76, 79, 81, 79, 76,
    74, 76, 74, 72, 69, 0, 72, 0,
    81, 0, 84, 81, 79, 0, 76, 79,
    81, 79, 76, 74, 76, 0, 0, 0,
    72, 74, 76, 74, 72, 69, 67, 69,
    72, 0, 74, 76, 72, 0, 0, 0,
  ];
  var BASS = [48, 55, 45, 52, 41, 48, 43, 50, 45, 52, 41, 48, 43, 50, 48, 43];

  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.45; sfxBus.connect(master);
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

  function schedule() {
    while (nextTime < ctx.currentTime + 0.15) {
      var m = MELODY[step % MELODY.length];
      if (m) tone(musicBus, freq(m), nextTime, EIGHTH * 0.9, 'square', 0.35);
      if (step % 2 === 0) {
        var b = BASS[Math.floor(step / 4) % BASS.length];
        tone(musicBus, freq(b), nextTime, EIGHTH * 1.8, 'triangle', 0.7);
      }
      if (step % 2 === 1) noise(musicBus, nextTime, 0.03, 0.12, 'highpass', 7000);
      nextTime += EIGHTH;
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
