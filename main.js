/* KINESIS — site logic
   - i18n from content/{lang}.json (vi | en | ru)
   - hero demo typewriter (JSON-driven, respects reduced motion)
   - scroll reveals, mobile nav, quote form (FormSubmit AJAX)
*/
(function () {
  "use strict";

  var LANGS = ["vi", "en", "ru"];
  var STORAGE_KEY = "kinesis_lang";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var currentDict = null; // Global dictionary to track current language

  /* ---------- i18n ---------- */

  function currentLang() {
    var params = new URLSearchParams(window.location.search);
    var q = params.get("lang");
    if (LANGS.indexOf(q) !== -1) return q;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (LANGS.indexOf(stored) !== -1) return stored;
    } catch (e) { /* private mode */ }
    var def = document.documentElement.getAttribute("data-default-lang");
    return LANGS.indexOf(def) !== -1 ? def : "vi";
  }

  function flatten(obj, prefix, out) {
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      var key = prefix ? prefix + "." + k : k;
      if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = v;
    });
    return out;
  }

  function loadContent(lang) {
    var p = window.location.pathname;
    var inSubdir = /\/(en|ru)(\/|$)/.test(p);
    var bases = inSubdir ? ["../content", "./content", "/content"] : ["./content", "/content"];
    function attempt(i) {
      if (i >= bases.length) return Promise.resolve(null);
      return fetch(bases[i] + "/" + lang + ".json", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : attempt(i + 1); })
        .catch(function () { return attempt(i + 1); });
    }
    return attempt(0);
  }

  /* ---------- FAQ: rendered from the content JSON ----------
     The number of questions follows the file: every faq.qN.t / faq.qN.a
     pair (q1, q2, q3, ...) becomes one accordion item. Add or remove
     questions in content/{lang}.json — no HTML changes needed. */

  function renderFaq(map) {
    var list = document.querySelector(".faq-list");
    if (!list) return;
    var n = 0;
    while (n < 99 && typeof map["faq.q" + (n + 1) + ".t"] === "string") n++;
    list.textContent = "";
    for (var i = 1; i <= n; i++) {
      var q = document.createElement("details");
      q.className = "faq-item";
      var s = document.createElement("summary");
      s.textContent = map["faq.q" + i + ".t"];
      var p = document.createElement("p");
      p.textContent = typeof map["faq.q" + i + ".a"] === "string" ? map["faq.q" + i + ".a"] : "";
      q.appendChild(s);
      q.appendChild(p);
      list.appendChild(q);
    }
  }

  function applyLang(lang, dict) {
    var map = flatten(dict, "", {});

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = map[el.getAttribute("data-i18n")];
      if (typeof v === "string") el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var v = map[el.getAttribute("data-i18n-ph")];
      if (typeof v === "string") el.setAttribute("placeholder", v);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var v = map[el.getAttribute("data-i18n-aria")];
      if (typeof v === "string") el.setAttribute("aria-label", v);
    });
    var inSub = /\/(en|ru)(\/|$)/.test(window.location.pathname);
    document.querySelectorAll("[data-i18n-href]").forEach(function (el) {
      var v = map[el.getAttribute("data-i18n-href")];
      if (typeof v === "string") el.setAttribute("href", v);
    });
    document.querySelectorAll("[data-i18n-src]").forEach(function (el) {
      var v = map[el.getAttribute("data-i18n-src")];
      if (typeof v === "string") el.setAttribute("src", (inSub ? "../" : "") + v);
    });

    renderFaq(map);

    if (map["meta.title"]) document.title = map["meta.title"];
    var desc = document.querySelector('meta[name="description"]');
    if (desc && map["meta.description"]) desc.setAttribute("content", map["meta.description"]);

    document.documentElement.setAttribute("lang", lang);
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      var active = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }

    var url = new URL(window.location.href);
    if (url.searchParams.get("lang") !== lang) {
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    }
  }

  /* ---------- Hero demo (typed Q&A) ---------- */

  var demo = {
    run: 0,
    start: function (qa) {
      if (!Array.isArray(qa) || !qa.length) return;
      this.run += 1;
      var myRun = this.run;
      var qEl = document.getElementById("demo-question");
      var aEl = document.getElementById("demo-answer");
      var citeEl = document.getElementById("demo-cite");
      var citeText = document.getElementById("demo-cite-text");
      var rowEl = document.getElementById("demo-answer-row");
      var caret = document.getElementById("demo-caret");
      if (!qEl || !aEl) return;

      function sleep(ms) {
        return new Promise(function (res) { setTimeout(res, ms); });
      }

      function setAll(item, visible) {
        qEl.textContent = item.q;
        aEl.textContent = item.a;
        citeText.textContent = item.cite;
        rowEl.classList.remove("is-hidden");
        if (visible) citeEl.hidden = false;
        window.dispatchEvent(new Event("kinesis-redraw"));
      }

      async function cycle() {
        var i = 0;
        for (;;) {
          if (this.run !== myRun) return;
          var item = qa[i % qa.length];
          qEl.textContent = "";
          aEl.textContent = "";
          citeEl.hidden = true;
          rowEl.classList.add("is-hidden");
          window.dispatchEvent(new Event("kinesis-redraw"));

          if (reducedMotion) {
            setAll(item, true);
            await sleep(6000);
          } else {
            caret.hidden = false;
            for (var c = 1; c <= item.q.length; c++) {
              if (this.run !== myRun) return;
              qEl.textContent = item.q.slice(0, c);
              await sleep(26);
            }
            await sleep(450);
            if (this.run !== myRun) return;
            caret.hidden = true;
            rowEl.classList.remove("is-hidden");
            window.dispatchEvent(new Event("kinesis-redraw"));
            var words = item.a.split(" ");
            for (var w = 1; w <= words.length; w++) {
              if (this.run !== myRun) return;
              aEl.textContent = words.slice(0, w).join(" ");
              await sleep(68);
            }
            citeText.textContent = item.cite;
            citeEl.hidden = false;
            await sleep(4600);
          }
          i += 1;
        }
      }
      cycle.call(this);
    }
  };

  /* ---------- Scroll reveals ---------- */

  function initReveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window) || reducedMotion) {
      els.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    var ticking = false;
    function checkPassed() {
      ticking = false;
      els.forEach(function (el) {
        if (!el.classList.contains("in-view") && el.getBoundingClientRect().bottom < 0) {
          el.classList.add("in-view");
        }
      });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(checkPassed); }
    }, { passive: true });

    els.forEach(function (el) { io.observe(el); });
    checkPassed();
  }

  /* ---------- Mobile nav ---------- */

  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.getElementById("mobile-menu");
    if (!toggle || !menu) return;
    function setOpen(open) {
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    toggle.addEventListener("click", function () {
      setOpen(menu.hidden);
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { setOpen(false); toggle.focus(); }
    });
  }

  /* ---------- Quote form (FormSubmit AJAX) ---------- */

  function initForm() {
    var form = document.getElementById("quote-form");
    var status = document.getElementById("form-status");
    if (!form || !status) return;
    
    if (form.hasAttribute('data-listener-attached')) return;
    form.setAttribute('data-listener-attached', 'true');

    form.addEventListener("submit", function (e) {
      var t = (currentDict && currentDict.contact && currentDict.contact.form) || {};
      
      e.preventDefault(); 
      
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var gotcha = form.querySelector('[name="_gotcha"]');
      if (gotcha && gotcha.value) {
        status.textContent = t.success || "";
        status.className = "form-status is-success";
        return;
      }

      var fd = new FormData(form);
      var action = form.getAttribute("action") || "";
      status.textContent = "";
      status.className = "form-status";
      
      var btn = form.querySelector(".btn-submit");
      if (btn) btn.disabled = true;

      function done(ok, text) {
        status.textContent = text;
        status.className = "form-status " + (ok ? "is-success" : "is-error");
        if (btn) btn.disabled = false;
        if (ok) form.reset();
      }

      if (action.indexOf("YOUR_FORM_ID") !== -1) {
        var subject = encodeURIComponent((t.name ? t.name : "Name") + ": " + (fd.get("name") || ""));
        var bodyLines = [
          (t.name ? t.name : "Name") + ": " + (fd.get("name") || ""),
          (t.company ? t.company : "Company") + ": " + (fd.get("company") || ""),
          (t.email ? t.email : "Email") + ": " + (fd.get("email") || ""),
          "",
          (t.message ? t.message : "Message") + ":",
          String(fd.get("message") || "")
        ];
        window.location.href = "mailto:kinesiscomp@gmail.com?subject=" + subject + "&body=" + encodeURIComponent(bodyLines.join("\n"));
        done(true, t.success || "Sent.");
        return;
      }

      fetch(action, { method: "POST", body: fd, headers: { Accept: "application/json" } })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          done(true, t.success || "Sent.");
        })
        .catch(function () { 
          done(false, t.error || "Error sending message."); 
        });
    });
  }

  /* ---------- Procedural circuit background (content/bg.json) ---------- */

  function initBackground() {
    var canvas = document.getElementById("bg-canvas");
    if (!canvas) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var p = window.location.pathname;
    var inSubdir = /\/(en|ru)(\/|$)/.test(p);
    var bases = inSubdir ? ["../content", "./content", "/content"] : ["./content", "/content"];

    function fetchFirst(list, name) {
      if (!list.length) return Promise.resolve(null);
      return fetch(list[0] + "/" + name + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
        if (r.ok) return r.json();
        return fetchFirst(list.slice(1), name);
      }).catch(function () { return fetchFirst(list.slice(1), name); });
    }

    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    var traces = []; 
    var padNodes = []; 
    var pulseState = null;
    var rafId = null, lastTs = 0, resizeT = null;

    function build(cfg) {
      var rnd = mulberry32(cfg.seed || 1);
      var V = Math.ceil(window.innerHeight);
      var pageH = Math.max(document.documentElement.scrollHeight, V * 3);
      var speed = Math.min(1, Math.max(0, cfg.scrollSpeed != null ? cfg.scrollSpeed : 0.35));
      var W = Math.ceil(window.innerWidth) + 80;
      var H = Math.round(V + (pageH - V) * speed) + 40;
      canvas.setAttribute("width", W);
      canvas.setAttribute("height", H);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      canvas.style.transform = "translateY(" + (-window.scrollY * speed) + "px)";
      canvas.innerHTML = "";
      traces = [];

      var NS = "http://www.w3.org/2000/svg";
      var step = cfg.gridStep || 44;
      var cols = Math.ceil(W / step), rows = Math.ceil(H / step);
      function pickWeighted() {
        var r = rnd(), ws = (cfg.lineWidths || [1]);
        if (ws.length === 1) return ws[0];
        var c = 0.55; if (r < c) return ws[0]; c += 0.3; if (r < c) return ws[1];
        return ws[ws.length - 1];
      }

      var bt = buildTraces();
      traces = bt.traces;
      padNodes = bt.pads;
      var bgEl = document.querySelector(".bg");
      if (bgEl) bgEl.style.opacity = String(cfg.opacity != null ? cfg.opacity : 0.9);
      
      function buildTraces() {
        var rnd2 = mulberry32((cfg.seed || 1) + 7919);
        var out = [];
        var segs = [];
        var hexPts = [];
        var hexOcc = [];
        var CW = W, CH = H;
        var minGap = 4;

        function ptSegDist(px, py, ax, ay, bx, by) {
          var vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
          var l2 = vx * vx + vy * vy;
          if (l2 === 0) return Math.sqrt(wx * wx + wy * wy);
          var t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / l2));
          var dx = ax + t * vx - px, dy = ay + t * vy - py;
          return Math.sqrt(dx * dx + dy * dy);
        }
        function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
          var r1x = bx - ax, r1y = by - ay, r2x = dx - cx, r2y = dy - cy;
          var den = r1x * r2y - r1y * r2x;
          if (Math.abs(den) < 1e-9) return false;
          var t = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
          var u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
          return t > 0 && t < 1 && u > 0 && u < 1;
        }
        function segGap(ax, ay, bx, by, cx, cy, dx, dy) {
          if (segsCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
          return Math.min(
            ptSegDist(ax, ay, cx, cy, dx, dy),
            ptSegDist(bx, by, cx, cy, dx, dy),
            ptSegDist(cx, cy, ax, ay, bx, by),
            ptSegDist(dx, dy, ax, ay, bx, by)
          );
        }
        function isTouch(px, py, qx, qy) { return px === qx && py === qy; }
        function clearOf(x1, y1, x2, y2, wSelf, crossP, skipOwn, relaxed, anchor) {
          for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            if (skipOwn != null && s[5] === skipOwn) continue; 
            if (segsCross(x1, y1, x2, y2, s[0], s[1], s[2], s[3])) {
              var thinCross = (wSelf <= 2.1 && s[4] >= 3.5) || (s[4] <= 2.1 && wSelf >= 3.5);
              if (thinCross && rnd2() < (crossP != null ? crossP : 0.2)) continue;
              if (relaxed && wSelf <= 2.1 && anchor) {
                var r1x = x2 - x1, r1y = y2 - y1, r2x = s[2] - s[0], r2y = s[3] - s[1];
                var den = r1x * r2y - r1y * r2x;
                if (Math.abs(den) > 1e-9) {
                  var tI = ((s[0] - x1) * r2y - (s[1] - y1) * r2x) / den;
                  if (Math.hypot(x1 + tI * r1x - anchor[0], y1 + tI * r1y - anchor[1]) <= 9) continue;
                }
              }
              return false;
            }
            var g3 = Infinity;
            if (!(isTouch(x1, y1, s[0], s[1]) || isTouch(x1, y1, s[2], s[3]))) g3 = Math.min(g3, ptSegDist(x1, y1, s[0], s[1], s[2], s[3]));
            if (!(isTouch(x2, y2, s[0], s[1]) || isTouch(x2, y2, s[2], s[3]))) g3 = Math.min(g3, ptSegDist(x2, y2, s[0], s[1], s[2], s[3]));
            if (!(isTouch(s[0], s[1], x1, y1) || isTouch(s[0], s[1], x2, y2))) g3 = Math.min(g3, ptSegDist(s[0], s[1], x1, y1, x2, y2));
            if (!(isTouch(s[2], s[3], x1, y1) || isTouch(s[2], s[3], x2, y2))) g3 = Math.min(g3, ptSegDist(s[2], s[3], x1, y1, x2, y2));
            if (g3 < (wSelf + s[4]) / 2 + minGap) {
              var nearMiss = g3 >= (wSelf + s[4]) / 2 - 0.5;
              if (nearMiss && wSelf <= 2.1 && crossP != null && rnd2() < crossP) continue;
              if (relaxed && wSelf <= 2.1) {
                var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                if (anchor && Math.hypot(mx - anchor[0], my - anchor[1]) <= 12) continue;
                if (g3 >= (wSelf + s[4]) / 2 + 0.6) continue;
              }
              return false;
            }
          }
          return true;
        }
        function reserve(pts, w, own) {
          for (var i = 0; i < pts.length - 1; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, own != null ? own : -1]);
        }

        var back = [];
        function planRegion(x0, x1, n, longBias) {
          for (var i = 0; i < n; i++) {
            var t = n === 1 ? 0.5 : i / (n - 1);
            var x = x0 + (x1 - x0) * t + (rnd2() - 0.5) * ((x1 - x0) / n) * 0.7;
            back.push({ x: Math.max(20, Math.min(CW - 20, x)), longBias: longBias });
          }
        }
        var nTot = Math.max(9, Math.min(44, Math.round((cfg.traceCount || 64) * 0.35)));
        if (CW < 620) nTot = Math.max(7, Math.round(nTot * 0.5)); 
        planRegion(18, CW * 0.34, Math.max(2, Math.round(nTot * 0.2)), 0.25);
        planRegion(CW * 0.34, CW * 0.60, Math.max(2, Math.round(nTot * 0.28)), 0.6);
        planRegion(CW * 0.60, CW - 18, Math.max(3, Math.round(nTot * 0.52)), 0.55);
        back.sort(function (a, b) { return a.x - b.x; });
        for (var ci = 0; ci < back.length; ci++) {
          var xl = ci > 0 ? back[ci - 1].x : 8;
          var xr = ci < back.length - 1 ? back[ci + 1].x : CW - 8;
          back[ci].xMin = (xl + back[ci].x) / 2 + 2 + minGap / 2;
          back[ci].xMax = (back[ci].x + xr) / 2 - 2 - minGap / 2;
          if (back[ci].xMin > back[ci].x) back[ci].xMin = back[ci].x;
          if (back[ci].xMax < back[ci].x) back[ci].xMax = back[ci].x;
        }

        var backMeta = [];
        var branchCount = 0;
        for (var bi = 0; bi < back.length; bi++) {
          (function (B) {
            var wL = pickWeighted();
            var isLong = rnd2() < B.longBias;
            var yS = isLong ? -20 : 40 + rnd2() * (CH * 0.5);
            var yE = isLong ? CH + 20 : Math.min(CH + 20, yS + 260 + rnd2() * 900);
            var pts = [[B.x, yS]];
            var x = B.x, y = yS;
            var lastDirB = 0;
            while (y < yE - 120) {
              var yTurn = Math.min(yE - 40, y + 50 + rnd2() * 280);
              if (rnd2() < 0.95 && B.xMax - B.xMin > 26) {
                var dir = lastDirB !== 0 ? (rnd2() < 0.45 ? lastDirB : -lastDirB) : (rnd2() < 0.5 ? -1 : 1);
                var room = dir > 0 ? B.xMax - x : x - B.xMin;
                var didZ = false;
                if (room >= 46 && rnd2() < 0.35) {
                  var L1 = Math.min(room - 4, 40 + rnd2() * 80);
                  if (L1 >= 30) {
                    var xA = x + dir * L1, yA = yTurn + L1;
                    var vLen = 20 + rnd2() * 60;
                    var yB = yA + vLen;
                    if (yB + L1 <= yE - 10 && clearOf(x, yTurn, xA, yA, wL) && clearOf(xA, yA, xA, yB, wL) && clearOf(xA, yB, x, yB + L1, wL)) {
                      pts.push([x, yTurn], [xA, yA], [xA, yB], [x, yB + L1]);
                      y = yB + L1;
                      lastDirB = 0;
                      didZ = true;
                    }
                  }
                }
                if (!didZ && room > 30) {
                  var L = 34 + rnd2() * (room - 24);
                  if (rnd2() < 0.5 && L + 24 <= room) L += 16 + rnd2() * 30; 
                  pts.push([x, yTurn]);
                  x += dir * L;
                  pts.push([x, yTurn + L]);
                  y = yTurn + L;
                  lastDirB = dir;
                }
              }
              y = Math.max(y, yTurn);
              if (y >= yE - 40) break;
            }
            pts.push([x, Math.max(yE, y)]);
            reserve(pts, wL);
            out.push({ pts: pts, w: wL });
            backMeta.push({ B: B, pts: pts, w: wL });
            var brW = Math.max(1.4, wL - 1);
            var brChance = B.longBias >= 0.55 && isLong ? 0.9 : 0.45;
            if (wL >= 3 && rnd2() < brChance && pts.length > 4) {
              var nBr = rnd2() < (B.longBias >= 0.55 ? 0.4 : 0) ? 2 : 1;
              for (var bb2 = 0; bb2 < nBr; bb2++) {
                var k = 1 + Math.floor(rnd2() * (pts.length - 2));
                var bx = pts[k][0], by = pts[k][1];
                var dirB = rnd2() < 0.5 ? -1 : 1;
                var roomB = dirB > 0 ? B.xMax - bx : bx - B.xMin;
                if (roomB <= 24) continue;
                if (rnd2() < 0.2) {
                  var LBu = Math.min(roomB - 6, 20 + rnd2() * 40);
                  var yBUp = Math.max(-10, by - LBu - (60 + rnd2() * 120));
                  var upts = [[bx, by], [bx + dirB * LBu, by - LBu], [bx + dirB * LBu, yBUp]];
                  if (clearOf(bx, by, upts[1][0], upts[1][1], brW) && clearOf(upts[1][0], upts[1][1], upts[2][0], upts[2][1], brW)) {
                    reserve(upts, brW);
                    out.push({ pts: upts, w: brW });
                    branchCount++;
                  }
                } else {
                  var LB = Math.min(roomB - 6, 24 + rnd2() * 70);
                  var yBE = Math.min(CH + 20, by + LB + 260 + rnd2() * 700);
                  var bpts = [[bx, by], [bx + dirB * LB, by + LB], [bx + dirB * LB, yBE]];
                  if (clearOf(bx, by, bpts[1][0], bpts[1][1], brW) && clearOf(bpts[1][0], bpts[1][1], bpts[2][0], bpts[2][1], brW)) {
                    reserve(bpts, brW);
                    out.push({ pts: bpts, w: brW });
                    branchCount++;
                  }
                }
              }
            }
          })(back[bi]);
        }

        var brMin = cfg.branchMin != null ? cfg.branchMin : 6;
        var brMax = cfg.branchMax != null ? cfg.branchMax : 12;
        var brTarget = CW < 620 ? Math.max(2, Math.round((brMin + brMax) / 2 * 0.6)) : Math.round(brMin + rnd2() * (brMax - brMin));
        var guardB = 0;
        while (branchCount < brTarget && guardB++ < 90 && backMeta.length) {
          var mB = backMeta[Math.floor(rnd2() * backMeta.length)];
          if (!mB.w || mB.w < 3 || mB.pts.length < 4) continue; 
          var brW2 = Math.max(1.4, mB.w - 1); 
          var kB = 1 + Math.floor(rnd2() * (mB.pts.length - 2));
          var bxB = mB.pts[kB][0], byB = mB.pts[kB][1];
          var dirB2 = rnd2() < 0.5 ? -1 : 1;
          var roomB2 = dirB2 > 0 ? mB.B.xMax - bxB : bxB - mB.B.xMin;
          if (roomB2 <= 24) continue;
          var LB2 = Math.min(roomB2 - 6, 24 + rnd2() * 70);
          var yBE2 = Math.min(CH + 20, byB + LB2 + 260 + rnd2() * 700);
          var bpts2 = [[bxB, byB], [bxB + dirB2 * LB2, byB + LB2], [bxB + dirB2 * LB2, yBE2]];
          if (clearOf(bxB, byB, bpts2[1][0], bpts2[1][1], brW2) && clearOf(bpts2[1][0], bpts2[1][1], bpts2[2][0], bpts2[2][1], brW2)) {
            reserve(bpts2, brW2);
            out.push({ pts: bpts2, w: brW2 });
            branchCount++;
          }
        }

        var hexN = cfg.hexCount || 18;
        var baseHS = cfg.hexSize || 40;
        var hsR = baseHS * 0.78;
        var aroundN = Math.min(3, Math.floor(hexN / 4));
        for (var hi = 0; hi < hexN; hi++) {
          if (hi < aroundN) {
            var m0 = backMeta[Math.floor(rnd2() * backMeta.length)];
            var p0 = m0.pts, B0 = m0.B;
            var vk = 1 + Math.floor(rnd2() * (p0.length - 2));
            var px = p0[vk][0], py = p0[vk][1];
            if (py < 140 || py > CH - 180) continue;
            var placed = false;
            for (var at = 0; at < 6 && !placed; at++) {
              var dOff = rnd2() < 0.5 ? -1 : 1;
              var offX = Math.max(B0.xMin + hsR, Math.min(B0.xMax - hsR, px + dOff * (hsR + 22 + rnd2() * 34)));
              if (Math.abs(offX - px) < hsR) continue;
              var d2 = offX > px ? 1 : -1;
              var ap = [
                [offX + d2 * 40, py - 460],
                [offX + d2 * 40, py - baseHS / 2 - 41],
                [offX, py - baseHS / 2 - 1]
              ];
              var okAp = true;
              for (var ai = 0; ai < ap.length - 1 && okAp; ai++) if (!clearOf(ap[ai][0], ap[ai][1], ap[ai + 1][0], ap[ai + 1][1], 2)) okAp = false;
              if (okAp) {
                reserve(ap, 2); out.push({ pts: ap, w: 2 });
                hexPts.push([offX, py, 1]);
                hexOcc.push([-Math.PI / 2]); 
                placed = true;
              }
            }
            if (!placed) {
              hexPts.push([px, py, 0]);
              var occA = [];
              if (p0[vk - 1]) occA.push(Math.atan2(p0[vk - 1][1] - py, p0[vk - 1][0] - px));
              if (p0[vk + 1]) occA.push(Math.atan2(p0[vk + 1][1] - py, p0[vk + 1][0] - px));
              if (!occA.length) occA.push(-Math.PI / 2);
              hexOcc.push(occA);
            }
          } else {
            var m1 = backMeta[Math.floor(rnd2() * backMeta.length)];
            var p1 = m1.pts;
            var vk1 = 1 + Math.floor(rnd2() * (p1.length - 2));
            var bx1 = p1[vk1][0], by1 = p1[vk1][1];
            hexPts.push([bx1, by1, 0]); 
            var occB = [];
            if (p1[vk1 - 1]) occB.push(Math.atan2(p1[vk1 - 1][1] - by1, p1[vk1 - 1][0] - bx1));
            if (p1[vk1 + 1]) occB.push(Math.atan2(p1[vk1 + 1][1] - by1, p1[vk1 + 1][0] - bx1));
            if (!occB.length) occB.push(-Math.PI / 2);
            hexOcc.push(occB);
          }
        }
        var hexFinal = [];
        var hexFinalOcc = [];
        for (var hf = 0; hf < hexPts.length; hf++) {
          var okH = true;
          for (var hf2 = 0; hf2 < hexFinal.length; hf2++) {
            var hdxx = hexFinal[hf2][0] - hexPts[hf][0], hdyy = hexFinal[hf2][1] - hexPts[hf][1];
            if (Math.sqrt(hdxx * hdxx + hdyy * hdyy) < 150) { okH = false; break; }
          }
          if (okH) { hexFinal.push(hexPts[hf]); hexFinalOcc.push(hexOcc[hf]); }
        }
        hexPts = hexFinal;
        hexOcc = hexFinalOcc;

        var hubCount = CW < 620 ? 1 : 2;
        var candIdx = [];
        for (var ci1 = 0; ci1 < hexPts.length; ci1++) if (!hexPts[ci1][2]) candIdx.push(ci1);
        for (var hb = 0; hb < hubCount && candIdx.length > 2; hb++) {
          var pick = candIdx.splice(Math.floor(rnd2() * candIdx.length), 1)[0];
          var hubP = hexPts[pick];
          hubP[2] = 2; 
          hubP[3] = baseHS * 1.3;
          hubP[4] = 1; 
          var hR = hubP[3] * 0.78;
          var nArr = 2 + Math.floor(rnd2() * 3);
          var slots = [[0, -1], [-0.6, -0.55], [0.6, -0.55], [-0.95, 0.1], [0.95, 0.1]];
          for (var si2 = slots.length - 1; si2 > 0; si2--) {
            var sj2 = Math.floor(rnd2() * (si2 + 1));
            var tmpS = slots[si2]; slots[si2] = slots[sj2]; slots[sj2] = tmpS;
          }
          for (var na = 0; na < nArr; na++) {
            var slot = slots[na % slots.length];
            var targetX = hubP[0] + slot[0] * hR;
            var targetY = hubP[1] + slot[1] * hR;
            var side = slot[0] >= 0 ? 1 : -1;
            if (slot[0] === 0) side = rnd2() < 0.5 ? -1 : 1;
            var startX = hubP[0] + side * (hR + 18 + rnd2() * 55);
            startX = Math.max(14, Math.min(CW - 14, startX));
            if (Math.abs(startX - hubP[0]) < hR + 14) continue;
            var startY = Math.max(-10, hubP[1] - (200 + rnd2() * 320));
            var D = targetX - startX;
            if ((side > 0 && D <= 0) || (side < 0 && D >= 0)) continue;
            var yT = targetY - D;
            if (yT < startY + 40) continue;
            var wH = pickWeighted();
            if (clearOf(startX, startY, startX, yT, wH) && clearOf(startX, yT, targetX, targetY, wH)) {
              reserve([[startX, startY], [startX, yT], [targetX, targetY]], wH);
              out.push({ pts: [[startX, startY], [startX, yT], [targetX, targetY]], w: wH, noEndDot: true });
              hexOcc[pick].push(Math.atan2(startY - hubP[1], startX - hubP[0])); 
            }
          }
        }
        for (var ps2 = 0; ps2 < hexPts.length; ps2++) {
          if (hexPts[ps2][2] === 2) continue;
          if (hexPts[ps2][2] === 1) { hexPts[ps2][3] = baseHS; hexPts[ps2][4] = 0; continue; } 
          var isSolid = rnd2() < 0.35;
          hexPts[ps2][3] = baseHS * (isSolid ? 0.5 : 1);
          hexPts[ps2][4] = isSolid ? 1 : 0;
        }

        function spokeStartR(size, dx, dy) {
          var s = size / 2, a = s * Math.sqrt(3) / 2;
          var ang = Math.atan2(dy, dx), best = Infinity;
          for (var e = 0; e < 6; e++) {
            var tn = e * Math.PI / 3;
            var d = Math.abs(ang - tn) % (2 * Math.PI);
            if (d > Math.PI) d = 2 * Math.PI - d;
            if (d <= Math.PI / 6) { var rr = a / Math.cos(d); if (rr < best) best = rr; }
          }
          return best === Infinity ? s : best;
        }
        var spokeN = cfg.hexSpokeCount != null ? cfg.hexSpokeCount : 0;
        for (var sp = 0; sp < Math.min(spokeN, hexPts.length); sp++) {
          var hxc = hexPts[sp][0], hyc = hexPts[sp][1];
          var pSize = hexPts[sp][3] || baseHS;
          var nStMin = cfg.hexSpokeMin != null ? cfg.hexSpokeMin : 3;
          var nStMax = cfg.hexSpokeMax != null ? cfg.hexSpokeMax : 5;
          var nSt = nStMin + Math.floor(rnd2() * (nStMax - nStMin + 1));
          var slMin = cfg.spokeLenMin != null ? cfg.spokeLenMin : 14;
          var slMax = cfg.spokeLenMax != null ? cfg.spokeLenMax : 72;
          var occ = hexOcc[sp] || [];
          var stepA = (2 * Math.PI) / (nSt + Math.max(1, occ.length));
          var offA = rnd2() * 2 * Math.PI, bestOff = offA, bestScore = Infinity;
          for (var oc = 0; oc < 8; oc++) {
            var cand = offA + oc * 0.79;
            var score = 0;
            for (var tg3 = 0; tg3 < nSt; tg3++) {
              var ta3 = cand + tg3 * stepA;
              for (var oi4 = 0; oi4 < occ.length; oi4++) {
                var dd3 = ((ta3 - occ[oi4]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
                if (dd3 > Math.PI) dd3 = 2 * Math.PI - dd3;
                if (dd3 < 0.5) score++;
              }
            }
            if (score < bestScore) { bestScore = score; bestOff = cand; }
          }
          offA = bestOff;
          function trySpoke(ang) {
            var onOcc = false;
            for (var oi2 = 0; oi2 < occ.length; oi2++) {
              var da2 = ((ang - occ[oi2]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
              if (da2 > Math.PI) da2 = 2 * Math.PI - da2;
              if (da2 < 0.5) { onOcc = true; break; } 
            }
            if (onOcc) return false;
            var nn = [Math.cos(ang), Math.sin(ang)];
            var len = slMin + rnd2() * (slMax - slMin);
            var rSt = spokeStartR(pSize, nn[0], nn[1]) - 2; 
            var sx = hxc + nn[0] * rSt, sy = hyc + nn[1] * rSt;
            var dU = null, lT = 0;
            if (Math.abs(nn[1]) <= 0.75) {
              dU = nn[1] >= 0 ? 1 : -1;
              lT = 48 + rnd2() * 52; 
            }
            var lenF = len, okRad = false;
            for (var sc = 0; sc < 7 && !okRad; sc++) {
              if (sc > 0) lenF *= 0.7;
              var exC = hxc + nn[0] * (rSt + lenF), eyC = hyc + nn[1] * (rSt + lenF);
              okRad = clearOf(sx, sy, exC, eyC, 1.4, null, sp);
              if (lenF < 10) break; 
            }
            if (okRad) {
              var tip = [hxc + nn[0] * (rSt + lenF), hyc + nn[1] * (rSt + lenF)];
              var cptsR = [[sx, sy], tip];
              if (dU !== null && lenF >= 20) {
                var lTR = lT, okT = false;
                for (var tc = 0; tc < 5 && !okT; tc++) {
                  if (tc > 0) lTR *= 0.55;
                  okT = clearOf(tip[0], tip[1], tip[0], tip[1] + dU * lTR, 1.4, null, sp);
                  if (!okT && lTR <= 9) break;
                }
                if (okT) cptsR.push([tip[0], tip[1] + dU * lTR]);
              }
              reserve(cptsR, 1.4, sp);
              out.push({ pts: cptsR, w: 1.4, spoke: true });
              return true;
            }
            var spts = [[sx, sy], [hxc + nn[0] * (rSt + len), hyc + nn[1] * (rSt + len)]];
            var lenR = len, okSp2 = false, cpts2 = spts;
            for (var rc = 0; rc < 3 && !okSp2; rc++) {
              if (rc > 0) {
                lenR *= 0.7;
                if (lenR < 20 && cpts2.length === 3) cpts2 = cpts2.slice(0, 2);
              }
              var exR = hxc + nn[0] * (rSt + lenR), eyR = hyc + nn[1] * (rSt + lenR);
              cpts2[1] = [exR, eyR];
              if (dU !== null) {
                if (lenR >= 20) {
                  if (cpts2.length === 2) cpts2.push([exR, eyR + dU * lT]);
                  else cpts2[2] = [exR, eyR + dU * lT];
                } else if (cpts2.length === 3) cpts2 = cpts2.slice(0, 2);
              }
              okSp2 = clearOf(sx, sy, exR, eyR, 1.4, null, sp, true, [hxc, hyc]);
              if (okSp2 && cpts2.length === 3) {
                okSp2 = clearOf(exR, eyR, cpts2[2][0], cpts2[2][1], 1.4, null, sp, true, [hxc, hyc]);
                if (!okSp2) cpts2 = cpts2.slice(0, 2); 
              }
              if (lenR < 10) break;
            }
            if (okSp2) {
              reserve(cpts2, 1.4, sp);
              out.push({ pts: cpts2, w: 1.4, spoke: true });
              return true;
            }
            return false;
          }
          for (var tg = 0; tg < nSt; tg++) {
            var baseT = offA + tg * stepA;
            var doneT = trySpoke(baseT);
            for (var jt = 1; jt <= 4 && !doneT; jt++) {
              if (trySpoke(baseT - jt * stepA * 0.35)) doneT = true;
              else if (trySpoke(baseT + jt * stepA * 0.35)) doneT = true;
            }
          }
        }
        return { traces: out, pads: hexPts };
      }
      function roundedPath(pts, bmin, bmax, rfn) {
        if (pts.length < 2) return "";
        var n = pts.length - 2; 
        var rr = [];
        for (var i = 0; i < n; i++) {
          var p0 = pts[i], p1 = pts[i + 1], p2 = pts[i + 2];
          var v1x = p0[0] - p1[0], v1y = p0[1] - p1[1];
          var v2x = p2[0] - p1[0], v2y = p2[1] - p1[1];
          var l1 = Math.sqrt(v1x * v1x + v1y * v1y), l2 = Math.sqrt(v2x * v2x + v2y * v2y);
          rr.push((l1 && l2) ? Math.min(bmin + (rfn ? rfn() : 0.5) * (bmax - bmin), l1 / 2, l2 / 2) : 0);
        }
        for (var pass = 0; pass < 2; pass++) {
          for (var j = 1; j < n; j++) {
            var qx = pts[j][0] - pts[j + 1][0], qy = pts[j][1] - pts[j + 1][1];
            var ql = Math.sqrt(qx * qx + qy * qy);
            var sum = rr[j - 1] + rr[j];
            if (sum > ql - 6 && sum > 0) {
              var f = Math.max(0, (ql - 6) / sum);
              rr[j - 1] *= f;
              rr[j] *= f;
            }
          }
        }
        var d = "M" + pts[0][0] + " " + pts[0][1];
        for (var i2 = 0; i2 < n; i2++) {
          var pa = pts[i2], pb = pts[i2 + 1], pc = pts[i2 + 2];
          var va1x = pa[0] - pb[0], va1y = pa[1] - pb[1];
          var va2x = pc[0] - pb[0], va2y = pc[1] - pb[1];
          var la1 = Math.sqrt(va1x * va1x + va1y * va1y), la2 = Math.sqrt(va2x * va2x + va2y * va2y);
          if (!la1 || !la2 || rr[i2] <= 0.5) { d += " L" + pb[0] + " " + pb[1]; continue; }
          var r2 = Math.min(rr[i2], la1 / 2, la2 / 2);
          var ax = pb[0] + va1x / la1 * r2, ay = pb[1] + va1y / la1 * r2;
          var bx = pb[0] + va2x / la2 * r2, by = pb[1] + va2y / la2 * r2;
          d += " L" + ax + " " + ay + " Q" + pb[0] + " " + pb[1] + " " + bx + " " + by;
        }
        var last = pts[pts.length - 1];
        d += " L" + last[0] + " " + last[1];
        return d;
      }

      for (var t2 = 0; t2 < traces.length; t2++) {
        var tr = traces[t2];
        var sBev = cfg.spokeBevel != null ? cfg.spokeBevel : 3;
        var dd = tr.spoke
          ? roundedPath(tr.pts, sBev, sBev, null)
          : roundedPath(tr.pts, cfg.bevelMin != null ? cfg.bevelMin : 4, cfg.bevelMax != null ? cfg.bevelMax : 12, rnd);
        var el = document.createElementNS(NS, "path");
        el.setAttribute("d", dd);
        el.setAttribute("fill", "none");
        el.setAttribute("stroke", cfg.lineColor || "#c6c6d0");
        el.setAttribute("stroke-width", tr.w);
        el.setAttribute("stroke-linecap", "round");
        canvas.appendChild(el);
        traces[t2].el = el;
        traces[t2].len = el.getTotalLength();
      }

      var hexes = cfg.hexCount || 18, drawnHex = 0;
      for (var hp = 0; hp < padNodes.length && drawnHex < hexes; hp++) {
        var hx = padNodes[hp][0], hy = padNodes[hp][1];
        var hs = padNodes[hp][3] || (cfg.hexSize || 40);
        var s = hs / 2, w2 = s * Math.sqrt(3) / 2;
        var poly = document.createElementNS(NS, "polygon");
        poly.setAttribute("points",
          hx + "," + (hy - s) + " " + (hx + w2) + "," + (hy - s / 2) + " " + (hx + w2) + "," + (hy + s / 2) + " " +
          hx + "," + (hy + s) + " " + (hx - w2) + "," + (hy + s / 2) + " " + (hx - w2) + "," + (hy - s / 2));
        var solidHex = !!padNodes[hp][4];
        poly.setAttribute("fill", solidHex ? "#cfcfd6" : (cfg.lineColor || "#dcdce2"));
        poly.setAttribute("fill-opacity", "1");
        poly.setAttribute("stroke", solidHex ? "#a6a6b0" : "#b3b3bd");
        poly.setAttribute("stroke-width", "1.5");
        canvas.appendChild(poly);
        drawnHex++;
      }

      var dg = document.createElementNS(NS, "g");
      canvas.appendChild(dg);
      var exclHex = [];
      for (var ex1 = 0; ex1 < padNodes.length; ex1++) exclHex.push([padNodes[ex1][0], padNodes[ex1][1], (padNodes[ex1][3] || (cfg.hexSize || 40)) / 2 + 4]);
      var bgRectEl = document.querySelector(".bg");
      var bgRect = bgRectEl ? bgRectEl.getBoundingClientRect() : null;
      if (bgRect) {
        var mnEls = document.querySelectorAll(".mini-node");
        for (var mn2 = 0; mn2 < mnEls.length; mn2++) {
          var mr2 = mnEls[mn2].getBoundingClientRect();
          exclHex.push([mr2.left + mr2.width / 2 - bgRect.left, mr2.top + mr2.height / 2 - bgRect.top + window.scrollY * speed, 36]);
        }
      }
      function nearExcl(x, y) {
        for (var i2 = 0; i2 < exclHex.length; i2++) {
          var ex2 = exclHex[i2][0] - x, ey2 = exclHex[i2][1] - y;
          if (ex2 * ex2 + ey2 * ey2 < exclHex[i2][2] * exclHex[i2][2]) return true;
        }
        return false;
      }
      function dotEl(x, y, w) {
        var r = Math.max(1.5, (w || 2) * 0.9);
        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", r);
        dot.setAttribute("fill", cfg.lineColor || "#dcdce2"); 
        dg.appendChild(dot);
      }
      var endHexes = [];
      var ehTarget = Math.min(8, Math.round(traces.length * 0.14));
      var ehGuard = 0;
      while (endHexes.length < ehTarget && ehGuard++ < 200) {
        var tE = traces[Math.floor(rnd() * traces.length)];
        if (tE.w < 2 || tE.pts.length < 3) continue; 
        var eE = tE.pts[tE.pts.length - 1];
        if (eE[1] < 40 || eE[1] > H - 40) continue;
        if (nearExcl(eE[0], eE[1])) continue;
        var dupE = false;
        for (var dh2 = 0; dh2 < endHexes.length; dh2++) if (endHexes[dh2][0] === eE[0] && endHexes[dh2][1] === eE[1]) { dupE = true; break; }
        if (!dupE) endHexes.push(eE);
      }
      var endDots = 0;
      for (var t3 = 0; t3 < traces.length; t3++) {
        var tp3 = traces[t3].pts;
        var sPt = tp3[0], ePt = tp3[tp3.length - 1];
        if (sPt[1] > 10 && !traces[t3].spoke && !nearExcl(sPt[0], sPt[1])) dotEl(sPt[0], sPt[1], traces[t3].w);
        var hasEndHex = false;
        for (var he2 = 0; he2 < endHexes.length; he2++) if (endHexes[he2][0] === ePt[0] && endHexes[he2][1] === ePt[1]) { hasEndHex = true; break; }
        if (!traces[t3].noEndDot && !traces[t3].spoke && !hasEndHex && !nearExcl(ePt[0], ePt[1]) && endDots < (cfg.dotCount || 80)) { dotEl(ePt[0], ePt[1], traces[t3].w); endDots++; }
      }
      for (var eh3 = 0; eh3 < endHexes.length; eh3++) {
        var hx2 = endHexes[eh3][0], hy2 = endHexes[eh3][1];
        var s2 = 7, w2b = s2 * Math.sqrt(3) / 2;
        var pe = document.createElementNS(NS, "polygon");
        pe.setAttribute("points",
          hx2 + "," + (hy2 - s2) + " " + (hx2 + w2b) + "," + (hy2 - s2 / 2) + " " + (hx2 + w2b) + "," + (hy2 + s2 / 2) + " " +
          hx2 + "," + (hy2 + s2) + " " + (hx2 - w2b) + "," + (hy2 + s2 / 2) + " " + (hx2 - w2b) + "," + (hy2 - s2 / 2));
        pe.setAttribute("fill", cfg.lineColor || "#dcdce2"); 
        pe.setAttribute("stroke", "#b3b3bd");
        pe.setAttribute("stroke-width", "1.2");
        dg.appendChild(pe);
      }
      var shs = cfg.spokeHexSize != null ? cfg.spokeHexSize : 6;
      var sh2 = shs / 2, shw = sh2 * Math.sqrt(3) / 2;
      for (var sh3 = 0; sh3 < traces.length; sh3++) {
        if (!traces[sh3].spoke) continue;
        var stp = traces[sh3].pts[traces[sh3].pts.length - 1];
        if (nearExcl(stp[0], stp[1])) continue;
        var shp = document.createElementNS(NS, "polygon");
        shp.setAttribute("points",
          stp[0] + "," + (stp[1] - sh2) + " " + (stp[0] + shw) + "," + (stp[1] - sh2 / 2) + " " + (stp[0] + shw) + "," + (stp[1] + sh2 / 2) + " " +
          stp[0] + "," + (stp[1] + sh2) + " " + (stp[0] - shw) + "," + (stp[1] + sh2 / 2) + " " + (stp[0] - shw) + "," + (stp[1] - sh2 / 2));
        shp.setAttribute("fill", "none"); 
        shp.setAttribute("stroke", "#b3b3bd");
        shp.setAttribute("stroke-width", "1");
        dg.appendChild(shp);
      }
      var defs = document.createElementNS(NS, "defs");
      var grad = document.createElementNS(NS, "radialGradient");
      grad.setAttribute("id", "pulseGlow");
      var st1 = document.createElementNS(NS, "stop");
      st1.setAttribute("offset", "0%");
      st1.setAttribute("stop-color", (cfg.pulses && cfg.pulses.color) || "#db814c");
      st1.setAttribute("stop-opacity", "0.55");
      var st2 = document.createElementNS(NS, "stop");
      st2.setAttribute("offset", "100%");
      st2.setAttribute("stop-color", (cfg.pulses && cfg.pulses.color) || "#db814c");
      st2.setAttribute("stop-opacity", "0");
      grad.appendChild(st1); grad.appendChild(st2); defs.appendChild(grad);
      canvas.appendChild(defs);

      {
        var pg = document.createElementNS(NS, "g");
        for (var p2 = 0; p2 < (cfg.pulses ? cfg.pulses.max : 8); p2++) {
          var halo = document.createElementNS(NS, "circle");
          halo.setAttribute("r", (cfg.pulses && cfg.pulses.glowRadius) || 11);
          halo.setAttribute("fill", "url(#pulseGlow)");
          var core = document.createElementNS(NS, "circle");
          core.setAttribute("r", (cfg.pulses && cfg.pulses.core) || 2.2);
          core.setAttribute("fill", (cfg.pulses && cfg.pulses.color) || "#db814c");
          var item = document.createElementNS(NS, "g");
          item.appendChild(halo); item.appendChild(core);
          pg.appendChild(item);
          pulseState = pulseState || [];
          pulseState.push({ el: item, t: rnd() * 200, trace: Math.floor(rnd() * Math.max(1, traces.length)),
            speed: (cfg.pulses ? (cfg.pulses.speedMin || 40) + rnd() * ((cfg.pulses.speedMax || 150) - (cfg.pulses.speedMin || 40)) : 90) });
        }
        canvas.appendChild(pg);
      }
    }

    function respawn(ps, cfg) {
      ps.trace = Math.floor(Math.random() * Math.max(1, traces.length));
      ps.t = 0;
      ps.speed = (cfg.pulses ? (cfg.pulses.speedMin || 40) + Math.random() * ((cfg.pulses.speedMax || 150) - (cfg.pulses.speedMin || 40)) : 90);
    }

    function frame(ts) {
      if (!pulseState) return;
      var dt = Math.min(0.1, (ts - lastTs) / 1000 || 0);
      lastTs = ts;
      for (var i = 0; i < pulseState.length; i++) {
        var ps = pulseState[i];
        var tr = traces[ps.trace % Math.max(1, traces.length)];
        if (!tr) continue;
        ps.t += ps.speed * dt;
        if (ps.t >= tr.len) respawn(ps, lastCfg);
        var pt = tr.el.getPointAtLength(Math.min(ps.t, tr.len));
        ps.el.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
        var overHex = false;
        for (var ph2 = 0; ph2 < padNodes.length; ph2++) {
          var pxd = pt.x - padNodes[ph2][0], pyd = pt.y - padNodes[ph2][1];
          if (pxd * pxd + pyd * pyd < ((padNodes[ph2][3] || 40) * 0.62) * ((padNodes[ph2][3] || 40) * 0.62)) { overHex = true; break; }
        }
        ps.el.setAttribute("opacity", overHex ? "0" : "1");
      }
      rafId = requestAnimationFrame(frame);
    }

    var lastCfg = null;
    function start(cfg) {
      lastCfg = cfg;
      lastTs = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    }

    var scrollRaf = null;
    window.addEventListener("scroll", function () {
      if (scrollRaf || !lastCfg) return;
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = null;
        if (!lastCfg) return;
        var s = Math.min(1, Math.max(0, lastCfg.scrollSpeed != null ? lastCfg.scrollSpeed : 0.35));
        canvas.style.transform = "translateY(" + (-window.scrollY * s) + "px)";
      });
    }, { passive: true });

    fetchFirst(bases, "bg.json").then(function (cfg) {
      if (!cfg) return;
      document.body.classList.toggle("no-grid", cfg.gridOn === false);
      build(cfg);
      start(cfg);
    });

    window.addEventListener("resize", function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (!lastCfg) return;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        pulseState = null;
        build(lastCfg);
        start(lastCfg);
      }, 300);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
      else if (lastCfg) { lastTs = 0; if (!rafId) rafId = requestAnimationFrame(frame); }
    });
  }

  /* ---------- Hero connectors: mini-nodes -> demo card (measured at runtime) ---------- */

  function initHeroLinks() {
    var svg = document.querySelector(".hero-cluster");
    var card = document.querySelector(".demo-card");
    if (!svg || !card) return;
    var NS = "http://www.w3.org/2000/svg";
    var g = null;

    function toUser(cx, cy) {
      var pt = svg.createSVGPoint();
      pt.x = cx; pt.y = cy;
      var inv = svg.getScreenCTM() && svg.getScreenCTM().inverse();
      if (!inv) return null;
      return pt.matrixTransform(inv);
    }

    function roundedPath(pts, r) {
      if (pts.length < 2) return "";
      var d = "M" + pts[0][0] + " " + pts[0][1];
      for (var i = 1; i < pts.length - 1; i++) {
        var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
        var v1x = p0[0] - p1[0], v1y = p0[1] - p1[1];
        var v2x = p2[0] - p1[0], v2y = p2[1] - p1[1];
        var l1 = Math.sqrt(v1x * v1x + v1y * v1y), l2 = Math.sqrt(v2x * v2x + v2y * v2y);
        if (!l1 || !l2) { d += " L" + p1[0] + " " + p1[1]; continue; }
        var rr = Math.min(r, l1 / 2, l2 / 2);
        var ax = p1[0] + v1x / l1 * rr, ay = p1[1] + v1y / l1 * rr;
        var bx = p1[0] + v2x / l2 * rr, by = p1[1] + v2y / l2 * rr;
        d += " L" + ax + " " + ay + " Q" + p1[0] + " " + p1[1] + " " + bx + " " + by;
      }
      var last = pts[pts.length - 1];
      d += " L" + last[0] + " " + last[1];
      return d;
    }

    var nodes = [
      { x: 120, y: 106, off: -70 },
      { x: 340, y: 346, off: 60 },
      { x: 90, y: 346, off: -80 }
    ];

    function draw() {
      if (!svg.getScreenCTM()) return;
      if (!g) {
        g = document.createElementNS(NS, "g");
        g.setAttribute("fill", "none");
        svg.appendChild(g);
      }
      while (g.firstChild) g.removeChild(g.firstChild);

      var cr = card.getBoundingClientRect();
      var a = toUser(cr.left, cr.top), b = toUser(cr.right, cr.bottom);
      if (!a || !b) return;
      var R = { left: a.x, top: a.y, right: b.x, bottom: b.y };

      nodes.forEach(function (n) {
        if (n.x > R.left && n.x < R.right && n.y > R.top && n.y < R.bottom) return;
        var tx, ty, beside;
        if (n.y >= R.bottom || n.y <= R.top) {
          ty = (n.y >= R.bottom) ? R.bottom : R.top;
          tx = Math.max(R.left + 18, Math.min(n.x + n.off, R.right - 18));
          beside = false;
        } else {
          tx = (n.x <= R.left) ? R.left : R.right;
          ty = Math.max(R.top + 18, Math.min(n.y + n.off, R.bottom - 18));
          beside = true;
        }
        var dx = tx - n.x, dy = ty - n.y;
        var dl = Math.sqrt(dx * dx + dy * dy);
        if (dl < 40) return;
        var sx = n.x + dx / dl * 34, sy = n.y + dy / dl * 34; 
        var ex, ey;
        if (beside || Math.abs(dy) >= Math.abs(dx)) {
          ey = ty - Math.sign(dy) * Math.abs(tx - sx);
          if (Math.abs(ey - sy) < 14) ey = ty; 
          ex = sx;
        } else {
          ex = tx - Math.sign(dx) * Math.abs(ty - sy);
          if (Math.abs(ex - sx) < 14) ex = tx;
          ey = sy;
        }
        var pts = [[sx, sy], [ex, ey], [tx, ty]];
        var el = document.createElementNS(NS, "path");
        el.setAttribute("d", roundedPath(pts, 10));
        el.setAttribute("stroke", "#c9c9d3");
        el.setAttribute("stroke-width", "1.2");
        el.setAttribute("stroke-linecap", "round");
        g.appendChild(el); 
      });
    }

    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    setTimeout(draw, 600);
    window.addEventListener("kinesis-redraw", function () { draw(); });
    if (window.ResizeObserver) new ResizeObserver(function () { draw(); }).observe(card);
    var rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(draw, 300);
    });
  }

  /* ---------- Boot ---------- */

  function boot() {
    initNav();
    initReveals();
    initBackground();
    initHeroLinks();
    initForm(); // Initialize form once (Listener handles dict dynamically)

    var lang = currentLang();
    loadContent(lang).then(function (dict) {
      if (!dict) return; 
      currentDict = dict; // Save dictionary globally
      applyLang(lang, dict);
      demo.start(dict.demo ? dict.demo.qa : []);
    });

    // Language Switcher
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = btn.getAttribute("data-lang");
        if (!next || next === currentLang()) return;

        // --- CLEAR THE FORM SUCCESS MESSAGE ---
        var formStatus = document.getElementById("form-status");
        if (formStatus) {
          formStatus.textContent = "";
          formStatus.className = "form-status";
        }
        // --------------------------------------

        loadContent(next).then(function (dict) {
          if (!dict) return;
          currentDict = dict; // Update dictionary globally on switch
          applyLang(next, dict);
          demo.start(dict.demo ? dict.demo.qa : []);
        });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();