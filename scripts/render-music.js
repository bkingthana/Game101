/* Renders the background music to a WAV file so it can be listened to without playing the game.
   Run: NODE_PATH="$(npm root -g)" node scripts/render-music.js out.wav [seconds] */
var fs = require('fs');
var path = require('path');
var chromium = require('playwright').chromium;

var out = process.argv[2] || 'music-preview.wav';
var seconds = Number(process.argv[3]) || 60;

(async function () {
  var browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    var page = await browser.newPage();
    var errors = [];
    page.on('pageerror', function (e) { errors.push(String(e)); });
    await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
    var res = await page.evaluate(function (seconds) {
      return MF.audio.renderPreview(seconds, 44100).then(function (buf) {
        var data = buf.getChannelData(0), peak = 0;
        for (var i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
        // 16-bit mono WAV, normalized to -1 dB for listening
        var gain = peak ? 0.89 / peak : 1, n = data.length, bytes = new Uint8Array(44 + n * 2), v = new DataView(bytes.buffer);
        var str = function (o, s) { for (var k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); };
        str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        str(36, 'data'); v.setUint32(40, n * 2, true);
        for (var j = 0; j < n; j++) v.setInt16(44 + j * 2, Math.max(-1, Math.min(1, data[j] * gain)) * 32767, true);
        var bin = '';
        for (var c = 0; c < bytes.length; c += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(c, c + 32768));
        return { peak: peak, wav: btoa(bin) };
      });
    }, seconds);
    fs.writeFileSync(out, Buffer.from(res.wav, 'base64'));
    console.log('wrote', out, seconds + 's', 'peak before normalizing', res.peak.toFixed(3));
    if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  } finally {
    await browser.close();
  }
})().catch(function (e) { console.error(e); process.exit(1); });
