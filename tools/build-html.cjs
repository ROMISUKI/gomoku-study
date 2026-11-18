'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function build(src, out) {
  let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
  function read(name) {
    assert(/^[a-z0-9.-]+$/i.test(name), 'Unexpected resource name');
    return fs.readFileSync(path.join(src, name), 'utf8');
  }
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, n) => '<style>\n' + read(n) + '\n</style>');
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, n) => '<script>\n' + read(n).replace(/<\/script/gi, '<\\/script') + '\n</script>');
  assert(!/<(?:script|link)[^>]+(?:src|href)=/i.test(html));
  assert(!/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|@import|url\(\s*https?:)/i.test(html), 'Unexpected networking');
  fs.mkdirSync(path.dirname(out), {recursive:true});
  fs.writeFileSync(out, html);
  console.log('Offline HTML: ' + Buffer.byteLength(html) + ' bytes');
  return html;
}
if (require.main === module) build(process.argv[2], process.argv[3]);
module.exports = build;
