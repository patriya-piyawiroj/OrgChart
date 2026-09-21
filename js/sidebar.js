(function () {
  "use strict";

  var STORAGE_KEY = "teamgrid-nav-sections-v2";

  function readPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writePrefs() {
    var prefs = {};
    document.querySelectorAll(".nav-section").forEach(function (section) {
      prefs[section.getAttribute("data-section")] = section.classList.contains("open");
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) { /* ignore quota / private mode */ }
  }

  function setSectionOpen(section, open) {
    if (!section) return;
    section.classList.toggle("open", open);
    var toggle = section.querySelector(".nav-section-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
    writePrefs();
  }

  function applyPrefs() {
    var prefs = readPrefs();
    document.querySelectorAll(".nav-section").forEach(function (section) {
      var id = section.getAttribute("data-section");
      var open = prefs && Object.prototype.hasOwnProperty.call(prefs, id)
        ? !!prefs[id]
        : true;
      section.classList.toggle("open", open);
      var toggle = section.querySelector(".nav-section-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", String(open));
    });
  }

  document.querySelectorAll(".nav-section-toggle").forEach(function (toggle) {
    toggle.addEventListener("click", function () {
      var section = toggle.closest(".nav-section");
      setSectionOpen(section, !section.classList.contains("open"));
    });
  });

  applyPrefs();

  var activeBtn = document.querySelector(".nav-btn.active");
  if (activeBtn) {
    var activeSection = activeBtn.closest(".nav-section");
    if (activeSection) setSectionOpen(activeSection, true);
    document.querySelectorAll(".nav-section").forEach(function (s) {
      s.classList.toggle("has-active", s.contains(activeBtn));
    });
  }

  window.TeamGridNav = {
    setSectionOpen: setSectionOpen,
    openSectionForTab: function (btn) {
      var section = btn && btn.closest(".nav-section");
      if (section) setSectionOpen(section, true);
      document.querySelectorAll(".nav-section").forEach(function (s) {
        s.classList.toggle("has-active", !!(btn && s.contains(btn)));
      });
    }
  };
})();
