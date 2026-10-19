/* Builds dist/the-magic-farmcare.html: one self-contained file (CSS and JS inlined) for publishing
   as a claude.ai artifact. The artifact host adds its own <!doctype>, <head> and <body>, so the output
   is only the marked head and body parts of index.html. Run: node scripts/build-artifact.js */
var fs = require('fs');
var path = require('path');

var rootDir = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

function between(start, end) {
  var a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < 0) throw new Error('Missing marker ' + start);
  return html.slice(a + start.length, b).trim();
}

function read(rel) { return fs.readFileSync(path.join(rootDir, rel), 'utf8'); }

var head = between('<!-- artifact:head -->', '<!-- /artifact:head -->')
  .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, function (_, file) { return '<style>\n' + read(file) + '\n</style>'; });

var body = between('<!-- artifact:body -->', '<!-- /artifact:body -->')
  .replace(/<script src="(js\/[^"]+)"><\/script>/g, function (_, file) {
    var code = read(file);
    if (code.indexOf('</script') >= 0) throw new Error(file + ' contains </script');
    return '<script>\n' + code + '\n</script>';
  });

var out = head + '\n' + body + '\n';
fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });
var file = path.join(rootDir, 'dist', 'the-magic-farmcare.html');
fs.writeFileSync(file, out);
console.log('wrote', path.relative(rootDir, file), Math.round(out.length / 1024) + ' KB');
