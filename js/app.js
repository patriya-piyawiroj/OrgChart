(function () {
  "use strict";

  // Live data is loaded from the local SQLite API (see server.py / TOOLS.md).
  // Seed records live in data/seed.json and are imported on first server start.

  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var TAG_CLASSES = ["tag-1", "tag-2", "tag-3", "tag-4", "tag-5", "tag-6"];
  var STATUS_ORDER = ["Not Started", "In Progress", "Done"];
  var STATUS_TAG = { "Not Started": "tag-0", "In Progress": "tag-4", "Done": "tag-3" };
  var WORKLOAD_TARGET = 5;

  function hashStr(s) {
    var h = 0;
    s = String(s || "");
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function tagClassFor(key) { return TAG_CLASSES[hashStr(key) % TAG_CLASSES.length]; }
  function tagClassForStatus(s) { return STATUS_TAG[s] || "tag-0"; }

  var state = {
    employees: [],
    usingExamples: false,
    editingId: null,
    search: "",
    deptFilter: "",
    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),
    boardGroupBy: "department",
    examplesDismissed: false,
    pendingPhotoUrl: null,
    fieldDefs: [],
    pendingCustomFields: {},
    projects: [],
    usingExamplesProjects: false,
    examplesDismissedProjects: false,
    mtgSearch: "",
    expandedProjectId: null,
    editingProjectId: null,
    pendingProjectPeople: [],
    evaluations: [],
    usingExamplesEvaluations: false,
    examplesDismissedEvaluations: false,
    expandedEvalEmployeeId: null,
    evalSearch: "",
    conversations: [],
    usingExamplesConversations: false,
    examplesDismissedConversations: false,
    selectedConversationId: null,
    convSearch: "",
    convFilter: "all",
    pendingConvParticipants: [],
    aiTaskDrafts: {},
    aiSuggestingProjectId: null
  };

  var els = {
    tbody: document.getElementById("emp-tbody"),
    empty: document.getElementById("empty-state"),
    statTotal: document.getElementById("stat-total"),
    statDepts: document.getElementById("stat-depts"),
    statRoots: document.getElementById("stat-roots"),
    search: document.getElementById("search"),
    deptFilter: document.getElementById("dept-filter"),
    deptList: document.getElementById("dept-list"),
    exampleBanner: document.getElementById("example-banner"),
    clearExamplesBtn: document.getElementById("clear-examples-btn"),
    form: document.getElementById("emp-form"),
    managerSelect: document.getElementById("f-manager"),
    photoInput: document.getElementById("f-photo"),
    photoPreview: document.getElementById("photo-preview"),
    removePhotoBtn: document.getElementById("remove-photo-btn"),
    theadRow: document.getElementById("emp-thead-row"),
    manageFieldsBtn: document.getElementById("manage-fields-btn"),
    fieldsPanel: document.getElementById("fields-panel"),
    fieldDefsList: document.getElementById("field-defs-list"),
    newFieldLabel: document.getElementById("new-field-label"),
    newFieldType: document.getElementById("new-field-type"),
    newFieldOptions: document.getElementById("new-field-options"),
    addFieldBtn: document.getElementById("add-field-btn"),
    customFieldsContainer: document.getElementById("custom-fields-container"),
    checklistSection: document.getElementById("checklist-section"),
    checklistList: document.getElementById("checklist-list"),
    checklistEmpty: document.getElementById("checklist-empty"),
    checklistInput: document.getElementById("checklist-input"),
    checklistAddBtn: document.getElementById("checklist-add-btn"),
    checklistTemplateBtn: document.getElementById("checklist-template-btn"),
    selfForm: document.getElementById("self-form"),
    selfManagerSelect: document.getElementById("sf-manager"),
    selfSubmitBtn: document.getElementById("self-submit-btn"),
    selfFormWrap: document.getElementById("self-add-form-wrap"),
    selfSuccess: document.getElementById("self-add-success"),
    selfAddAnotherBtn: document.getElementById("self-add-another-btn"),
    formTitle: document.getElementById("form-title"),
    formSub: document.getElementById("form-sub"),
    submitBtn: document.getElementById("submit-btn"),
    cancelBtn: document.getElementById("cancel-btn"),
    syncNote: document.getElementById("sync-note"),
    chartForest: document.getElementById("chart-forest"),
    chartEmpty: document.getElementById("chart-empty"),
    boardColumns: document.getElementById("board-columns"),
    boardEmpty: document.getElementById("board-empty"),
    boardQuickAdd: document.getElementById("board-quick-add"),
    boardHint: document.getElementById("board-hint"),
    calTitle: document.getElementById("cal-title"),
    calPrev: document.getElementById("cal-prev"),
    calNext: document.getElementById("cal-next"),
    calGrid: document.getElementById("cal-grid"),
    calEmptyNote: document.getElementById("cal-empty-note"),
    tlAxis: document.getElementById("tl-axis"),
    tlGroups: document.getElementById("tl-groups"),
    tlEmpty: document.getElementById("tl-empty"),
    tlPipeline: document.getElementById("tl-pipeline"),
    timelineQuickAdd: document.getElementById("timeline-quick-add"),
    wlRows: document.getElementById("workload-rows"),
    wlEmpty: document.getElementById("workload-empty"),
    wlFootnote: document.getElementById("workload-footnote"),
    wlTargetText: document.getElementById("wl-target-text"),
    dashGrid: document.getElementById("dash-grid"),
    dashEmpty: document.getElementById("dash-empty"),
    dashDept: document.getElementById("dash-dept"),
    dashStatus: document.getElementById("dash-status"),
    dashTenure: document.getElementById("dash-tenure"),
    dashWorkload: document.getElementById("dash-workload"),
    dashAnniv: document.getElementById("dash-anniv"),
    notesSection: document.getElementById("notes-section"),
    notesHeading: document.getElementById("notes-heading"),
    notesList: document.getElementById("notes-list"),
    notesEmpty: document.getElementById("notes-empty"),
    notesInput: document.getElementById("notes-input"),
    notesAddBtn: document.getElementById("notes-add-btn"),
    mtgFormTitle: document.getElementById("mtg-form-title"),
    mtgFormSub: document.getElementById("mtg-form-sub"),
    mtgForm: document.getElementById("mtg-form"),
    mtgName: document.getElementById("mtg-name"),
    mtgStatus: document.getElementById("mtg-status"),
    mtgStart: document.getElementById("mtg-start"),
    mtgEnd: document.getElementById("mtg-end"),
    mtgPersonInput: document.getElementById("mtg-person-input"),
    mtgPersonAddBtn: document.getElementById("mtg-person-add-btn"),
    mtgPeopleChips: document.getElementById("mtg-people-chips"),
    mtgSubmitBtn: document.getElementById("mtg-submit-btn"),
    mtgCancelBtn: document.getElementById("mtg-cancel-btn"),
    mtgNewBtn: document.getElementById("mtg-new-btn"),
    mtgModal: document.getElementById("mtg-modal"),
    mtgModalCloseBtn: document.getElementById("mtg-modal-close-btn"),
    mtgSearch: document.getElementById("mtg-search"),
    mtgStatActive: document.getElementById("mtg-stat-active"),
    mtgStatUpcoming: document.getElementById("mtg-stat-upcoming"),
    mtgStatCompleted: document.getElementById("mtg-stat-completed"),
    mtgExampleBanner: document.getElementById("mtg-example-banner"),
    mtgClearExamplesBtn: document.getElementById("mtg-clear-examples-btn"),
    mtgSectionsRoot: document.getElementById("mtg-sections-root"),
    mtgEmpty: document.getElementById("mtg-empty"),
    tbFilterProject: document.getElementById("tb-filter-project"),
    tbFilterAssignee: document.getElementById("tb-filter-assignee"),
    tbSearch: document.getElementById("tb-search"),
    tbColumns: document.getElementById("tb-columns"),
    tbEmpty: document.getElementById("tb-empty"),
    peopleList: document.getElementById("people-list"),
    dashAiCard: document.getElementById("dash-ai-card"),
    dashAiBtn: document.getElementById("dash-ai-btn"),
    dashAiBody: document.getElementById("dash-ai-body"),
    notesAiBtn: document.getElementById("notes-ai-btn"),
    notesAiPreview: document.getElementById("notes-ai-preview"),
    askAiFab: document.getElementById("ask-ai-fab"),
    askAiModal: document.getElementById("ask-ai-modal"),
    askAiCloseBtn: document.getElementById("ask-ai-close-btn"),
    askAiBody: document.getElementById("ask-ai-body"),
    askAiEmpty: document.getElementById("ask-ai-empty"),
    askAiMessages: document.getElementById("ask-ai-messages"),
    askAiError: document.getElementById("ask-ai-error"),
    askAiForm: document.getElementById("ask-ai-form"),
    askAiInput: document.getElementById("ask-ai-input"),
    askAiSendBtn: document.getElementById("ask-ai-send-btn"),
    evalForm: document.getElementById("eval-form"),
    evEmployee: document.getElementById("ev-employee"),
    evPeriod: document.getElementById("ev-period"),
    evReviewer: document.getElementById("ev-reviewer"),
    evQuality: document.getElementById("ev-quality"),
    evProductivity: document.getElementById("ev-productivity"),
    evCommunication: document.getElementById("ev-communication"),
    evLeadership: document.getElementById("ev-leadership"),
    evNotes: document.getElementById("ev-notes"),
    evalStatExceeds: document.getElementById("ev-stat-exceeds"),
    evalStatMeets: document.getElementById("ev-stat-meets"),
    evalStatNeeds: document.getElementById("ev-stat-needs"),
    evalSearch: document.getElementById("eval-search"),
    evalExampleBanner: document.getElementById("eval-example-banner"),
    evalClearExamplesBtn: document.getElementById("eval-clear-examples-btn"),
    evalRowsRoot: document.getElementById("eval-rows-root"),
    evalEmpty: document.getElementById("eval-empty"),
    navBadgeInbox: document.getElementById("nav-badge-inbox"),
    convExampleBanner: document.getElementById("conv-example-banner"),
    convClearExamplesBtn: document.getElementById("conv-clear-examples-btn"),
    convSearch: document.getElementById("conv-search"),
    convNewBtn: document.getElementById("conv-new-btn"),
    convThreadList: document.getElementById("conv-thread-list"),
    convListEmpty: document.getElementById("conv-list-empty"),
    convDetailEmpty: document.getElementById("conv-detail-empty"),
    convDetailBody: document.getElementById("conv-detail-body"),
    convDetailHead: document.getElementById("conv-detail-head"),
    convMessages: document.getElementById("conv-messages"),
    convComposer: document.getElementById("conv-composer"),
    convFrom: document.getElementById("conv-from"),
    convText: document.getElementById("conv-text"),
    convNewModal: document.getElementById("conv-new-modal"),
    convNewCloseBtn: document.getElementById("conv-new-close-btn"),
    convNewCancelBtn: document.getElementById("conv-new-cancel-btn"),
    convNewForm: document.getElementById("conv-new-form"),
    nmAboutType: document.getElementById("nm-about-type"),
    nmAboutRelatedField: document.getElementById("nm-about-related-field"),
    nmAboutRelatedLabel: document.getElementById("nm-about-related-label"),
    nmAboutText: document.getElementById("nm-about-text"),
    nmAboutProject: document.getElementById("nm-about-project"),
    nmAboutEval: document.getElementById("nm-about-eval"),
    nmRecipientInput: document.getElementById("nm-recipient-input"),
    nmRecipientAddBtn: document.getElementById("nm-recipient-add-btn"),
    nmRecipientChips: document.getElementById("nm-recipient-chips"),
    nmFrom: document.getElementById("nm-from"),
    nmMessage: document.getElementById("nm-message")
  };

  els.wlTargetText.textContent = String(WORKLOAD_TARGET);

  var VIEWS = [
    { key: "table", btn: document.getElementById("tab-btn-table"), panel: document.getElementById("panel-table") },
    { key: "board", btn: document.getElementById("tab-btn-board"), panel: document.getElementById("panel-board") },
    { key: "timeline", btn: document.getElementById("tab-btn-timeline"), panel: document.getElementById("panel-timeline") },
    { key: "calendar", btn: document.getElementById("tab-btn-calendar"), panel: document.getElementById("panel-calendar") },
    { key: "inbox", btn: document.getElementById("tab-btn-inbox"), panel: document.getElementById("panel-inbox") },
    { key: "workload", btn: document.getElementById("tab-btn-workload"), panel: document.getElementById("panel-workload") },
    { key: "dashboard", btn: document.getElementById("tab-btn-dashboard"), panel: document.getElementById("panel-dashboard") },
    { key: "chart", btn: document.getElementById("tab-btn-chart"), panel: document.getElementById("panel-chart") },
    { key: "meetings", btn: document.getElementById("tab-btn-meetings"), panel: document.getElementById("panel-meetings") },
    { key: "taskboard", btn: document.getElementById("tab-btn-taskboard"), panel: document.getElementById("panel-taskboard") },
    { key: "selfadd", btn: document.getElementById("tab-btn-selfadd"), panel: document.getElementById("panel-selfadd") },
    { key: "evaluation", btn: document.getElementById("tab-btn-evaluation"), panel: document.getElementById("panel-evaluation") }
  ];

  var HIDE_PAGE_HEADER = { meetings: true, taskboard: true, timeline: true, calendar: true, evaluation: true, inbox: true, dashboard: true };

  function activateTab(key) {
    VIEWS.forEach(function (v) {
      if (!v.btn || !v.panel) return;
      var active = v.key === key;
      v.btn.classList.toggle("active", active);
      v.panel.classList.toggle("active", active);
      v.btn.setAttribute("aria-selected", String(active));
      if (active && window.TeamGridNav) window.TeamGridNav.openSectionForTab(v.btn);
    });
    var pageHeader = document.getElementById("page-header");
    if (pageHeader) pageHeader.hidden = !!HIDE_PAGE_HEADER[key];
  }
  VIEWS.forEach(function (v) {
    if (!v.btn) return;
    v.btn.addEventListener("click", function () { activateTab(v.key); });
  });

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function formatDateShort(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function dateMs(iso) {
    if (!iso) return null;
    var d = new Date(iso + "T00:00:00");
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  function addDaysIso(iso, days) {
    var ms = dateMs(iso);
    var d = ms != null ? new Date(ms) : new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (days || 0));
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function isoToday() { return addDaysIso("", 0); }

  function emailForName(name) {
    var emp = state.employees.filter(function (e) { return e.name === name; })[0];
    return emp && emp.email ? emp.email : "";
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  function avatarHtml(e) {
    if (e.photoUrl) {
      return '<span class="avatar avatar-photo"><img src="' + e.photoUrl + '" alt="" /></span>';
    }
    return '<span class="avatar ' + tagClassFor(e.id) + '">' + escapeHtml(initials(e.name)) + "</span>";
  }

  function updatePhotoPreview() {
    if (state.pendingPhotoUrl) {
      els.photoPreview.innerHTML = '<img src="' + state.pendingPhotoUrl + '" alt="" />';
      els.removePhotoBtn.style.display = "";
    } else {
      els.photoPreview.innerHTML = "<span>" + escapeHtml(initials(els.form.name.value)) + "</span>";
      els.removePhotoBtn.style.display = "none";
    }
  }

  function readAndResizePhoto(file, cb) {
    if (!file || !/^image\//.test(file.type)) { cb(null); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var size = 200;
        var canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext("2d");
        var side = Math.min(img.width, img.height);
        var sx = (img.width - side) / 2;
        var sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        try {
          cb(canvas.toDataURL("image/jpeg", 0.72));
        } catch (e) {
          console.log("[org-chart-directory] photo resize failed", e);
          cb(null);
        }
      };
      img.onerror = function () { cb(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }
  function deptBadgeHtml(dept) {
    if (!dept) return "—";
    return '<span class="badge ' + tagClassFor(dept) + '">' + escapeHtml(dept) + "</span>";
  }
  function statusBadgeHtml(status) {
    var s = status || "Not Started";
    return '<span class="badge ' + tagClassForStatus(s) + '">' + escapeHtml(s) + "</span>";
  }

  function byId(id) { return state.employees.find(function (e) { return e.id === id; }); }

  function uniqueDepartments() {
    var set = {};
    state.employees.forEach(function (e) { if (e.department) set[e.department] = true; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  // A manager reference is only valid if it points at another employee
  // that currently exists and doesn't create a cycle back to itself.
  function resolvedManagerId(emp) {
    if (!emp.managerId) return "";
    if (emp.managerId === emp.id) return "";
    if (!byId(emp.managerId)) return "";
    var seen = {};
    var cur = emp.managerId;
    while (cur) {
      if (cur === emp.id || seen[cur]) return "";
      seen[cur] = true;
      var m = byId(cur);
      cur = m ? m.managerId : "";
    }
    return emp.managerId;
  }

  function refreshManagerOptions() {
    var options = ['<option value="">No manager (top of chart)</option>'];
    state.employees
      .slice()
      .sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); })
      .forEach(function (e) {
        if (e.id === state.editingId) return;
        options.push('<option value="' + escapeHtml(e.id) + '">' + escapeHtml(e.name) + (e.title ? " — " + escapeHtml(e.title) : "") + "</option>");
      });
    var html = options.join("");
    [els.managerSelect, els.selfManagerSelect].forEach(function (selectEl) {
      if (!selectEl) return;
      var current = selectEl.value;
      selectEl.innerHTML = html;
      if (Array.prototype.some.call(selectEl.options, function (o) { return o.value === current; })) {
        selectEl.value = current;
      }
    });
  }

  function refreshDeptOptions() {
    var depts = uniqueDepartments();
    var currentFilter = els.deptFilter.value;
    els.deptFilter.innerHTML = '<option value="">All departments</option>' +
      depts.map(function (d) { return '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + "</option>"; }).join("");
    if (depts.indexOf(currentFilter) !== -1) els.deptFilter.value = currentFilter;
    els.deptList.innerHTML = depts.map(function (d) { return '<option value="' + escapeHtml(d) + '"></option>'; }).join("");
  }

  // ---- Custom fields --------------------------------------------------
  function genFieldId() { return "fld_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function renderFieldDefsList() {
    els.fieldDefsList.innerHTML = state.fieldDefs.length
      ? state.fieldDefs.map(function (f) {
          return '<div class="fielddef-row"><span>' + escapeHtml(f.label) + ' <span class="fielddef-type">(' + escapeHtml(f.type) + ')</span></span>' +
            '<button type="button" class="btn-danger-text" data-remove-field="' + escapeHtml(f.id) + '">Remove</button></div>';
        }).join("")
      : '<p class="hint">No custom fields yet — add one below.</p>';
    Array.prototype.forEach.call(els.fieldDefsList.querySelectorAll("[data-remove-field]"), function (btn) {
      btn.addEventListener("click", function () { removeFieldDef(btn.getAttribute("data-remove-field")); });
    });
  }

  function renderCustomFieldInputs() {
    var container = els.customFieldsContainer;
    if (!state.fieldDefs.length) { container.innerHTML = ""; return; }
    container.innerHTML = state.fieldDefs.map(function (f) {
      var val = state.pendingCustomFields[f.id];
      var inputHtml;
      if (f.type === "dropdown") {
        var opts = (f.options || []).map(function (o) {
          return '<option value="' + escapeHtml(o) + '"' + (o === val ? " selected" : "") + '>' + escapeHtml(o) + "</option>";
        }).join("");
        inputHtml = '<select data-cf="' + escapeHtml(f.id) + '"><option value="">—</option>' + opts + "</select>";
      } else if (f.type === "checkbox") {
        inputHtml = '<input type="checkbox" data-cf="' + escapeHtml(f.id) + '" style="width:auto;"' + (val ? " checked" : "") + " />";
      } else {
        var type = f.type === "number" ? "number" : f.type === "date" ? "date" : "text";
        inputHtml = '<input type="' + type + '" data-cf="' + escapeHtml(f.id) + '" value="' + escapeHtml(val || "") + '" />';
      }
      return '<div class="field" data-field="cf-' + escapeHtml(f.id) + '"><label>' + escapeHtml(f.label) + "</label>" + inputHtml + "</div>";
    }).join("");
  }

  function collectCustomFieldValues() {
    var values = {};
    state.fieldDefs.forEach(function (f) {
      var el = els.customFieldsContainer.querySelector('[data-cf="' + f.id + '"]');
      if (!el) return;
      values[f.id] = f.type === "checkbox" ? el.checked : el.value;
    });
    return values;
  }

  function persistFieldDefs() {
    TeamGridApi.put("/api/field-defs", { fields: state.fieldDefs }).catch(function (e) {
      console.log("[org-chart-directory] save fields failed", e);
    });
    renderFieldDefsList();
    renderCustomFieldInputs();
    renderTableHead();
    renderDirectory();
  }

  function addFieldDef() {
    var label = els.newFieldLabel.value.trim();
    if (!label) return;
    var type = els.newFieldType.value;
    var options = type === "dropdown"
      ? els.newFieldOptions.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean)
      : undefined;
    state.fieldDefs = state.fieldDefs.concat([{ id: genFieldId(), label: label, type: type, options: options }]);
    els.newFieldLabel.value = "";
    els.newFieldOptions.value = "";
    persistFieldDefs();
  }

  function removeFieldDef(id) {
    state.fieldDefs = state.fieldDefs.filter(function (f) { return f.id !== id; });
    persistFieldDefs();
  }

  els.manageFieldsBtn.addEventListener("click", function () {
    els.fieldsPanel.hidden = !els.fieldsPanel.hidden;
  });
  els.newFieldType.addEventListener("change", function () {
    els.newFieldOptions.hidden = els.newFieldType.value !== "dropdown";
  });
  els.addFieldBtn.addEventListener("click", addFieldDef);
  renderFieldDefsList();

  // ---- Meetings / Projects --------------------------------------------
  var MTG_STATUS_ORDER = ["active", "upcoming", "stuck", "completed"];
  var MTG_STATUS_LABEL = { active: "Active", upcoming: "Upcoming", stuck: "Stuck", completed: "Completed" };

  function projectById(id) { return state.projects.find(function (p) { return p.id === id; }); }

  var TASK_SUB_STATUSES = ["todo", "inprogress", "done"];
  var TASK_SUB_LABEL = { todo: "To do", inprogress: "In progress", done: "Done" };
  var TASK_BANDS = [
    { key: "starting", label: "Starting", min: 0, max: 25 },
    { key: "underway", label: "Underway", min: 25, max: 50 },
    { key: "advanced", label: "Advanced", min: 50, max: 75 },
    { key: "complete", label: "Complete", min: 75, max: 101 }
  ];

  function genTaskId() { return "tsk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function genSubtaskId() { return "sub_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function normalizeSubtask(s) {
    s = s || {};
    var status = TASK_SUB_STATUSES.indexOf(s.status) !== -1 ? s.status : "todo";
    return { id: s.id || genSubtaskId(), title: s.title || "", startDate: s.startDate || "", endDate: s.endDate || "", status: status };
  }

  function normalizeTask(t) {
    t = t || {};
    return {
      id: t.id || genTaskId(),
      title: t.title || "",
      assignee: t.assignee || "",
      subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(normalizeSubtask) : []
    };
  }

  function normalizeTasks(tasks) {
    return Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
  }

  function taskProgress(task) {
    var subs = (task && task.subtasks) || [];
    var total = subs.length;
    var done = subs.filter(function (s) { return s.status === "done"; }).length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    var band = TASK_BANDS[0];
    if (pct >= 75) band = TASK_BANDS[3];
    else if (pct >= 50) band = TASK_BANDS[2];
    else if (pct >= 25) band = TASK_BANDS[1];
    return { done: done, total: total, pct: pct, band: band.key, label: band.label };
  }

  var BAND_GIF_INDEX = { starting: 1, underway: 2, advanced: 3, complete: 4 };

  function todayStartMs() {
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }

  function isPastDeadline(endDate) {
    var end = dateMs(endDate);
    return end != null && todayStartMs() > end;
  }

  function taskDeadline(task, project) {
    var latest = "";
    var latestMs = null;
    ((task && task.subtasks) || []).forEach(function (s) {
      var ms = dateMs(s.endDate);
      if (ms != null && (latestMs == null || ms > latestMs)) {
        latestMs = ms;
        latest = s.endDate;
      }
    });
    return latest || (project && project.endDate) || "";
  }

  function bandGifHtml(band, endDate) {
    var n = BAND_GIF_INDEX[band] || 1;
    var past = isPastDeadline(endDate);
    var mood = past ? "sad" : "happy";
    var info = TASK_BANDS.filter(function (b) { return b.key === band; })[0];
    var label = (info ? info.label : "Starting") + (past ? " · past deadline" : "");
    return '<img class="band-gif" src="assets/' + mood + n + '.gif" alt="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '" />';
  }

  function sortedMeetings(meetings) {
    return (meetings || []).slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

  function personAvatarHtml(name) {
    return '<span class="avatar ' + tagClassFor(name) + '" title="' + escapeHtml(name) + '">' + escapeHtml(initials(name)) + "</span>";
  }

  function projPeopleHtml(people) {
    var shown = (people || []).slice(0, 4);
    var extra = (people || []).length - shown.length;
    return '<div class="proj-people">' + shown.map(personAvatarHtml).join("") +
      (extra > 0 ? '<span class="avatar-more">+' + extra + "</span>" : "") + "</div>";
  }

  function projStatusColorVar(status) {
    return status === "active" ? "--tag4-fg" : status === "upcoming" ? "--tag2-fg" : status === "stuck" ? "--danger" : "--tag3-fg";
  }

  function openProjectInMeetings(id) {
    state.expandedProjectId = id;
    activateTab("meetings");
    renderMtgSections();
  }

  function openProjectModal() {
    if (els.mtgModal) els.mtgModal.hidden = false;
    setTimeout(function () { if (els.mtgName) els.mtgName.focus(); }, 30);
  }

  function closeProjectModal() {
    resetMtgForm();
    if (els.mtgModal) els.mtgModal.hidden = true;
  }

  function jumpToAddProject() {
    resetMtgForm();
    activateTab("meetings");
    openProjectModal();
  }

  function projTimelineHtml(p) {
    if (!p.startDate || !p.endDate) return '<div class="proj-timeline"><div class="dates">No dates set</div></div>';
    var start = new Date(p.startDate + "T00:00:00");
    var end = new Date(p.endDate + "T00:00:00");
    var today = new Date();
    var total = end - start;
    var pct = total > 0 ? Math.max(0, Math.min(100, ((today - start) / total) * 100)) : (today >= end ? 100 : 0);
    return '<div class="proj-timeline"><div class="dates">' + formatDate(p.startDate) + " – " + formatDate(p.endDate) + "</div>" +
      '<div class="timeline-track"><div class="timeline-fill" style="width:' + pct.toFixed(1) + '%; background: var(' + projStatusColorVar(p.status) + ');"></div></div></div>';
  }

  function projPreviewHtml(text, emptyLabel) {
    if (!text) return '<div class="proj-preview empty">' + escapeHtml(emptyLabel) + "</div>";
    return '<div class="proj-preview">' + escapeHtml(text) + "</div>";
  }

  function renderMtgSections() {
    var q = state.mtgSearch.trim().toLowerCase();
    var filtered = state.projects.filter(function (p) {
      if (!q) return true;
      var hay = [p.name].concat(p.people || []).join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    els.mtgStatActive.textContent = state.projects.filter(function (p) { return p.status === "active"; }).length;
    els.mtgStatUpcoming.textContent = state.projects.filter(function (p) { return p.status === "upcoming"; }).length;
    els.mtgStatCompleted.textContent = state.projects.filter(function (p) { return p.status === "completed"; }).length;

    els.mtgExampleBanner.hidden = !state.usingExamplesProjects;
    els.mtgEmpty.hidden = !!state.projects.length;

    if (!filtered.length) {
      els.mtgSectionsRoot.innerHTML = state.projects.length
        ? '<div class="empty-state"><h3>No matches</h3><p>Try a different search.</p></div>'
        : "";
      renderTaskBoard();
      return;
    }

    els.mtgSectionsRoot.innerHTML = MTG_STATUS_ORDER.map(function (status) {
      var items = filtered.filter(function (p) { return p.status === status; })
        .sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
      if (!items.length) return "";
      var rows = items.map(function (p) {
        var latest = sortedMeetings(p.meetings)[0];
        var open = state.expandedProjectId === p.id;
        return (
          '<div class="proj-row' + (open ? " open" : "") + '" data-id="' + escapeHtml(p.id) + '">' +
            '<div class="proj-row-main" data-toggle="' + escapeHtml(p.id) + '">' +
              '<div class="proj-name">' + escapeHtml(p.name) + (p.example ? ' <span class="badge badge-example">Example</span>' : "") + "</div>" +
              projTimelineHtml(p) +
              projPeopleHtml(p.people) +
              projPreviewHtml(latest ? latest.memo : "", "No meetings logged yet") +
              projPreviewHtml(latest ? latest.nextSteps : "", "—") +
              '<svg class="proj-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
            "</div>" +
            '<div class="proj-row-detail" data-detail="' + escapeHtml(p.id) + '">' + (open ? renderProjectDetailHtml(p) : "") + "</div>" +
          "</div>"
        );
      }).join("");
      return (
        '<div class="mtg-section" data-status="' + status + '">' +
          '<div class="mtg-section-head"><h3>' + MTG_STATUS_LABEL[status] + "</h3><span class=\"count\">" + items.length + (items.length === 1 ? " project" : " projects") + "</span></div>" +
          '<div class="proj-rows-scroll"><div class="proj-rows-inner">' +
            '<div class="proj-row-head"><div>Project</div><div>Timeline</div><div>People</div><div>Latest memo</div><div>Next steps</div><div></div></div>' +
            rows +
          "</div></div>" +
        "</div>"
      );
    }).join("");

    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-toggle]"), function (el) {
      el.addEventListener("click", function () { toggleProjectExpand(el.getAttribute("data-toggle")); });
    });
    wireMtgDetailEvents();
    renderTaskBoard();
  }

  function subtaskGanttHtml(s, rangeStart, rangeEnd) {
    var start = dateMs(s.startDate);
    var end = dateMs(s.endDate);
    if (start == null || end == null || rangeStart == null || rangeEnd == null || rangeEnd <= rangeStart) return "";
    var left = Math.max(0, Math.min(100, ((start - rangeStart) / (rangeEnd - rangeStart)) * 100));
    var right = Math.max(0, Math.min(100, ((end - rangeStart) / (rangeEnd - rangeStart)) * 100));
    var width = Math.max(6, right - left);
    return '<div class="sub-gantt" title="' + escapeHtml((formatDateShort(s.startDate) || "Start") + " → " + (formatDateShort(s.endDate) || "End")) + '"><span style="left:' + left.toFixed(1) + "%;width:" + width.toFixed(1) + '%"></span></div>';
  }

  function taskMeterHtml(prog, endDate) {
    var current = BAND_GIF_INDEX[prog.band] || 1;
    var past = isPastDeadline(endDate);
    var mood = past ? "sad" : "happy";
    var segs = TASK_BANDS.map(function (b, i) {
      var n = i + 1;
      var reached = n <= current;
      var label = b.label + (reached && past ? " · past deadline" : "");
      if (reached) {
        return '<img class="task-meter-fig on" src="assets/' + mood + n + '.gif" alt="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '" />';
      }
      return '<img class="task-meter-fig pending" src="assets/' + n + '.jpg" alt="' + escapeHtml(b.label) + '" title="' + escapeHtml(b.label) + '" />';
    }).join("");
    return '<div class="task-meter" data-band="' + prog.band + '">' + segs + "</div>";
  }

  function renderTasksHtml(p) {
    var tasks = normalizeTasks(p.tasks);
    var rangeStart = dateMs(p.startDate);
    var rangeEnd = dateMs(p.endDate);
    tasks.forEach(function (t) {
      t.subtasks.forEach(function (s) {
        var a = dateMs(s.startDate);
        var b = dateMs(s.endDate);
        if (a != null) rangeStart = rangeStart == null ? a : Math.min(rangeStart, a);
        if (b != null) rangeEnd = rangeEnd == null ? b : Math.max(rangeEnd, b);
      });
    });
    var list = tasks.length
      ? tasks.map(function (t) {
          var prog = taskProgress(t);
          var subs = t.subtasks.map(function (s) {
            return '<div class="subtask-row" data-subtask-id="' + escapeHtml(s.id) + '" data-status="' + escapeHtml(s.status) + '">' +
              '<span class="sub-dot" aria-hidden="true"></span>' +
              '<div class="subtask-main">' +
                '<span class="sub-title">' + escapeHtml(s.title || "Untitled") + "</span>" +
                subtaskGanttHtml(s, rangeStart, rangeEnd) +
              "</div>" +
              '<div class="sub-dates">' +
                '<input type="date" data-sub-date="start" value="' + escapeHtml(s.startDate) + '" aria-label="Start date" />' +
                '<input type="date" data-sub-date="end" value="' + escapeHtml(s.endDate) + '" aria-label="End date" />' +
              "</div>" +
              '<select data-sub-status aria-label="Subtask status">' +
                TASK_SUB_STATUSES.map(function (st) {
                  return '<option value="' + st + '"' + (s.status === st ? " selected" : "") + ">" + TASK_SUB_LABEL[st] + "</option>";
                }).join("") +
              "</select>" +
              '<button type="button" class="btn-danger-text" data-del-subtask="' + escapeHtml(s.id) + '" aria-label="Delete subtask">✕</button>' +
            "</div>";
          }).join("");
          return '<div class="proj-task" data-task-id="' + escapeHtml(t.id) + '">' +
            '<div class="proj-task-top">' +
              "<div>" +
                '<div class="proj-task-title">' + escapeHtml(t.title) + "</div>" +
                '<div class="proj-task-assignee">' + (t.assignee ? "Assigned to " + escapeHtml(t.assignee) : "Unassigned") + "</div>" +
              "</div>" +
              '<button type="button" class="btn-danger-text" data-del-task="' + escapeHtml(t.id) + '">Delete</button>' +
            "</div>" +
            '<div class="proj-task-progress">' +
              '<div class="proj-task-progress-meta">' +
                "<span>" + escapeHtml(prog.label) + " · " + prog.pct + "%</span>" +
                "<span>" + prog.done + " of " + prog.total + " done</span>" +
              "</div>" +
              taskMeterHtml(prog, taskDeadline(t, p)) +
            "</div>" +
            '<div class="subtask-list">' + (subs || '<p class="proj-tasks-empty">No subtasks yet — add one to start tracking progress.</p>') + "</div>" +
            '<div class="subtask-add">' +
              '<input type="text" class="ns-title" placeholder="Subtask title" />' +
              '<input type="date" class="ns-start" />' +
              '<input type="date" class="ns-end" />' +
              '<button type="button" class="btn-ghost" data-add-subtask="' + escapeHtml(t.id) + '">Add subtask</button>' +
            "</div>" +
          "</div>";
        }).join("")
      : '<p class="proj-tasks-empty">No tasks yet — add one below to break the project into work.</p>';

    var suggesting = state.aiSuggestingProjectId === p.id;
    var drafts = state.aiTaskDrafts[p.id] || [];
    var draftHtml = drafts.length ? renderDraftTasksHtml(p, drafts) : "";

    return '<div class="proj-pane">' +
      '<div class="proj-pane-head">' +
        "<h4>Tasks</h4>" +
        '<div class="proj-pane-head-right">' +
          '<span class="pane-count">' + tasks.length + (tasks.length === 1 ? " task" : " tasks") + "</span>" +
          '<button type="button" class="btn-text ai-btn" data-suggest-tasks="' + escapeHtml(p.id) + '"' + (suggesting ? " disabled" : "") + ">" +
            (suggesting ? "Suggesting…" : "✨ Suggest tasks") +
          "</button>" +
        "</div>" +
      "</div>" +
      '<div class="proj-tasks">' +
        list +
        draftHtml +
        '<div class="task-add">' +
          '<input type="text" class="nt-title" placeholder="New task title" />' +
          '<input type="text" class="nt-assignee" list="people-list" placeholder="Assign to…" />' +
          '<button type="button" class="btn-ghost" data-add-task="' + escapeHtml(p.id) + '">Add task</button>' +
        "</div>" +
      "</div>" +
    "</div>";
  }

  function mockSuggestedTasks(p) {
    var people = p.people || [];
    var a1 = people[0] || "";
    var a2 = people[1] || people[0] || "";
    var start = p.startDate || isoToday();
    var mid = addDaysIso(start, 7);
    var later = addDaysIso(start, 14);
    var end = p.endDate || addDaysIso(start, 21);
    var stamp = Date.now().toString(36);
    return [
      {
        id: "draft_" + stamp + "_1",
        title: "Kickoff and scope for " + (p.name || "this project"),
        assignee: a1,
        subtasks: [
          { title: "Confirm goals with stakeholders", startDate: start, endDate: mid, status: "todo" },
          { title: "Write success criteria", startDate: start, endDate: mid, status: "todo" }
        ]
      },
      {
        id: "draft_" + stamp + "_2",
        title: "Delivery plan for " + (p.name || "this project"),
        assignee: a2,
        subtasks: [
          { title: "Break work into milestones", startDate: mid, endDate: later, status: "todo" },
          { title: "Set review dates", startDate: later, endDate: end, status: "todo" }
        ]
      }
    ];
  }

  function renderDraftTasksHtml(p, drafts) {
    var cards = drafts.map(function (t) {
      var subs = (t.subtasks || []).map(function (s) {
        return '<div class="subtask-row draft-sub">' +
          '<input type="text" class="ds-title" value="' + escapeHtml(s.title || "") + '" aria-label="Draft subtask title" />' +
          '<input type="date" class="ds-start" value="' + escapeHtml(s.startDate || "") + '" aria-label="Start date" />' +
          '<input type="date" class="ds-end" value="' + escapeHtml(s.endDate || "") + '" aria-label="End date" />' +
        "</div>";
      }).join("");
      return '<div class="proj-task draft" data-draft-id="' + escapeHtml(t.id) + '">' +
        '<div class="proj-task-top">' +
          "<div>" +
            '<span class="badge draft-badge">Draft</span>' +
            '<input type="text" class="dt-title" value="' + escapeHtml(t.title || "") + '" aria-label="Draft task title" />' +
            '<input type="text" class="dt-assignee" list="people-list" value="' + escapeHtml(t.assignee || "") + '" placeholder="Assign to…" aria-label="Draft assignee" />' +
          "</div>" +
          '<button type="button" class="btn-danger-text" data-discard-draft="' + escapeHtml(t.id) + '">Discard</button>' +
        "</div>" +
        '<div class="subtask-list">' + subs + "</div>" +
        '<div class="draft-actions">' +
          '<button type="button" class="btn-primary" data-add-draft="' + escapeHtml(t.id) + '">Add</button>' +
        "</div>" +
      "</div>";
    }).join("");
    return '<div class="ai-drafts" data-drafts-project="' + escapeHtml(p.id) + '">' +
      '<div class="draft-toolbar">' +
        "<span>AI suggested these tasks — review and add, or cancel.</span>" +
        '<div class="draft-toolbar-actions">' +
          '<button type="button" class="btn-primary" data-add-all-drafts="' + escapeHtml(p.id) + '">Add all</button>' +
          '<button type="button" class="btn-ghost" data-cancel-drafts="' + escapeHtml(p.id) + '">Cancel</button>' +
        "</div>" +
      "</div>" +
      cards +
    "</div>";
  }

  function renderMeetingsHtml(p) {
    var meetings = sortedMeetings(p.meetings);
    var log = meetings.length
      ? '<div class="mtg-timeline">' + meetings.map(function (m) {
          return '<div class="mtg-log-entry" data-meeting-id="' + escapeHtml(m.id) + '">' +
            '<div class="log-date">' + formatDate(m.date) + '<button type="button" class="btn-danger-text" data-del-meeting="' + escapeHtml(m.id) + '">Delete</button></div>' +
            '<div class="mtg-log-card">' +
              '<div class="log-field"><b>Memo</b><span>' + escapeHtml(m.memo || "—") + "</span></div>" +
              '<div class="log-field"><b>Next steps</b><span>' + escapeHtml(m.nextSteps || "—") + "</span></div>" +
            "</div>" +
          "</div>";
        }).join("") + "</div>"
      : '<p class="mtg-log-empty">No meetings yet. Log the first one to keep decisions and next steps in one place.</p>';

    return '<div class="proj-pane">' +
      '<div class="proj-pane-head"><h4>Meetings</h4><span class="pane-count">' + meetings.length + (meetings.length === 1 ? " entry" : " entries") + "</span></div>" +
      log +
      '<div class="add-meeting-form">' +
        "<h4>Log a meeting</h4>" +
        '<div class="mtg-field-row">' +
          '<input type="date" class="mn-date" value="' + new Date().toISOString().slice(0, 10) + '" />' +
          '<textarea class="mn-memo" placeholder="What happened in this meeting…" rows="2"></textarea>' +
          '<textarea class="mn-next" placeholder="What to do before the next meeting…" rows="2"></textarea>' +
        "</div>" +
        '<div class="ai-inline-row"><button type="button" class="btn-text ai-btn ai-suggest-next-btn">✨ Suggest next steps from memo</button></div>' +
        '<div class="ai-preview-box ai-suggest-preview" hidden></div>' +
        '<button type="button" class="btn-ghost" data-add-meeting="' + escapeHtml(p.id) + '">Add entry</button>' +
      "</div>" +
    "</div>";
  }

  function renderProjectDetailHtml(p) {
    var summaryUsed = getTimelineSummaryCountToday();
    var summaryLeft = Math.max(0, TIMELINE_SUMMARY_DAILY_LIMIT - summaryUsed);

    return (
      '<div class="detail-actions">' +
        '<button type="button" class="btn-text" data-edit-project="' + escapeHtml(p.id) + '">Edit project</button>' +
        '<button type="button" class="btn-danger-text" data-delete-project="' + escapeHtml(p.id) + '">Delete project</button>' +
      "</div>" +
      '<div class="ai-timeline-card">' +
        '<div class="ai-timeline-head">' +
          '<span class="ai-timeline-title">✨ AI timeline summary</span>' +
          '<span class="ai-timeline-quota">' + summaryLeft + " of " + TIMELINE_SUMMARY_DAILY_LIMIT + ' left today</span>' +
          '<button type="button" class="btn-ghost ai-timeline-btn" data-summarize-timeline="' + escapeHtml(p.id) + '"' + (summaryLeft <= 0 ? " disabled" : "") + '>Summarize</button>' +
        "</div>" +
        '<div class="ai-timeline-body" hidden></div>' +
      "</div>" +
      '<div class="proj-detail-grid">' +
        renderTasksHtml(p) +
        renderMeetingsHtml(p) +
      "</div>" +
      '<div class="ai-email-card">' +
        '<div class="ai-email-head"><span class="ai-email-title">✨ AI email composer</span></div>' +
        '<div class="ai-email-presets">' +
          '<button type="button" class="chip-btn active" data-email-preset="status update">Status update</button>' +
          '<button type="button" class="chip-btn" data-email-preset="meeting recap">Meeting recap</button>' +
          '<button type="button" class="chip-btn" data-email-preset="reminder">Reminder</button>' +
        "</div>" +
        '<textarea class="ai-email-instructions" rows="2" placeholder="Optional: add context or instructions for the draft…"></textarea>' +
        '<button type="button" class="btn-ghost ai-email-draft-btn" data-draft-email="' + escapeHtml(p.id) + '">Draft email</button>' +
        '<div class="ai-email-result" hidden></div>' +
      "</div>"
    );
  }

  function wireMtgDetailEvents() {
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-del-meeting]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var row = btn.closest(".proj-row");
        deleteMeeting(row.getAttribute("data-id"), btn.getAttribute("data-del-meeting"));
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-add-meeting]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var detail = btn.closest(".proj-row-detail");
        var dateEl = detail.querySelector(".mn-date");
        var memoEl = detail.querySelector(".mn-memo");
        var nextEl = detail.querySelector(".mn-next");
        addMeeting(btn.getAttribute("data-add-meeting"), {
          date: dateEl.value || new Date().toISOString().slice(0, 10),
          memo: memoEl.value.trim(),
          nextSteps: nextEl.value.trim()
        });
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-edit-project]"), function (btn) {
      btn.addEventListener("click", function (ev) { ev.stopPropagation(); startEditProject(btn.getAttribute("data-edit-project")); });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-delete-project]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var wrap = btn.parentNode;
        wrap.innerHTML = '<span class="confirm-row">Delete this project? <button type="button" class="btn-danger-text" id="confirm-proj-del-yes">Yes</button><button type="button" class="btn-text" id="confirm-proj-del-no">No</button></span>';
        var id = btn.getAttribute("data-delete-project");
        document.getElementById("confirm-proj-del-yes").addEventListener("click", function (e) { e.stopPropagation(); deleteProject(id); });
        document.getElementById("confirm-proj-del-no").addEventListener("click", function (e) { e.stopPropagation(); renderMtgSections(); });
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-add-task]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var wrap = btn.closest(".task-add");
        var titleEl = wrap.querySelector(".nt-title");
        var assigneeEl = wrap.querySelector(".nt-assignee");
        var title = titleEl.value.trim();
        if (!title) return;
        addProjectTask(btn.getAttribute("data-add-task"), title, assigneeEl.value.trim());
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll(".nt-title, .nt-assignee"), function (input) {
      input.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          var wrap = input.closest(".task-add");
          wrap.querySelector("[data-add-task]").click();
        }
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll(".ns-title"), function (input) {
      input.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          input.closest(".subtask-add").querySelector("[data-add-subtask]").click();
        }
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-del-task]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var row = btn.closest(".proj-row");
        deleteProjectTask(row.getAttribute("data-id"), btn.getAttribute("data-del-task"));
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-add-subtask]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var addRow = btn.closest(".subtask-add");
        var titleEl = addRow.querySelector(".ns-title");
        var title = titleEl.value.trim();
        if (!title) return;
        var row = btn.closest(".proj-row");
        addProjectSubtask(row.getAttribute("data-id"), btn.getAttribute("data-add-subtask"), {
          title: title,
          startDate: addRow.querySelector(".ns-start").value,
          endDate: addRow.querySelector(".ns-end").value,
          status: "todo"
        });
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-del-subtask]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var row = btn.closest(".proj-row");
        var task = btn.closest(".proj-task");
        deleteProjectSubtask(row.getAttribute("data-id"), task.getAttribute("data-task-id"), btn.getAttribute("data-del-subtask"));
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-sub-status]"), function (sel) {
      sel.addEventListener("change", function (ev) {
        ev.stopPropagation();
        var row = sel.closest(".proj-row");
        var task = sel.closest(".proj-task");
        var sub = sel.closest(".subtask-row");
        updateProjectSubtask(row.getAttribute("data-id"), task.getAttribute("data-task-id"), sub.getAttribute("data-subtask-id"), { status: sel.value });
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-sub-date]"), function (input) {
      input.addEventListener("change", function (ev) {
        ev.stopPropagation();
        var row = input.closest(".proj-row");
        var task = input.closest(".proj-task");
        var sub = input.closest(".subtask-row");
        var patch = {};
        patch[input.getAttribute("data-sub-date") === "start" ? "startDate" : "endDate"] = input.value;
        updateProjectSubtask(row.getAttribute("data-id"), task.getAttribute("data-task-id"), sub.getAttribute("data-subtask-id"), patch);
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll(".proj-row-detail"), function (el) {
      el.addEventListener("click", function (ev) { ev.stopPropagation(); });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll(".ai-suggest-next-btn"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var formEl = btn.closest(".add-meeting-form");
        var memoEl = formEl.querySelector(".mn-memo");
        var nextEl = formEl.querySelector(".mn-next");
        var previewEl = formEl.querySelector(".ai-suggest-preview");
        suggestNextSteps(memoEl, nextEl, previewEl, btn);
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-summarize-timeline]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        summarizeProjectTimeline(btn.getAttribute("data-summarize-timeline"), btn);
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-suggest-tasks]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        suggestProjectTasks(btn.getAttribute("data-suggest-tasks"), btn);
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-add-draft]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var row = btn.closest(".proj-row");
        acceptDraftTask(row.getAttribute("data-id"), btn.getAttribute("data-add-draft"));
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-discard-draft]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var row = btn.closest(".proj-row");
        discardDraftTask(row.getAttribute("data-id"), btn.getAttribute("data-discard-draft"));
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-add-all-drafts]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        acceptAllDrafts(btn.getAttribute("data-add-all-drafts"));
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll("[data-cancel-drafts]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        discardAllDrafts(btn.getAttribute("data-cancel-drafts"));
      });
    });
    Array.prototype.forEach.call(els.mtgSectionsRoot.querySelectorAll(".ai-email-card"), function (card) {
      Array.prototype.forEach.call(card.querySelectorAll(".chip-btn"), function (chip) {
        chip.addEventListener("click", function (ev) {
          ev.stopPropagation();
          Array.prototype.forEach.call(card.querySelectorAll(".chip-btn"), function (c) { c.classList.remove("active"); });
          chip.classList.add("active");
        });
      });
      var draftBtn = card.querySelector("[data-draft-email]");
      draftBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        draftProjectEmail(draftBtn.getAttribute("data-draft-email"), card, draftBtn);
      });
    });
  }

  function toggleProjectExpand(id) {
    state.expandedProjectId = state.expandedProjectId === id ? null : id;
    renderMtgSections();
  }

  function refreshPeopleList() {
    var names = {};
    state.employees.forEach(function (e) { if (e.name) names[e.name] = true; });
    els.peopleList.innerHTML = Object.keys(names).sort().map(function (n) { return '<option value="' + escapeHtml(n) + '"></option>'; }).join("");
  }

  function renderProjectPeopleChips() {
    els.mtgPeopleChips.innerHTML = state.pendingProjectPeople.map(function (name) {
      return '<span class="people-chip">' + escapeHtml(name) + '<button type="button" data-remove-proj-person="' + escapeHtml(name) + '" aria-label="Remove">✕</button></span>';
    }).join("");
    Array.prototype.forEach.call(els.mtgPeopleChips.querySelectorAll("[data-remove-proj-person]"), function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-remove-proj-person");
        state.pendingProjectPeople = state.pendingProjectPeople.filter(function (n) { return n !== name; });
        renderProjectPeopleChips();
      });
    });
  }

  function addProjectPersonFromInput() {
    var name = els.mtgPersonInput.value.trim();
    if (!name) return;
    if (state.pendingProjectPeople.indexOf(name) === -1) state.pendingProjectPeople.push(name);
    els.mtgPersonInput.value = "";
    renderProjectPeopleChips();
    els.mtgPersonInput.focus();
  }

  function clearMtgFormErrors() {
    Array.prototype.forEach.call(els.mtgForm.querySelectorAll(".field"), function (f) { f.classList.remove("invalid"); });
  }

  function resetMtgForm() {
    state.editingProjectId = null;
    state.pendingProjectPeople = [];
    els.mtgForm.reset();
    els.mtgStatus.value = "upcoming";
    els.mtgFormTitle.textContent = "New project";
    els.mtgFormSub.textContent = "Set the basics — you can add tasks and log meetings afterward.";
    els.mtgSubmitBtn.textContent = "Add project";
    renderProjectPeopleChips();
    clearMtgFormErrors();
  }

  function startEditProject(id) {
    var p = projectById(id);
    if (!p) return;
    state.editingProjectId = id;
    state.pendingProjectPeople = (p.people || []).slice();
    els.mtgName.value = p.name || "";
    els.mtgStatus.value = p.status || "upcoming";
    els.mtgStart.value = p.startDate || "";
    els.mtgEnd.value = p.endDate || "";
    els.mtgFormTitle.textContent = "Edit project";
    els.mtgFormSub.textContent = p.example ? "Editing this example turns it into your own project." : "Update the basics for this project.";
    els.mtgSubmitBtn.textContent = "Save changes";
    renderProjectPeopleChips();
    clearMtgFormErrors();
    openProjectModal();
  }

  function collectBoardSubtasks() {
    var items = [];
    state.projects.forEach(function (p) {
      normalizeTasks(p.tasks).forEach(function (t) {
        var prog = taskProgress(t);
        t.subtasks.forEach(function (s) {
          items.push({
            projectId: p.id,
            projectName: p.name,
            projectEndDate: p.endDate || "",
            taskId: t.id,
            taskTitle: t.title,
            assignee: t.assignee || "",
            sub: s,
            band: prog.band,
            bandLabel: prog.label
          });
        });
      });
    });
    return items;
  }

  function fillTaskBoardFilters(items) {
    if (!els.tbFilterProject || !els.tbFilterAssignee) return;
    var projVal = els.tbFilterProject.value;
    var asgVal = els.tbFilterAssignee.value;
    var projects = [];
    var assignees = [];
    items.forEach(function (it) {
      if (it.projectName && projects.indexOf(it.projectName) === -1) projects.push(it.projectName);
      if (it.assignee && assignees.indexOf(it.assignee) === -1) assignees.push(it.assignee);
    });
    projects.sort(function (a, b) { return a.localeCompare(b); });
    assignees.sort(function (a, b) { return a.localeCompare(b); });
    els.tbFilterProject.innerHTML = '<option value="">All projects</option>' + projects.map(function (n) {
      return '<option value="' + escapeHtml(n) + '"' + (n === projVal ? " selected" : "") + ">" + escapeHtml(n) + "</option>";
    }).join("");
    els.tbFilterAssignee.innerHTML = '<option value="">All people</option>' + assignees.map(function (n) {
      return '<option value="' + escapeHtml(n) + '"' + (n === asgVal ? " selected" : "") + ">" + escapeHtml(n) + "</option>";
    }).join("");
  }

  function renderTaskBoard() {
    if (!els.tbColumns) return;
    var items = collectBoardSubtasks();
    fillTaskBoardFilters(items);
    var projFilter = els.tbFilterProject ? els.tbFilterProject.value : "";
    var asgFilter = els.tbFilterAssignee ? els.tbFilterAssignee.value : "";
    var q = (els.tbSearch && els.tbSearch.value ? els.tbSearch.value : "").trim().toLowerCase();
    var filtered = items.filter(function (it) {
      if (projFilter && it.projectName !== projFilter) return false;
      if (asgFilter && it.assignee !== asgFilter) return false;
      if (!q) return true;
      var hay = (it.sub.title + " " + it.taskTitle + " " + it.projectName + " " + it.assignee).toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    if (!filtered.length) {
      els.tbColumns.innerHTML = "";
      if (els.tbEmpty) els.tbEmpty.hidden = items.length > 0 ? false : false;
      if (els.tbEmpty) {
        els.tbEmpty.hidden = false;
        if (items.length && (projFilter || asgFilter || q)) {
          els.tbEmpty.innerHTML = "<h3>No matching subtasks</h3><p>Try a different project, person, or search.</p>";
        } else {
          els.tbEmpty.innerHTML = "<h3>No subtasks yet</h3><p>Open a project and add a task with subtasks to see them here.</p>";
        }
      }
      return;
    }
    if (els.tbEmpty) els.tbEmpty.hidden = true;

    els.tbColumns.innerHTML = TASK_SUB_STATUSES.map(function (st) {
      var colItems = filtered.filter(function (it) { return it.sub.status === st; });
      var cards = colItems.map(function (it) {
        var dates = (it.sub.startDate || it.sub.endDate)
          ? formatDate(it.sub.startDate) + " – " + formatDate(it.sub.endDate)
          : "No dates";
        var moves = TASK_SUB_STATUSES.filter(function (other) { return other !== st; }).map(function (other) {
          return '<button type="button" class="btn-ghost" data-tb-move="' + other + '">' + TASK_SUB_LABEL[other] + "</button>";
        }).join("");
        return '<div class="board-card tb-card" draggable="true" data-project-id="' + escapeHtml(it.projectId) + '" data-task-id="' + escapeHtml(it.taskId) + '" data-subtask-id="' + escapeHtml(it.sub.id) + '">' +
          '<div class="bc-top"><div>' +
            '<div class="bc-name">' + escapeHtml(it.sub.title || "Untitled") + "</div>" +
            '<div class="bc-title">' + escapeHtml(it.taskTitle) + (it.assignee ? " · " + escapeHtml(it.assignee) : "") + "</div>" +
            '<div class="bc-project">' + escapeHtml(it.projectName) + "</div>" +
          "</div>" + bandGifHtml(it.band, it.sub.endDate || it.projectEndDate) + "</div>" +
          '<div class="bc-meta"><span class="bc-date">' + dates + "</span></div>" +
          '<div class="tb-card-moves">' + moves + "</div>" +
        "</div>";
      }).join("");
      return '<div class="board-col tb-col" data-tb-status="' + st + '">' +
        '<div class="board-col-head"><div class="head-left">' + TASK_SUB_LABEL[st] + ' <span class="count">' + colItems.length + "</span></div></div>" +
        (cards || '<p class="proj-tasks-empty">Drop subtasks here.</p>') +
      "</div>";
    }).join("");

    Array.prototype.forEach.call(els.tbColumns.querySelectorAll(".tb-card"), function (card) {
      card.addEventListener("dragstart", function (ev) {
        ev.dataTransfer.setData("text/plain", JSON.stringify({
          projectId: card.getAttribute("data-project-id"),
          taskId: card.getAttribute("data-task-id"),
          subId: card.getAttribute("data-subtask-id")
        }));
        ev.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dblclick", function () {
        openProjectInMeetings(card.getAttribute("data-project-id"));
      });
    });
    Array.prototype.forEach.call(els.tbColumns.querySelectorAll("[data-tb-move]"), function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var card = btn.closest(".tb-card");
        updateProjectSubtask(card.getAttribute("data-project-id"), card.getAttribute("data-task-id"), card.getAttribute("data-subtask-id"), { status: btn.getAttribute("data-tb-move") });
      });
    });
    Array.prototype.forEach.call(els.tbColumns.querySelectorAll(".tb-col"), function (col) {
      col.addEventListener("dragover", function (ev) {
        ev.preventDefault();
        col.classList.add("drag-over");
      });
      col.addEventListener("dragleave", function () { col.classList.remove("drag-over"); });
      col.addEventListener("drop", function (ev) {
        ev.preventDefault();
        col.classList.remove("drag-over");
        var raw = ev.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          var payload = JSON.parse(raw);
          updateProjectSubtask(payload.projectId, payload.taskId, payload.subId, { status: col.getAttribute("data-tb-status") });
        } catch (e) { /* ignore bad drag payload */ }
      });
    });
  }

  // ---- Evaluation / performance view -------------------------------------
  function evalAvgForEntry(ev) {
    var vals = [ev.quality, ev.productivity, ev.communication, ev.leadership].map(Number).filter(function (n) { return !isNaN(n); });
    if (!vals.length) return 0;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  function evalsForEmployee(id) {
    return state.evaluations.filter(function (e) { return e.employeeId === id; })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function personAvgScore(id) {
    var list = evalsForEmployee(id);
    if (!list.length) return null;
    var sum = list.reduce(function (s, e) { return s + evalAvgForEntry(e); }, 0);
    return sum / list.length;
  }

  function evalBand(avg) {
    if (avg >= 4.2) return { key: "high", cls: "wl-balanced", label: "Exceeds expectations" };
    if (avg >= 3.2) return { key: "mid", cls: "wl-under", label: "Meets expectations" };
    return { key: "low", cls: "wl-over", label: "Needs improvement" };
  }

  function refreshEvalEmployeeOptions() {
    var current = els.evEmployee.value;
    var options = ['<option value="">Select a person…</option>'].concat(
      state.employees.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); })
        .map(function (e) { return '<option value="' + escapeHtml(e.id) + '">' + escapeHtml(e.name) + (e.title ? " — " + escapeHtml(e.title) : "") + "</option>"; })
    );
    els.evEmployee.innerHTML = options.join("");
    if (Array.prototype.some.call(els.evEmployee.options, function (o) { return o.value === current; })) els.evEmployee.value = current;
  }

  function renderEvalDetailHtml(emp, history) {
    if (!history.length) return '<p class="mtg-log-empty">No evaluations logged yet for ' + escapeHtml(emp.name) + '.</p>';
    return history.map(function (ev) {
      var avg = evalAvgForEntry(ev);
      return '<div class="mtg-log-entry" data-eval-id="' + escapeHtml(ev.id) + '">' +
        '<div class="log-date">' + escapeHtml(ev.period || "Evaluation") + (ev.reviewer ? " · " + escapeHtml(ev.reviewer) : "") +
          '<button type="button" class="btn-danger-text" data-del-eval="' + escapeHtml(ev.id) + '">Delete</button></div>' +
        '<div class="log-field"><b>Scores</b>Quality ' + ev.quality + " · Productivity " + ev.productivity + " · Communication " + ev.communication + " · Leadership " + ev.leadership + " (avg " + avg.toFixed(1) + ")</div>" +
        (ev.notes ? '<div class="log-field"><b>Notes</b>' + escapeHtml(ev.notes) + "</div>" : "") +
      "</div>";
    }).join("");
  }

  function wireEvalEvents() {
    Array.prototype.forEach.call(els.evalRowsRoot.querySelectorAll("[data-toggle-eval]"), function (el) {
      el.addEventListener("click", function () { toggleEvalExpand(el.getAttribute("data-toggle-eval")); });
    });
    Array.prototype.forEach.call(els.evalRowsRoot.querySelectorAll(".ev-row-detail"), function (el) {
      el.addEventListener("click", function (ev) { ev.stopPropagation(); });
    });
    Array.prototype.forEach.call(els.evalRowsRoot.querySelectorAll("[data-del-eval]"), function (btn) {
      btn.addEventListener("click", function (ev) { ev.stopPropagation(); deleteEvaluation(btn.getAttribute("data-del-eval")); });
    });
  }

  function toggleEvalExpand(id) {
    state.expandedEvalEmployeeId = state.expandedEvalEmployeeId === id ? null : id;
    renderEvaluations();
  }

  function renderEvaluations() {
    els.evalExampleBanner.hidden = !state.usingExamplesEvaluations;

    if (!state.employees.length) {
      els.evalRowsRoot.innerHTML = "";
      els.evalEmpty.hidden = false;
      els.evalStatExceeds.textContent = els.evalStatMeets.textContent = els.evalStatNeeds.textContent = "0";
      return;
    }
    els.evalEmpty.hidden = true;

    var q = state.evalSearch.trim().toLowerCase();
    var filtered = state.employees.filter(function (e) {
      if (!q) return true;
      return (e.name + " " + (e.title || "")).toLowerCase().indexOf(q) !== -1;
    });

    var counts = { high: 0, mid: 0, low: 0 };
    var rows = filtered.map(function (e) {
      var avg = personAvgScore(e.id);
      var band = avg === null ? null : evalBand(avg);
      if (band) counts[band.key]++;
      return { emp: e, avg: avg, band: band, history: evalsForEmployee(e.id) };
    });
    rows.sort(function (a, b) {
      if (a.avg === null && b.avg === null) return String(a.emp.name || "").localeCompare(String(b.emp.name || ""));
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return b.avg - a.avg;
    });

    els.evalStatExceeds.textContent = counts.high;
    els.evalStatMeets.textContent = counts.mid;
    els.evalStatNeeds.textContent = counts.low;

    if (!rows.length) {
      els.evalRowsRoot.innerHTML = '<div class="empty-state"><h3>No matches</h3><p>Try a different search.</p></div>';
      return;
    }

    els.evalRowsRoot.innerHTML =
      '<div class="ev-row-head"><div>Person</div><div>Average score</div><div>Score</div><div>Status</div><div></div></div>' +
      rows.map(function (r) {
        var open = state.expandedEvalEmployeeId === r.emp.id;
        var pct = r.avg === null ? 0 : (r.avg / 5) * 100;
        var barCls = r.band ? r.band.cls : "wl-under";
        return '<div class="ev-row' + (open ? " open" : "") + '" data-id="' + escapeHtml(r.emp.id) + '">' +
          '<div class="ev-row-main" data-toggle-eval="' + escapeHtml(r.emp.id) + '">' +
            '<span class="wl-person">' + avatarHtml(r.emp) +
              '<span><span class="wl-name">' + escapeHtml(r.emp.name) + '</span><span class="wl-title">' + escapeHtml(r.emp.title || "—") + "</span></span></span>" +
            '<div class="wl-bar-wrap"><div class="wl-bar ' + barCls + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
            '<div class="wl-count">' + (r.avg === null ? "—" : r.avg.toFixed(1) + " / 5") + "</div>" +
            (r.band ? '<span class="badge ' + r.band.cls + '">' + r.band.label + "</span>" : '<span class="badge tag-0">Not yet reviewed</span>') +
            '<svg class="ev-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
          "</div>" +
          '<div class="ev-row-detail" data-detail="' + escapeHtml(r.emp.id) + '">' + (open ? renderEvalDetailHtml(r.emp, r.history) : "") + "</div>" +
        "</div>";
      }).join("");

    wireEvalEvents();
  }

  function clearEvalFormErrors() {
    Array.prototype.forEach.call(els.evalForm.querySelectorAll(".field"), function (f) { f.classList.remove("invalid"); });
  }

  function resetEvalForm() {
    els.evalForm.reset();
    ["evQuality", "evProductivity", "evCommunication", "evLeadership"].forEach(function (key) {
      els[key].value = 3;
      document.getElementById(els[key].id + "-val").textContent = "3";
    });
    clearEvalFormErrors();
  }

  ["ev-quality", "ev-productivity", "ev-communication", "ev-leadership"].forEach(function (id) {
    var input = document.getElementById(id);
    var out = document.getElementById(id + "-val");
    input.addEventListener("input", function () { out.textContent = input.value; });
  });

  // ---- Inbox / conversations view ------------------------------------------
  var CONV_TYPE_LABEL = { task: "Task", topic: "Topic", project: "Project", evaluation: "Evaluation", general: "General" };
  var CONV_TYPE_TAG = { task: "tag-4", topic: "tag-2", project: "tag-1", evaluation: "tag-3", general: "tag-0" };

  function convById(id) { return state.conversations.find(function (c) { return c.id === id; }); }

  function sortedConvMessages(msgs) {
    return (msgs || []).slice().sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  }

  function convUnreadCount(conv) {
    return (conv.messages || []).filter(function (m) { return !m.read; }).length;
  }

  function convLatestMessage(conv) {
    var msgs = sortedConvMessages(conv.messages);
    return msgs.length ? msgs[msgs.length - 1] : null;
  }

  function totalUnreadConversations() {
    return state.conversations.reduce(function (sum, c) { return sum + convUnreadCount(c); }, 0);
  }

  function relTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    var days = Math.round(hrs / 24);
    if (days < 7) return days + "d ago";
    return formatDate(d.toISOString().slice(0, 10));
  }

  function convOpenTarget(conv) {
    if (conv.aboutType === "project" && conv.aboutRefId) {
      var p = projectById(conv.aboutRefId);
      if (p) return { label: "Open project →", action: function () { openProjectInMeetings(p.id); } };
    }
    if (conv.aboutType === "evaluation" && conv.aboutRefId) {
      var ev = state.evaluations.filter(function (e) { return e.id === conv.aboutRefId; })[0];
      if (ev) return { label: "Open evaluation →", action: function () { activateTab("evaluation"); state.expandedEvalEmployeeId = ev.employeeId; renderEvaluations(); } };
    }
    return null;
  }

  function refreshConvAboutOptions() {
    els.nmAboutProject.innerHTML = state.projects.length
      ? state.projects.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); })
          .map(function (p) { return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + "</option>"; }).join("")
      : '<option value="">No projects yet</option>';
    els.nmAboutEval.innerHTML = state.evaluations.length
      ? state.evaluations.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
          .map(function (ev) {
            var emp = byId(ev.employeeId);
            return '<option value="' + escapeHtml(ev.id) + '">' + escapeHtml(emp ? emp.name : "Unknown") + " — " + escapeHtml(ev.period || "") + "</option>";
          }).join("")
      : '<option value="">No evaluations yet</option>';
  }

  function renderInboxNavBadge() {
    var n = totalUnreadConversations();
    els.navBadgeInbox.hidden = n === 0;
    els.navBadgeInbox.textContent = n > 99 ? "99+" : String(n);
  }

  function filteredConversations() {
    var q = state.convSearch.trim().toLowerCase();
    return state.conversations.filter(function (c) {
      if (state.convFilter === "unread" && convUnreadCount(c) === 0) return false;
      if (["task", "topic", "project", "evaluation"].indexOf(state.convFilter) !== -1 && c.aboutType !== state.convFilter) return false;
      if (!q) return true;
      var hay = [c.aboutLabel].concat(c.participants || []).concat((c.messages || []).map(function (m) { return m.from + " " + m.text; })).join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    }).sort(function (a, b) {
      var la = convLatestMessage(a), lb = convLatestMessage(b);
      return new Date((lb && lb.createdAt) || b.createdAt || 0) - new Date((la && la.createdAt) || a.createdAt || 0);
    });
  }

  function convParticipantsAvatarHtml(names) {
    var shown = (names || []).slice(0, 4);
    var extra = (names || []).length - shown.length;
    return '<div class="conv-thread-people">' + shown.map(personAvatarHtml).join("") + (extra > 0 ? '<span class="avatar-more">+' + extra + "</span>" : "") + "</div>";
  }

  function renderConvThreadList() {
    var list = filteredConversations();
    els.convListEmpty.hidden = !!state.conversations.length;

    if (!list.length) {
      els.convThreadList.innerHTML = state.conversations.length ? '<p class="dash-empty-inline">No matches.</p>' : "";
      return;
    }

    els.convThreadList.innerHTML = list.map(function (c) {
      var active = state.selectedConversationId === c.id;
      var unread = convUnreadCount(c);
      var latest = convLatestMessage(c);
      return '<button type="button" class="conv-thread-item' + (active ? " active" : "") + '" data-conv="' + escapeHtml(c.id) + '">' +
        '<div class="conv-thread-top">' +
          '<span class="badge ' + CONV_TYPE_TAG[c.aboutType] + '">' + CONV_TYPE_LABEL[c.aboutType] + "</span>" +
          '<span class="conv-thread-about">' + escapeHtml(c.aboutLabel) + "</span>" +
          (unread ? '<span class="conv-unread-dot"></span>' : "") +
          '<span class="conv-thread-meta"><span class="conv-thread-time">' + (latest ? relTime(latest.createdAt) : "") + "</span></span>" +
        "</div>" +
        convParticipantsAvatarHtml(c.participants) +
        '<div class="conv-thread-snippet">' + (latest ? escapeHtml(latest.from || "Someone") + ": " + escapeHtml(latest.text) : "No messages yet") + "</div>" +
      "</button>";
    }).join("");

    Array.prototype.forEach.call(els.convThreadList.querySelectorAll("[data-conv]"), function (btn) {
      btn.addEventListener("click", function () { selectConversation(btn.getAttribute("data-conv")); });
    });
  }

  function renderConvDetail() {
    var conv = state.selectedConversationId ? convById(state.selectedConversationId) : null;
    if (!conv) {
      els.convDetailEmpty.hidden = false;
      els.convDetailBody.hidden = true;
      return;
    }
    els.convDetailEmpty.hidden = true;
    els.convDetailBody.hidden = false;

    var openTarget = convOpenTarget(conv);
    els.convDetailHead.innerHTML =
      '<div class="conv-detail-head-top"><span class="badge ' + CONV_TYPE_TAG[conv.aboutType] + '">' + CONV_TYPE_LABEL[conv.aboutType] + "</span>" +
      (openTarget ? '<a href="#" class="conv-open-link" id="conv-open-link">' + escapeHtml(openTarget.label) + "</a>" : "") +
      "</div>" +
      '<div class="conv-detail-about">' + escapeHtml(conv.aboutLabel) + "</div>" +
      '<div class="conv-detail-participants">With ' + escapeHtml((conv.participants || []).join(", ") || "no one yet") + "</div>";

    if (openTarget) {
      document.getElementById("conv-open-link").addEventListener("click", function (ev) { ev.preventDefault(); openTarget.action(); });
    }

    var msgs = sortedConvMessages(conv.messages);
    if (!msgs.length) {
      els.convMessages.innerHTML = '<p class="dash-empty-inline">No messages yet — say something below.</p>';
    } else {
      var seenUnreadLabel = false;
      els.convMessages.innerHTML = msgs.map(function (m) {
        var label = "";
        if (!m.read && !seenUnreadLabel) { label = '<div class="conv-unread-label">Unread</div>'; seenUnreadLabel = true; }
        return label + '<div class="conv-msg' + (m.read ? "" : " unread") + '">' +
          '<div class="conv-msg-head">' + escapeHtml(m.from || "Anonymous") + " · " + relTime(m.createdAt) + "</div>" +
          '<div class="conv-msg-bubble">' + escapeHtml(m.text) + "</div>" +
        "</div>";
      }).join("");
    }
    els.convMessages.scrollTop = els.convMessages.scrollHeight;
  }

  function renderInbox() {
    els.convExampleBanner.hidden = !state.usingExamplesConversations;
    renderConvThreadList();
    renderConvDetail();
    renderInboxNavBadge();
  }

  function markConversationRead(id) {
    var conv = convById(id);
    if (!conv) return;
    var changed = false;
    (conv.messages || []).forEach(function (m) { if (!m.read) { m.read = true; changed = true; } });
    if (!changed) return;
    TeamGridApi.put("/api/conversations/" + encodeURIComponent(id), { messages: conv.messages }).catch(function (e) {
      console.log("[org-chart-directory] mark conversation read failed", e);
    });
  }

  function selectConversation(id) {
    state.selectedConversationId = id;
    markConversationRead(id);
    renderInbox();
  }

  function renderNmRecipientChips() {
    els.nmRecipientChips.innerHTML = state.pendingConvParticipants.map(function (name) {
      var email = emailForName(name);
      return '<span class="people-chip">' +
        '<span class="people-chip-text"><span>' + escapeHtml(name) + "</span>" +
        (email ? '<span class="people-chip-email">' + escapeHtml(email) + "</span>" : "") +
        "</span>" +
        '<button type="button" data-remove-nm-person="' + escapeHtml(name) + '" aria-label="Remove">✕</button></span>';
    }).join("");
    Array.prototype.forEach.call(els.nmRecipientChips.querySelectorAll("[data-remove-nm-person]"), function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-remove-nm-person");
        state.pendingConvParticipants = state.pendingConvParticipants.filter(function (n) { return n !== name; });
        renderNmRecipientChips();
      });
    });
  }

  function addNmRecipientFromInput() {
    var name = els.nmRecipientInput.value.trim();
    if (!name) return;
    if (state.pendingConvParticipants.indexOf(name) === -1) state.pendingConvParticipants.push(name);
    els.nmRecipientInput.value = "";
    renderNmRecipientChips();
    els.nmRecipientInput.focus();
  }

  function updateAboutRelatedField() {
    var type = els.nmAboutType.value;
    els.nmAboutText.hidden = true;
    els.nmAboutProject.hidden = true;
    els.nmAboutEval.hidden = true;
    els.nmAboutRelatedField.hidden = false;
    if (type === "task" || type === "topic") {
      els.nmAboutText.hidden = false;
      els.nmAboutRelatedLabel.textContent = type === "task" ? "Task name" : "Topic name";
      els.nmAboutText.placeholder = type === "task" ? "e.g. Fix onboarding email template" : "e.g. Sprint planning";
    } else if (type === "project") {
      els.nmAboutProject.hidden = false;
      els.nmAboutRelatedLabel.textContent = "Project";
    } else if (type === "evaluation") {
      els.nmAboutEval.hidden = false;
      els.nmAboutRelatedLabel.textContent = "Evaluation";
    } else {
      els.nmAboutRelatedField.hidden = true;
    }
  }

  function clearConvNewFormErrors() {
    Array.prototype.forEach.call(els.convNewForm.querySelectorAll(".field"), function (f) { f.classList.remove("invalid"); });
  }

  function openNewConvModal() {
    els.convNewForm.reset();
    els.nmAboutType.value = "task";
    refreshConvAboutOptions();
    updateAboutRelatedField();
    state.pendingConvParticipants = [];
    renderNmRecipientChips();
    clearConvNewFormErrors();
    els.convNewModal.hidden = false;
    setTimeout(function () { els.nmAboutText.focus(); }, 30);
  }

  function closeNewConvModal() { els.convNewModal.hidden = true; }

  function render() {
    renderDirectory();
    renderChart();
    renderBoard();
    renderCalendar();
    renderTimeline();
    renderWorkload();
    renderDashboard();
    refreshManagerOptions();
    refreshDeptOptions();
    refreshPeopleList();
    renderMtgSections();
    renderTaskBoard();
    refreshEvalEmployeeOptions();
    renderEvaluations();
    refreshConvAboutOptions();
    renderInbox();
  }

  function renderTableHead() {
    var base = ["Name / title", "Reports to", "Department", "Status", "Email", "Start date"];
    var head = base.map(function (b) { return "<th>" + b + "</th>"; }).join("") +
      state.fieldDefs.map(function (f) { return "<th>" + escapeHtml(f.label) + "</th>"; }).join("") +
      '<th class="visually-hidden">Actions</th>';
    els.theadRow.innerHTML = head;
  }

  function customFieldDisplay(f, value) {
    if (f.type === "checkbox") return value ? "✓" : "—";
    if (value === undefined || value === null || value === "") return "—";
    return escapeHtml(String(value));
  }

  function renderDirectory() {
    renderTableHead();
    var q = state.search.trim().toLowerCase();
    var filtered = state.employees.filter(function (e) {
      var matchesQ = !q || [e.name, e.title, e.email].some(function (v) { return String(v || "").toLowerCase().indexOf(q) !== -1; });
      var matchesDept = !state.deptFilter || e.department === state.deptFilter;
      return matchesQ && matchesDept;
    });
    filtered.sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });

    els.statTotal.textContent = state.employees.length;
    els.statDepts.textContent = uniqueDepartments().length;
    els.statRoots.textContent = state.employees.filter(function (e) { return !resolvedManagerId(e); }).length;

    els.exampleBanner.hidden = !state.usingExamples;

    if (!filtered.length) {
      els.tbody.innerHTML = "";
      els.empty.hidden = false;
      els.empty.querySelector("h3").textContent = state.employees.length ? "No matches" : "No one added yet";
      els.empty.querySelector("p").textContent = state.employees.length
        ? "Try a different search or department filter."
        : "Add your first person using the form on the left.";
      return;
    }
    els.empty.hidden = true;

    els.tbody.innerHTML = filtered.map(function (e) {
      var manager = byId(resolvedManagerId(e));
      var customTds = state.fieldDefs.map(function (f) {
        return "<td>" + customFieldDisplay(f, (e.customFields || {})[f.id]) + "</td>";
      }).join("");
      return (
        '<tr data-id="' + escapeHtml(e.id) + '">' +
          '<td><div class="person-cell">' + avatarHtml(e) +
            '<span class="emp-name">' + escapeHtml(e.name) +
            (e.example ? ' <span class="badge badge-example">Example</span>' : "") +
            (!e.example && e.selfAdded ? ' <span class="badge badge-self">Self-added</span>' : "") +
            '<span class="sub">' + escapeHtml(e.title || "—") + "</span></span></div></td>" +
          "<td>" + (manager ? escapeHtml(manager.name) : "—") + "</td>" +
          "<td>" + deptBadgeHtml(e.department) + "</td>" +
          "<td>" + statusBadgeHtml(e.status) + "</td>" +
          '<td>' + (e.email ? '<a href="mailto:' + escapeHtml(e.email) + '" style="color:inherit;">' + escapeHtml(e.email) + "</a>" : "—") + "</td>" +
          '<td class="mono-date">' + formatDate(e.startDate) + "</td>" +
          customTds +
          '<td class="row-actions" data-actions></td>' +
        "</tr>"
      );
    }).join("");

    Array.prototype.forEach.call(els.tbody.querySelectorAll("tr"), function (tr) {
      var id = tr.getAttribute("data-id");
      buildRowActions(tr.querySelector("[data-actions]"), id);
    });
  }

  function buildRowActions(cell, id) {
    cell.innerHTML = "";
    var editBtn = document.createElement("button");
    editBtn.className = "btn-text";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () { startEdit(id); });

    var delBtn = document.createElement("button");
    delBtn.className = "btn-danger-text";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", function () { showDeleteConfirm(cell, id); });

    cell.appendChild(editBtn);
    cell.appendChild(delBtn);
  }

  function showDeleteConfirm(cell, id) {
    var emp = byId(id);
    cell.innerHTML = "";
    var wrap = document.createElement("span");
    wrap.className = "confirm-row";
    wrap.textContent = "Delete " + (emp ? emp.name : "this record") + "? ";

    var yes = document.createElement("button");
    yes.className = "btn-danger-text";
    yes.type = "button";
    yes.textContent = "Yes";
    yes.addEventListener("click", function () { deleteEmployee(id); });

    var no = document.createElement("button");
    no.className = "btn-text";
    no.type = "button";
    no.textContent = "No";
    no.addEventListener("click", function () { buildRowActions(cell, id); });

    wrap.appendChild(yes);
    wrap.appendChild(no);
    cell.appendChild(wrap);
  }

  // ---- Org chart view ------------------------------------------------
  function renderChart() {
    var roots = state.employees.filter(function (e) { return !resolvedManagerId(e); });
    if (!state.employees.length) {
      els.chartForest.innerHTML = "";
      els.chartEmpty.hidden = false;
      return;
    }
    els.chartEmpty.hidden = true;

    var childrenOf = {};
    state.employees.forEach(function (e) {
      var m = resolvedManagerId(e);
      if (!m) return;
      (childrenOf[m] = childrenOf[m] || []).push(e);
    });
    Object.keys(childrenOf).forEach(function (k) {
      childrenOf[k].sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
    });
    roots.sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });

    function nodeHtml(e) {
      return (
        '<button type="button" class="org-node" data-id="' + escapeHtml(e.id) + '">' +
          '<div class="n-person">' + avatarHtml(e) +
            '<div><div class="n-name">' + escapeHtml(e.name) + (e.example ? ' <span class="badge badge-example">Ex</span>' : "") + "</div></div>" +
          "</div>" +
          '<div class="n-title">' + escapeHtml(e.title || "—") + "</div>" +
          (e.department ? '<div class="n-dept">' + deptBadgeHtml(e.department) + "</div>" : "") +
        "</button>"
      );
    }

    function buildLi(e) {
      var kids = childrenOf[e.id] || [];
      var html = "<li>" + nodeHtml(e);
      if (kids.length) {
        html += '<ul style="--child-count:' + kids.length + ';"' + (kids.length === 1 ? ' class="single"' : "") + ">" +
          kids.map(buildLi).join("") +
          "</ul>";
      }
      html += "</li>";
      return html;
    }

    els.chartForest.innerHTML = roots.map(function (r) {
      return '<ul class="org-tree">' + buildLi(r) + "</ul>";
    }).join("");

    Array.prototype.forEach.call(els.chartForest.querySelectorAll(".org-node"), function (btn) {
      btn.addEventListener("click", function () { startEdit(btn.getAttribute("data-id")); });
    });
  }

  // ---- Board / Kanban view ---------------------------------------------
  function renderBoard() {
    if (!state.employees.length) {
      els.boardColumns.innerHTML = "";
      els.boardEmpty.hidden = false;
      return;
    }
    els.boardEmpty.hidden = true;

    var byStatus = state.boardGroupBy === "status";
    els.boardHint.textContent = byStatus
      ? "Grouped by onboarding status. Click a card to edit."
      : "Grouped by department. Click a card to edit.";

    var groups = {};
    state.employees.forEach(function (e) {
      var key = byStatus ? (e.status || "Not Started") : (e.department || "Unassigned");
      (groups[key] = groups[key] || []).push(e);
    });
    var colNames = byStatus ? STATUS_ORDER.slice() : Object.keys(groups).sort(function (a, b) { return a.localeCompare(b); });

    els.boardColumns.innerHTML = colNames.map(function (name) {
      var items = (groups[name] || []).slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
      var tagCls = byStatus ? tagClassForStatus(name) : tagClassFor(name);
      var cards = items.map(function (e) {
        return '<button type="button" class="board-card" data-id="' + escapeHtml(e.id) + '">' +
          '<div class="bc-top">' + avatarHtml(e) +
            '<div><div class="bc-name">' + escapeHtml(e.name) + (e.example ? ' <span class="badge badge-example">Ex</span>' : "") + '</div>' +
            '<div class="bc-title">' + escapeHtml(e.title || "—") + "</div></div>" +
          "</div>" +
          '<div class="bc-meta"><span class="bc-date">Since ' + formatDate(e.startDate) + "</span>" +
          (byStatus ? deptBadgeHtml(e.department) : statusBadgeHtml(e.status)) + "</div>" +
        "</button>";
      }).join("");
      var addAttr = byStatus ? ' data-add-status="' + escapeHtml(name) + '"' : ' data-add-dept="' + escapeHtml(name) + '"';
      return '<div class="board-col">' +
        '<div class="board-col-head"><span class="head-left"><span class="dot ' + tagCls + '"></span>' + escapeHtml(name) + '</span><span class="badge ' + tagCls + '">' + items.length + "</span></div>" +
        cards +
        '<button type="button" class="board-add"' + addAttr + '>+ Add person</button>' +
      "</div>";
    }).join("");

    Array.prototype.forEach.call(els.boardColumns.querySelectorAll(".board-card"), function (btn) {
      btn.addEventListener("click", function () { startEdit(btn.getAttribute("data-id")); });
    });
    Array.prototype.forEach.call(els.boardColumns.querySelectorAll(".board-add"), function (btn) {
      btn.addEventListener("click", function () {
        var dept = btn.getAttribute("data-add-dept");
        var status = btn.getAttribute("data-add-status");
        jumpToAddPerson({ department: dept, status: status });
      });
    });
  }

  document.querySelectorAll("#panel-board .seg-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.boardGroupBy = btn.getAttribute("data-group");
      document.querySelectorAll("#panel-board .seg-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
      renderBoard();
    });
  });

  // ---- Calendar view (project dates & logged meetings) ------------------
  function projectCalendarEvents() {
    var events = [];
    state.projects.forEach(function (p) {
      if (p.startDate) events.push({ date: p.startDate, kind: "start", project: p });
      if (p.endDate) events.push({ date: p.endDate, kind: "end", project: p });
      (p.meetings || []).forEach(function (m) {
        if (m.date) events.push({ date: m.date, kind: "meeting", project: p, meeting: m });
      });
    });
    return events;
  }

  function calEventLabel(ev) {
    if (ev.kind === "start") return ev.project.name + " starts";
    if (ev.kind === "end") return ev.project.name + " due";
    return ev.project.name + " meeting";
  }

  function renderCalendar() {
    els.calTitle.textContent = MONTH_NAMES[state.calMonth] + " " + state.calYear;
    var year = state.calYear;
    var firstDay = new Date(year, state.calMonth, 1);
    var startWeekday = firstDay.getDay();
    var daysInMonth = new Date(year, state.calMonth + 1, 0).getDate();
    var daysInPrevMonth = new Date(year, state.calMonth, 0).getDate();

    var allEvents = projectCalendarEvents();
    var byDay = {};
    allEvents.forEach(function (ev) {
      var d = new Date(ev.date + "T00:00:00");
      if (isNaN(d.getTime()) || d.getMonth() !== state.calMonth || d.getFullYear() !== year) return;
      (byDay[d.getDate()] = byDay[d.getDate()] || []).push(ev);
    });

    var cells = [];
    for (var i = 0; i < startWeekday; i++) {
      cells.push('<div class="cal-cell outside"><div class="cal-daynum">' + (daysInPrevMonth - startWeekday + 1 + i) + "</div></div>");
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var items = byDay[day] || [];
      var chips = items.map(function (ev) {
        return '<button type="button" class="cal-chip" data-id="' + escapeHtml(ev.project.id) + '">' +
          '<span class="dot" style="background: var(' + projStatusColorVar(ev.project.status) + ');"></span>' +
          "<span>" + escapeHtml(calEventLabel(ev)) + "</span></button>";
      }).join("");
      cells.push('<div class="cal-cell"><div class="cal-daynum">' + day + "</div>" + chips + "</div>");
    }
    var remainder = cells.length % 7;
    if (remainder !== 0) {
      var toAdd = 7 - remainder;
      for (var j = 1; j <= toAdd; j++) { cells.push('<div class="cal-cell outside"><div class="cal-daynum">' + j + "</div></div>"); }
    }
    els.calGrid.innerHTML = cells.join("");

    Array.prototype.forEach.call(els.calGrid.querySelectorAll(".cal-chip"), function (btn) {
      btn.addEventListener("click", function () { openProjectInMeetings(btn.getAttribute("data-id")); });
    });

    var anyThisMonth = Object.keys(byDay).length > 0;
    els.calEmptyNote.hidden = anyThisMonth;
    els.calEmptyNote.textContent = state.projects.length
      ? "Nothing scheduled in " + MONTH_NAMES[state.calMonth] + " " + year + "."
      : "Add projects to see their dates here.";
  }

  // ---- Timeline view (project schedules) --------------------------------
  function renderTlPipeline() {
    var counts = { active: 0, upcoming: 0, stuck: 0, completed: 0 };
    state.projects.forEach(function (p) { if (counts.hasOwnProperty(p.status)) counts[p.status]++; });
    var order = ["upcoming", "active", "stuck", "completed"];
    var total = state.projects.length;
    els.tlPipeline.innerHTML = order.map(function (status, i) {
      var pct = total ? Math.round((counts[status] / total) * 100) : 0;
      var stage = '<button type="button" class="tl-pipeline-stage" data-status="' + status + '" style="border-top-color: var(' + projStatusColorVar(status) + ');">' +
        '<div class="stage-count">' + counts[status] + '</div>' +
        '<div class="stage-label">' + MTG_STATUS_LABEL[status] + '</div>' +
        '<div class="stage-pct">' + pct + '% of projects</div>' +
      '</button>';
      var arrow = i < order.length - 1
        ? '<div class="tl-pipeline-arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>'
        : "";
      return stage + arrow;
    }).join("");

    Array.prototype.forEach.call(els.tlPipeline.querySelectorAll(".tl-pipeline-stage"), function (btn) {
      btn.addEventListener("click", function () {
        var status = btn.getAttribute("data-status");
        var target = els.tlGroups.querySelector('.tl-group[data-status="' + status + '"]');
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function renderTimeline() {
    renderTlPipeline();
    var withDates = state.projects.filter(function (p) {
      return p.startDate && p.endDate && !isNaN(new Date(p.startDate + "T00:00:00").getTime()) && !isNaN(new Date(p.endDate + "T00:00:00").getTime());
    });

    if (!withDates.length) {
      els.tlAxis.innerHTML = "";
      els.tlGroups.innerHTML = "";
      els.tlEmpty.hidden = false;
      els.tlEmpty.querySelector("h3").textContent = state.projects.length ? "No project dates yet" : "No projects yet";
      els.tlEmpty.querySelector("p").textContent = state.projects.length
        ? "Add a start and end date to a project to see it on the timeline."
        : "Add your first project to see the timeline.";
      return;
    }
    els.tlEmpty.hidden = true;

    var today = new Date();
    var minStart = withDates.reduce(function (m, p) { return Math.min(m, new Date(p.startDate + "T00:00:00").getTime()); }, today.getTime());
    var maxEnd = withDates.reduce(function (m, p) { return Math.max(m, new Date(p.endDate + "T00:00:00").getTime()); }, today.getTime());
    var domainStart = new Date(new Date(minStart).getFullYear(), 0, 1);
    var domainEnd = new Date(new Date(maxEnd).getFullYear(), 11, 31);
    var domainMs = domainEnd - domainStart;
    function pct(d) { return domainMs > 0 ? ((d - domainStart) / domainMs) * 100 : 0; }

    var axisTicks = [];
    for (var y = domainStart.getFullYear(); y <= domainEnd.getFullYear(); y++) {
      axisTicks.push('<span style="left:' + pct(new Date(y, 0, 1)).toFixed(2) + '%">' + y + "</span>");
    }
    els.tlAxis.innerHTML = axisTicks.join("");

    var groups = {};
    withDates.forEach(function (p) { (groups[p.status] = groups[p.status] || []).push(p); });
    var todayPct = pct(today);

    els.tlGroups.innerHTML = MTG_STATUS_ORDER.filter(function (s) { return groups[s] && groups[s].length; }).map(function (status) {
      var items = groups[status].slice().sort(function (a, b) { return new Date(a.startDate) - new Date(b.startDate); });
      var rows = items.map(function (p) {
        var start = new Date(p.startDate + "T00:00:00");
        var end = new Date(p.endDate + "T00:00:00");
        var left = pct(start);
        var right = pct(end);
        var width = Math.max(right - left, 0.6);
        return '<div class="tl-row">' +
          '<div class="tl-label"><span class="lbl-name">' + escapeHtml(p.name) + "</span></div>" +
          '<div class="tl-track">' +
            '<div class="tl-today-line" style="left:' + todayPct.toFixed(2) + '%"></div>' +
            '<button type="button" class="tl-bar" data-id="' + escapeHtml(p.id) + '" style="left:' + left.toFixed(2) + "%; width:" + width.toFixed(2) + '%; background: var(' + projStatusColorVar(status) + ');" title="' + escapeHtml(p.name) + " — " + formatDate(p.startDate) + " to " + formatDate(p.endDate) + '"></button>' +
          "</div>" +
        "</div>";
      }).join("");
      return '<div class="tl-group" data-status="' + status + '"><div class="tl-group-head"><span class="dot" style="background: var(' + projStatusColorVar(status) + ');"></span>' + MTG_STATUS_LABEL[status] + "</div>" + rows + "</div>";
    }).join("");

    Array.prototype.forEach.call(els.tlGroups.querySelectorAll(".tl-bar"), function (btn) {
      btn.addEventListener("click", function () { openProjectInMeetings(btn.getAttribute("data-id")); });
    });
  }

  // ---- Workload view (manager capacity) ---------------------------------
  function workloadCounts() {
    var counts = {};
    state.employees.forEach(function (e) {
      var m = resolvedManagerId(e);
      if (m) counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  }

  function workloadTone(count) {
    if (count > WORKLOAD_TARGET + 1) return "over";
    if (count < WORKLOAD_TARGET - 2) return "under";
    return "balanced";
  }

  function renderWorkload() {
    var counts = workloadCounts();
    var managerIds = Object.keys(counts);
    if (!managerIds.length) {
      els.wlRows.innerHTML = "";
      els.wlEmpty.hidden = false;
      els.wlFootnote.textContent = "";
      return;
    }
    els.wlEmpty.hidden = true;

    var rows = managerIds.map(function (id) { return { emp: byId(id), count: counts[id] }; }).filter(function (r) { return r.emp; });
    rows.sort(function (a, b) { return b.count - a.count; });
    var maxCount = Math.max.apply(null, rows.map(function (r) { return r.count; }).concat([WORKLOAD_TARGET]));
    var targetPct = Math.min((WORKLOAD_TARGET / maxCount) * 100, 100);

    els.wlRows.innerHTML = rows.map(function (r) {
      var pct = Math.min((r.count / maxCount) * 100, 100);
      var tone = workloadTone(r.count);
      var toneLabel = tone === "over" ? "Over capacity" : tone === "under" ? "Under capacity" : "Balanced";
      return '<div class="wl-row">' +
        '<button type="button" class="wl-person" data-id="' + escapeHtml(r.emp.id) + '">' + avatarHtml(r.emp) +
          '<span><span class="wl-name">' + escapeHtml(r.emp.name) + '</span><span class="wl-title">' + escapeHtml(r.emp.title || "—") + "</span></span></button>" +
        '<div class="wl-bar-wrap"><div class="wl-target-line" style="left:' + targetPct.toFixed(2) + '%"></div><div class="wl-bar wl-' + tone + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<div class="wl-count">' + r.count + " report" + (r.count === 1 ? "" : "s") + "</div>" +
        '<span class="badge wl-' + tone + '">' + toneLabel + "</span>" +
      "</div>";
    }).join("");

    Array.prototype.forEach.call(els.wlRows.querySelectorAll(".wl-person"), function (btn) {
      btn.addEventListener("click", function () { startEdit(btn.getAttribute("data-id")); });
    });

    var icCount = state.employees.length - managerIds.length;
    els.wlFootnote.textContent = icCount > 0
      ? icCount + " " + (icCount === 1 ? "person has" : "people have") + " no direct reports (individual contributors)."
      : "";
  }

  // ---- Dashboard view (project summary) ------------------------------------
  function renderDashboard() {
    var total = state.projects.length;
    els.dashEmpty.hidden = !!total;
    els.dashGrid.style.display = total ? "" : "none";
    els.dashAiCard.style.display = total ? "" : "none";
    if (!total) return;

    var statusCounts = { active: 0, upcoming: 0, stuck: 0, completed: 0 };
    state.projects.forEach(function (p) { if (statusCounts.hasOwnProperty(p.status)) statusCounts[p.status]++; });
    var maxStatus = Math.max.apply(null, MTG_STATUS_ORDER.map(function (s) { return statusCounts[s]; }).concat([1]));
    els.dashDept.innerHTML = MTG_STATUS_ORDER.map(function (s) {
      return '<div class="dash-bar-row"><span class="dash-bar-label">' + MTG_STATUS_LABEL[s] + '</span>' +
        '<div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + ((statusCounts[s] / maxStatus) * 100).toFixed(1) + '%; background: var(' + projStatusColorVar(s) + ');"></div></div>' +
        '<span class="dash-bar-count">' + statusCounts[s] + "</span></div>";
    }).join("");

    var today = new Date();
    var onTrack = 0, dueSoon = 0, overdue = 0;
    state.projects.forEach(function (p) {
      if (p.status === "completed" || !p.endDate) return;
      var end = new Date(p.endDate + "T00:00:00");
      var daysLeft = (end - today) / (1000 * 60 * 60 * 24);
      if (daysLeft < 0) overdue++;
      else if (daysLeft <= 7) dueSoon++;
      else onTrack++;
    });
    els.dashStatus.innerHTML =
      '<div class="dash-stat badge wl-balanced" style="border-radius:12px;"><div class="num">' + onTrack + '</div><div class="lbl">On track</div></div>' +
      '<div class="dash-stat badge tag-4" style="border-radius:12px;"><div class="num">' + dueSoon + '</div><div class="lbl">Due soon</div></div>' +
      '<div class="dash-stat badge wl-over" style="border-radius:12px;"><div class="num">' + overdue + '</div><div class="lbl">Overdue</div></div>';

    var sizeBuckets = [
      { label: "Solo (1)", min: 1, max: 1, count: 0 },
      { label: "Small (2–3)", min: 2, max: 3, count: 0 },
      { label: "Larger (4+)", min: 4, max: Infinity, count: 0 }
    ];
    state.projects.forEach(function (p) {
      var n = (p.people || []).length;
      var b = sizeBuckets.filter(function (b) { return n >= b.min && n <= b.max; })[0];
      if (b) b.count++;
    });
    var maxSize = Math.max.apply(null, sizeBuckets.map(function (b) { return b.count; }).concat([1]));
    els.dashTenure.innerHTML = sizeBuckets.map(function (b) {
      return '<div class="dash-bar-row"><span class="dash-bar-label">' + b.label + '</span>' +
        '<div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + ((b.count / maxSize) * 100).toFixed(1) + '%; background: var(--accent);"></div></div>' +
        '<span class="dash-bar-count">' + b.count + "</span></div>";
    }).join("");

    var peopleCounts = {};
    state.projects.forEach(function (p) { (p.people || []).forEach(function (name) { peopleCounts[name] = (peopleCounts[name] || 0) + 1; }); });
    var one = 0, two = 0, threePlus = 0;
    Object.keys(peopleCounts).forEach(function (name) {
      var c = peopleCounts[name];
      if (c >= 3) threePlus++; else if (c === 2) two++; else one++;
    });
    els.dashWorkload.innerHTML =
      '<div class="dash-stat badge wl-under" style="border-radius:12px;"><div class="num">' + one + '</div><div class="lbl">1 project</div></div>' +
      '<div class="dash-stat badge wl-balanced" style="border-radius:12px;"><div class="num">' + two + '</div><div class="lbl">2 projects</div></div>' +
      '<div class="dash-stat badge wl-over" style="border-radius:12px;"><div class="num">' + threePlus + '</div><div class="lbl">3+ projects</div></div>';

    var upcoming = state.projects.filter(function (p) { return p.endDate && p.status !== "completed"; }).map(function (p) {
      return { project: p, date: new Date(p.endDate + "T00:00:00") };
    }).sort(function (a, b) { return a.date - b.date; }).slice(0, 6);
    els.dashAnniv.innerHTML = upcoming.length
      ? upcoming.map(function (u) {
          var daysLeft = Math.round((u.date - today) / (1000 * 60 * 60 * 24));
          var dueLabel = daysLeft < 0 ? Math.abs(daysLeft) + "d overdue" : daysLeft === 0 ? "Due today" : "in " + daysLeft + "d";
          return '<button type="button" class="dash-anniv-item" data-id="' + escapeHtml(u.project.id) + '">' +
            '<span class="dot" style="background: var(' + projStatusColorVar(u.project.status) + ');"></span>' +
            '<span><span class="lbl-name">' + escapeHtml(u.project.name) + "</span><br><span class=\"lbl-sub\">" + MTG_STATUS_LABEL[u.project.status] + " · " + dueLabel + "</span></span>" +
            '<span class="dash-anniv-date">' + u.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + "</span>" +
          "</button>";
        }).join("")
      : '<p class="dash-empty-inline">No upcoming deadlines.</p>';

    Array.prototype.forEach.call(els.dashAnniv.querySelectorAll(".dash-anniv-item"), function (btn) {
      btn.addEventListener("click", function () { openProjectInMeetings(btn.getAttribute("data-id")); });
    });
  }

  // ---- Notes / comments per person --------------------------------------
  var notesCache = {};

  function renderNotesList(notes) {
    if (!notes.length) {
      els.notesList.innerHTML = "";
      els.notesEmpty.hidden = false;
      return;
    }
    els.notesEmpty.hidden = true;
    els.notesList.innerHTML = notes.map(function (n) {
      var when = n.createdAt ? new Date(n.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
      return '<div class="note-item" data-note-id="' + escapeHtml(n.id) + '">' +
        '<div class="note-text">' + escapeHtml(n.text) + "</div>" +
        '<div class="note-meta"><span>' + escapeHtml(when) + '</span><button type="button" class="note-del" data-note-id="' + escapeHtml(n.id) + '" aria-label="Delete note">✕</button></div>' +
      "</div>";
    }).join("");
    Array.prototype.forEach.call(els.notesList.querySelectorAll(".note-del"), function (btn) {
      btn.addEventListener("click", function () { deleteNote(btn.getAttribute("data-note-id")); });
    });
  }

  function openNotesFor(id) {
    var emp = byId(id);
    els.notesSection.hidden = false;
    els.notesHeading.textContent = "Notes for " + (emp ? emp.name : "this person");

    TeamGridApi.get("/api/employees/" + encodeURIComponent(id) + "/notes").then(function (notes) {
      notesCache[id] = notes || [];
      renderNotesList(notesCache[id]);
    }).catch(function (err) {
      console.log("[org-chart-directory] notes load error", err);
      renderNotesList(notesCache[id] || []);
    });
  }

  function closeNotes() {
    els.notesSection.hidden = true;
    els.notesList.innerHTML = "";
    els.notesInput.value = "";
  }

  async function addNote() {
    var id = state.editingId;
    var text = els.notesInput.value.trim();
    if (!id || !text) return;
    els.notesInput.value = "";
    try {
      var created = await TeamGridApi.post("/api/employees/" + encodeURIComponent(id) + "/notes", {
        text: text,
        createdAt: new Date().toISOString()
      });
      notesCache[id] = (notesCache[id] || []).concat([created]);
      renderNotesList(notesCache[id]);
    } catch (e) {
      console.log("[org-chart-directory] add note failed", e);
    }
  }

  async function deleteNote(noteId) {
    var id = state.editingId;
    if (!id) return;
    try {
      await TeamGridApi.del("/api/employees/" + encodeURIComponent(id) + "/notes/" + encodeURIComponent(noteId));
      notesCache[id] = (notesCache[id] || []).filter(function (n) { return n.id !== noteId; });
      renderNotesList(notesCache[id]);
    } catch (e) {
      console.log("[org-chart-directory] delete note failed", e);
    }
  }

  els.notesAddBtn.addEventListener("click", addNote);

  // ---- Onboarding checklist per person -----------------------------------
  var checklistCache = {};
  var DEFAULT_CHECKLIST = ["Laptop & equipment issued", "Accounts & access created", "Intro meeting scheduled", "Handbook & policies signed"];

  function renderChecklist(items) {
    if (!items.length) {
      els.checklistList.innerHTML = "";
      els.checklistEmpty.hidden = false;
      return;
    }
    els.checklistEmpty.hidden = true;
    var doneCount = items.filter(function (i) { return i.done; }).length;
    els.checklistList.innerHTML =
      '<p class="checklist-progress">' + doneCount + " of " + items.length + " done</p>" +
      items.map(function (i) {
        return '<div class="check-item' + (i.done ? " done" : "") + '" data-id="' + escapeHtml(i.id) + '">' +
          '<input type="checkbox" data-toggle="' + escapeHtml(i.id) + '"' + (i.done ? " checked" : "") + " />" +
          '<span class="check-text">' + escapeHtml(i.text) + "</span>" +
          '<button type="button" class="check-del" data-del="' + escapeHtml(i.id) + '" aria-label="Delete item">✕</button>' +
        "</div>";
      }).join("");
    Array.prototype.forEach.call(els.checklistList.querySelectorAll("[data-toggle]"), function (cb) {
      cb.addEventListener("change", function () { toggleChecklistItem(cb.getAttribute("data-toggle"), cb.checked); });
    });
    Array.prototype.forEach.call(els.checklistList.querySelectorAll("[data-del]"), function (btn) {
      btn.addEventListener("click", function () { deleteChecklistItem(btn.getAttribute("data-del")); });
    });
  }

  function openChecklistFor(id) {
    els.checklistSection.hidden = false;
    TeamGridApi.get("/api/employees/" + encodeURIComponent(id) + "/checklist").then(function (items) {
      checklistCache[id] = items || [];
      renderChecklist(checklistCache[id]);
    }).catch(function (err) {
      console.log("[org-chart-directory] checklist load error", err);
      renderChecklist(checklistCache[id] || []);
    });
  }

  function closeChecklist() {
    els.checklistSection.hidden = true;
    els.checklistList.innerHTML = "";
    els.checklistInput.value = "";
  }

  async function addChecklistItem(text) {
    var id = state.editingId;
    if (!id || !text) return;
    try {
      var created = await TeamGridApi.post("/api/employees/" + encodeURIComponent(id) + "/checklist", {
        text: text,
        done: false,
        createdAt: new Date().toISOString()
      });
      checklistCache[id] = (checklistCache[id] || []).concat([created]);
      renderChecklist(checklistCache[id]);
    } catch (e) {
      console.log("[org-chart-directory] add checklist item failed", e);
    }
  }

  async function toggleChecklistItem(itemId, done) {
    var id = state.editingId;
    if (!id) return;
    try {
      var updated = await TeamGridApi.patch(
        "/api/employees/" + encodeURIComponent(id) + "/checklist/" + encodeURIComponent(itemId),
        { done: done }
      );
      checklistCache[id] = (checklistCache[id] || []).map(function (i) {
        return i.id === itemId ? updated : i;
      });
      renderChecklist(checklistCache[id]);
    } catch (e) {
      console.log("[org-chart-directory] toggle checklist item failed", e);
    }
  }

  async function deleteChecklistItem(itemId) {
    var id = state.editingId;
    if (!id) return;
    try {
      await TeamGridApi.del("/api/employees/" + encodeURIComponent(id) + "/checklist/" + encodeURIComponent(itemId));
      checklistCache[id] = (checklistCache[id] || []).filter(function (i) { return i.id !== itemId; });
      renderChecklist(checklistCache[id]);
    } catch (e) {
      console.log("[org-chart-directory] delete checklist item failed", e);
    }
  }

  els.checklistAddBtn.addEventListener("click", function () {
    var text = els.checklistInput.value.trim();
    if (!text) return;
    els.checklistInput.value = "";
    addChecklistItem(text);
  });
  els.checklistInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); els.checklistAddBtn.click(); }
  });
  els.checklistTemplateBtn.addEventListener("click", function () {
    DEFAULT_CHECKLIST.forEach(function (text) { addChecklistItem(text); });
  });

  function jumpToAddPerson(prefill) {
    resetForm();
    if (prefill) {
      if (prefill.department && prefill.department !== "Unassigned") { els.form.department.value = prefill.department; }
      if (prefill.status) { els.form.status.value = prefill.status; }
    }
    activateTab("table");
    setTimeout(function () { els.form.name.focus(); }, 30);
  }

  function startEdit(id) {
    var emp = byId(id);
    if (!emp) return;
    state.editingId = id;
    els.form.name.value = emp.name || "";
    els.form.title.value = emp.title || "";
    els.form.department.value = emp.department || "";
    els.form.status.value = emp.status || "Not Started";
    els.form.email.value = emp.email || "";
    els.form.phone.value = emp.phone || "";
    els.form.startDate.value = emp.startDate || "";
    state.pendingPhotoUrl = emp.photoUrl || null;
    els.photoInput.value = "";
    updatePhotoPreview();
    state.pendingCustomFields = Object.assign({}, emp.customFields || {});
    renderCustomFieldInputs();
    refreshManagerOptions();
    els.managerSelect.value = emp.managerId || "";
    els.formTitle.textContent = "Edit person";
    els.formSub.textContent = emp.example ? "Editing this example turns it into your own record." : "Update the details, then save.";
    els.submitBtn.textContent = "Save changes";
    els.cancelBtn.style.display = "";
    activateTab("table");
    openNotesFor(id);
    openChecklistFor(id);
    els.form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    els.form.name.focus();
  }

  function resetForm() {
    state.editingId = null;
    els.form.reset();
    els.form.status.value = "Not Started";
    els.formTitle.textContent = "Add person";
    els.formSub.textContent = "Set who they report to and the chart updates on its own.";
    els.submitBtn.textContent = "Add person";
    els.cancelBtn.style.display = "none";
    state.pendingPhotoUrl = null;
    els.photoInput.value = "";
    updatePhotoPreview();
    state.pendingCustomFields = {};
    renderCustomFieldInputs();
    Array.prototype.forEach.call(els.form.querySelectorAll(".field"), function (f) { f.classList.remove("invalid"); });
    refreshManagerOptions();
    closeNotes();
    closeChecklist();
  }

  function validateFormFields(formEl, data) {
    var required = ["name", "title", "department", "email", "startDate"];
    var valid = true;
    required.forEach(function (key) {
      var fieldEl = formEl.querySelector('[data-field="' + key + '"]');
      var ok = !!String(data[key] || "").trim();
      if (key === "email" && ok) ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim());
      if (fieldEl) fieldEl.classList.toggle("invalid", !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  function validateForm(data) { return validateFormFields(els.form, data); }

  // ---- Persistence layer (local SQLite API) -------------------------
  var apiOnline = false;

  function genId() { return "emp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function genProjectId() { return "proj_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function genEvalId() { return "eval_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function genConvId() { return "conv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function genConvMsgId() { return "cm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function saveFailed() {
    els.syncNote.textContent = "Couldn't save that just now — please try again.";
  }

  function applyEmployees(list) {
    state.usingExamples = false;
    state.employees = (list || []).map(function (data) {
      return {
        id: data.id,
        name: data.name || "",
        title: data.title || "",
        department: data.department || "",
        status: data.status || "Not Started",
        managerId: data.managerId || "",
        email: data.email || "",
        phone: data.phone || "",
        startDate: data.startDate || "",
        photoUrl: data.photoUrl || "",
        customFields: data.customFields || {},
        selfAdded: !!data.selfAdded
      };
    });
    render();
  }

  function applyProjects(list) {
    state.usingExamplesProjects = false;
    state.projects = (list || []).map(function (data) {
      return {
        id: data.id,
        name: data.name || "",
        status: MTG_STATUS_ORDER.indexOf(data.status) !== -1 ? data.status : "upcoming",
        startDate: data.startDate || "",
        endDate: data.endDate || "",
        people: Array.isArray(data.people) ? data.people : [],
        meetings: Array.isArray(data.meetings) ? data.meetings : [],
        tasks: normalizeTasks(data.tasks)
      };
    });
    if (state.expandedProjectId && !projectById(state.expandedProjectId)) state.expandedProjectId = null;
    renderMtgSections();
  }

  function applyEvaluations(list) {
    state.usingExamplesEvaluations = false;
    state.evaluations = (list || []).map(function (data) {
      return {
        id: data.id,
        employeeId: data.employeeId || "",
        period: data.period || "",
        reviewer: data.reviewer || "",
        quality: Number(data.quality) || 0,
        productivity: Number(data.productivity) || 0,
        communication: Number(data.communication) || 0,
        leadership: Number(data.leadership) || 0,
        notes: data.notes || "",
        createdAt: data.createdAt || ""
      };
    });
    renderEvaluations();
  }

  function applyConversations(list) {
    state.usingExamplesConversations = false;
    state.conversations = (list || []).map(function (data) {
      return {
        id: data.id,
        aboutType: data.aboutType || "general",
        aboutRefId: data.aboutRefId || "",
        aboutLabel: data.aboutLabel || "",
        participants: Array.isArray(data.participants) ? data.participants : [],
        messages: Array.isArray(data.messages) ? data.messages : [],
        createdAt: data.createdAt || ""
      };
    });
    if (state.selectedConversationId && !convById(state.selectedConversationId)) state.selectedConversationId = null;
    renderInbox();
  }

  function applyFieldDefs(payload) {
    state.fieldDefs = (payload && payload.fields) || [];
    renderFieldDefsList();
    renderCustomFieldInputs();
    renderTableHead();
    renderDirectory();
  }

  async function refreshEmployees() { applyEmployees(await TeamGridApi.get("/api/employees")); }
  async function refreshProjects() { applyProjects(await TeamGridApi.get("/api/projects")); }
  async function refreshEvaluations() { applyEvaluations(await TeamGridApi.get("/api/evaluations")); }
  async function refreshConversations() { applyConversations(await TeamGridApi.get("/api/conversations")); }

  function replaceExamplesWithEmpty() {
    state.employees = [];
    state.usingExamples = false;
    state.examplesDismissed = true;
    render();
  }

  function replaceProjectExamplesWithEmpty() {
    state.projects = [];
    state.usingExamplesProjects = false;
    state.examplesDismissedProjects = true;
    renderMtgSections();
  }

  function replaceEvaluationExamplesWithEmpty() {
    state.evaluations = [];
    state.usingExamplesEvaluations = false;
    state.examplesDismissedEvaluations = true;
    renderEvaluations();
  }

  function replaceConversationExamplesWithEmpty() {
    state.conversations = [];
    state.usingExamplesConversations = false;
    state.examplesDismissedConversations = true;
    renderInbox();
  }

  async function initDb() {
    try {
      await TeamGridApi.health();
      apiOnline = true;
      await Promise.all([
        refreshEmployees(),
        refreshProjects(),
        refreshEvaluations(),
        refreshConversations(),
        TeamGridApi.get("/api/field-defs").then(applyFieldDefs)
      ]);
      els.syncNote.textContent = "Saved automatically to the local database.";
    } catch (e) {
      apiOnline = false;
      console.log("[org-chart-directory] local API unavailable", e);
      els.syncNote.textContent = "Could not reach the local database. Run python3 server.py and reload.";
      render();
      renderMtgSections();
      renderEvaluations();
      renderInbox();
    }
  }

  async function persistAdd(record) {
    try {
      var created = await TeamGridApi.post("/api/employees", record);
      state.usingExamples = false;
      state.employees = state.employees.concat([created]);
      render();
    } catch (e) {
      console.log("[org-chart-directory] add failed", e);
      saveFailed();
    }
  }

  async function persistUpdate(id, record) {
    try {
      var updated = await TeamGridApi.put("/api/employees/" + encodeURIComponent(id), record);
      var idx = state.employees.findIndex(function (e) { return e.id === id; });
      if (idx !== -1) state.employees[idx] = updated;
      render();
    } catch (e) {
      console.log("[org-chart-directory] update failed", e);
      saveFailed();
    }
  }

  async function deleteEmployee(id) {
    try {
      await TeamGridApi.del("/api/employees/" + encodeURIComponent(id));
      state.employees = state.employees.filter(function (e) { return e.id !== id; });
      render();
    } catch (e) {
      console.log("[org-chart-directory] delete failed", e);
      els.syncNote.textContent = "Couldn't delete that just now — please try again.";
    }
  }

  async function persistAddProject(record) {
    record.meetings = [];
    record.tasks = [];
    try {
      var created = await TeamGridApi.post("/api/projects", record);
      state.usingExamplesProjects = false;
      state.projects = state.projects.concat([created]);
      state.expandedProjectId = created.id;
      renderMtgSections();
    } catch (e) {
      console.log("[org-chart-directory] add project failed", e);
      saveFailed();
    }
  }

  async function persistUpdateProject(id, record) {
    try {
      var updated = await TeamGridApi.put("/api/projects/" + encodeURIComponent(id), record);
      var idx = state.projects.findIndex(function (p) { return p.id === id; });
      if (idx !== -1) state.projects[idx] = Object.assign({}, state.projects[idx], updated, { tasks: normalizeTasks(updated.tasks) });
      renderMtgSections();
    } catch (e) {
      console.log("[org-chart-directory] update project failed", e);
      saveFailed();
    }
  }

  async function deleteProject(id) {
    try {
      await TeamGridApi.del("/api/projects/" + encodeURIComponent(id));
      state.projects = state.projects.filter(function (p) { return p.id !== id; });
      if (state.expandedProjectId === id) state.expandedProjectId = null;
      renderMtgSections();
    } catch (e) {
      console.log("[org-chart-directory] delete project failed", e);
      els.syncNote.textContent = "Couldn't delete that just now — please try again.";
    }
  }

  async function persistProjectTasks(projectId, tasks) {
    var p = projectById(projectId);
    if (!p) return;
    var next = normalizeTasks(tasks);
    p.tasks = next;
    renderMtgSections();
    try {
      var updated = await TeamGridApi.put("/api/projects/" + encodeURIComponent(projectId) + "/tasks", { tasks: next });
      var idx = state.projects.findIndex(function (pr) { return pr.id === projectId; });
      if (idx !== -1) state.projects[idx] = Object.assign({}, state.projects[idx], updated, { tasks: normalizeTasks(updated.tasks) });
      renderMtgSections();
    } catch (e) {
      console.log("[org-chart-directory] update project tasks failed", e);
      saveFailed();
    }
  }

  function addProjectTask(projectId, title, assignee) {
    var p = projectById(projectId);
    if (!p || !title) return;
    var tasks = normalizeTasks(p.tasks).concat([normalizeTask({ title: title, assignee: assignee, subtasks: [] })]);
    persistProjectTasks(projectId, tasks);
  }

  function readDraftFromCard(card) {
    return {
      id: card.getAttribute("data-draft-id"),
      title: (card.querySelector(".dt-title") && card.querySelector(".dt-title").value.trim()) || "",
      assignee: (card.querySelector(".dt-assignee") && card.querySelector(".dt-assignee").value.trim()) || "",
      subtasks: Array.prototype.map.call(card.querySelectorAll(".draft-sub"), function (row) {
        var titleEl = row.querySelector(".ds-title");
        var startEl = row.querySelector(".ds-start");
        var endEl = row.querySelector(".ds-end");
        return {
          title: titleEl ? titleEl.value.trim() : "",
          startDate: startEl ? startEl.value : "",
          endDate: endEl ? endEl.value : "",
          status: "todo"
        };
      }).filter(function (s) { return s.title; })
    };
  }

  function syncDraftsFromDom(projectId) {
    var drafts = state.aiTaskDrafts[projectId];
    if (!drafts || !drafts.length) return drafts;
    var pane = els.mtgSectionsRoot.querySelector('.proj-row[data-id="' + projectId + '"]');
    if (!pane) return drafts;
    Array.prototype.forEach.call(pane.querySelectorAll(".proj-task.draft"), function (card) {
      var next = readDraftFromCard(card);
      var i = -1;
      drafts.forEach(function (d, idx) { if (d.id === next.id) i = idx; });
      if (i !== -1) drafts[i] = next;
    });
    return drafts;
  }

  function draftToTask(draft) {
    return normalizeTask({
      title: draft.title,
      assignee: draft.assignee,
      subtasks: (draft.subtasks || []).map(function (s) {
        return { title: s.title, startDate: s.startDate, endDate: s.endDate, status: s.status || "todo" };
      })
    });
  }

  function suggestProjectTasks(projectId, btn) {
    var p = projectById(projectId);
    if (!p || state.aiSuggestingProjectId === projectId) return;
    state.aiSuggestingProjectId = projectId;
    if (btn) { btn.disabled = true; btn.textContent = "Suggesting…"; }
    renderMtgSections();
    TeamGridApi.post("/api/ai/suggest-tasks", { projectId: projectId }).then(function (data) {
      if (state.aiSuggestingProjectId !== projectId) return;
      var stamp = Date.now().toString(36);
      state.aiTaskDrafts[projectId] = ((data && data.tasks) || []).map(function (t, i) {
        return {
          id: "draft_" + stamp + "_" + (i + 1),
          title: t.title || "",
          assignee: t.assignee || "",
          subtasks: (t.subtasks || []).map(function (s) {
            return { title: s.title || "", startDate: s.startDate || "", endDate: s.endDate || "", status: "todo" };
          })
        };
      });
      state.aiSuggestingProjectId = null;
      renderMtgSections();
    }).catch(function (err) {
      console.log("[org-chart-directory] suggest tasks failed", err);
      state.aiSuggestingProjectId = null;
      state.aiTaskDrafts[projectId] = [];
      renderMtgSections();
      els.syncNote.textContent = aiErrorMessage(err);
    });
  }

  function acceptDraftTask(projectId, draftId) {
    var p = projectById(projectId);
    if (!p) return;
    syncDraftsFromDom(projectId);
    var drafts = state.aiTaskDrafts[projectId] || [];
    var draft = drafts.filter(function (d) { return d.id === draftId; })[0];
    if (!draft || !draft.title) return;
    state.aiTaskDrafts[projectId] = drafts.filter(function (d) { return d.id !== draftId; });
    if (!state.aiTaskDrafts[projectId].length) delete state.aiTaskDrafts[projectId];
    persistProjectTasks(projectId, normalizeTasks(p.tasks).concat([draftToTask(draft)]));
  }

  function acceptAllDrafts(projectId) {
    var p = projectById(projectId);
    if (!p) return;
    var drafts = (syncDraftsFromDom(projectId) || []).filter(function (d) { return d.title; });
    delete state.aiTaskDrafts[projectId];
    if (!drafts.length) { renderMtgSections(); return; }
    persistProjectTasks(projectId, normalizeTasks(p.tasks).concat(drafts.map(draftToTask)));
  }

  function discardDraftTask(projectId, draftId) {
    syncDraftsFromDom(projectId);
    var drafts = state.aiTaskDrafts[projectId] || [];
    state.aiTaskDrafts[projectId] = drafts.filter(function (d) { return d.id !== draftId; });
    if (!state.aiTaskDrafts[projectId].length) delete state.aiTaskDrafts[projectId];
    renderMtgSections();
  }

  function discardAllDrafts(projectId) {
    delete state.aiTaskDrafts[projectId];
    renderMtgSections();
  }

  function deleteProjectTask(projectId, taskId) {
    var p = projectById(projectId);
    if (!p) return;
    persistProjectTasks(projectId, normalizeTasks(p.tasks).filter(function (t) { return t.id !== taskId; }));
  }

  function addProjectSubtask(projectId, taskId, fields) {
    var p = projectById(projectId);
    if (!p || !fields || !fields.title) return;
    var tasks = normalizeTasks(p.tasks).map(function (t) {
      if (t.id !== taskId) return t;
      return Object.assign({}, t, { subtasks: t.subtasks.concat([normalizeSubtask(fields)]) });
    });
    persistProjectTasks(projectId, tasks);
  }

  function updateProjectSubtask(projectId, taskId, subId, patch) {
    var p = projectById(projectId);
    if (!p) return;
    var tasks = normalizeTasks(p.tasks).map(function (t) {
      if (t.id !== taskId) return t;
      return Object.assign({}, t, {
        subtasks: t.subtasks.map(function (s) {
          return s.id === subId ? Object.assign({}, s, patch) : s;
        })
      });
    });
    persistProjectTasks(projectId, tasks);
  }

  function deleteProjectSubtask(projectId, taskId, subId) {
    var p = projectById(projectId);
    if (!p) return;
    var tasks = normalizeTasks(p.tasks).map(function (t) {
      if (t.id !== taskId) return t;
      return Object.assign({}, t, { subtasks: t.subtasks.filter(function (s) { return s.id !== subId; }) });
    });
    persistProjectTasks(projectId, tasks);
  }

  async function addMeeting(projectId, meeting) {
    if (!meeting.memo && !meeting.nextSteps) return;
    var p = projectById(projectId);
    if (!p) return;
    try {
      var created = await TeamGridApi.post("/api/projects/" + encodeURIComponent(projectId) + "/meetings", meeting);
      p.meetings = (p.meetings || []).concat([created]);
      renderMtgSections();
    } catch (e) {
      console.log("[org-chart-directory] add meeting failed", e);
      saveFailed();
    }
  }

  async function deleteMeeting(projectId, meetingId) {
    var p = projectById(projectId);
    if (!p) return;
    try {
      await TeamGridApi.del("/api/projects/" + encodeURIComponent(projectId) + "/meetings/" + encodeURIComponent(meetingId));
      p.meetings = (p.meetings || []).filter(function (m) { return m.id !== meetingId; });
      renderMtgSections();
    } catch (e) {
      console.log("[org-chart-directory] delete meeting failed", e);
      els.syncNote.textContent = "Couldn't delete that just now — please try again.";
    }
  }

  async function persistAddEvaluation(record) {
    try {
      var created = await TeamGridApi.post("/api/evaluations", record);
      state.usingExamplesEvaluations = false;
      state.evaluations = state.evaluations.concat([created]);
      renderEvaluations();
    } catch (e) {
      console.log("[org-chart-directory] add evaluation failed", e);
      saveFailed();
    }
  }

  async function deleteEvaluation(id) {
    try {
      await TeamGridApi.del("/api/evaluations/" + encodeURIComponent(id));
      state.evaluations = state.evaluations.filter(function (e) { return e.id !== id; });
      renderEvaluations();
    } catch (e) {
      console.log("[org-chart-directory] delete evaluation failed", e);
      els.syncNote.textContent = "Couldn't delete that just now — please try again.";
    }
  }

  async function persistAddConversation(record) {
    try {
      var created = await TeamGridApi.post("/api/conversations", record);
      state.usingExamplesConversations = false;
      state.conversations = state.conversations.concat([created]);
      state.selectedConversationId = created.id;
      renderInbox();
    } catch (e) {
      console.log("[org-chart-directory] add conversation failed", e);
      saveFailed();
    }
  }

  async function persistAddConvMessage(conv, message) {
    try {
      var created = await TeamGridApi.post("/api/conversations/" + encodeURIComponent(conv.id) + "/messages", message);
      conv.messages = (conv.messages || []).concat([created]);
      renderInbox();
    } catch (e) {
      console.log("[org-chart-directory] add message failed", e);
      saveFailed();
    }
  }

  // ---- Event wiring ---------------------------------------------------
  els.form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var data = {
      name: els.form.name.value.trim(),
      title: els.form.title.value.trim(),
      department: els.form.department.value.trim(),
      status: els.form.status.value || "Not Started",
      managerId: els.managerSelect.value || "",
      email: els.form.email.value.trim(),
      phone: els.form.phone.value.trim(),
      startDate: els.form.startDate.value,
      photoUrl: state.pendingPhotoUrl || "",
      customFields: collectCustomFieldValues()
    };
    if (!validateForm(data)) return;

    var wasEditing = state.editingId;
    if (state.editingId) {
      persistUpdate(state.editingId, data);
    } else {
      persistAdd(data);
    }
    resetForm();
  });

  els.cancelBtn.addEventListener("click", resetForm);
  els.form.name.addEventListener("input", function () { if (!state.pendingPhotoUrl) updatePhotoPreview(); });
  els.photoInput.addEventListener("change", function () {
    var file = els.photoInput.files && els.photoInput.files[0];
    if (!file) return;
    readAndResizePhoto(file, function (dataUrl) {
      if (dataUrl) {
        state.pendingPhotoUrl = dataUrl;
        updatePhotoPreview();
      } else {
        els.syncNote.textContent = "Couldn't read that image — try a different file.";
      }
    });
  });
  els.removePhotoBtn.addEventListener("click", function () {
    state.pendingPhotoUrl = null;
    els.photoInput.value = "";
    updatePhotoPreview();
  });
  els.search.addEventListener("input", function () { state.search = els.search.value; renderDirectory(); });
  els.deptFilter.addEventListener("change", function () { state.deptFilter = els.deptFilter.value; renderDirectory(); });
  els.clearExamplesBtn.addEventListener("click", replaceExamplesWithEmpty);

  els.calPrev.addEventListener("click", function () {
    state.calMonth--;
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
    renderCalendar();
  });
  els.calNext.addEventListener("click", function () {
    state.calMonth++;
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
    renderCalendar();
  });
  els.boardQuickAdd.addEventListener("click", function () { jumpToAddPerson(); });
  els.timelineQuickAdd.addEventListener("click", function () { jumpToAddProject(); });

  els.selfForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var data = {
      name: els.selfForm.name.value.trim(),
      title: els.selfForm.title.value.trim(),
      department: els.selfForm.department.value.trim(),
      status: "Not Started",
      managerId: els.selfManagerSelect.value || "",
      email: els.selfForm.email.value.trim(),
      phone: els.selfForm.phone.value.trim(),
      startDate: els.selfForm.startDate.value,
      photoUrl: "",
      customFields: {},
      selfAdded: true
    };
    if (!validateFormFields(els.selfForm, data)) return;
    persistAdd(data);
    els.selfForm.reset();
    Array.prototype.forEach.call(els.selfForm.querySelectorAll(".field"), function (f) { f.classList.remove("invalid"); });
    els.selfFormWrap.hidden = true;
    els.selfSuccess.hidden = false;
  });
  els.selfAddAnotherBtn.addEventListener("click", function () {
    els.selfSuccess.hidden = true;
    els.selfFormWrap.hidden = false;
    refreshManagerOptions();
  });

  els.mtgForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = els.mtgName.value.trim();
    var start = els.mtgStart.value;
    var end = els.mtgEnd.value;
    clearMtgFormErrors();
    var valid = true;
    if (!name) { els.mtgForm.querySelector('[data-field="name"]').classList.add("invalid"); valid = false; }
    if (!start || !end) { els.mtgForm.querySelector('[data-field="dates"]').classList.add("invalid"); valid = false; }
    if (!valid) return;

    var record = {
      name: name,
      status: els.mtgStatus.value,
      startDate: start,
      endDate: end,
      people: state.pendingProjectPeople.slice()
    };

    if (state.editingProjectId) {
      persistUpdateProject(state.editingProjectId, record);
    } else {
      persistAddProject(record);
    }
    closeProjectModal();
  });
  if (els.mtgNewBtn) els.mtgNewBtn.addEventListener("click", jumpToAddProject);
  if (els.mtgModalCloseBtn) els.mtgModalCloseBtn.addEventListener("click", closeProjectModal);
  if (els.mtgModal) {
    els.mtgModal.addEventListener("click", function (ev) { if (ev.target === els.mtgModal) closeProjectModal(); });
  }
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && els.mtgModal && !els.mtgModal.hidden) closeProjectModal();
  });
  els.mtgCancelBtn.addEventListener("click", closeProjectModal);
  els.mtgPersonAddBtn.addEventListener("click", addProjectPersonFromInput);
  els.mtgPersonInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); addProjectPersonFromInput(); }
  });
  els.mtgSearch.addEventListener("input", function () { state.mtgSearch = els.mtgSearch.value; renderMtgSections(); });
  els.mtgClearExamplesBtn.addEventListener("click", replaceProjectExamplesWithEmpty);
  if (els.tbFilterProject) els.tbFilterProject.addEventListener("change", renderTaskBoard);
  if (els.tbFilterAssignee) els.tbFilterAssignee.addEventListener("change", renderTaskBoard);
  if (els.tbSearch) els.tbSearch.addEventListener("input", renderTaskBoard);

  els.evalForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    clearEvalFormErrors();
    var employeeId = els.evEmployee.value;
    var period = els.evPeriod.value.trim();
    var reviewer = els.evReviewer.value.trim();
    var valid = true;
    if (!employeeId) { els.evalForm.querySelector('[data-field="employeeId"]').classList.add("invalid"); valid = false; }
    if (!period) { els.evalForm.querySelector('[data-field="period"]').classList.add("invalid"); valid = false; }
    if (!reviewer) { els.evalForm.querySelector('[data-field="reviewer"]').classList.add("invalid"); valid = false; }
    if (!valid) return;

    persistAddEvaluation({
      employeeId: employeeId,
      period: period,
      reviewer: reviewer,
      quality: Number(els.evQuality.value),
      productivity: Number(els.evProductivity.value),
      communication: Number(els.evCommunication.value),
      leadership: Number(els.evLeadership.value),
      notes: els.evNotes.value.trim(),
      createdAt: new Date().toISOString()
    });
    resetEvalForm();
  });
  els.evalSearch.addEventListener("input", function () { state.evalSearch = els.evalSearch.value; renderEvaluations(); });
  els.evalClearExamplesBtn.addEventListener("click", replaceEvaluationExamplesWithEmpty);

  els.convSearch.addEventListener("input", function () { state.convSearch = els.convSearch.value; renderConvThreadList(); });
  document.querySelectorAll("#panel-inbox .conv-filter-bar .seg-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.convFilter = btn.getAttribute("data-conv-filter");
      document.querySelectorAll("#panel-inbox .conv-filter-bar .seg-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
      renderConvThreadList();
    });
  });
  els.convClearExamplesBtn.addEventListener("click", replaceConversationExamplesWithEmpty);

  els.convComposer.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var conv = state.selectedConversationId ? convById(state.selectedConversationId) : null;
    var text = els.convText.value.trim();
    if (!conv || !text) return;
    persistAddConvMessage(conv, {
      id: genConvMsgId(),
      from: els.convFrom.value.trim() || "Anonymous",
      text: text,
      read: true,
      createdAt: new Date().toISOString()
    });
    els.convText.value = "";
  });

  els.convNewBtn.addEventListener("click", openNewConvModal);
  els.convNewCloseBtn.addEventListener("click", closeNewConvModal);
  els.convNewCancelBtn.addEventListener("click", closeNewConvModal);
  els.convNewModal.addEventListener("click", function (ev) { if (ev.target === els.convNewModal) closeNewConvModal(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !els.convNewModal.hidden) closeNewConvModal(); });
  els.nmAboutType.addEventListener("change", updateAboutRelatedField);
  els.nmRecipientAddBtn.addEventListener("click", addNmRecipientFromInput);
  els.nmRecipientInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); addNmRecipientFromInput(); }
  });

  els.convNewForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    clearConvNewFormErrors();
    var type = els.nmAboutType.value;
    var valid = true;
    var aboutRefId = "", aboutLabel = "";

    if (type === "task" || type === "topic") {
      aboutLabel = els.nmAboutText.value.trim();
      if (!aboutLabel) { els.nmAboutRelatedField.classList.add("invalid"); valid = false; }
    } else if (type === "project") {
      var p = projectById(els.nmAboutProject.value);
      if (!p) { els.nmAboutRelatedField.classList.add("invalid"); valid = false; }
      else { aboutRefId = p.id; aboutLabel = p.name; }
    } else if (type === "evaluation") {
      var ev2 = state.evaluations.filter(function (e) { return e.id === els.nmAboutEval.value; })[0];
      if (!ev2) { els.nmAboutRelatedField.classList.add("invalid"); valid = false; }
      else { aboutRefId = ev2.id; aboutLabel = (byId(ev2.employeeId) || {}).name + " — " + (ev2.period || ""); }
    } else {
      aboutLabel = "General";
    }

    if (!state.pendingConvParticipants.length) {
      els.convNewForm.querySelector('[data-field="recipients"]').classList.add("invalid");
      valid = false;
    }
    var text = els.nmMessage.value.trim();
    if (!text) { els.convNewForm.querySelector('[data-field="message"]').classList.add("invalid"); valid = false; }
    if (!valid) return;

    persistAddConversation({
      aboutType: type,
      aboutRefId: aboutRefId,
      aboutLabel: aboutLabel,
      participants: state.pendingConvParticipants.slice(),
      messages: [{ id: genConvMsgId(), from: els.nmFrom.value.trim() || "Anonymous", text: text, read: true, createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    });
    closeNewConvModal();
  });

  // ---- Ask AI / AI writing assist ---------------------------------------
  // Uses the page's "sample" capability (claude.use("sample")) to ask Claude
  // directly from the browser — no separate backend. Resolved lazily on
  // first use (not at page load) so the permission prompt only appears when
  // someone actually clicks an AI action.
  var sampleAI = null;
  var sampleAIChecked = false;

  async function getSampleAI() {
    if (sampleAIChecked) return sampleAI;
    sampleAIChecked = true;
    try {
      if (window.claude && typeof window.claude.use === "function") {
        sampleAI = await window.claude.use("sample");
      }
    } catch (e) {
      console.log("[org-chart-directory] claude.use('sample') failed", e);
    }
    return sampleAI;
  }

  async function callSampleText(input, opts) {
    var sample = await getSampleAI();
    if (!sample) {
      var err = new Error("AI features aren't available in this view.");
      err.code = "not_available";
      throw err;
    }
    return sample(input, opts || {});
  }

  function aiErrorMessage(err) {
    if (err && (err.status === 503 || err.status === 502)) {
      return (err.data && err.data.error) || err.message || "Couldn't reach the local Ollama model. Is Ollama running with qwen3:14b?";
    }
    if (err && err.code === "not_available") return "AI features aren't available in this view.";
    if (err && err.code === "not_granted") return "AI access wasn't granted for this session.";
    if (err && err.code === "rate_limited") return "AI is rate-limited right now — try again in a moment.";
    return (err && err.data && err.data.error) || (err && err.message) || (err && err.text) || "Something went wrong.";
  }

  // -- Ask AI (chat over the workspace's own data) --
  var askAI = { messages: [], streaming: false, error: null };

  function buildWorkspaceContext() {
    var parts = [];
    parts.push("PEOPLE (" + state.employees.length + "):");
    state.employees.slice(0, 80).forEach(function (e) {
      var mgr = state.employees.filter(function (m) { return m.id === e.managerId; })[0];
      parts.push(
        "- " + e.name + " — " + e.title + " (" + e.department + "), onboarding: " + e.status +
        (mgr ? ", reports to " + mgr.name : "") + (e.email ? ", " + e.email : "")
      );
    });
    parts.push("");
    parts.push("PROJECTS (" + state.projects.length + "):");
    state.projects.forEach(function (p) {
      parts.push(
        "- " + p.name + " [" + (MTG_STATUS_LABEL[p.status] || p.status) + "], " +
        (p.startDate ? formatDate(p.startDate) : "no start date") + " to " + (p.endDate ? formatDate(p.endDate) : "no end date") +
        ", people: " + ((p.people || []).join(", ") || "none assigned")
      );
      sortedMeetings(p.meetings).slice(0, 5).forEach(function (m) {
        parts.push("  · " + formatDate(m.date) + " — memo: " + (m.memo || "—") + " | next steps: " + (m.nextSteps || "—"));
      });
    });
    var text = parts.join("\n");
    var MAX = 8000;
    if (text.length > MAX) text = text.slice(0, MAX) + "\n…(truncated)";
    return text;
  }

  function renderAskAI() {
    var hasMessages = askAI.messages.length > 0;
    els.askAiEmpty.hidden = hasMessages;
    if (hasMessages) {
      els.askAiMessages.innerHTML = askAI.messages.map(function (m, i) {
        var isStreamingHere = askAI.streaming && i === askAI.messages.length - 1 && m.role === "assistant";
        var cursor = isStreamingHere ? '<span class="ai-cursor"></span>' : "";
        return '<div class="ai-msg ai-msg-' + m.role + '">' + escapeHtml(m.text).replace(/\n/g, "<br>") + cursor + "</div>";
      }).join("");
    } else {
      els.askAiMessages.innerHTML = "";
    }
    els.askAiError.hidden = !askAI.error;
    if (askAI.error) els.askAiError.textContent = askAI.error;
    els.askAiSendBtn.disabled = askAI.streaming;
    els.askAiBody.scrollTop = els.askAiBody.scrollHeight;
  }

  async function askAISubmit(query) {
    query = (query || "").trim();
    if (!query || askAI.streaming) return;
    askAI.error = null;
    askAI.messages.push({ role: "user", text: query });
    var assistantMsg = { role: "assistant", text: "" };
    askAI.messages.push(assistantMsg);
    askAI.streaming = true;
    renderAskAI();

    try {
      var result = await TeamGridApi.post("/api/ai/chat", {
        messages: askAI.messages.slice(0, -1).map(function (m) { return { role: m.role, text: m.text }; })
      });
      assistantMsg.text = (result && result.text) || "";
    } catch (err) {
      console.log("[org-chart-directory] Ask AI failed", err);
      askAI.messages.pop();
      askAI.error = aiErrorMessage(err);
    } finally {
      askAI.streaming = false;
      renderAskAI();
    }
  }

  function openAskAI() {
    els.askAiModal.hidden = false;
    renderAskAI();
    setTimeout(function () { els.askAiInput.focus(); }, 30);
  }
  function closeAskAI() { els.askAiModal.hidden = true; }

  els.askAiFab.addEventListener("click", openAskAI);
  els.askAiCloseBtn.addEventListener("click", closeAskAI);
  els.askAiModal.addEventListener("click", function (ev) { if (ev.target === els.askAiModal) closeAskAI(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !els.askAiModal.hidden) closeAskAI(); });
  els.askAiForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = els.askAiInput.value;
    els.askAiInput.value = "";
    askAISubmit(q);
  });
  Array.prototype.forEach.call(els.askAiEmpty.querySelectorAll("[data-ai-suggestion]"), function (btn) {
    btn.addEventListener("click", function () { askAISubmit(btn.getAttribute("data-ai-suggestion")); });
  });

  // -- AI writing assist: improve a person's note --
  var notesAI = { preview: "", loading: false, error: null };

  function renderNotesAI() {
    els.notesAiBtn.disabled = notesAI.loading;
    els.notesAiBtn.textContent = notesAI.loading ? "Improving…" : "✨ Improve with AI";
    els.notesAiPreview.hidden = !notesAI.preview && !notesAI.error;
    if (notesAI.error) {
      els.notesAiPreview.innerHTML = '<p class="ai-inline-error" style="margin:0;">' + escapeHtml(notesAI.error) + "</p>";
    } else if (notesAI.preview) {
      els.notesAiPreview.innerHTML =
        '<p class="ai-preview-text">' + escapeHtml(notesAI.preview) + "</p>" +
        '<div class="ai-preview-actions">' +
          '<button type="button" class="btn-ghost" id="notes-ai-use-btn">Use this</button>' +
          '<button type="button" class="btn-text" id="notes-ai-discard-btn">Discard</button>' +
        "</div>";
      document.getElementById("notes-ai-use-btn").addEventListener("click", function () {
        els.notesInput.value = notesAI.preview;
        notesAI.preview = "";
        renderNotesAI();
      });
      document.getElementById("notes-ai-discard-btn").addEventListener("click", function () {
        notesAI.preview = "";
        renderNotesAI();
      });
    } else {
      els.notesAiPreview.innerHTML = "";
    }
  }

  async function improveNotesText() {
    var text = els.notesInput.value.trim();
    if (!text) return;
    notesAI.loading = true;
    notesAI.error = null;
    notesAI.preview = "";
    renderNotesAI();
    try {
      var result = await callSampleText(
        "Improve the clarity and phrasing of this note without changing its meaning or adding new information. Keep it about the same length. Return ONLY the revised text, nothing else.\n\n---\n" + text,
        { modelTier: "quick", cache: false }
      );
      notesAI.preview = ((result && result.text) || "").trim();
    } catch (err) {
      notesAI.error = aiErrorMessage(err);
    } finally {
      notesAI.loading = false;
      renderNotesAI();
    }
  }

  els.notesAiBtn.addEventListener("click", improveNotesText);

  // -- AI action-item extraction: suggest "next steps" from a meeting memo --
  async function suggestNextSteps(memoEl, nextEl, previewEl, btn) {
    var memo = memoEl.value.trim();
    if (!memo) {
      previewEl.hidden = false;
      previewEl.innerHTML = '<p class="ai-inline-error" style="margin:0;">Write what happened in the meeting first.</p>';
      return;
    }
    btn.disabled = true;
    var origLabel = btn.textContent;
    btn.textContent = "Thinking…";
    previewEl.hidden = true;

    try {
      var result = await callSampleText(
        "Read this meeting memo and extract the concrete action items — things a specific person needs to do next. Write them as a short list, one per line starting with \"- \", no other commentary. If nothing is actionable, respond with exactly: No action items found.\n\n---\n" + memo,
        { modelTier: "quick", cache: false }
      );
      var suggestion = ((result && result.text) || "").trim();
      previewEl.hidden = false;
      if (!suggestion || suggestion.toLowerCase().indexOf("no action items") !== -1) {
        previewEl.innerHTML = '<p class="ai-inline-error" style="margin:0;">No clear action items found in that memo.</p>';
      } else {
        previewEl.innerHTML =
          '<p class="ai-preview-text">' + escapeHtml(suggestion).replace(/\n/g, "<br>") + "</p>" +
          '<div class="ai-preview-actions">' +
            '<button type="button" class="btn-ghost ai-use-suggestion">Use this</button>' +
            '<button type="button" class="btn-text ai-discard-suggestion">Discard</button>' +
          "</div>";
        previewEl.querySelector(".ai-use-suggestion").addEventListener("click", function () {
          nextEl.value = suggestion;
          previewEl.hidden = true;
        });
        previewEl.querySelector(".ai-discard-suggestion").addEventListener("click", function () {
          previewEl.hidden = true;
        });
      }
    } catch (err) {
      previewEl.hidden = false;
      previewEl.innerHTML = '<p class="ai-inline-error" style="margin:0;">' + escapeHtml(aiErrorMessage(err)) + "</p>";
    } finally {
      btn.disabled = false;
      btn.textContent = origLabel;
    }
  }

  // -- AI daily summary on the Dashboard tab --
  function computeDashboardFindings() {
    var statusCounts = { active: 0, upcoming: 0, stuck: 0, completed: 0 };
    state.projects.forEach(function (p) { if (statusCounts.hasOwnProperty(p.status)) statusCounts[p.status]++; });
    var today = new Date();
    var onTrack = 0, dueSoon = 0, overdue = 0;
    var overdueList = [], dueSoonList = [], unassignedList = [];
    state.projects.forEach(function (p) {
      if (!(p.people || []).length && p.status !== "completed") unassignedList.push(p);
      if (p.status === "completed" || !p.endDate) return;
      var end = new Date(p.endDate + "T00:00:00");
      var daysLeft = (end - today) / (1000 * 60 * 60 * 24);
      if (daysLeft < 0) { overdue++; overdueList.push(p); }
      else if (daysLeft <= 7) { dueSoon++; dueSoonList.push(p); }
      else onTrack++;
    });
    return { statusCounts: statusCounts, onTrack: onTrack, dueSoon: dueSoon, overdue: overdue, overdueList: overdueList, dueSoonList: dueSoonList, unassignedList: unassignedList };
  }

  async function generateDashboardSummary() {
    if (!state.projects.length) return;
    els.dashAiBtn.disabled = true;
    var origLabel = els.dashAiBtn.textContent;
    els.dashAiBtn.textContent = "Generating…";
    els.dashAiBody.hidden = false;
    els.dashAiBody.innerHTML = '<p class="ai-inline-loading">Thinking…</p>';

    try {
      var result = await TeamGridApi.post("/api/ai/daily-summary", {});
      var text = ((result && result.text) || "").trim();
      els.dashAiBody.innerHTML = '<p class="ai-preview-text">' + escapeHtml(text).replace(/\n/g, "<br>") + "</p>";
    } catch (err) {
      els.dashAiBody.innerHTML = '<p class="ai-inline-error" style="margin:0;">' + escapeHtml(aiErrorMessage(err)) + "</p>";
    } finally {
      els.dashAiBtn.disabled = false;
      els.dashAiBtn.textContent = origLabel;
    }
  }

  els.dashAiBtn.addEventListener("click", generateDashboardSummary);

  // -- AI timeline summary (per project, capped like ClickUp's: 10/day, skips events >35k chars) --
  var TIMELINE_SUMMARY_DAILY_LIMIT = 10;
  var TIMELINE_SUMMARY_EVENT_LIMIT = 10;
  var TIMELINE_SUMMARY_CHAR_LIMIT = 35000;
  var timelineSummaryFallbackUsage = null; // used only when localStorage is unavailable (e.g. private browsing)

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function getTimelineSummaryCountToday() {
    try {
      var raw = localStorage.getItem("aiTimelineSummaryUsage");
      var data = raw ? JSON.parse(raw) : null;
      return data && data.day === todayKey() ? data.count || 0 : 0;
    } catch (e) {
      return timelineSummaryFallbackUsage && timelineSummaryFallbackUsage.day === todayKey() ? timelineSummaryFallbackUsage.count : 0;
    }
  }

  function recordTimelineSummaryUse() {
    var next = getTimelineSummaryCountToday() + 1;
    try {
      localStorage.setItem("aiTimelineSummaryUsage", JSON.stringify({ day: todayKey(), count: next }));
    } catch (e) {
      timelineSummaryFallbackUsage = { day: todayKey(), count: next };
    }
  }

  async function summarizeProjectTimeline(projectId, btn) {
    var p = state.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return;
    var card = btn.closest(".ai-timeline-card");
    var bodyEl = card.querySelector(".ai-timeline-body");

    if (getTimelineSummaryCountToday() >= TIMELINE_SUMMARY_DAILY_LIMIT) {
      bodyEl.hidden = false;
      bodyEl.innerHTML = '<p class="ai-inline-error" style="margin:0;">Daily limit reached — up to ' + TIMELINE_SUMMARY_DAILY_LIMIT + ' AI timeline summaries per day. Try again tomorrow.</p>';
      return;
    }

    var recent = sortedMeetings(p.meetings).slice(0, TIMELINE_SUMMARY_EVENT_LIMIT);
    if (!recent.length) {
      bodyEl.hidden = false;
      bodyEl.innerHTML = '<p class="ai-inline-error" style="margin:0;">No timeline activity logged yet for this project.</p>';
      return;
    }

    var skipped = 0;
    var included = recent.filter(function (m) {
      var len = (m.memo || "").length + (m.nextSteps || "").length;
      if (len > TIMELINE_SUMMARY_CHAR_LIMIT) { skipped++; return false; }
      return true;
    });

    btn.disabled = true;
    var origLabel = btn.textContent;
    btn.textContent = "Summarizing…";
    bodyEl.hidden = false;
    bodyEl.innerHTML = '<p class="ai-inline-loading">Reading the last ' + included.length + ' event' + (included.length === 1 ? "" : "s") + '…</p>';

    try {
      if (!included.length) {
        var noEventsErr = new Error("no events");
        noEventsErr.code = "no_events";
        throw noEventsErr;
      }
      var result = await TeamGridApi.post("/api/ai/timeline-summary", { projectId: projectId });
      var text = ((result && result.text) || "").trim();
      recordTimelineSummaryUse();
      var note = skipped > 0
        ? '<p class="ai-timeline-note">' + skipped + " event" + (skipped === 1 ? "" : "s") + " skipped for exceeding the " + TIMELINE_SUMMARY_CHAR_LIMIT.toLocaleString() + "-character limit.</p>"
        : "";
      bodyEl.innerHTML = '<p class="ai-preview-text">' + escapeHtml(text).replace(/\n/g, "<br>") + "</p>" + note;
    } catch (err) {
      var msg = err && err.code === "no_events" ? "Every recent event was too long to summarize (over " + TIMELINE_SUMMARY_CHAR_LIMIT.toLocaleString() + " characters)." : aiErrorMessage(err);
      bodyEl.innerHTML = '<p class="ai-inline-error" style="margin:0;">' + escapeHtml(msg) + "</p>";
    } finally {
      btn.disabled = false;
      btn.textContent = origLabel;
      var left = Math.max(0, TIMELINE_SUMMARY_DAILY_LIMIT - getTimelineSummaryCountToday());
      card.querySelector(".ai-timeline-quota").textContent = left + " of " + TIMELINE_SUMMARY_DAILY_LIMIT + " left today";
      btn.disabled = left <= 0;
    }
  }

  // -- AI email composer (mocked; opens a ready-to-send Inbox draft) --
  function mockProjectEmail(p, preset, instructions) {
    var people = p.people || [];
    var names = people.length ? people.join(", ") : "the project team";
    var dates = (p.startDate || p.endDate) ? formatDate(p.startDate) + " – " + formatDate(p.endDate) : "the current timeline";
    var extra = instructions ? "\n\nNote: " + instructions : "";
    var status = MTG_STATUS_LABEL[p.status] || p.status || "in progress";
    if (preset === "meeting recap") {
      return {
        subject: "Meeting recap: " + p.name,
        body: "Hi " + names + ",\n\nQuick recap from our latest " + p.name + " discussion. We're tracking to " + dates + " and the next step is to confirm owners on remaining work.\n\nPlease reply with anything I missed." + extra
      };
    }
    if (preset === "reminder") {
      return {
        subject: "Reminder: " + p.name + (p.endDate ? " is due " + formatDate(p.endDate) : ""),
        body: "Hi " + names + ",\n\nFriendly reminder that " + p.name + " is scheduled through " + dates + ". Please check your open tasks and flag blockers this week.\n\nThanks." + extra
      };
    }
    return {
      subject: "Status update: " + p.name,
      body: "Hi " + names + ",\n\nHere's a status update on " + p.name + " (" + status + "). Timeline is " + dates + ". Progress is moving, and I'll follow up if anything slips.\n\nThanks." + extra
    };
  }

  function openInboxDraftFromEmail(project, recipients, subject, body) {
    activateTab("inbox");
    openNewConvModal();
    els.nmAboutType.value = "project";
    refreshConvAboutOptions();
    updateAboutRelatedField();
    if (els.nmAboutProject && project && project.id) els.nmAboutProject.value = project.id;
    state.pendingConvParticipants = (recipients || []).map(function (r) { return r.name; }).filter(Boolean);
    renderNmRecipientChips();
    els.nmMessage.value = (subject ? subject + "\n\n" : "") + (body || "");
    setTimeout(function () { els.nmMessage.focus(); }, 30);
  }

  function draftProjectEmail(projectId, card, btn) {
    var p = projectById(projectId);
    if (!p) return;

    var activeChip = card.querySelector(".chip-btn.active");
    var preset = activeChip ? activeChip.getAttribute("data-email-preset") : "status update";
    var instructions = card.querySelector(".ai-email-instructions").value.trim();
    var resultEl = card.querySelector(".ai-email-result");

    btn.disabled = true;
    var origLabel = btn.textContent;
    btn.textContent = "Drafting…";
    if (resultEl) {
      resultEl.hidden = false;
      resultEl.innerHTML = '<p class="ai-inline-loading">Drafting…</p>';
    }

    TeamGridApi.post("/api/ai/draft-email", {
      projectId: projectId,
      preset: preset,
      instructions: instructions
    }).then(function (draft) {
      var recipients = (draft && draft.recipients) || (p.people || []).map(function (name) {
        return { name: name, email: emailForName(name) };
      });
      if (resultEl) {
        resultEl.hidden = true;
        resultEl.innerHTML = "";
      }
      btn.disabled = false;
      btn.textContent = origLabel;
      openInboxDraftFromEmail(p, recipients, (draft && draft.subject) || "", (draft && draft.body) || "");
    }).catch(function (err) {
      if (resultEl) {
        resultEl.hidden = false;
        resultEl.innerHTML = '<p class="ai-inline-error" style="margin:0;">' + escapeHtml(aiErrorMessage(err)) + "</p>";
      }
      btn.disabled = false;
      btn.textContent = origLabel;
    });
  }

  render();
  initDb();
})();
