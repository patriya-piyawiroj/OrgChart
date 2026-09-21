(function () {
  "use strict";

  var FILES = [
    "sections/organisation.html",
    "sections/projects.html",
    "sections/inbox.html",
    "sections/overview.html"
  ];

  var root = document.getElementById("panels-root");
  if (!root) return;

  function showError(err) {
    console.error("[teamgrid] failed to load sections", err);
    root.innerHTML =
      '<div class="empty-state">' +
        "<h3>Could not load workspace sections</h3>" +
        "<p>These views live in separate files under <code>sections/</code>. From this folder run <code>python3 server.py</code>, then open the printed address so the app can load sections and the local database API.</p>" +
      "</div>";
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error(src + " failed to load")); };
      document.body.appendChild(s);
    });
  }

  function loadApp() {
    loadScript("js/api.js").then(function () {
      return loadScript("js/app.js");
    }).catch(showError);
  }

  Promise.all(FILES.map(function (file) {
    return fetch(file).then(function (res) {
      if (!res.ok) throw new Error(file + " (" + res.status + ")");
      return res.text();
    });
  })).then(function (htmls) {
    root.innerHTML = htmls.join("\n");
    loadApp();
  }).catch(showError);
})();
