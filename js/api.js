(function (global) {
  "use strict";

  var base = "";
  var fallbackBase = "http://127.0.0.1:8787";

  function parseBody(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return text; }
  }

  function request(path, opts) {
    opts = opts || {};
    var headers = { Accept: "application/json" };
    if (opts.headers) {
      Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
    }
    var body = opts.body;
    if (body != null && typeof body !== "string") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    return fetch(base + path, {
      method: opts.method || "GET",
      headers: headers,
      body: body
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = parseBody(text);
        if (!res.ok) {
          var err = new Error((data && data.error) || ("API " + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function withFallback(fn) {
    return fn().catch(function (err) {
      if (base || (err && err.status)) throw err;
      base = fallbackBase;
      return fn();
    });
  }

  global.TeamGridApi = {
    baseUrl: function () { return base; },
    get: function (path) { return request(path); },
    post: function (path, body) { return request(path, { method: "POST", body: body }); },
    put: function (path, body) { return request(path, { method: "PUT", body: body }); },
    patch: function (path, body) { return request(path, { method: "PATCH", body: body }); },
    del: function (path) { return request(path, { method: "DELETE" }); },
    health: function () {
      return withFallback(function () { return request("/api/health"); });
    }
  };
})(window);
