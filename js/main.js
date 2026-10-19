/* The Magic Farmcare - start-up. When the page runs as a claude.ai artifact, window.claude.hot
   carries the game across a republish so an open game is not lost; elsewhere it is simply absent. */
(function (root) {
  var MF = root.MF;
  var hot = root.claude && root.claude.hot;

  if (hot && typeof hot.snapshot === 'function') {
    try { hot.snapshot(function () { return MF.ui.snapshot(); }); } catch (e) { /* optional */ }
  }

  function start(data) { MF.ui.boot(data || {}); }

  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start((hot && hot.data) || {});
})(window);
