// ==UserScript==
// @name         AI Token Tracker
// @namespace    http://tampermonkey.net/
// @version      0.8.8
// @description  Tracks AI credits/tokens spending from Generate UI across supported platforms.
// @match        *://kling.ai/*
// @match        *://*.kling.ai/*
// @match        *://higgsfield.ai/*
// @match        *://*.higgsfield.ai/*
// @match        *://sjinn.ai/*
// @match        *://*.sjinn.ai/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      script.google.com
// @connect      script.googleusercontent.com
// ==/UserScript==

(() => {
  // src/core/constants.js
  var VERSION = "0.8.8";
  var VERSION_HISTORY = [
    {
      version: "0.8.8",
      date: "2026-07-06",
      changes: [
        "Added shared Google Sheets pull sync",
        "Slimmed Sheets columns to essentials",
        "Showed spend author in History"
      ]
    },
    {
      version: "0.8.7",
      date: "2026-07-06",
      changes: [
        "Show undo notice in panel header",
        "Replace title bar while undo is active",
        "Highlighted spend timestamps"
      ]
    },
    {
      version: "0.8.6",
      date: "2026-07-06",
      changes: [
        "Fixed Kling balance scale",
        "Normalized point/ticket credits",
        "Added regression coverage"
      ]
    },
    {
      version: "0.8.5",
      date: "2026-07-06",
      changes: [
        "Added spend delete from History",
        "Added 10s undo for recent spends",
        "Delayed Sheets sync with delete support"
      ]
    },
    {
      version: "0.8.4",
      date: "2026-07-06",
      changes: [
        "Shortened panel title to AITT",
        "Added clickable version badge",
        "Added Settings changelog"
      ]
    },
    {
      version: "0.8.3",
      date: "2026-07-06",
      changes: [
        "Added SJinn Seedance support",
        "Calculated Seedance spend from selected settings",
        "Moved adapters to factory list"
      ]
    }
  ];
  var UI_CLICK_DEDUP_MS = 3e3;
  var SPEND_UNDO_WINDOW_MS = 1e4;
  var SHEETS_SYNC_DELAY_MS = 1e4;
  var SHEETS_PULL_INTERVAL_MS = 6e4;
  var SPEND_MERGE_MS = 8e3;
  var STORAGE_PREFIX = "klingTokenTracker.";
  var HISTORY_KEY = STORAGE_PREFIX + "history.v1";
  var SESSION_KEY = STORAGE_PREFIX + "session.v1";
  var META_KEY = STORAGE_PREFIX + "meta.v1";
  var DEBUG_KEY = STORAGE_PREFIX + "debug.v1";
  var PANEL_KEY = STORAGE_PREFIX + "panel.v1";
  var UI_KEY = STORAGE_PREFIX + "ui.v1";
  var SETTINGS_KEY = STORAGE_PREFIX + "settings.v1";
  var SHEETS_SYNC_KEY = STORAGE_PREFIX + "sheetsSync.v1";
  var DEFAULT_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwG2o3NIhF6zUURKV_0G0YBRm3nYIPHfbnLKIf4kuOQb2NuGljoqAD8AbG5blBRUAXc5g/exec";
  var LEGACY_SHEETS_WEB_APP_URLS = [
    "https://script.google.com/macros/s/AKfycbyBKgzw0oZmfdaOSHU4iBdsRY6l-tXupdUNjcRbMDNw7-glxMuw9kC2rJCljgJquDZORA/exec",
    "https://script.google.com/macros/s/AKfycbxi3YrJYesMvttSYoFVA-_E_RxIeSHXIOjmGvFVc4HVmOp0QDka_rUo2Oxw82fTP2HXmg/exec",
    "https://script.google.com/macros/s/AKfycbwZ4SqCwMEvByu8L1MNO1OdRz30Q96HDGabFl5nj_ZvoT2Lw1Z9iWLH5vvswalTwV90kg/exec"
  ];
  var DEFAULT_SHEETS_SECRET_TOKEN = "token";
  var PROJECT_KEY = STORAGE_PREFIX + "project.v1";
  var PROJECTS_LIBRARY_KEY = STORAGE_PREFIX + "projects.v1";
  var MAX_PROJECTS = 100;
  var MAX_EVENTS = 200;
  var DUPLICATE_WINDOW_MS = 45 * 1e3;
  var UI_SCAN_DEBOUNCE_MS = 450;
  var UI_SCAN_INTERVAL_MS = 3e3;
  var MIN_BALANCE_SCORE = 14;
  var MIN_UI_SCORE = 14;

  // src/lib/utils.js
  function compactText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }
  function escapeRegExp(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function escapeHtml(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function redactUrl(value) {
    const raw = String(value || "");
    if (!raw) return "";
    if (raw.indexOf("?") < 0 && raw.indexOf("#") < 0) return raw;
    try {
      const base = window.location && window.location.origin ? window.location.origin : "https://kling.ai";
      const parsed = new URL(raw, base);
      const keys = [];
      parsed.searchParams.forEach(function(_paramValue, key) {
        if (keys.indexOf(key) < 0) keys.push(key);
      });
      const query = keys.length ? "?" + keys.map(function(key) {
        return key + "=...";
      }).join("&") : "";
      const origin = /^https?:\/\//i.test(raw) ? parsed.origin : "";
      return origin + parsed.pathname + query;
    } catch (_) {
      return raw.replace(/\?[^#\s]*/g, "?...");
    }
  }
  function walkJson(value, path, visitor, depth) {
    depth = depth || 0;
    if (depth > 12) return;
    visitor(value, path);
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(function(item, index) {
        walkJson(item, path.concat(String(index)), visitor, depth + 1);
      });
      return;
    }
    if (typeof value === "object") {
      Object.keys(value).forEach(function(key) {
        walkJson(value[key], path.concat(key), visitor, depth + 1);
      });
    }
  }
  function parseJsonText(text) {
    if (text == null || text === "") return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }
  function normalizeUrl(input) {
    if (input == null) return "";
    try {
      if (typeof input === "string") return input;
      if (input && typeof input.toString === "function") return input.toString();
    } catch (_) {
    }
    return String(input || "");
  }
  function getHeader(headers, name) {
    if (!headers || !name) return "";
    try {
      return headers.get ? headers.get(name) || "" : "";
    } catch (_) {
      return "";
    }
  }
  function maybeRedactDebugString(value) {
    const text = String(value);
    if (/^(https?:\/\/|\/)/.test(text) && text.indexOf("?") >= 0) return redactUrl(text);
    return text.replace(/(https?:\/\/[^\s]+|\/[A-Za-z0-9_./-]+\?[^\s]+)/g, function(match) {
      return redactUrl(match);
    });
  }

  // src/lib/credits.js
  function isFiniteCredit(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e9;
  }
  function normalizeCredit(value) {
    return Math.round(Number(value) * 1e6) / 1e6;
  }
  function nearlyEqual(a, b) {
    return Math.abs(Number(a) - Number(b)) < 1e-6;
  }
  function parseLooseNumber(value) {
    if (value == null || value === "") return NaN;
    const normalized = String(value).replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  function normalizeJsonNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") return parseLooseNumber(value);
    return NaN;
  }

  // src/adapters/shared.js
  function getDirectClickableText(clickable) {
    return compactText([
      clickable.textContent || "",
      clickable.getAttribute("aria-label") || "",
      clickable.getAttribute("title") || ""
    ].join(" ")).slice(0, 160);
  }
  function getElementRectSummary(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return "";
    const rect = element.getBoundingClientRect();
    if (!rect) return "";
    return [
      "w=" + Math.round(rect.width || 0),
      "h=" + Math.round(rect.height || 0),
      "x=" + Math.round(rect.left || 0),
      "y=" + Math.round(rect.top || 0)
    ].join(" ");
  }
  function isUiGenerationText(text) {
    const normalized = String(text || "").toLowerCase();
    if (!normalized) return false;
    if (/generate|create|submit|start|try|render/.test(normalized) && /video|generation|generate|create|submit|render/.test(normalized)) {
      return true;
    }
    if (/生成|創建|创建/.test(normalized)) return true;
    return false;
  }
  function hasGenerateCostInDirectText(text) {
    const normalized = compactText(text);
    if (!normalized) return false;
    return /(?:^|[^\d:])\d+(?:[.,]\d+)?\s*(?:generate|生成|創建|创建)\b/i.test(normalized);
  }
  function extractCostFromUiText(text) {
    const normalized = compactText(text);
    if (!normalized) return NaN;
    const generateMatches = Array.from(normalized.matchAll(/(?:^|[^\d:])(\d+(?:[.,]\d+)?)\s*(?:generate|生成|創建|创建)\b/gi));
    if (generateMatches.length) return parseLooseNumber(generateMatches[generateMatches.length - 1][1]);
    const hdMatches = Array.from(normalized.matchAll(/hd\s*(\d+(?:[.,]\d+)?)/gi));
    if (hdMatches.length) return parseLooseNumber(hdMatches[hdMatches.length - 1][1]);
    const numbers = normalized.match(/\d+(?:[.,]\d+)?/g) || [];
    if (!numbers.length) return NaN;
    return parseLooseNumber(numbers[numbers.length - 1]);
  }
  function extractHiggsfieldCost(text) {
    const normalized = compactText(text);
    if (!normalized) return NaN;
    const primary = normalized.match(/generate\s*[✦✧⋆*]\s*(\d+(?:[.,]\d+)?)/i);
    if (primary) return parseLooseNumber(primary[1]);
    const glued = normalized.match(/generate\s*(\d+(?:[.,]\d+)?)/i);
    if (glued) return parseLooseNumber(glued[1]);
    const sparkle = normalized.match(/[✦✧⋆*]\s*(\d+(?:[.,]\d+)?)/);
    if (sparkle) return parseLooseNumber(sparkle[1]);
    if (!/generate/i.test(normalized)) return NaN;
    const numbers = normalized.match(/\d+(?:[.,]\d+)?/g) || [];
    if (!numbers.length) return NaN;
    return parseLooseNumber(numbers[numbers.length - 1]);
  }
  function extractHiggsfieldBalance(root, panelHost) {
    if (!root) return null;
    const pageText = compactText(root.innerText || root.textContent || "");
    const pageMatch = pageText.match(/\bCredits\b[\s\S]{0,100}?(\d[\d,.]*)\s*left\b/i);
    if (pageMatch) {
      const value = parseLooseNumber(pageMatch[1]);
      if (isFiniteCredit(value) && value > 0) {
        return {
          value: normalizeCredit(value),
          score: 24,
          context: "Credits " + pageMatch[1] + " left"
        };
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    let count = 0;
    while ((node = walker.nextNode()) && count < 2500) {
      count += 1;
      const parent = node.parentElement;
      if (!parent || panelHost && panelHost.contains(parent)) continue;
      const text = compactText(node.nodeValue || "");
      const leftMatch = text.match(/(\d[\d,.]*)\s*left\b/i);
      if (!leftMatch) continue;
      let element = parent;
      for (let depth = 0; element && depth < 8; depth += 1) {
        if (panelHost && panelHost.contains(element)) break;
        const ctx = compactText(element.textContent || "");
        if (/\bcredits\b/i.test(ctx) && ctx.length <= 320) {
          const value = parseLooseNumber(leftMatch[1]);
          if (isFiniteCredit(value) && value > 0) {
            return {
              value: normalizeCredit(value),
              score: 22,
              context: ctx.slice(0, 180)
            };
          }
        }
        element = element.parentElement;
      }
    }
    return null;
  }
  function isLikelyKlingGenerateButton(clickable, event) {
    if (!clickable || typeof clickable.getBoundingClientRect !== "function") return true;
    const rect = clickable.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return true;
    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) return false;
    }
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (rect.width > 360) return false;
    if (viewportWidth && rect.width > viewportWidth * 0.35) return false;
    if (rect.height > 96) return false;
    if (viewportHeight && rect.height > viewportHeight * 0.16) return false;
    if (rect.width < 80 || rect.height < 28) return false;
    return true;
  }
  function isLikelyHiggsfieldGenerateButton(clickable, event) {
    if (!clickable || typeof clickable.getBoundingClientRect !== "function") return true;
    const rect = clickable.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return true;
    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) return false;
    }
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (viewportWidth && rect.width > viewportWidth * 0.95) return false;
    if (rect.height > 64) return false;
    if (viewportHeight && rect.height > viewportHeight * 0.12) return false;
    if (rect.width < 60 || rect.height < 24) return false;
    return true;
  }
  function getGenerateClickText(clickable, panelHost, extractCost) {
    const candidates = [];
    function consider(element, maxLen) {
      if (!element) return;
      const text = compactText([
        element.textContent || "",
        element.getAttribute && element.getAttribute("aria-label") || "",
        element.getAttribute && element.getAttribute("title") || ""
      ].join(" "));
      if (!text || text.length > maxLen) return;
      if (element !== clickable && !/generate|生成|創建|创建/i.test(text)) return;
      if (candidates.indexOf(text) >= 0) return;
      candidates.push(text);
    }
    consider(clickable, 140);
    let parent = clickable.parentElement;
    for (let depth = 0; parent && depth < 2; depth += 1) {
      if (panelHost && panelHost.contains(parent)) break;
      consider(parent, 200);
      parent = parent.parentElement;
    }
    if (!candidates.length) return compactText(clickable.textContent || "").slice(0, 260);
    candidates.sort(function(a, b) {
      return a.length - b.length;
    });
    for (let i = 0; i < candidates.length; i += 1) {
      const amount = extractCost(candidates[i]);
      if (isFiniteCredit(amount)) return candidates[i].slice(0, 260);
    }
    return candidates[0].slice(0, 260);
  }
  function buildHiggsfieldDetail(directText, amount) {
    const normalized = compactText(directText);
    if (normalized && /generate/i.test(normalized)) return normalized.slice(0, 100);
    if (typeof amount === "number" && Number.isFinite(amount)) {
      return ("Generate " + amount).slice(0, 100);
    }
    return normalized ? normalized.slice(0, 100) : "";
  }
  function findFormLikeContainer(start, requiredLabels, panelHost, maxDepth) {
    if (!start) return null;
    const labels = Array.isArray(requiredLabels) ? requiredLabels : [];
    let element = start;
    const limit = Number(maxDepth) > 0 ? Number(maxDepth) : 8;
    for (let depth = 0; element && depth < limit; depth += 1) {
      if (panelHost && panelHost.contains(element) && element !== start) break;
      const text = compactText(element.innerText || element.textContent || "");
      if (text && labels.every(function(label) {
        return new RegExp("\\b" + String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(text);
      })) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }
  function buildCalculatedSpendDetail(name, settings, amount) {
    const parts = [name || "Generate"];
    if (settings && settings.resolution) parts.push(settings.resolution);
    if (settings && settings.mode) parts.push(settings.mode);
    if (settings && settings.duration) parts.push(settings.duration);
    if (isFiniteCredit(amount)) parts.push(String(normalizeCredit(amount)) + " credits");
    return compactText(parts.join(" \xB7 ")).slice(0, 140);
  }

  // src/adapters/metadata.js
  var HIGGSFIELD_IGNORE_RE = /your browser does not support|enhance\s*off|does not support the video/i;
  function parseKlingMetadata(text) {
    const normalized = compactText(text);
    const metadata = {};
    const resolution = normalized.match(/\b(720p|1080p|2k|4k)\b/i);
    if (resolution) metadata.resolution = resolution[1];
    const duration = normalized.match(/\b(\d+)\s*s\b/i);
    if (duration) metadata.duration = duration[1] + "s";
    const aspectRatio = normalized.match(/\b(\d{1,2}:\d{1,2})\b/);
    if (aspectRatio) metadata.aspectRatio = aspectRatio[1];
    const outputs = normalized.match(/(?:^|[^\d:])([1-4])\s+(?:Native Audio|Audio|HD|Generate|\d+\s*Generate)/i);
    if (outputs) metadata.outputs = Number(outputs[1]);
    if (/Native Audio/i.test(normalized)) metadata.audio = "Native Audio";
    else if (/\bAudio\b/i.test(normalized)) metadata.audio = "Audio";
    const mode = normalized.match(/\b(Standard|Professional|Pro|Master|High Quality|Quality)\b/i);
    if (mode) metadata.mode = mode[1];
    const model = normalized.match(/\b(?:Model|Kling)\s*([A-Za-z0-9._-]+)/i);
    if (model) metadata.model = model[1];
    return metadata;
  }
  function parseHiggsfieldMetadata(clickable, panelHost) {
    const metadata = {};
    if (!clickable || typeof document === "undefined") return metadata;
    function isIgnoredElement(element2) {
      if (!element2) return true;
      if (panelHost && panelHost.contains(element2) && element2 !== clickable) return true;
      const tag = String(element2.tagName || "").toLowerCase();
      return tag === "script" || tag === "style" || tag === "noscript" || tag === "video";
    }
    function considerPrompt(value) {
      const text = compactText(value || "");
      if (text.length < 2 || text.length > 500) return;
      if (HIGGSFIELD_IGNORE_RE.test(text)) return;
      if (/^generate/i.test(text)) return;
      if (!metadata.prompt || text.length > metadata.prompt.length) {
        metadata.prompt = text.slice(0, 200);
      }
    }
    function considerPillText(text) {
      const normalized = compactText(text || "");
      if (!normalized || normalized.length > 28) return;
      if (/^\d+s$/i.test(normalized)) metadata.duration = normalized.toLowerCase();
      else if (/^(720p|1080p|2k|4k)$/i.test(normalized)) metadata.resolution = normalized.toLowerCase();
      else if (normalized === "Auto") metadata.aspectRatio = "Auto";
      else if (/^\d{1,2}:\d{1,2}$/.test(normalized)) metadata.aspectRatio = normalized;
      else if (/^(On|Off)$/i.test(normalized) && !metadata.audio) metadata.audio = normalized;
    }
    function scanContainer(container) {
      if (!container || isIgnoredElement(container)) return;
      container.querySelectorAll('textarea, [contenteditable="true"]').forEach(function(field) {
        if (isIgnoredElement(field)) return;
        considerPrompt(field.value || field.textContent || "");
      });
      container.querySelectorAll('input[type="text"], input:not([type])').forEach(function(field) {
        if (isIgnoredElement(field)) return;
        considerPrompt(field.value || "");
      });
      container.querySelectorAll('button, [role="button"]').forEach(function(button) {
        if (button === clickable || isIgnoredElement(button)) return;
        considerPillText(button.textContent || "");
      });
    }
    let element = clickable;
    for (let depth = 0; element && depth < 7; depth += 1) {
      scanContainer(element);
      element = element.parentElement;
    }
    let scope = clickable.parentElement;
    for (let depth = 0; scope && depth < 8; depth += 1) {
      if (panelHost && panelHost.contains(scope)) break;
      if (typeof scope.querySelectorAll === "function") {
        scope.querySelectorAll("span, div, p, label, li").forEach(function(node) {
          if (isIgnoredElement(node)) return;
          const text = compactText(node.textContent || "");
          if (!text || text.length > 80) return;
          if (/^model\b/i.test(text)) return;
          const modelInline = text.match(/^(?:Model\s*)?(Kling\s*[\d.]+\s*(?:Mix|Omni)?|Google\s+Veo[\w.\s-]*|Veo\s*[\d.]+\s*\w*)/i);
          if (modelInline) metadata.model = compactText(modelInline[1] || modelInline[0]).slice(0, 80);
        });
      }
      const scopeText = compactText(scope.innerText || scope.textContent || "");
      if (scopeText.length <= 400) {
        const modeMatch = scopeText.match(/\b(GENERAL|CINEMA|STANDARD)\b/);
        if (modeMatch) metadata.mode = modeMatch[1];
        const modelMatch = scopeText.match(/\b(Kling\s*[\d.]+\s*(?:Mix|Omni)?|Google\s+Veo[\w.\s-]*|Veo\s*[\d.]+\s*(?:Lite|Pro)?[\w]*)\b/i);
        if (modelMatch) metadata.model = compactText(modelMatch[1]).slice(0, 80);
      }
      scope = scope.parentElement;
    }
    return metadata;
  }

  // src/lib/balance-parse.js
  function scoreBalancePath(pathText, url) {
    const path = String(pathText || "").toLowerCase();
    const urlText = String(url || "").toLowerCase();
    let score = 0;
    if (/\/api\/notify\/expiredpoint/.test(urlText)) return -100;
    if (/\/api\/task\/price|\/api\/task\/calculate-price/.test(urlText)) return -100;
    if (/remainpoints|remain_points/.test(path) && !/\/api\/account\/pointandticket/.test(urlText)) return -100;
    if (/quota/.test(path) && !/\/api\/account\//.test(urlText)) return -100;
    if (/\/api\/account\/pointandticket/.test(urlText) && /^data\.total$/.test(path)) score += 25;
    if (/\/api\/account\/pointandticket/.test(urlText) && /^data\.points\.\d+\.balance$/.test(path)) score -= 6;
    if (/\/api\/account\//.test(urlText) && /balance|point|credit|ticket/.test(path)) score += 12;
    if (/balance/.test(path)) score += 12;
    if (/remain|remaining|available|left/.test(path)) score += 10;
    if (/wallet|account|quota/.test(path)) score += 7;
    if (/credit|credits|token|tokens/.test(path)) score += 6;
    if (/coin|coins/.test(path)) score += 4;
    if (/wallet|account|balance|credit|quota|asset|pointandticket/.test(urlText)) score += 3;
    if (/\/api\/user\/|\/api\/elements|\/api\/product|\/api\/libraries|\/api\/lora|\/api\/task\//.test(urlText)) score -= 8;
    if (/generate|generation|submit|create|task/.test(urlText)) score -= 4;
    if (/cost|consume|consumed|spend|spent|used|usage|price|deduct|fee|charge/.test(path)) score -= 8;
    if (/count|num|number|duration|second|width|height|fps|size|limit|max|min|id$/.test(path)) score -= 5;
    if (/expire|expiry|deadline|timestamp|time|date/.test(path)) score -= 6;
    return score;
  }
  function normalizeKlingPointAndTicketCredit(value) {
    return normalizeCredit(value / 100);
  }
  function extractKlingPointAndTicketBalance(payload) {
    const data = payload && payload.data;
    if (!data || typeof data !== "object") return null;
    const total = normalizeJsonNumber(data.total);
    if (isFiniteCredit(total)) {
      return {
        value: normalizeKlingPointAndTicketCredit(total),
        path: "data.total",
        score: 30
      };
    }
    if (Array.isArray(data.points) && data.points.length) {
      let sum = 0;
      let hasAny = false;
      data.points.forEach(function(point) {
        const balance = normalizeJsonNumber(point && point.balance);
        if (!isFiniteCredit(balance)) return;
        sum += balance;
        hasAny = true;
      });
      if (hasAny) {
        return {
          value: normalizeKlingPointAndTicketCredit(sum),
          path: "data.points[].balance(sum)",
          score: 28
        };
      }
    }
    const remain = normalizeJsonNumber(
      data.remainPoints != null ? data.remainPoints : data.remain_points
    );
    if (isFiniteCredit(remain)) {
      return {
        value: normalizeKlingPointAndTicketCredit(remain),
        path: data.remainPoints != null ? "data.remainPoints" : "data.remain_points",
        score: 26
      };
    }
    return null;
  }
  function extractBalanceFromPayload(payload, url) {
    const urlText = String(url || "");
    if (/\/api\/account\/pointandticket/i.test(urlText)) {
      const klingBalance = extractKlingPointAndTicketBalance(payload);
      if (klingBalance) return klingBalance;
    }
    const candidates = [];
    walkJson(payload, [], function(value, path) {
      const number = normalizeJsonNumber(value);
      if (!isFiniteCredit(number)) return;
      const pathText = path.join(".").toLowerCase();
      const score = scoreBalancePath(pathText, url);
      if (score >= MIN_BALANCE_SCORE) {
        candidates.push({
          value: normalizeCredit(number),
          path: path.join("."),
          score
        });
      }
    });
    if (!candidates.length) return null;
    candidates.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.path).length - String(b.path).length;
    });
    return candidates[0];
  }
  function extractTaskId(payload) {
    let found = null;
    walkJson(payload, [], function(value, path) {
      if (found != null) return;
      if (typeof value !== "string" && typeof value !== "number") return;
      const pathText = path.join(".").toLowerCase();
      if (!/(task|job|generation|video).*(id)|(^|\.)(taskid|task_id|jobid|job_id)$/.test(pathText)) return;
      const text = String(value);
      if (text.length < 3 || text.length > 120) return;
      found = text;
    });
    return found;
  }

  // src/adapters/kling.js
  function createKlingAdapter(h) {
    return {
      id: "kling",
      name: "Kling",
      networkEnabled: true,
      matchesLocation: function(url) {
        return /^https?:\/\/(?:[\w-]+\.)*kling\.ai(?:[:/]|$)/i.test(String(url || ""));
      },
      parseGenerateClick: function(clickable, event) {
        const directText = getDirectClickableText(clickable);
        if (!isUiGenerationText(directText)) return null;
        if (!hasGenerateCostInDirectText(directText)) {
          h.addDiagnostic("ignored generate-like click without direct cost", directText);
          return null;
        }
        if (!isLikelyKlingGenerateButton(clickable, event)) {
          h.addDiagnostic("ignored generate-like click outside generate button bounds", directText, getElementRectSummary(clickable));
          return null;
        }
        const detail = getGenerateClickText(clickable, h.getPanelHost(), extractCostFromUiText);
        const amount = extractCostFromUiText(detail);
        if (!isFiniteCredit(amount) || amount <= 0) {
          h.addDiagnostic("ui generate click without cost", detail);
          return null;
        }
        return {
          amount,
          detail,
          metadata: parseKlingMetadata(detail),
          estimated: true
        };
      },
      extractBalance: function(payload, url) {
        if (/\/api\/account\/pointandticket/i.test(String(url || ""))) {
          const structured = extractKlingPointAndTicketBalance(payload);
          if (structured) return structured;
        }
        return h.extractBalanceFromPayload(payload, url);
      },
      isRelevantDebugUrl: function(url, payload) {
        return h.looksRelevantForDebug(url, payload);
      },
      isGenerateButton: isLikelyKlingGenerateButton
    };
  }

  // src/adapters/higgsfield.js
  function createHiggsfieldAdapter(h) {
    return {
      id: "higgsfield",
      name: "Higgsfield",
      networkEnabled: false,
      uiBalanceEnabled: true,
      matchesLocation: function(url) {
        return /^https?:\/\/(?:[\w-]+\.)*higgsfield\.ai(?:[:/]|$)/i.test(String(url || ""));
      },
      parseGenerateClick: function(clickable, event) {
        const directText = getDirectClickableText(clickable);
        if (!/generate/i.test(directText)) return null;
        if (!isLikelyHiggsfieldGenerateButton(clickable, event)) {
          h.addDiagnostic("ignored higgsfield generate click outside button bounds", directText, getElementRectSummary(clickable));
          return null;
        }
        const amount = extractHiggsfieldCost(directText);
        const metadata = parseHiggsfieldMetadata(clickable, h.getPanelHost());
        const detail = buildHiggsfieldDetail(directText, amount);
        if (!isFiniteCredit(amount) || amount <= 0) {
          h.addDiagnostic("higgsfield generate click without ui cost", directText);
          return {
            amount: null,
            detail,
            metadata,
            estimated: true
          };
        }
        return {
          amount,
          detail,
          metadata,
          estimated: false
        };
      },
      extractBalance: function() {
        return null;
      },
      extractUiBalance: function(root, panelHost) {
        return extractHiggsfieldBalance(root, panelHost);
      },
      isRelevantDebugUrl: function() {
        return false;
      },
      isGenerateButton: isLikelyHiggsfieldGenerateButton,
      extractCostFromUiText: extractHiggsfieldCost
    };
  }

  // src/adapters/seedance.js
  var SEEDANCE_RATES = {
    "480P": { Pro: 143, Fast: 100, Mini: 72 },
    "720P": { Pro: 240, Fast: 168, Mini: 120 },
    "1080P": { Pro: 600, Fast: 420, Mini: 300 },
    "4K": { Pro: 1200, Fast: 840, Mini: 600 }
  };
  var SEEDANCE_LABELS = ["Aspect Ratio", "Duration", "Mode", "Resolution"];
  function normalizeResolution(value) {
    const text = compactText(value).toUpperCase();
    if (/^4\s*K$/.test(text)) return "4K";
    const match = text.match(/\b(480P|720P|1080P|4K)\b/i);
    return match ? match[1].toUpperCase() : "";
  }
  function normalizeMode(value) {
    const match = compactText(value).match(/\b(Pro|Fast|Mini)\b/i);
    if (!match) return "";
    return match[1].slice(0, 1).toUpperCase() + match[1].slice(1).toLowerCase();
  }
  function normalizeDuration(value) {
    const match = compactText(value).match(/(\d+(?:[.,]\d+)?)\s*s\b/i);
    if (!match) return { label: "", seconds: NaN };
    const seconds = parseLooseNumber(match[1]);
    return {
      label: isFiniteCredit(seconds) ? normalizeCredit(seconds) + "s" : "",
      seconds
    };
  }
  function normalizeAspectRatio(value) {
    const match = compactText(value).match(/\b(\d{1,2}:\d{1,2})\b/);
    return match ? match[1] : "";
  }
  function extractPrompt(container) {
    if (!container || typeof container.querySelectorAll !== "function") return "";
    const fields = container.querySelectorAll('textarea, [contenteditable="true"], input[type="text"], input:not([type])');
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i];
      const text = compactText(field.value || field.textContent || "");
      if (text && !/^generate$/i.test(text)) return text.slice(0, 200);
    }
    return "";
  }
  function getElementText(element) {
    if (!element) return "";
    return compactText([
      element.innerText || "",
      element.textContent || "",
      element.value || "",
      element.getAttribute ? element.getAttribute("aria-label") || "" : "",
      element.getAttribute ? element.getAttribute("title") || "" : ""
    ].join(" "));
  }
  function isUsefulSelectValue(text, label) {
    const normalized = compactText(text);
    if (!normalized || normalized.length > 40) return false;
    if (label && normalized.toLowerCase() === String(label).toLowerCase()) return false;
    if (/upload|generate|prompt|collection|guide/i.test(normalized)) return false;
    return true;
  }
  function readSeedanceComboboxValues(container) {
    if (!container || typeof container.querySelectorAll !== "function") return null;
    const controls = Array.from(container.querySelectorAll('button[role="combobox"], [role="combobox"], select')).filter(function(element) {
      return isUsefulSelectValue(getElementText(element), "");
    });
    if (controls.length < SEEDANCE_LABELS.length) return null;
    const selected = controls.slice(-SEEDANCE_LABELS.length);
    return {
      aspectRatio: getElementText(selected[0]),
      duration: getElementText(selected[1]),
      mode: getElementText(selected[2]),
      resolution: getElementText(selected[3])
    };
  }
  function calculateSeedanceCost(settings) {
    const resolution = normalizeResolution(settings && settings.resolution);
    const mode = normalizeMode(settings && settings.mode);
    const duration = normalizeDuration(settings && settings.duration);
    const rate = resolution && mode && SEEDANCE_RATES[resolution] && SEEDANCE_RATES[resolution][mode];
    if (!isFiniteCredit(duration.seconds) || duration.seconds <= 0 || !isFiniteCredit(rate) || rate <= 0) {
      return NaN;
    }
    return normalizeCredit(duration.seconds * rate);
  }
  function parseSeedanceSettingsFromText(text) {
    const values = {};
    SEEDANCE_LABELS.forEach(function(label, index) {
      values[label] = "";
      const nextLabels = SEEDANCE_LABELS.slice(index + 1).map(function(item) {
        return String(item).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      });
      const endPattern = nextLabels.length ? "(?=\\s+(?:" + nextLabels.join("|") + ")\\b|$)" : "(?=$)";
      const match = compactText(text).match(new RegExp("\\b" + label + "\\b\\s+(.+?)" + endPattern, "i"));
      if (match) values[label] = compactText(match[1]);
    });
    return normalizeSeedanceSettings({
      aspectRatio: values["Aspect Ratio"],
      duration: values.Duration,
      mode: values.Mode,
      resolution: values.Resolution
    });
  }
  function normalizeSeedanceSettings(input) {
    const duration = normalizeDuration(input && input.duration);
    return {
      aspectRatio: normalizeAspectRatio(input && input.aspectRatio),
      duration: duration.label,
      durationSeconds: duration.seconds,
      mode: normalizeMode(input && input.mode),
      resolution: normalizeResolution(input && input.resolution),
      prompt: compactText(input && input.prompt || "").slice(0, 200)
    };
  }
  function getSeedanceSettings(container) {
    const comboValues = readSeedanceComboboxValues(container);
    if (comboValues) {
      return normalizeSeedanceSettings({
        aspectRatio: comboValues.aspectRatio,
        duration: comboValues.duration,
        mode: comboValues.mode,
        resolution: comboValues.resolution,
        prompt: extractPrompt(container)
      });
    }
    const values = parseSeedanceSettingsFromText(container && (container.innerText || container.textContent) || "");
    return normalizeSeedanceSettings({
      aspectRatio: values.aspectRatio,
      duration: values.duration,
      mode: values.mode,
      resolution: values.resolution,
      prompt: extractPrompt(container)
    });
  }
  function createSeedanceAdapter(h) {
    return {
      id: "seedance",
      name: "Seedance",
      networkEnabled: false,
      uiBalanceEnabled: false,
      matchesLocation: function(url) {
        return /^https?:\/\/(?:[\w-]+\.)*sjinn\.ai\/tools\/seedance20-video(?:[/?#]|$)/i.test(String(url || ""));
      },
      parseGenerateClick: function(clickable, event) {
        const directText = getDirectClickableText(clickable);
        if (!/^generate$/i.test(directText)) return null;
        const container = findFormLikeContainer(clickable, SEEDANCE_LABELS, h.getPanelHost(), 10);
        if (!container) {
          h.addDiagnostic("ignored seedance generate without form context", directText, getElementRectSummary(clickable));
          return null;
        }
        if (event && clickable && typeof clickable.getBoundingClientRect === "function") {
          const rect = clickable.getBoundingClientRect();
          if (rect && Number.isFinite(rect.left) && Number.isFinite(event.clientX)) {
            const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
            if (!inside) return null;
          }
        }
        const settings = getSeedanceSettings(container);
        const amount = calculateSeedanceCost(settings);
        if (!isFiniteCredit(amount) || amount <= 0) {
          h.addDiagnostic("seedance generate click without calculable cost", settings);
          return null;
        }
        return {
          amount,
          detail: buildCalculatedSpendDetail("Seedance Generate", settings, amount),
          metadata: {
            resolution: settings.resolution,
            duration: settings.duration,
            mode: settings.mode,
            aspectRatio: settings.aspectRatio,
            model: "Seedance 2.0",
            prompt: settings.prompt
          },
          estimated: true
        };
      },
      extractBalance: function() {
        return null;
      },
      isRelevantDebugUrl: function() {
        return false;
      }
    };
  }

  // src/adapters/index.js
  var ADAPTER_FACTORIES = [
    createKlingAdapter,
    createHiggsfieldAdapter,
    createSeedanceAdapter
  ];

  // src/adapters/registry.js
  var ADAPTERS = [];
  function initAdapters(helpers) {
    ADAPTERS = ADAPTER_FACTORIES.map(function(createAdapter) {
      return createAdapter(helpers);
    });
    return ADAPTERS;
  }
  function getActiveAdapter() {
    for (let i = 0; i < ADAPTERS.length; i += 1) {
      if (ADAPTERS[i].matchesLocation(window.location.href)) return ADAPTERS[i];
    }
    return ADAPTERS[0] || null;
  }

  // src/core/storage.js
  var SHARED_KEYS = /* @__PURE__ */ new Set([HISTORY_KEY, PROJECT_KEY, PROJECTS_LIBRARY_KEY]);
  function gmAvailable() {
    return typeof GM_getValue === "function" && typeof GM_setValue === "function";
  }
  function getPageWindow() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) return unsafeWindow;
    } catch (_) {
    }
    return typeof window !== "undefined" ? window : globalThis;
  }
  function readLocalJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null || raw === "") return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }
  function parseGmValue(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    }
    return raw;
  }
  function mergeEventHistories(a, b, max) {
    const limit = typeof max === "number" && max > 0 ? max : MAX_EVENTS;
    const byId = /* @__PURE__ */ new Map();
    const lists = [a, b];
    lists.forEach(function(list) {
      if (!Array.isArray(list)) return;
      list.forEach(function(event) {
        if (!event || typeof event !== "object") return;
        const id = event.id ? String(event.id) : "";
        if (id) {
          const existing = byId.get(id);
          if (!existing || Number(event.ts || 0) >= Number(existing.ts || 0)) {
            byId.set(id, event);
          }
          return;
        }
        byId.set("anon:" + byId.size + ":" + String(event.ts || 0), event);
      });
    });
    return Array.from(byId.values()).sort(function(left, right) {
      return Number(right.ts || 0) - Number(left.ts || 0);
    }).slice(0, limit);
  }
  function loadSharedHistory(fallback) {
    const empty = Array.isArray(fallback) ? fallback : [];
    if (!gmAvailable()) {
      const localOnly = readLocalJson(HISTORY_KEY, null);
      return Array.isArray(localOnly) ? localOnly : empty;
    }
    const fromGm = parseGmValue(GM_getValue(HISTORY_KEY, null), []);
    const fromLocal = readLocalJson(HISTORY_KEY, []);
    const gmList = Array.isArray(fromGm) ? fromGm : [];
    const localList = Array.isArray(fromLocal) ? fromLocal : [];
    const merged = mergeEventHistories(gmList, localList, MAX_EVENTS);
    writeJson(HISTORY_KEY, merged);
    return merged;
  }
  function readJson(key, fallback) {
    if (key === HISTORY_KEY) {
      return loadSharedHistory(fallback);
    }
    if (SHARED_KEYS.has(key) && gmAvailable()) {
      try {
        const fromGm = parseGmValue(GM_getValue(key, null), null);
        if (fromGm != null) return fromGm;
        const fromLocal = readLocalJson(key, null);
        if (fromLocal != null) {
          writeJson(key, fromLocal);
          return fromLocal;
        }
        return fallback;
      } catch (_) {
        return readLocalJson(key, fallback);
      }
    }
    return readLocalJson(key, fallback);
  }
  function writeJson(key, value) {
    const serialized = JSON.stringify(value);
    if (SHARED_KEYS.has(key) && gmAvailable()) {
      try {
        GM_setValue(key, serialized);
      } catch (error) {
        console.warn("[AI Token Tracker] GM_setValue failed for", key, error);
      }
    }
    try {
      window.localStorage.setItem(key, serialized);
    } catch (error) {
      console.warn("[AI Token Tracker] localStorage write failed for", key, error);
    }
  }

  // src/lib/ids.js
  function createId(prefix) {
    return prefix + ":" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2, 9);
  }

  // src/core/project-model.js
  function sanitizeMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const allowed = ["resolution", "duration", "outputs", "audio", "mode", "aspectRatio", "model", "prompt"];
    const result = {};
    allowed.forEach(function(key) {
      if (value[key] == null || value[key] === "") return;
      const maxLen = key === "prompt" ? 200 : 80;
      result[key] = typeof value[key] === "number" ? value[key] : String(value[key]).slice(0, maxLen);
    });
    return result;
  }
  function sanitizeProjectUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw.slice(0, 500);
    if (/^\/\//.test(raw)) return ("https:" + raw).slice(0, 500);
    return raw.slice(0, 500);
  }
  function sanitizeProject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { id: "", name: "", url: "" };
    return {
      id: String(value.id || "").trim().slice(0, 80),
      name: String(value.name || "").trim().slice(0, 160),
      url: sanitizeProjectUrl(value.url || "")
    };
  }
  function sanitizeProjectEntry(value) {
    const project = sanitizeProject(value || {});
    return {
      id: project.id || createId("project"),
      name: project.name,
      url: project.url,
      createdAt: Number(value && value.createdAt || Date.now()),
      updatedAt: Number(value && value.updatedAt || Date.now())
    };
  }
  function sanitizeProjectLibrary(value) {
    if (!Array.isArray(value)) return [];
    const seen = {};
    return value.map(function(entry) {
      return sanitizeProjectEntry(entry);
    }).filter(function(entry) {
      if (!entry.name) return false;
      if (seen[entry.id]) return false;
      seen[entry.id] = true;
      return true;
    }).sort(function(a, b) {
      return b.updatedAt - a.updatedAt;
    }).slice(0, MAX_PROJECTS);
  }

  // src/core/events.js
  function localDateKey(ts) {
    const date = new Date(ts);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }
  function createEventId(input, ts) {
    return [
      "delta",
      Math.floor(ts / 1e3),
      normalizeCredit(input.before),
      normalizeCredit(input.after),
      normalizeCredit(input.amount)
    ].join(":");
  }
  function mergeSources(a, b) {
    const first = a || "";
    const second = b || "";
    if (!first) return second || "unknown";
    if (!second || first === second) return first;
    if (first === "estimated" && second === "network") return "network";
    if (first === "network" && second === "estimated") return "network";
    if (first === "estimated" && second === "ui") return "ui";
    if (first === "ui" && second === "estimated") return "ui";
    if (first === "mixed" || second === "mixed") return "mixed";
    if (first === "network" && second === "ui" || first === "ui" && second === "network") return "mixed";
    return first;
  }
  function findDuplicateSpend(history, input, now) {
    for (let i = 0; i < history.length; i += 1) {
      const event = history[i];
      if (!event || now - event.ts > DUPLICATE_WINDOW_MS) continue;
      if (input.taskId && event.taskId && input.taskId === event.taskId) return event;
      if (input.source === "ui" && event.source === "ui" && event.estimated === true && input.estimated === true && now - event.ts <= UI_CLICK_DEDUP_MS && nearlyEqual(event.amount, input.amount)) {
        return event;
      }
      if (nearlyEqual(event.amount, input.amount) && nearlyEqual(event.before, input.before) && nearlyEqual(event.after, input.after) && now - event.ts <= SPEND_MERGE_MS) {
        return event;
      }
    }
    return null;
  }
  function resolveUiSpendBalance(amount, now, state) {
    const balance = state.balance;
    const lastUiSpend = state.lastUiSpend;
    let before = balance;
    if (lastUiSpend && isFiniteCredit(lastUiSpend.expectedAfter) && now - lastUiSpend.ts < DUPLICATE_WINDOW_MS) {
      const balanceStale = balance == null || isFiniteCredit(lastUiSpend.beforeAtClick) && nearlyEqual(balance, lastUiSpend.beforeAtClick);
      if (balanceStale) {
        before = lastUiSpend.expectedAfter;
      }
    }
    if (!isFiniteCredit(before) || before <= 0) {
      return {
        before: isFiniteCredit(before) ? normalizeCredit(before) : null,
        after: isFiniteCredit(before) ? normalizeCredit(before) : null
      };
    }
    return {
      before: normalizeCredit(before),
      after: normalizeCredit(before - amount)
    };
  }
  function createSession() {
    return {
      id: createId("session"),
      startedAt: Date.now(),
      total: 0,
      eventIds: []
    };
  }
  function sanitizeSession(value) {
    if (!value || typeof value !== "object") return null;
    return {
      id: String(value.id || createId("session")),
      startedAt: Number(value.startedAt || Date.now()),
      total: normalizeCredit(Number(value.total || 0)),
      eventIds: Array.isArray(value.eventIds) ? value.eventIds.map(String).slice(0, MAX_EVENTS) : []
    };
  }
  function sanitizeEvents(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function(event) {
      return event && typeof event === "object" && isFiniteCredit(Number(event.amount));
    }).map(function(event) {
      return {
        id: String(event.id || createId("event")),
        ts: Number(event.ts || Date.now()),
        localDate: String(event.localDate || localDateKey(event.ts || Date.now())),
        amount: normalizeCredit(Number(event.amount || 0)),
        before: normalizeCredit(Number(event.before || 0)),
        after: normalizeCredit(Number(event.after || 0)),
        source: String(event.source || "unknown"),
        service: String(event.service || "kling"),
        serviceName: String(event.serviceName || (event.service === "kling" || !event.service ? "Kling" : event.service)),
        taskId: event.taskId == null ? null : String(event.taskId),
        url: redactUrl(event.url || ""),
        method: String(event.method || ""),
        path: String(event.path || ""),
        score: event.score == null ? null : Number(event.score),
        pendingId: event.pendingId == null ? null : String(event.pendingId),
        detail: String(event.detail || ""),
        metadata: sanitizeMetadata(event.metadata || {}),
        project: sanitizeProject(event.project || {}),
        estimated: event.estimated === true,
        user: String(event.user || ""),
        remote: event.remote === true,
        updatedAt: event.updatedAt ? Number(event.updatedAt) : void 0
      };
    }).sort(function(a, b) {
      return b.ts - a.ts;
    }).slice(0, MAX_EVENTS);
  }
  function addEventToSession(session, event) {
    if (!session || !Array.isArray(session.eventIds)) session = createSession();
    if (session.eventIds.indexOf(event.id) >= 0) return session;
    session.eventIds.push(event.id);
    session.total = normalizeCredit(Number(session.total || 0) + Number(event.amount || 0));
    return session;
  }
  function removeEventFromSession(session, event) {
    if (!session || !Array.isArray(session.eventIds)) session = createSession();
    if (!event || !event.id) return session;
    if (session.eventIds.indexOf(event.id) < 0) return session;
    session.eventIds = session.eventIds.filter(function(id) {
      return id !== event.id;
    });
    session.total = normalizeCredit(Math.max(0, Number(session.total || 0) - Number(event.amount || 0)));
    return session;
  }
  function eventMatchesService(event, serviceId) {
    return String(event && event.service || "kling") === serviceId;
  }
  function normalizeProjectName(name) {
    return String(name || "").trim().toLowerCase();
  }
  function eventMatchesProject(event, project) {
    if (!project || !project.name) return false;
    const eventProject = sanitizeProject(event && event.project || {});
    if (!eventProject.name) return false;
    if (project.id && eventProject.id) return eventProject.id === project.id;
    return normalizeProjectName(eventProject.name) === normalizeProjectName(project.name);
  }
  function getFilteredHistory(history, project) {
    if (!project || !project.name) return history.slice();
    return history.filter(function(event) {
      return eventMatchesProject(event, project);
    });
  }
  function getProjectAllTimeTotal(history, project) {
    return normalizeCredit(getFilteredHistory(history, project).reduce(function(sum, event) {
      return sum + Number(event.amount || 0);
    }, 0));
  }
  function getProjectTotalsByService(history, project) {
    const grouped = {};
    getFilteredHistory(history, project).forEach(function(event) {
      const service = String(event && event.service || "kling");
      if (!grouped[service]) {
        grouped[service] = {
          service,
          serviceName: String(event && event.serviceName || service),
          total: 0,
          count: 0
        };
      } else if (event && event.serviceName && grouped[service].serviceName === service) {
        grouped[service].serviceName = String(event.serviceName);
      }
      grouped[service].total += Number(event && event.amount || 0);
      grouped[service].count += 1;
    });
    return Object.keys(grouped).map(function(service) {
      return {
        service: grouped[service].service,
        serviceName: grouped[service].serviceName,
        total: normalizeCredit(grouped[service].total),
        count: grouped[service].count
      };
    }).sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return a.serviceName.localeCompare(b.serviceName);
    });
  }
  function getTodayTotal(history, serviceId) {
    const today = localDateKey(Date.now());
    return normalizeCredit(history.reduce(function(sum, event) {
      if (event.localDate !== today) return sum;
      if (!eventMatchesService(event, serviceId)) return sum;
      return sum + Number(event.amount || 0);
    }, 0));
  }

  // src/core/projects.js
  function createProjects(ctx) {
    function findProjectById(id) {
      const needle = String(id || "").trim();
      if (!needle) return null;
      const library = ctx.getProjectLibrary();
      for (let i = 0; i < library.length; i += 1) {
        if (library[i].id === needle) return library[i];
      }
      return null;
    }
    function createProjectEntry(name, url) {
      const now = Date.now();
      return sanitizeProjectEntry({
        id: createId("project"),
        name,
        url,
        createdAt: now,
        updatedAt: now
      });
    }
    function listProjects() {
      return ctx.getProjectLibrary().map(function(entry) {
        return deepClone(entry);
      });
    }
    function formatProjectOptionLabel(entry) {
      const name = entry.name || "Untitled";
      if (!entry.url) return name;
      try {
        const parsed = new URL(entry.url);
        return name + " \xB7 " + parsed.hostname.replace(/^www\./i, "");
      } catch (_) {
        return name;
      }
    }
    function getActiveProject() {
      const project = sanitizeProject(ctx.runtime.project || {});
      if (project.id && findProjectById(project.id)) return project;
      if (project.name) return project;
      return sanitizeProject({});
    }
    function hasActiveProject() {
      const project = getActiveProject();
      return !!(project.id || project.name);
    }
    function isProjectFilterActive() {
      return hasActiveProject() && ctx.runtime.projectFilterEnabled === true;
    }
    function getFilteredHistory2(project) {
      const needle = project || getActiveProject();
      if (!needle || !needle.name) return ctx.getHistory().slice();
      return getFilteredHistory(ctx.getHistory(), needle);
    }
    function getProjectAllTimeTotal2(project) {
      return getProjectAllTimeTotal(ctx.getHistory(), project || getActiveProject());
    }
    function getProjectTotalsByService2(project) {
      return getProjectTotalsByService(ctx.getHistory(), project || getActiveProject());
    }
    function getProjectLastSpend(project) {
      const filtered = getFilteredHistory2(project);
      return filtered.length ? filtered[0] : null;
    }
    function getProjectEventCount(project) {
      return getFilteredHistory2(project).length;
    }
    function backfillHistoryProjectIds() {
      const library = ctx.getProjectLibrary();
      const history = ctx.getHistory();
      if (!library.length || !history.length) return;
      let changed = false;
      const next = history.map(function(event) {
        const project = sanitizeProject(event.project || {});
        if (project.id || !project.name) return event;
        const match = library.find(function(entry) {
          return entry.name === project.name && (!project.url || !entry.url || entry.url === project.url);
        });
        if (!match) return event;
        changed = true;
        return Object.assign({}, event, {
          project: sanitizeProject({
            id: match.id,
            name: project.name,
            url: project.url || match.url
          })
        });
      });
      if (changed) {
        ctx.setHistory(next);
        ctx.saveHistory();
      }
    }
    function syncProjectDraftFromActive() {
      ctx.runtime.projectDraft = {
        name: ctx.runtime.project.name || "",
        url: ctx.runtime.project.url || ""
      };
    }
    function syncProjectDraftFromInputs(root) {
      const nameInput = root.querySelector('[data-field="projectName"]');
      const urlInput = root.querySelector('[data-field="projectUrl"]');
      ctx.runtime.projectDraft = {
        name: nameInput ? nameInput.value : "",
        url: urlInput ? urlInput.value : ""
      };
    }
    function shouldCompactProject() {
      return !ctx.runtime.projectEditorOpen;
    }
    function migrateProjectLibrary() {
      let library = sanitizeProjectLibrary(ctx.getProjectLibrary());
      ctx.setProjectLibrary(library);
      const active = sanitizeProject(readJson(PROJECT_KEY, {}));
      if (!library.length && active.name) {
        const entry = createProjectEntry(active.name, active.url);
        library = [entry];
        ctx.setProjectLibrary(library);
        active.id = entry.id;
        ctx.saveProjectLibrary();
      } else if (active.id && !findProjectById(active.id) && active.name) {
        const match = library.find(function(entry) {
          return entry.name === active.name && entry.url === active.url;
        });
        active.id = match ? match.id : "";
      }
      ctx.runtime.project = active;
      syncProjectDraftFromActive();
      ctx.runtime.projectEditorOpen = !active.id && !library.length;
      backfillHistoryProjectIds();
      ctx.saveProject();
    }
    function setProject(project) {
      const sanitized = sanitizeProject(project || {});
      if (sanitized.id && !findProjectById(sanitized.id)) {
        sanitized.id = "";
      }
      ctx.runtime.project = sanitized;
      syncProjectDraftFromActive();
      ctx.saveProject();
      ctx.renderSoon();
      return ctx.getState();
    }
    function clearProject() {
      ctx.runtime.project = sanitizeProject({});
      ctx.runtime.projectEditorOpen = false;
      ctx.runtime.projectFilterEnabled = false;
      ctx.saveProject();
      ctx.saveUiState();
      ctx.renderSoon();
      return ctx.getState();
    }
    function setProjectFilterEnabled(enabled) {
      ctx.runtime.projectFilterEnabled = Boolean(enabled) && hasActiveProject();
      ctx.saveUiState();
      ctx.renderSoon();
    }
    function addProject(name, url) {
      const sanitized = sanitizeProject({ name, url });
      if (!sanitized.name) return null;
      const entry = createProjectEntry(sanitized.name, sanitized.url);
      const library = ctx.getProjectLibrary().slice();
      library.unshift(entry);
      ctx.setProjectLibrary(sanitizeProjectLibrary(library));
      ctx.saveProjectLibrary();
      ctx.renderSoon();
      return deepClone(entry);
    }
    function updateProject(id, name, url) {
      const entry = findProjectById(id);
      if (!entry) return null;
      const sanitized = sanitizeProject({ name, url });
      if (!sanitized.name) return null;
      entry.name = sanitized.name;
      entry.url = sanitized.url;
      entry.updatedAt = Date.now();
      ctx.setProjectLibrary(sanitizeProjectLibrary(ctx.getProjectLibrary()));
      ctx.saveProjectLibrary();
      if (ctx.runtime.project && ctx.runtime.project.id === entry.id) {
        ctx.runtime.project = sanitizeProject({
          id: entry.id,
          name: entry.name,
          url: entry.url
        });
        syncProjectDraftFromActive();
        ctx.saveProject();
      }
      ctx.renderSoon();
      return deepClone(entry);
    }
    function deleteProject(id) {
      const needle = String(id || "").trim();
      if (!needle) return false;
      const library = ctx.getProjectLibrary();
      const before = library.length;
      const next = library.filter(function(entry) {
        return entry.id !== needle;
      });
      if (next.length === before) return false;
      ctx.setProjectLibrary(next);
      ctx.saveProjectLibrary();
      if (ctx.runtime.project && ctx.runtime.project.id === needle) {
        ctx.runtime.project = sanitizeProject({});
        syncProjectDraftFromActive();
        ctx.saveProject();
      }
      ctx.renderSoon();
      return true;
    }
    function selectProject(id) {
      const entry = findProjectById(id);
      if (!entry) {
        return clearProject();
      }
      entry.updatedAt = Date.now();
      ctx.setProjectLibrary(sanitizeProjectLibrary(ctx.getProjectLibrary()));
      ctx.saveProjectLibrary();
      ctx.runtime.project = sanitizeProject({
        id: entry.id,
        name: entry.name,
        url: entry.url
      });
      syncProjectDraftFromActive();
      ctx.runtime.projectEditorOpen = false;
      ctx.saveProject();
      ctx.renderSoon();
      return ctx.getState();
    }
    function openProjectEditor() {
      syncProjectDraftFromActive();
      ctx.runtime.projectEditorOpen = true;
      ctx.renderSoon();
    }
    function closeProjectEditor() {
      ctx.runtime.projectEditorOpen = false;
      ctx.renderSoon();
    }
    function saveProjectFromForm(root) {
      syncProjectDraftFromInputs(root);
      const selectedId = ctx.runtime.project && ctx.runtime.project.id ? ctx.runtime.project.id : "";
      const select = root.querySelector('[data-field="projectSelect"]');
      const selectId = select ? select.value : "";
      const editingId = selectId || selectedId;
      let entry = null;
      if (editingId && findProjectById(editingId)) {
        entry = updateProject(
          editingId,
          ctx.runtime.projectDraft.name,
          ctx.runtime.projectDraft.url
        );
      } else {
        entry = addProject(ctx.runtime.projectDraft.name, ctx.runtime.projectDraft.url);
      }
      if (!entry) return null;
      ctx.runtime.project = sanitizeProject({
        id: entry.id,
        name: entry.name,
        url: entry.url
      });
      syncProjectDraftFromActive();
      ctx.runtime.projectEditorOpen = false;
      ctx.saveProject();
      ctx.renderSoon();
      return entry;
    }
    function beginNewProjectForm(root) {
      ctx.runtime.project = sanitizeProject({});
      ctx.runtime.projectDraft = { name: "", url: "" };
      ctx.runtime.projectEditorOpen = true;
      ctx.saveProject();
      const select = root.querySelector('[data-field="projectSelect"]');
      const nameInput = root.querySelector('[data-field="projectName"]');
      const urlInput = root.querySelector('[data-field="projectUrl"]');
      if (select) select.value = "";
      if (nameInput) nameInput.value = "";
      if (urlInput) urlInput.value = "";
      if (nameInput) nameInput.focus();
      ctx.renderSoon();
    }
    function deleteSelectedProject(root) {
      const select = root.querySelector('[data-field="projectSelect"]');
      const selectedId = select ? select.value : "";
      if (!selectedId || !deleteProject(selectedId)) return false;
      beginNewProjectForm(root);
      return true;
    }
    return {
      findProjectById,
      createProjectEntry,
      listProjects,
      formatProjectOptionLabel,
      getActiveProject,
      hasActiveProject,
      isProjectFilterActive,
      getFilteredHistory: getFilteredHistory2,
      getProjectAllTimeTotal: getProjectAllTimeTotal2,
      getProjectTotalsByService: getProjectTotalsByService2,
      getProjectLastSpend,
      getProjectEventCount,
      backfillHistoryProjectIds,
      syncProjectDraftFromActive,
      syncProjectDraftFromInputs,
      shouldCompactProject,
      migrateProjectLibrary,
      setProject,
      clearProject,
      setProjectFilterEnabled,
      addProject,
      updateProject,
      deleteProject,
      selectProject,
      openProjectEditor,
      closeProjectEditor,
      saveProjectFromForm,
      beginNewProjectForm,
      deleteSelectedProject
    };
  }

  // src/core/balance.js
  function createBalance(ctx) {
    function adapterSupportsUiBalance(adapter) {
      if (!adapter) return false;
      if (adapter.uiBalanceEnabled === true) return true;
      if (adapter.networkEnabled === true) return true;
      return false;
    }
    function getElementSignature(element) {
      if (!element) return "";
      const tag = String(element.tagName || "").toLowerCase();
      const classes = String(element.className || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
      const testId = element.getAttribute && element.getAttribute("data-testid");
      const role = element.getAttribute && element.getAttribute("role");
      return [
        tag,
        testId ? '[data-testid="' + testId + '"]' : "",
        role ? '[role="' + role + '"]' : "",
        classes ? "." + classes : ""
      ].join("");
    }
    function resolveUiSpendBalanceForRuntime(amount, now) {
      return resolveUiSpendBalance(amount, now, {
        balance: ctx.runtime.balance,
        lastUiSpend: ctx.runtime.lastUiSpend
      });
    }
    function updateBalanceMeta(balance, source, context, now) {
      ctx.runtime.balance = normalizeCredit(balance);
      ctx.runtime.balanceSource = source || ctx.runtime.balanceSource || "none";
      ctx.runtime.balancePath = context && context.path || ctx.runtime.balancePath || "";
      ctx.runtime.lastBalanceAt = now || Date.now();
      ctx.setMeta({
        balance: ctx.runtime.balance,
        balanceSource: ctx.runtime.balanceSource,
        balancePath: ctx.runtime.balancePath,
        lastBalanceAt: ctx.runtime.lastBalanceAt
      });
      ctx.saveMeta();
      ctx.renderSoon();
    }
    function observeBalance(nextBalance, source, context) {
      if (!isFiniteCredit(nextBalance)) return;
      const next = normalizeCredit(nextBalance);
      const previous = ctx.runtime.balance;
      const now = Date.now();
      ctx.runtime.sourceSeen[source] = true;
      if (previous != null && nearlyEqual(previous, next)) {
        updateBalanceMeta(next, source, context, now);
        return;
      }
      if (source === "ui" && ctx.runtime.balanceSource === "network" && previous != null && ctx.runtime.lastBalanceAt && now - ctx.runtime.lastBalanceAt < 15e3) {
        ctx.addDiagnostic("ignored early ui balance drift", next, "current", previous);
        return;
      }
      if (previous != null && next < previous) {
        const amount = normalizeCredit(previous - next);
        ctx.addDiagnostic("observed balance decrease without spend record", {
          previous,
          next,
          amount,
          source,
          path: context && context.path,
          url: context && context.url
        });
      }
      updateBalanceMeta(next, source, context, now);
      ctx.saveMeta();
      ctx.renderSoon();
    }
    function isPriceLikeUiContext(text) {
      return /\bcost\b|\bprice\b|\bspent\b|\bused\b|\bconsume|\bconsumed\b|\bupgrade\b|\bsubscribe\b|\bbuy\b|\bpurchase\b|\bstandard\b|\bpro\b|\bmaster\b|\bgenerate\b|\bgeneration\b/i.test(String(text || ""));
    }
    function extractBalanceFromText(text) {
      const normalized = compactText(text);
      if (!normalized) return null;
      const patterns = [
        {
          re: /\b(?:credit|credits|token|tokens|balance|wallet)\b[^\d]{0,35}(\d[\d\s,.]*)/i,
          score: 10
        },
        {
          re: /(\d[\d\s,.]*)[^\w]{0,16}\b(?:credit|credits|token|tokens)\b/i,
          score: 8
        }
      ];
      let best = null;
      patterns.forEach(function(pattern) {
        const match = normalized.match(pattern.re);
        if (!match) return;
        const value = parseLooseNumber(match[1]);
        if (!isFiniteCredit(value)) return;
        let score = pattern.score;
        if (/\bbalance\b/i.test(normalized)) score += 5;
        if (/\bwallet\b/i.test(normalized)) score += 3;
        if (/\bremaining\b|\bremain\b|\bavailable\b/i.test(normalized)) score += 4;
        if (/\bcost\b|\bprice\b|\bspent\b|\bused\b|\bconsume/i.test(normalized)) score -= 8;
        if (isPriceLikeUiContext(normalized)) score -= 8;
        if (!/\bbalance\b|\bwallet\b|\bremaining\b|\bremain\b|\bavailable\b/i.test(normalized)) score -= 3;
        const candidate = {
          value: normalizeCredit(value),
          score,
          context: normalized.slice(0, 180)
        };
        if (!best || candidate.score > best.score) best = candidate;
      });
      return best;
    }
    function isIgnoredUiElement(element) {
      if (!element) return true;
      const tag = String(element.tagName || "").toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript" || tag === "textarea") return true;
      if (tag === "button" || tag === "a" || tag === "input" || tag === "select" || tag === "option") return true;
      if (element.closest && element.closest('button, a, [role="button"], [data-ktt-root]')) return true;
      if (ctx.runtime.panelHost && (element === ctx.runtime.panelHost || ctx.runtime.panelHost.contains(element))) return true;
      return false;
    }
    function getNodeContext(node) {
      let element = node.parentElement;
      for (let depth = 0; element && depth < 3; depth += 1) {
        if (isIgnoredUiElement(element)) return "";
        const text = compactText(element.textContent || "");
        if (text.length > 0 && text.length <= 220 && /(credit|token|balance|wallet|\d)/i.test(text)) {
          return text;
        }
        element = element.parentElement;
      }
      return compactText(node.nodeValue || "");
    }
    function extractUiBalanceCandidate(root) {
      const candidates = [];
      const seenContexts = /* @__PURE__ */ new Set();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node2) {
          if (!node2 || !node2.nodeValue) return NodeFilter.FILTER_REJECT;
          const parent = node2.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (isIgnoredUiElement(parent)) return NodeFilter.FILTER_REJECT;
          const text = compactText(node2.nodeValue);
          if (!/\d/.test(text) && !/(credit|token|balance|wallet)/i.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let node;
      let count = 0;
      while ((node = walker.nextNode()) && count < 1500) {
        count += 1;
        const context = getNodeContext(node);
        if (!context || seenContexts.has(context)) continue;
        seenContexts.add(context);
        const extracted = extractBalanceFromText(context);
        if (extracted && extracted.score >= MIN_UI_SCORE) {
          candidates.push(extracted);
        }
      }
      if (!candidates.length) return null;
      candidates.sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.context).length - String(b.context).length;
      });
      return candidates[0];
    }
    function scheduleUiScan(delay) {
      if (ctx.runtime.uiScanTimer) {
        window.clearTimeout(ctx.runtime.uiScanTimer);
        ctx.runtime.uiScanTimer = null;
      }
      ctx.runtime.uiScanTimer = window.setTimeout(scanUiBalance, delay);
    }
    function scanUiBalance() {
      ctx.runtime.uiScanTimer = null;
      if (!document.body) return;
      const activeAdapter = ctx.getActiveAdapter();
      if (!adapterSupportsUiBalance(activeAdapter)) return;
      let candidate = null;
      if (activeAdapter && typeof activeAdapter.extractUiBalance === "function") {
        candidate = activeAdapter.extractUiBalance(document.body, ctx.runtime.panelHost);
      } else {
        candidate = extractUiBalanceCandidate(document.body);
      }
      if (!candidate) return;
      ctx.addDiagnostic("ui balance candidate", candidate.value, candidate.context);
      observeBalance(candidate.value, "ui", {
        path: "visible text",
        context: candidate.context,
        score: candidate.score,
        pending: null,
        url: window.location.href
      });
    }
    function recordUiGenerateClick(parsed, clickable) {
      const amount = parsed && parsed.amount;
      if (!isFiniteCredit(amount) || amount <= 0) {
        ctx.addDiagnostic("ui generate click without cost", parsed && parsed.detail);
        return null;
      }
      const now = Date.now();
      if (ctx.runtime.lastUiSpend && nearlyEqual(ctx.runtime.lastUiSpend.amount, amount) && now - ctx.runtime.lastUiSpend.ts < UI_CLICK_DEDUP_MS) {
        ctx.addDiagnostic("deduped ui spend click", amount, parsed.detail);
        return null;
      }
      const balanceSnapshot = resolveUiSpendBalanceForRuntime(amount, now);
      const before = balanceSnapshot.before;
      const after = balanceSnapshot.after;
      const metadata = parsed.metadata || {};
      const detailRaw = ctx.cleanUiDetailText(String(parsed.detail || ""), { project: ctx.runtime.project });
      const event = ctx.recordSpend({
        amount,
        before: before == null ? amount : before,
        after: after == null ? before == null ? 0 : before : after,
        source: "ui",
        service: ctx.getActiveAdapter().id,
        serviceName: ctx.getActiveAdapter().name,
        taskId: null,
        url: window.location.href,
        method: "UI",
        path: "ui generate button",
        score: null,
        pendingId: null,
        detail: ctx.hasDisplayMetadata({ metadata }) ? "" : detailRaw.slice(0, 180),
        metadata,
        estimated: parsed.estimated === true
      }, now);
      if (event) {
        ctx.runtime.lastUiSpend = {
          ts: now,
          amount,
          text: parsed.detail,
          target: getElementSignature(clickable),
          beforeAtClick: ctx.runtime.balance,
          expectedAfter: after
        };
        ctx.runtime.sourceSeen.ui = true;
        ctx.addDiagnostic("recorded ui spend click", event);
        ctx.renderSoon();
      }
      return event;
    }
    function installUiObserver() {
      if (!document.body || ctx.runtime.uiObserver || typeof window.MutationObserver !== "function") return;
      ctx.runtime.uiObserver = new MutationObserver(function() {
        scheduleUiScan(UI_SCAN_DEBOUNCE_MS);
      });
      ctx.runtime.uiObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      ctx.runtime.uiInterval = window.setInterval(function() {
        scheduleUiScan(0);
      }, UI_SCAN_INTERVAL_MS);
    }
    function installClickTracker() {
      document.addEventListener("click", function(event) {
        const target = event.target;
        if (!target || !target.closest) return;
        if (ctx.runtime.panelHost && ctx.runtime.panelHost.contains(target)) return;
        if (adapterSupportsUiBalance(ctx.getActiveAdapter())) {
          scheduleUiScan(350);
        }
        const clickable = target.closest('button, a, [role="button"], [data-testid], [class*="button"], [class*="Button"]');
        if (!clickable) return;
        const parsed = ctx.getActiveAdapter().parseGenerateClick(clickable, event);
        if (!parsed) return;
        ctx.addDiagnostic("ui generation click candidate", parsed.detail);
        recordUiGenerateClick(parsed, clickable);
      }, true);
    }
    return {
      adapterSupportsUiBalance,
      observeBalance,
      updateBalanceMeta,
      scanUiBalance,
      scheduleUiScan,
      extractUiBalanceCandidate,
      recordUiGenerateClick,
      resolveUiSpendBalanceForRuntime,
      installUiObserver,
      installClickTracker
    };
  }

  // src/core/network.js
  function createNetwork(ctx) {
    function stringifyBody(body) {
      if (body == null) return "";
      if (typeof body === "string") return body.slice(0, 5e3);
      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return body.toString().slice(0, 5e3);
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        const parts = [];
        try {
          body.forEach(function(value, key) {
            parts.push(key + "=" + (typeof value === "string" ? value : "[file]"));
          });
        } catch (_) {
        }
        return parts.join("&").slice(0, 5e3);
      }
      if (typeof Blob !== "undefined" && body instanceof Blob) return "[blob]";
      if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) return "[arraybuffer]";
      try {
        return JSON.stringify(body).slice(0, 5e3);
      } catch (_) {
        return String(body).slice(0, 5e3);
      }
    }
    function getFetchMeta(input, init) {
      let method = "GET";
      let url = "";
      let bodyText = "";
      if (input && typeof input === "object" && "url" in input) {
        url = normalizeUrl(input.url);
        method = String(input.method || method).toUpperCase();
      } else {
        url = normalizeUrl(input);
      }
      if (init && init.method) method = String(init.method).toUpperCase();
      if (init && "body" in init) bodyText = stringifyBody(init.body);
      return { url, method, bodyText, pending: null };
    }
    function looksRelevantForDebug(url, payload) {
      const text = String(url || "").toLowerCase();
      if (/wallet|balance|credit|quota|token|account|profile|video|generate|task/.test(text)) return true;
      try {
        return /wallet|balance|credit|quota|token|task|video/i.test(JSON.stringify(payload).slice(0, 3e3));
      } catch (_) {
        return false;
      }
    }
    function handlePayload(payload, context) {
      const activeAdapter = ctx.getActiveAdapter();
      if (!activeAdapter || !activeAdapter.networkEnabled) return;
      const taskId = extractTaskId(payload);
      if (taskId && context.pending) {
        context.pending.taskId = taskId;
      }
      const balanceCandidate = activeAdapter.extractBalance(payload, context.url);
      if (!balanceCandidate) {
        if (ctx.runtime.debug && activeAdapter.isRelevantDebugUrl(context.url, payload)) {
          ctx.addDiagnostic("network payload candidate without balance", context.method || "", context.url);
        }
        return;
      }
      ctx.addDiagnostic("balance candidate", balanceCandidate.value, balanceCandidate.path, context.url);
      ctx.observeBalance(balanceCandidate.value, "network", {
        url: context.url,
        method: context.method,
        path: balanceCandidate.path,
        taskId: taskId || context.pending && context.pending.taskId || null,
        pending: context.pending || null,
        score: balanceCandidate.score
      });
    }
    function inspectFetchResponse(response, metaInfo) {
      if (!response || typeof response.clone !== "function") return;
      if (response.type === "opaque" || response.type === "opaqueredirect") return;
      const contentType = getHeader(response.headers, "content-type");
      if (contentType && !/json|javascript|text/i.test(contentType)) return;
      response.clone().text().then(function(text) {
        const payload = parseJsonText(text);
        if (payload == null) return;
        handlePayload(payload, {
          source: "network",
          transport: "fetch",
          url: metaInfo.url,
          method: metaInfo.method,
          pending: metaInfo.pending || null
        });
      }).catch(function(error) {
        ctx.addDiagnostic("fetch response parse failed", metaInfo.url, error && error.message ? error.message : error);
      });
    }
    function inspectXhrResponse(xhr, metaInfo) {
      try {
        const responseType = xhr.responseType || "";
        let payload = null;
        if (responseType === "json") {
          payload = xhr.response;
        } else if (responseType === "" || responseType === "text") {
          payload = parseJsonText(xhr.responseText);
        }
        if (payload == null) return;
        handlePayload(payload, {
          source: "network",
          transport: "xhr",
          url: metaInfo.url,
          method: metaInfo.method,
          pending: metaInfo.pending || null
        });
      } catch (error) {
        ctx.addDiagnostic("xhr response parse failed", metaInfo.url, error && error.message ? error.message : error);
      }
    }
    function patchFetch() {
      const pageWindow = getPageWindow();
      if (typeof pageWindow.fetch !== "function" || pageWindow.fetch.__kttPatched) return;
      const originalFetch = pageWindow.fetch;
      function wrappedFetch(input, init) {
        const metaInfo = getFetchMeta(input, init);
        return originalFetch.apply(this, arguments).then(function(response) {
          inspectFetchResponse(response, metaInfo);
          return response;
        });
      }
      wrappedFetch.__kttPatched = true;
      wrappedFetch.__kttOriginal = originalFetch;
      pageWindow.fetch = wrappedFetch;
    }
    function patchXMLHttpRequest() {
      const pageWindow = getPageWindow();
      if (typeof pageWindow.XMLHttpRequest !== "function") return;
      const proto = pageWindow.XMLHttpRequest.prototype;
      if (!proto || proto.__kttPatched) return;
      const originalOpen = proto.open;
      const originalSend = proto.send;
      proto.open = function(method, url) {
        this.__kttMeta = {
          method: String(method || "GET").toUpperCase(),
          url: normalizeUrl(url),
          bodyText: "",
          pending: null
        };
        return originalOpen.apply(this, arguments);
      };
      proto.send = function(body) {
        const metaInfo = this.__kttMeta || {
          method: "GET",
          url: "",
          bodyText: "",
          pending: null
        };
        metaInfo.bodyText = stringifyBody(body);
        this.addEventListener("loadend", function() {
          inspectXhrResponse(this, metaInfo);
        });
        return originalSend.apply(this, arguments);
      };
      proto.__kttPatched = true;
    }
    return {
      patchFetch,
      patchXMLHttpRequest,
      inspectFetchResponse,
      inspectXhrResponse,
      handlePayload,
      getFetchMeta,
      stringifyBody,
      looksRelevantForDebug
    };
  }

  // src/core/api.js
  function createApi(ctx) {
    function summarizeDiagnostics(items) {
      const list = Array.isArray(items) ? items.slice(-80) : [];
      const grouped = {};
      list.forEach(function(entry) {
        const args = entry && Array.isArray(entry.args) ? entry.args : [];
        const label = String(args[0] || "unknown");
        const key = label + "|" + String(args[1] || "") + "|" + String(args[2] || "");
        if (!grouped[key]) {
          grouped[key] = {
            count: 0,
            lastAt: null,
            sample: args
          };
        }
        grouped[key].count += 1;
        grouped[key].lastAt = entry.ts || null;
        grouped[key].sample = args;
      });
      return Object.keys(grouped).map(function(key) {
        return grouped[key];
      }).sort(function(a, b) {
        return (b.lastAt || 0) - (a.lastAt || 0);
      }).slice(0, 30);
    }
    function createDebugReport() {
      return {
        version: VERSION,
        service: ctx.getActiveAdapter().id,
        serviceName: ctx.getActiveAdapter().name,
        page: redactUrl(window.location.href),
        capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
        balance: ctx.runtime.balance,
        balanceSource: ctx.runtime.balanceSource,
        balancePath: ctx.runtime.balancePath,
        lastBalanceAt: ctx.runtime.lastBalanceAt,
        sessionTotal: ctx.getSession().total || 0,
        todayTotal: ctx.getTodayTotal(),
        project: ctx.runtime.project,
        history: ctx.getHistory().slice(0, 10),
        pending: ctx.runtime.pending.slice(-10).map(function(pending) {
          return Object.assign({}, pending);
        }),
        diagnostics: summarizeDiagnostics(ctx.runtime.diagnostics)
      };
    }
    function getState() {
      return deepClone({
        version: VERSION,
        service: ctx.getActiveAdapter().id,
        serviceName: ctx.getActiveAdapter().name,
        balance: ctx.runtime.balance,
        balanceSource: ctx.runtime.balanceSource,
        balancePath: ctx.runtime.balancePath,
        lastBalanceAt: ctx.runtime.lastBalanceAt,
        session: ctx.getSession(),
        project: ctx.runtime.project,
        projects: ctx.listProjects(),
        projectFilterEnabled: ctx.runtime.projectFilterEnabled === true,
        projectAllTimeTotal: ctx.hasActiveProject() ? ctx.getProjectAllTimeTotal(ctx.getActiveProject()) : 0,
        history: ctx.getHistory(),
        pending: ctx.runtime.pending.map(function(item) {
          return Object.assign({}, item);
        }),
        diagnostics: ctx.runtime.diagnostics.slice(-80),
        debug: ctx.runtime.debug
      });
    }
    function resetSession() {
      ctx.setSession(createSession());
      ctx.saveSession();
      ctx.renderSoon();
      return getState();
    }
    function exportJSON() {
      return JSON.stringify(getState(), null, 2);
    }
    function getDebugReport() {
      return JSON.stringify(createDebugReport(), null, 2);
    }
    function copyDebugReport() {
      const report = getDebugReport();
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        return navigator.clipboard.writeText(report).then(function() {
          ctx.addDiagnostic("debug report copied");
          return report;
        });
      }
      return report;
    }
    function clearHistory() {
      ctx.setHistory([]);
      ctx.setSession(createSession());
      ctx.saveHistory();
      ctx.saveSession();
      ctx.renderSoon();
      return getState();
    }
    function forgetBalance() {
      ctx.runtime.balance = null;
      ctx.runtime.balanceSource = "none";
      ctx.runtime.balancePath = "";
      ctx.runtime.lastBalanceAt = null;
      ctx.setMeta({
        balance: null,
        balanceSource: "none",
        balancePath: "",
        lastBalanceAt: null
      });
      ctx.saveMeta();
      ctx.renderSoon();
      return getState();
    }
    function resetAll() {
      ctx.setHistory([]);
      ctx.setSession(createSession());
      ctx.runtime.pending = [];
      ctx.runtime.diagnostics = [];
      ctx.runtime.sourceSeen = { network: false, ui: false };
      ctx.runtime.project = sanitizeProject({});
      ctx.setProjectLibrary([]);
      ctx.runtime.projectDraft = { name: "", url: "" };
      ctx.runtime.projectEditorOpen = false;
      ctx.runtime.projectFilterEnabled = false;
      ctx.runtime.balance = null;
      ctx.runtime.balanceSource = "none";
      ctx.runtime.balancePath = "";
      ctx.runtime.lastBalanceAt = null;
      ctx.setMeta({
        balance: null,
        balanceSource: "none",
        balancePath: "",
        lastBalanceAt: null
      });
      ctx.saveHistory();
      ctx.saveSession();
      ctx.saveMeta();
      ctx.saveProjectLibrary();
      ctx.saveProject();
      ctx.saveUiState();
      ctx.renderSoon();
      return getState();
    }
    function setDebug(enabled) {
      ctx.runtime.debug = Boolean(enabled);
      writeJson(DEBUG_KEY, ctx.runtime.debug);
      ctx.renderSoon();
      ctx.addDiagnostic("debug", ctx.runtime.debug ? "enabled" : "disabled");
      if (ctx.runtime.debug) {
        console.info("[AI Token Tracker] Debug is collecting a compact report. Use window.AITokenTracker.copyDebugReport() or the Copy report button.");
      }
      return ctx.runtime.debug;
    }
    function downloadExport() {
      const blob = new Blob([exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "kling-token-tracker-" + localDateKey(Date.now()) + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 1e3);
    }
    function exposeApi() {
      const api = {
        version: VERSION,
        getState,
        resetSession,
        exportJSON,
        setDebug,
        clearHistory,
        forgetBalance,
        resetAll,
        deleteSpendEvent: ctx.deleteSpendEvent,
        undoLastSpend: ctx.undoLastSpend,
        setProject: ctx.setProject,
        clearProject: ctx.clearProject,
        listProjects: ctx.listProjects,
        addProject: ctx.addProject,
        updateProject: ctx.updateProject,
        deleteProject: ctx.deleteProject,
        selectProject: ctx.selectProject,
        getDebugReport,
        copyDebugReport
      };
      const pageWindow = getPageWindow();
      pageWindow.AITokenTracker = api;
      pageWindow.KlingTokenTracker = api;
    }
    return {
      exposeApi,
      getState,
      resetSession,
      exportJSON,
      getDebugReport,
      copyDebugReport,
      createDebugReport,
      clearHistory,
      forgetBalance,
      resetAll,
      setDebug,
      deleteSpendEvent: ctx.deleteSpendEvent,
      undoLastSpend: ctx.undoLastSpend,
      downloadExport
    };
  }
  function formatDebugArg(value) {
    if (value == null) return value;
    if (typeof value === "string") return maybeRedactDebugString(value);
    if (typeof value === "number" || typeof value === "boolean") return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return String(value);
    }
  }

  // src/ui/icons.js
  function iconSvg(name) {
    const icons = {
      "trash-2": [
        '<path d="M3 6h18"/>',
        '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
        '<path d="M19 6l-1 14c0 1-1 2-2 2H8c-1 0-2-1-2-2L5 6"/>',
        '<path d="M10 11v6"/>',
        '<path d="M14 11v6"/>'
      ],
      "clipboard-copy": [
        '<rect x="8" y="8" width="12" height="12" rx="2"/>',
        '<path d="M16 8V6c0-1-1-2-2-2H6C5 4 4 5 4 6v8c0 1 1 2 2 2h2"/>'
      ],
      "rotate-ccw": [
        '<path d="M3 12a9 9 0 1 0 3-6.7"/>',
        '<path d="M3 4v6h6"/>'
      ],
      download: [
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
        '<path d="M7 10l5 5 5-5"/>',
        '<path d="M12 15V3"/>'
      ],
      bug: [
        '<path d="M8 2l1.5 2"/>',
        '<path d="M16 2l-1.5 2"/>',
        '<path d="M9 9h6"/>',
        '<path d="M8 13h8"/>',
        '<path d="M3 13h4"/>',
        '<path d="M17 13h4"/>',
        '<path d="M5 7l3 2"/>',
        '<path d="M19 7l-3 2"/>',
        '<rect x="7" y="4" width="10" height="16" rx="5"/>'
      ],
      x: [
        '<path d="M18 6L6 18"/>',
        '<path d="M6 6l12 12"/>'
      ],
      plus: [
        '<path d="M12 5v14"/>',
        '<path d="M5 12h14"/>'
      ],
      pencil: [
        '<path d="M12 20h9"/>',
        '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'
      ],
      "chevron-down": [
        '<path d="M6 9l6 6 6-6"/>'
      ],
      "chevron-up": [
        '<path d="M18 15l-6-6-6 6"/>'
      ]
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || []).join("") + "</svg>";
  }

  // src/core/settings.js
  function readSheetsFieldsFromForm(root) {
    if (!root || typeof root.querySelector !== "function") return {};
    const enabled = root.querySelector('[data-field="settingSheetsEnabled"]');
    const nickname = root.querySelector('[data-field="settingSheetsNickname"]');
    const url = root.querySelector('[data-field="settingSheetsWebAppUrl"]');
    const token = root.querySelector('[data-field="settingSheetsSecretToken"]');
    const patch = {};
    if (enabled) patch.sheetsEnabled = enabled.checked === true;
    if (nickname) patch.sheetsNickname = nickname.value;
    if (url) patch.sheetsWebAppUrl = url.value;
    if (token) patch.sheetsSecretToken = token.value;
    return patch;
  }
  function applySheetsFieldsFromForm(ctx, root) {
    const patch = readSheetsFieldsFromForm(root);
    if (!Object.keys(patch).length) return;
    ctx.runtime.settings = sanitizeSettings(Object.assign({}, ctx.runtime.settings, patch));
    writeJson(SETTINGS_KEY, ctx.runtime.settings);
  }
  var DEFAULT_SETTINGS = {
    idleOpacity: 0.2,
    summaryEventsCount: 3,
    historyDisplayLimit: 50,
    rememberPanelPosition: false,
    panelWidth: 286,
    sheetsEnabled: true,
    sheetsWebAppUrl: DEFAULT_SHEETS_WEB_APP_URL,
    sheetsSecretToken: DEFAULT_SHEETS_SECRET_TOKEN,
    sheetsNickname: "",
    sheetsLastSyncAt: null,
    sheetsLastError: ""
  };
  var SUMMARY_COUNTS = [1, 3, 5, 10];
  var HISTORY_LIMITS = [25, 50, 100];
  var PANEL_WIDTHS = [260, 286, 320];
  function pickWhitelist(value, allowed, fallback) {
    const num = Number(value);
    return allowed.indexOf(num) >= 0 ? num : fallback;
  }
  function sanitizeSettings(value) {
    const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const idleOpacity = clamp(Number(input.idleOpacity), 0.1, 0.8);
    return {
      idleOpacity: Number.isFinite(idleOpacity) ? idleOpacity : DEFAULT_SETTINGS.idleOpacity,
      summaryEventsCount: pickWhitelist(input.summaryEventsCount, SUMMARY_COUNTS, DEFAULT_SETTINGS.summaryEventsCount),
      historyDisplayLimit: pickWhitelist(input.historyDisplayLimit, HISTORY_LIMITS, DEFAULT_SETTINGS.historyDisplayLimit),
      rememberPanelPosition: input.rememberPanelPosition === true,
      panelWidth: pickWhitelist(input.panelWidth, PANEL_WIDTHS, DEFAULT_SETTINGS.panelWidth),
      sheetsEnabled: input.sheetsEnabled === false ? false : true,
      sheetsWebAppUrl: String(input.sheetsWebAppUrl || "").trim().slice(0, 500) || DEFAULT_SHEETS_WEB_APP_URL,
      sheetsSecretToken: String(input.sheetsSecretToken || "").trim().slice(0, 200) || DEFAULT_SHEETS_SECRET_TOKEN,
      sheetsNickname: String(input.sheetsNickname || "").trim().slice(0, 80),
      sheetsLastSyncAt: input.sheetsLastSyncAt == null || input.sheetsLastSyncAt === "" ? null : Number(input.sheetsLastSyncAt) || null,
      sheetsLastError: String(input.sheetsLastError || "").slice(0, 200)
    };
  }
  function saveSettings(ctx) {
    writeJson(SETTINGS_KEY, ctx.runtime.settings);
  }
  function applyPanelSettings(ctx) {
    const host = ctx.runtime.panelHost;
    const shadowRoot = ctx.runtime.shadowRoot;
    if (!host || !shadowRoot) return;
    const settings = ctx.runtime.settings || DEFAULT_SETTINGS;
    host.style.setProperty("--ktt-idle-opacity", String(settings.idleOpacity));
    const panel = shadowRoot.querySelector(".panel");
    if (panel) {
      panel.style.width = settings.panelWidth + "px";
    }
  }
  function needsSheetsNickname(settings) {
    const value = settings || {};
    return value.sheetsEnabled !== false && !String(value.sheetsNickname || "").trim();
  }
  function isLegacySheetsWebAppUrl(url) {
    const value = String(url || "").trim().replace(/\/dev$/i, "/exec");
    return LEGACY_SHEETS_WEB_APP_URLS.indexOf(value) >= 0;
  }
  function loadSettings() {
    const raw = readJson(SETTINGS_KEY, {});
    const settings = sanitizeSettings(raw);
    const storedUrl = String(raw.sheetsWebAppUrl || "").trim();
    let migrated = false;
    if (!storedUrl || isLegacySheetsWebAppUrl(storedUrl)) {
      settings.sheetsWebAppUrl = DEFAULT_SHEETS_WEB_APP_URL;
      migrated = migrated || storedUrl !== "" && storedUrl !== DEFAULT_SHEETS_WEB_APP_URL;
    }
    if (!String(raw.sheetsSecretToken || "").trim()) {
      settings.sheetsSecretToken = DEFAULT_SHEETS_SECRET_TOKEN;
    }
    if (raw.sheetsEnabled !== false) {
      settings.sheetsEnabled = true;
    }
    if (migrated) {
      writeJson(SETTINGS_KEY, settings);
    }
    return settings;
  }

  // src/ui/panel.js
  function sanitizePanel(value, rememberPosition) {
    const result = {
      collapsed: value && value.collapsed === true
    };
    if (rememberPosition) {
      const right = Number(value && value.right);
      const bottom = Number(value && value.bottom);
      if (Number.isFinite(right) && right >= 8) result.right = right;
      if (Number.isFinite(bottom) && bottom >= 8) result.bottom = bottom;
    }
    return result;
  }
  function createPanelModule(ctx) {
    function getPanelMount() {
      return document.documentElement || document.body || null;
    }
    function createPanel() {
      const mount = getPanelMount();
      if (!mount) return;
      if (ctx.runtime.panelHost) {
        if (!ctx.runtime.panelHost.isConnected) {
          mount.appendChild(ctx.runtime.panelHost);
        }
        return;
      }
      const savedPanel = sanitizePanel(
        readJson(PANEL_KEY, {}),
        ctx.runtime.settings && ctx.runtime.settings.rememberPanelPosition === true
      );
      ctx.runtime.panelCollapsed = savedPanel.collapsed === true;
      const host = document.createElement("div");
      host.setAttribute("data-ktt-root", "1");
      Object.assign(host.style, {
        position: "fixed",
        right: (savedPanel.right != null ? savedPanel.right : 16) + "px",
        bottom: (savedPanel.bottom != null ? savedPanel.bottom : 16) + "px",
        zIndex: "2147483647",
        font: "13px/1.35 Arial, sans-serif"
      });
      host.style.setProperty("--ktt-idle-opacity", String(ctx.runtime.settings && ctx.runtime.settings.idleOpacity || 0.2));
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = [
        "<style>",
        ":host{display:block;position:relative;--ktt-idle-opacity:.2}",
        ":host(:hover) .panel,.panel.undo-active{opacity:1}",
        ".panel{position:relative;width:286px;color:#f6f7f8;background:rgba(18,20,24,.92);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px rgba(0,0,0,.26);border-radius:8px;overflow:hidden;font:13px/1.35 Arial,sans-serif;backdrop-filter:blur(8px);opacity:var(--ktt-idle-opacity);transition:opacity .2s ease}",
        ".panel.collapsed .panelContent{display:none}",
        ".panelContent{position:relative}",
        ".header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:rgba(255,255,255,.06);user-select:none;min-height:28px;cursor:move}",
        ".headerDefault{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;flex:1}",
        ".panel.undo-active .header{background:rgba(45,108,223,.14)}",
        ".panel.undo-active .headerDefault{display:none}",
        ".headerDrag{display:flex;align-items:center;gap:8px;min-width:0;flex:1;cursor:move}",
        ".headerControls{display:flex;align-items:center;gap:6px;flex-shrink:0}",
        ".headerBtn{width:28px;height:28px;flex-shrink:0;cursor:pointer}",
        ".headerBtn svg{width:15px;height:15px}",
        ".title{font-weight:700;letter-spacing:0}",
        ".versionBtn{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#d8dde6;border-radius:999px;padding:2px 7px;font:11px Arial,sans-serif;cursor:pointer;white-space:nowrap}",
        ".versionBtn:hover{background:rgba(255,255,255,.14);color:#fff}",
        ".badge{font-size:11px;border-radius:999px;padding:2px 7px;background:#2d6cdf;color:#fff;text-transform:uppercase}",
        ".body{padding:10px 12px 12px}",
        ".tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:8px 10px 0}",
        ".tab{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#bfc6d1;border-radius:6px;padding:6px 8px;font:12px Arial,sans-serif;cursor:pointer}",
        ".tab.active{background:#2d6cdf;border-color:#2d6cdf;color:#fff}",
        ".tabPanel{display:none}",
        ".tabPanel.active{display:block}",
        ".grid{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:baseline}",
        ".label{color:#aeb6c2}",
        ".value{font-weight:700;text-align:right;color:#fff}",
        ".muted{color:#aeb6c2}",
        ".events{margin-top:10px;border-top:1px solid rgba(255,255,255,.12);padding-top:8px;display:flex;flex-direction:column;gap:5px;max-height:138px;overflow:auto}",
        ".event{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;color:#d8dde6;font-size:12px}",
        ".history{margin-top:10px;display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto}",
        ".histItem{border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:8px;background:rgba(255,255,255,.04)}",
        ".histTop{display:flex;justify-content:space-between;gap:8px;color:#fff;font-weight:700;font-size:12px}",
        ".histSpendMain{min-width:0;flex:1;display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
        ".histTime{display:inline-flex;align-items:center;border:1px solid rgba(142,182,255,.28);background:rgba(45,108,223,.18);color:#d6e4ff;border-radius:999px;padding:1px 6px;font-size:11px;line-height:1.35;font-weight:700}",
        ".histAmount{color:#fff;font-weight:800}",
        ".histSpendService{color:#d8dde6;white-space:nowrap}",
        ".histDelete{width:24px;height:24px;flex-shrink:0;opacity:.72}",
        ".histDelete:hover{opacity:1}",
        ".histMeta{margin-top:5px;color:#bfc6d1;font-size:11px;display:flex;flex-wrap:wrap;gap:5px}",
        ".pill{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1px 6px;background:rgba(255,255,255,.05)}",
        ".raw{margin-top:5px;color:#8f98a6;font-size:11px;word-break:break-word}",
        ".projectBox{margin:0;padding:8px 10px 6px;border-bottom:1px solid rgba(255,255,255,.12);display:grid;gap:6px}",
        ".projectCompactRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;align-items:center}",
        ".projectCompactTools{display:flex;gap:2px;align-items:center;flex-shrink:0}",
        ".projectCompactRow .select.field{padding:5px 22px 5px 8px;font-size:11px;min-height:28px}",
        ".projectCompactTools .miniBtn{width:24px;height:24px;flex-shrink:0}",
        ".projectEditor{display:grid;gap:6px}",
        ".projectBox.compact .projectEditor{display:none}",
        ".projectFields{display:grid;gap:6px}",
        ".projectActionsRow{display:grid;grid-template-columns:1fr auto;gap:6px}",
        ".projectActionsRow button{font-weight:600}",
        ".projectHint{color:#8f98a6;font-size:11px;line-height:1.35}",
        ".projectFilterRow{display:none;grid-template-columns:1fr auto;gap:6px;align-items:center;font-size:11px;color:#bfc6d1}",
        ".projectFilterRow.visible{display:grid}",
        ".projectBox.filterOn{border-bottom-color:#2d6cdf}",
        ".projectFilter{display:inline-flex;align-items:center;gap:5px;cursor:pointer;user-select:none}",
        ".projectFilter input{width:13px;height:13px;margin:0;cursor:pointer}",
        ".projectMiniStat{color:#8eb6ff;font-weight:700;white-space:nowrap;font-size:11px}",
        ".projectGrid{margin-top:8px;border-top:1px solid rgba(255,255,255,.12);padding-top:8px}",
        ".projectGrid .label{color:#8eb6ff}",
        ".projectBreakdown{grid-column:1/-1;display:grid;gap:4px;margin-top:2px}",
        ".projectBreakdownRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;color:#d8dde6;font-size:12px}",
        ".projectBreakdownName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".projectBreakdownValue{font-weight:700;color:#fff;text-align:right}",
        ".projectBreakdownEmpty{color:#8f98a6;font-size:11px}",
        ".histHeader{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;color:#bfc6d1;margin-bottom:6px}",
        ".histHeader strong{color:#fff}",
        ".histHeaderText{min-width:0}",
        ".histStats{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;flex-shrink:0}",
        ".histStat{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1px 6px;background:rgba(255,255,255,.05);white-space:nowrap}",
        ".histShowAll{appearance:none;border:none;background:none;color:#8eb6ff;padding:0;font:11px Arial,sans-serif;cursor:pointer;text-decoration:underline}",
        ".histItem--matched{border-color:rgba(45,108,223,.45);background:rgba(45,108,223,.08)}",
        ".select.field{cursor:pointer;padding-right:24px}",
        ".field{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;border-radius:6px;padding:7px 8px;font:12px Arial,sans-serif;outline:none}",
        ".field:focus{border-color:#2d6cdf;background:rgba(255,255,255,.09)}",
        ".miniBtn{width:26px;height:26px}",
        ".miniBtn svg{width:14px;height:14px}",
        ".dot{width:7px;height:7px;border-radius:50%;background:#28b67a}",
        ".source{color:#aeb6c2;text-transform:uppercase;font-size:10px}",
        ".actions{display:flex;gap:8px;margin-top:10px;align-items:center;justify-content:space-between}",
        "button{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;border-radius:6px;padding:6px 8px;font:12px Arial,sans-serif;cursor:pointer;min-width:0}",
        "button:hover{background:rgba(255,255,255,.14)}",
        "button.active{background:#2d6cdf;border-color:#2d6cdf}",
        ".iconBtn{position:relative;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:7px}",
        ".iconBtn svg{width:17px;height:17px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}",
        ".iconBtn[data-tooltip]::after{content:attr(data-tooltip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);padding:5px 7px;border-radius:5px;background:rgba(8,10,14,.96);border:1px solid rgba(255,255,255,.14);color:#fff;font-size:11px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s, transform .12s;box-shadow:0 4px 14px rgba(0,0,0,.28);z-index:2}",
        '.iconBtn[data-tooltip]::before{content:"";position:absolute;left:50%;bottom:calc(100% + 3px);transform:translateX(-50%);border:5px solid transparent;border-top-color:rgba(8,10,14,.96);opacity:0;pointer-events:none;transition:opacity .12s;z-index:2}',
        ".iconBtn[data-tooltip]:hover::after{opacity:1;transform:translateX(-50%) translateY(-2px)}",
        ".iconBtn[data-tooltip]:hover::before{opacity:1}",
        ".empty{color:#aeb6c2;font-size:12px}",
        ".settingsForm{display:grid;gap:4px}",
        ".acc{border:1px solid rgba(255,255,255,.1);border-radius:6px;overflow:hidden;background:rgba(255,255,255,.02)}",
        ".accHead{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:5px 8px;background:rgba(255,255,255,.05);border:none;color:#e8ecf2;font:11px/1.2 Arial,sans-serif;cursor:pointer;text-align:left}",
        ".accTitle{font-weight:700}",
        ".accMeta{color:#8f98a6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}",
        ".accChevron{width:12px;height:12px;opacity:.75;transition:transform .15s ease;display:inline-flex}",
        ".accChevron svg{width:12px;height:12px;stroke:currentColor}",
        ".acc.open .accChevron{transform:rotate(180deg)}",
        ".accBody{display:none;padding:6px 8px 7px;gap:5px}",
        ".acc.open .accBody{display:grid}",
        ".settingsCompactRow{display:grid;grid-template-columns:72px minmax(0,1fr);gap:4px 6px;align-items:center}",
        ".settingsLabel{color:#aeb6c2;font-size:10px}",
        ".settingsInline{display:flex;align-items:center;gap:6px;min-width:0}",
        ".settingsValue{color:#fff;font-weight:700;font-size:10px;min-width:28px;text-align:right}",
        ".settingsCompactRow .field{padding:4px 6px;font-size:11px;min-height:24px}",
        '.settingsCompactRow input[type="range"]{padding:0;min-height:0;height:18px}',
        ".settingsCheck{display:inline-flex;align-items:center;gap:5px;color:#d8dde6;font-size:10px;cursor:pointer;user-select:none;grid-column:1/-1}",
        ".settingsCheck input{width:12px;height:12px;margin:0;cursor:pointer}",
        ".settingsStatus{color:#9aa3b2;font-size:10px;line-height:1.3;word-break:break-word;grid-column:1/-1}",
        ".settingsActions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;grid-column:1/-1}",
        ".settingsActions button,.settingsReset{padding:4px 6px;font-size:10px}",
        ".settingsReset{margin-top:2px}",
        ".versionList{display:grid;gap:7px}",
        ".versionItem{display:grid;gap:3px;border-top:1px solid rgba(255,255,255,.08);padding-top:7px}",
        ".versionItem:first-child{border-top:none;padding-top:0}",
        ".versionTop{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#fff;font-weight:700;font-size:11px}",
        ".versionDate{color:#8f98a6;font-weight:400}",
        ".versionChanges{margin:0;padding-left:14px;color:#bfc6d1;font-size:10px;line-height:1.35}",
        ".undoToast{display:none;width:100%;grid-template-columns:auto minmax(0,1fr) auto auto;gap:6px;align-items:center}",
        ".panel.undo-active .undoToast{display:grid}",
        ".undoIcon{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(45,108,223,.32);color:#fff}",
        ".undoIcon svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}",
        ".undoText{display:grid;gap:0;min-width:0;color:#d8dde6;font-size:10px;line-height:1.2}",
        ".undoText strong{color:#fff;font-size:11px;line-height:1.15}",
        ".undoMeta{color:#bfc6d1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".undoAction{padding:4px 8px;font-size:11px;font-weight:700;border-radius:999px;background:#2d6cdf;border-color:#2d6cdf}",
        ".undoClose{width:22px;height:22px;border-radius:999px}",
        ".sheetsNicknameWarn{padding:5px 10px;background:rgba(242,184,75,.14);border-bottom:1px solid rgba(242,184,75,.28);color:#f2d49b;font-size:10px;line-height:1.35;cursor:pointer}",
        ".sheetsNicknameWarn[hidden]{display:none}",
        '.tabPanel[data-panel="settings"]{max-height:260px;overflow:auto;padding-top:2px}',
        "</style>",
        '<div class="panel' + (ctx.runtime.panelCollapsed ? " collapsed" : "") + '">',
        '  <div class="header" data-drag-handle>',
        '    <div class="headerDefault" data-field="headerDefault">',
        '      <div class="headerDrag">',
        '        <div class="title">AITT</div>',
        '        <div class="badge" data-field="serviceName">none</div>',
        "      </div>",
        '      <div class="headerControls">',
        '        <button type="button" class="versionBtn" data-action="showVersions" data-field="versionBadge" aria-label="Show version history">v-</button>',
        '        <button type="button" class="iconBtn headerBtn" data-action="toggleCollapse" data-tooltip="Collapse panel" aria-label="Collapse panel">' + iconSvg(ctx.runtime.panelCollapsed ? "chevron-up" : "chevron-down") + "</button>",
        "      </div>",
        "    </div>",
        '    <div class="undoToast" data-field="undoToast" aria-hidden="true">',
        '      <span class="undoIcon">' + iconSvg("rotate-ccw") + "</span>",
        '      <span class="undoText"><strong>Recorded</strong><span class="undoMeta" data-field="undoMeta"></span></span>',
        '      <button type="button" class="undoAction" data-action="undoSpend">Undo</button>',
        '      <button type="button" class="iconBtn undoClose" data-action="closeUndoToast" data-tooltip="Close" aria-label="Close undo">' + iconSvg("x") + "</button>",
        "    </div>",
        "  </div>",
        '  <div class="panelContent">',
        '  <div class="projectBox compact" data-field="projectBox">',
        '    <div class="projectCompactRow">',
        '      <select class="field select" data-field="projectSelect" aria-label="Select project"></select>',
        '      <div class="projectCompactTools">',
        '        <button type="button" class="iconBtn miniBtn" data-action="editProject" data-tooltip="Edit project" aria-label="Edit project">' + iconSvg("pencil") + "</button>",
        '        <button type="button" class="iconBtn miniBtn" data-action="newProject" data-tooltip="New project" aria-label="New project">' + iconSvg("plus") + "</button>",
        '        <button type="button" class="iconBtn miniBtn" data-action="deleteProject" data-tooltip="Delete project" aria-label="Delete project">' + iconSvg("trash-2") + "</button>",
        '        <button type="button" class="iconBtn miniBtn" data-action="clearProject" data-tooltip="Clear active project" aria-label="Clear active project">' + iconSvg("x") + "</button>",
        "      </div>",
        "    </div>",
        '    <div class="projectFilterRow" data-field="projectFilterRow">',
        '      <label class="projectFilter">',
        '        <input type="checkbox" data-field="projectFilterToggle">',
        "        <span>Only this project</span>",
        "      </label>",
        '      <span class="projectMiniStat" data-field="projectMiniStat"></span>',
        "    </div>",
        '    <div class="projectEditor" data-field="projectEditor">',
        '      <div class="projectFields">',
        '        <input class="field" data-field="projectName" type="text" placeholder="Task name">',
        '        <input class="field" data-field="projectUrl" type="url" placeholder="Task URL">',
        "      </div>",
        '      <div class="projectActionsRow">',
        '        <button type="button" data-action="saveProject">Save to list</button>',
        '        <button type="button" data-action="cancelProjectEdit">Cancel</button>',
        "      </div>",
        '      <div class="projectHint" data-field="projectHint">Select a saved project or create a new one.</div>',
        "    </div>",
        "  </div>",
        '  <div class="sheetsNicknameWarn" data-field="sheetsNicknameWarn" hidden>\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 nickname \u0432 Settings \u2192 Google Sheets</div>',
        '  <div class="tabs">',
        '    <button type="button" class="tab" data-tab="summary">Summary</button>',
        '    <button type="button" class="tab" data-tab="history">History</button>',
        '    <button type="button" class="tab" data-tab="settings">Settings</button>',
        "  </div>",
        '  <div class="body">',
        '   <div class="tabPanel" data-panel="summary">',
        '    <div class="grid">',
        '      <div class="label">Balance</div><div class="value" data-field="balance">-</div>',
        "    </div>",
        '    <div class="projectGrid grid" data-field="projectGrid" hidden>',
        '      <div class="label">Project total</div><div class="value" data-field="projectTotal">0</div>',
        '      <div class="projectBreakdown" data-field="projectBreakdown"></div>',
        "    </div>",
        '    <div class="events" data-field="events"></div>',
        "   </div>",
        '   <div class="tabPanel" data-panel="history">',
        '    <div class="histHeader" data-field="historyHeader"></div>',
        '    <div class="history" data-field="history"></div>',
        "   </div>",
        '   <div class="tabPanel" data-panel="settings">',
        '    <div class="settingsForm">',
        '      <div class="acc open" data-acc="panel">',
        '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
        '          <span class="accTitle">Panel</span>',
        '          <span class="accMeta" data-field="settingAccMetaPanel">20% \xB7 286px</span>',
        '          <span class="accChevron">' + iconSvg("chevron-down") + "</span>",
        "        </button>",
        '        <div class="accBody">',
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">Opacity</span>',
        '            <div class="settingsInline">',
        '              <input class="field" data-field="settingIdleOpacity" type="range" min="10" max="80" step="5">',
        '              <span class="settingsValue" data-field="settingIdleOpacityValue">20%</span>',
        "            </div>",
        "          </div>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">Width</span>',
        '            <select class="field select" data-field="settingPanelWidth">',
        '              <option value="260">260 px</option>',
        '              <option value="286">286 px</option>',
        '              <option value="320">320 px</option>',
        "            </select>",
        "          </div>",
        '          <label class="settingsCheck">',
        '            <input type="checkbox" data-field="settingRememberPosition">',
        "            <span>Remember position</span>",
        "          </label>",
        "        </div>",
        "      </div>",
        '      <div class="acc" data-acc="display">',
        '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
        '          <span class="accTitle">Display</span>',
        '          <span class="accMeta" data-field="settingAccMetaDisplay">3 \xB7 50</span>',
        '          <span class="accChevron">' + iconSvg("chevron-down") + "</span>",
        "        </button>",
        '        <div class="accBody">',
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">Summary</span>',
        '            <select class="field select" data-field="settingSummaryEvents">',
        '              <option value="1">1</option>',
        '              <option value="3">3</option>',
        '              <option value="5">5</option>',
        '              <option value="10">10</option>',
        "            </select>",
        "          </div>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">History</span>',
        '            <select class="field select" data-field="settingHistoryLimit">',
        '              <option value="25">25</option>',
        '              <option value="50">50</option>',
        '              <option value="100">100</option>',
        "            </select>",
        "          </div>",
        "        </div>",
        "      </div>",
        '      <div class="acc" data-acc="versions">',
        '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
        '          <span class="accTitle">Versions</span>',
        '          <span class="accMeta" data-field="settingAccMetaVersions">v-</span>',
        '          <span class="accChevron">' + iconSvg("chevron-down") + "</span>",
        "        </button>",
        '        <div class="accBody">',
        '          <div class="versionList" data-field="versionHistory"></div>',
        "        </div>",
        "      </div>",
        '      <div class="acc' + (needsSheetsNickname(ctx.runtime.settings) ? " open" : "") + '" data-acc="sheets">',
        '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
        '          <span class="accTitle">Google Sheets</span>',
        '          <span class="accMeta" data-field="settingAccMetaSheets">off</span>',
        '          <span class="accChevron">' + iconSvg("chevron-down") + "</span>",
        "        </button>",
        '        <div class="accBody">',
        '          <label class="settingsCheck">',
        '            <input type="checkbox" data-field="settingSheetsEnabled">',
        "            <span>Sync spends</span>",
        "          </label>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">Nickname</span>',
        '            <input class="field" data-field="settingSheetsNickname" type="text" placeholder="Team name">',
        "          </div>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">Token</span>',
        '            <input class="field" data-field="settingSheetsSecretToken" type="password" placeholder="Secret">',
        "          </div>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">URL</span>',
        '            <input class="field" data-field="settingSheetsWebAppUrl" type="url" placeholder=".../exec">',
        "          </div>",
        '          <div class="settingsStatus" data-field="settingSheetsStatus">Sheets sync is off.</div>',
        '          <div class="settingsActions">',
        '            <button type="button" data-action="testSheetsConnection">Test</button>',
        '            <button type="button" data-action="retrySheetsSync">Retry</button>',
        '            <button type="button" data-action="refreshSheetsData">Refresh</button>',
        "          </div>",
        "        </div>",
        "      </div>",
        '      <button type="button" class="settingsReset" data-action="resetSettings">Reset defaults</button>',
        "    </div>",
        "   </div>",
        '    <div class="actions">',
        '      <button type="button" class="iconBtn" data-action="resetAll" data-tooltip="Reset all" aria-label="Reset all">' + iconSvg("trash-2") + "</button>",
        '      <button type="button" class="iconBtn" data-action="copyReport" data-tooltip="Copy report" aria-label="Copy report">' + iconSvg("clipboard-copy") + "</button>",
        '      <button type="button" class="iconBtn" data-action="reset" data-tooltip="Reset session" aria-label="Reset session">' + iconSvg("rotate-ccw") + "</button>",
        '      <button type="button" class="iconBtn" data-action="export" data-tooltip="Export JSON" aria-label="Export JSON">' + iconSvg("download") + "</button>",
        '      <button type="button" class="iconBtn" data-action="debug" data-tooltip="Collect debug report" aria-label="Collect debug report">' + iconSvg("bug") + "</button>",
        "    </div>",
        "  </div>",
        "</div>"
      ].join("");
      shadow.querySelector('[data-action="reset"]').addEventListener("click", function() {
        ctx.resetSession();
      });
      shadow.querySelector('[data-action="resetAll"]').addEventListener("click", function() {
        ctx.resetAll();
      });
      shadow.querySelector('[data-action="copyReport"]').addEventListener("click", function() {
        ctx.copyDebugReport();
      });
      shadow.querySelector('[data-action="export"]').addEventListener("click", function() {
        ctx.downloadExport();
      });
      shadow.querySelector('[data-action="debug"]').addEventListener("click", function() {
        ctx.setDebug(!ctx.runtime.debug);
      });
      shadow.querySelector('[data-action="undoSpend"]').addEventListener("click", function() {
        ctx.undoLastSpend();
      });
      shadow.querySelector('[data-action="closeUndoToast"]').addEventListener("click", function() {
        ctx.hideUndoSpend();
      });
      shadow.querySelector('[data-action="showVersions"]').addEventListener("click", function(event) {
        event.preventDefault();
        event.stopPropagation();
        ctx.setActiveTab("settings");
        window.setTimeout(function() {
          const versionsAcc = shadow.querySelector('[data-acc="versions"]');
          if (versionsAcc) versionsAcc.classList.add("open");
        }, 60);
      });
      shadow.querySelector('[data-action="clearProject"]').addEventListener("click", function() {
        ctx.clearProject();
      });
      shadow.querySelector('[data-action="editProject"]').addEventListener("click", function() {
        ctx.openProjectEditor();
      });
      shadow.querySelector('[data-action="cancelProjectEdit"]').addEventListener("click", function() {
        ctx.syncProjectDraftFromActive();
        ctx.closeProjectEditor();
      });
      shadow.querySelector('[data-action="newProject"]').addEventListener("click", function() {
        ctx.beginNewProjectForm(shadow);
      });
      shadow.querySelector('[data-action="deleteProject"]').addEventListener("click", function() {
        ctx.deleteSelectedProject(shadow);
      });
      shadow.querySelector('[data-action="saveProject"]').addEventListener("click", function() {
        ctx.saveProjectFromForm(shadow);
      });
      shadow.querySelector('[data-field="projectSelect"]').addEventListener("change", function(event) {
        const id = event.currentTarget.value;
        if (!id) {
          ctx.clearProject();
          return;
        }
        ctx.selectProject(id);
      });
      shadow.querySelector('[data-field="projectName"]').addEventListener("input", function(event) {
        ctx.syncProjectDraftFromInputs(event.currentTarget.getRootNode());
      });
      shadow.querySelector('[data-field="projectUrl"]').addEventListener("input", function(event) {
        ctx.syncProjectDraftFromInputs(event.currentTarget.getRootNode());
      });
      shadow.querySelector('[data-field="projectFilterToggle"]').addEventListener("change", function(event) {
        ctx.setProjectFilterEnabled(event.currentTarget.checked);
      });
      shadow.querySelector('[data-action="toggleCollapse"]').addEventListener("click", function(event) {
        event.stopPropagation();
        setPanelCollapsed(!ctx.runtime.panelCollapsed);
      });
      Array.from(shadow.querySelectorAll("[data-tab]")).forEach(function(button) {
        button.addEventListener("click", function() {
          ctx.setActiveTab(button.getAttribute("data-tab"));
        });
      });
      Array.from(shadow.querySelectorAll('[data-action="toggleSettingsAcc"]')).forEach(function(button) {
        button.addEventListener("click", function() {
          const acc = button.closest("[data-acc]");
          if (acc) acc.classList.toggle("open");
        });
      });
      const nicknameWarn = shadow.querySelector('[data-field="sheetsNicknameWarn"]');
      if (nicknameWarn) {
        nicknameWarn.addEventListener("click", function() {
          ctx.setActiveTab("settings");
          const sheetsAcc = shadow.querySelector('[data-acc="sheets"]');
          if (sheetsAcc) sheetsAcc.classList.add("open");
        });
      }
      shadow.querySelector('[data-field="settingIdleOpacity"]').addEventListener("input", function(event) {
        const percent = Number(event.currentTarget.value);
        ctx.updateSetting("idleOpacity", percent / 100);
      });
      shadow.querySelector('[data-field="settingSummaryEvents"]').addEventListener("change", function(event) {
        ctx.updateSetting("summaryEventsCount", Number(event.currentTarget.value));
      });
      shadow.querySelector('[data-field="settingHistoryLimit"]').addEventListener("change", function(event) {
        ctx.updateSetting("historyDisplayLimit", Number(event.currentTarget.value));
      });
      shadow.querySelector('[data-field="settingPanelWidth"]').addEventListener("change", function(event) {
        ctx.updateSetting("panelWidth", Number(event.currentTarget.value));
      });
      shadow.querySelector('[data-field="settingRememberPosition"]').addEventListener("change", function(event) {
        ctx.updateSetting("rememberPanelPosition", event.currentTarget.checked === true);
      });
      shadow.querySelector('[data-field="settingSheetsEnabled"]').addEventListener("change", function(event) {
        ctx.updateSetting("sheetsEnabled", event.currentTarget.checked === true);
      });
      shadow.querySelector('[data-field="settingSheetsNickname"]').addEventListener("change", function(event) {
        ctx.updateSetting("sheetsNickname", event.currentTarget.value);
      });
      shadow.querySelector('[data-field="settingSheetsWebAppUrl"]').addEventListener("change", function(event) {
        ctx.updateSetting("sheetsWebAppUrl", event.currentTarget.value);
      });
      shadow.querySelector('[data-field="settingSheetsSecretToken"]').addEventListener("change", function(event) {
        ctx.updateSetting("sheetsSecretToken", event.currentTarget.value);
      });
      shadow.querySelector('[data-action="testSheetsConnection"]').addEventListener("click", function() {
        applySheetsFieldsFromForm(ctx, shadow);
        const statusEl = shadow.querySelector('[data-field="settingSheetsStatus"]');
        const testButton = shadow.querySelector('[data-action="testSheetsConnection"]');
        if (statusEl) statusEl.textContent = "Testing connection...";
        if (testButton) testButton.disabled = true;
        const runTest = typeof ctx.testSheetsConnection === "function" ? ctx.testSheetsConnection() : Promise.reject(new Error("sheets module not ready"));
        runTest.then(function() {
          if (statusEl) statusEl.textContent = "Connection OK";
        }).catch(function() {
        }).finally(function() {
          if (testButton) testButton.disabled = false;
          ctx.renderSoon();
        });
      });
      shadow.querySelector('[data-action="retrySheetsSync"]').addEventListener("click", function() {
        applySheetsFieldsFromForm(ctx, shadow);
        ctx.retryFailedSyncs().then(function() {
          ctx.renderSoon();
        });
      });
      shadow.querySelector('[data-action="refreshSheetsData"]').addEventListener("click", function() {
        applySheetsFieldsFromForm(ctx, shadow);
        const statusEl = shadow.querySelector('[data-field="settingSheetsStatus"]');
        const refreshButton = shadow.querySelector('[data-action="refreshSheetsData"]');
        if (statusEl) statusEl.textContent = "Refreshing shared data...";
        if (refreshButton) refreshButton.disabled = true;
        Promise.resolve(ctx.pullEventsFromSheets()).catch(function() {
        }).then(function() {
          if (refreshButton) refreshButton.disabled = false;
          ctx.renderSoon();
        });
      });
      shadow.querySelector('[data-action="resetSettings"]').addEventListener("click", function() {
        ctx.resetSettings();
      });
      installPanelDrag(host, shadow.querySelector(".header"));
      mount.appendChild(host);
      ctx.runtime.panelHost = host;
      ctx.runtime.shadowRoot = shadow;
      applyPanelSettings(ctx);
    }
    function setPanelCollapsed(collapsed) {
      ctx.runtime.panelCollapsed = collapsed === true;
      if (!ctx.runtime.shadowRoot) return;
      const panel = ctx.runtime.shadowRoot.querySelector(".panel");
      const button = ctx.runtime.shadowRoot.querySelector('[data-action="toggleCollapse"]');
      if (panel) panel.classList.toggle("collapsed", ctx.runtime.panelCollapsed);
      if (button) {
        button.innerHTML = iconSvg(ctx.runtime.panelCollapsed ? "chevron-up" : "chevron-down");
        const label = ctx.runtime.panelCollapsed ? "Expand panel" : "Collapse panel";
        button.setAttribute("data-tooltip", label);
        button.setAttribute("aria-label", label);
      }
      savePanelGeometry();
    }
    function savePanelGeometry(host) {
      const panelHost = host || ctx.runtime.panelHost;
      const payload = {
        collapsed: ctx.runtime.panelCollapsed === true
      };
      if (ctx.runtime.settings && ctx.runtime.settings.rememberPanelPosition === true && panelHost) {
        const right = parseFloat(panelHost.style.right);
        const bottom = parseFloat(panelHost.style.bottom);
        if (Number.isFinite(right)) payload.right = right;
        if (Number.isFinite(bottom)) payload.bottom = bottom;
      }
      writeJson(PANEL_KEY, payload);
    }
    function installPanelDrag(host, handle) {
      if (!host || !handle) return;
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startRight = 0;
      let startBottom = 0;
      handle.addEventListener("pointerdown", function(event) {
        if (event.target && event.target.closest && event.target.closest('button, input, select, textarea, a, [role="button"]')) {
          return;
        }
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        const rect = host.getBoundingClientRect();
        startRight = Math.max(8, window.innerWidth - rect.right);
        startBottom = Math.max(8, window.innerHeight - rect.bottom);
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener("pointermove", function(event) {
        if (!dragging) return;
        const nextRight = clamp(startRight - (event.clientX - startX), 8, Math.max(8, window.innerWidth - 80));
        const nextBottom = clamp(startBottom - (event.clientY - startY), 8, Math.max(8, window.innerHeight - 60));
        host.style.right = nextRight + "px";
        host.style.bottom = nextBottom + "px";
      });
      handle.addEventListener("pointerup", function(event) {
        if (!dragging) return;
        dragging = false;
        try {
          handle.releasePointerCapture(event.pointerId);
        } catch (_) {
        }
        savePanelGeometry(host);
      });
    }
    function ensurePanelAttached() {
      const mount = getPanelMount();
      if (!mount) return;
      if (!ctx.runtime.panelHost) {
        createPanel();
        return;
      }
      if (!ctx.runtime.panelHost.isConnected) {
        mount.appendChild(ctx.runtime.panelHost);
        ctx.addDiagnostic("re-attached panel after dom removal");
        ctx.renderSoon();
      }
    }
    function installPanelPersistence() {
      if (ctx.runtime.panelPersistenceInstalled) return;
      ctx.runtime.panelPersistenceInstalled = true;
      ensurePanelAttached();
      if (typeof MutationObserver === "function" && document.body) {
        ctx.runtime.panelPersistenceObserver = new MutationObserver(function() {
          if (ctx.runtime.panelReattachTimer) return;
          ctx.runtime.panelReattachTimer = window.setTimeout(function() {
            ctx.runtime.panelReattachTimer = null;
            ensurePanelAttached();
          }, 50);
        });
        ctx.runtime.panelPersistenceObserver.observe(document.body, {
          childList: true,
          subtree: false
        });
      }
      ctx.runtime.panelEnsureInterval = window.setInterval(ensurePanelAttached, 2e3);
    }
    function initDomFeatures() {
      installPanelPersistence();
      ctx.installClickTracker();
      ctx.installUiObserver();
      ctx.scheduleUiScan(500);
      if (typeof ctx.notifyMissingSheetsNickname === "function") {
        ctx.notifyMissingSheetsNickname();
      }
      ctx.renderSoon();
    }
    function bootWhenBodyExists() {
      if (document.body) {
        initDomFeatures();
        return;
      }
      const timer = window.setInterval(function() {
        if (!document.body) return;
        window.clearInterval(timer);
        initDomFeatures();
      }, 50);
    }
    return {
      getPanelMount,
      createPanel,
      setPanelCollapsed,
      savePanelGeometry,
      installPanelDrag,
      ensurePanelAttached,
      installPanelPersistence,
      initDomFeatures,
      bootWhenBodyExists
    };
  }
  function sanitizeUiState(value) {
    const tab = value && value.activeTab;
    const activeTab = tab === "history" || tab === "settings" ? tab : "summary";
    return {
      activeTab,
      projectFilterEnabled: value && value.projectFilterEnabled === true
    };
  }
  function saveUiState(ctx) {
    writeJson(UI_KEY, {
      activeTab: ctx.runtime.activeTab,
      projectFilterEnabled: ctx.runtime.projectFilterEnabled === true
    });
  }

  // src/ui/render.js
  function formatCredit(value) {
    if (!isFiniteCredit(Number(value))) return "-";
    const rounded = normalizeCredit(value);
    return rounded.toLocaleString(void 0, {
      maximumFractionDigits: 3
    });
  }
  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_) {
      return "";
    }
  }
  function createRender(ctx) {
    function getDisplaySource() {
      if (ctx.runtime.sourceSeen.network && ctx.runtime.sourceSeen.ui) return "mixed";
      if (ctx.runtime.sourceSeen.network) return "network";
      if (ctx.runtime.sourceSeen.ui) return "ui";
      return ctx.runtime.balanceSource || "none";
    }
    function getTodayTotal2() {
      return getTodayTotal(ctx.getHistory(), ctx.getActiveAdapter().id);
    }
    function hasDisplayMetadata(event) {
      const metadata = event && event.metadata || {};
      return ["resolution", "duration", "outputs", "audio", "mode", "aspectRatio", "model", "prompt"].some(function(key) {
        return metadata[key] != null && metadata[key] !== "";
      });
    }
    function cleanUiDetailText(text, event) {
      let result = compactText(text);
      if (!result) return "";
      if (event && event.project && event.project.name) {
        const projectName = compactText(event.project.name);
        if (projectName) {
          result = result.replace(new RegExp("^" + escapeRegExp(projectName) + "\\s*\xB7\\s*", "i"), "");
          if (result.toLowerCase() === projectName.toLowerCase()) return "";
        }
      }
      result = result.replace(/\b(\d+\s*(?:generate|生成|創建|创建))(?:\s+\1\b)+/gi, "$1");
      const half = Math.floor(result.length / 2);
      if (half > 20) {
        const first = result.slice(0, half).trim();
        const second = result.slice(half).trim();
        if (first && first === second) result = first;
      }
      return result.slice(0, 180);
    }
    function getHistoryPills(event, options) {
      options = options || {};
      const metadata = event.metadata || {};
      const pills = [
        event.source || "unknown"
      ];
      if (event.user) pills.push("by " + event.user);
      if (event.estimated) pills.push("estimated");
      if (!options.hideProjectPill && event.project && event.project.name) {
        pills.push("project: " + event.project.name);
      }
      ["resolution", "duration", "outputs", "audio", "mode", "aspectRatio", "model"].forEach(function(key) {
        if (metadata[key] == null || metadata[key] === "") return;
        pills.push(key + ": " + metadata[key]);
      });
      return pills;
    }
    function setText(root, field, value) {
      const el = root.querySelector('[data-field="' + field + '"]');
      if (el) el.textContent = String(value);
    }
    function setActiveTab(tab) {
      ctx.runtime.activeTab = tab === "history" || tab === "settings" ? tab : "summary";
      ctx.saveUiState();
      renderSoon();
    }
    function createHistoryItem(event, context) {
      context = context || {};
      const item = document.createElement("div");
      item.className = "histItem";
      if (context.hasProject && !context.filterOn && eventMatchesProject(event, context.activeProject)) {
        item.className += " histItem--matched";
      }
      const top = document.createElement("div");
      top.className = "histTop";
      const left = document.createElement("div");
      left.className = "histSpendMain";
      const time = document.createElement("span");
      time.className = "histTime";
      time.textContent = formatTime(event.ts);
      const amount = document.createElement("span");
      amount.className = "histAmount";
      amount.textContent = "-" + formatCredit(event.amount) + (event.estimated ? " est." : "");
      left.appendChild(time);
      left.appendChild(amount);
      const right = document.createElement("div");
      right.className = "histSpendService";
      right.textContent = event.serviceName || event.service || ctx.getActiveAdapter().name;
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "iconBtn miniBtn histDelete";
      deleteButton.setAttribute("aria-label", "Delete spend");
      deleteButton.setAttribute("data-tooltip", "Delete spend");
      deleteButton.innerHTML = iconSvg("trash-2");
      deleteButton.addEventListener("click", function(clickEvent) {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        ctx.deleteSpendEvent(event.id);
      });
      top.appendChild(left);
      top.appendChild(right);
      top.appendChild(deleteButton);
      const meta = document.createElement("div");
      meta.className = "histMeta";
      getHistoryPills(event, { hideProjectPill: context.filterOn === true }).forEach(function(text) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = text;
        meta.appendChild(pill);
      });
      const detailText = event.metadata && event.metadata.prompt ? compactText(event.metadata.prompt).slice(0, 180) : hasDisplayMetadata(event) ? "" : cleanUiDetailText(event.detail, event);
      const showProjectLink = event.project && event.project.url;
      const showDetail = !!detailText;
      item.appendChild(top);
      item.appendChild(meta);
      if (showProjectLink || showDetail) {
        const raw = document.createElement("div");
        raw.className = "raw";
        if (showProjectLink) {
          const link = document.createElement("a");
          link.href = event.project.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = event.project.name || event.project.url;
          link.style.color = "#8eb6ff";
          link.style.textDecoration = "none";
          raw.appendChild(link);
          if (showDetail) raw.appendChild(document.createTextNode(" \xB7 " + detailText));
        } else {
          raw.textContent = detailText;
        }
        item.appendChild(raw);
      }
      return item;
    }
    function renderProjectSummary(root, activeProject, hasProject, filterOn) {
      const projectGrid = root.querySelector('[data-field="projectGrid"]');
      const breakdownEl = root.querySelector('[data-field="projectBreakdown"]');
      if (!projectGrid) return;
      projectGrid.hidden = !hasProject;
      if (!hasProject) return;
      const projectTotal = ctx.getProjectAllTimeTotal(activeProject);
      setText(root, "projectTotal", "-" + formatCredit(projectTotal));
      if (!breakdownEl) return;
      breakdownEl.textContent = "";
      const totals = ctx.getProjectTotalsByService(activeProject);
      if (!totals.length) {
        const empty = document.createElement("div");
        empty.className = "projectBreakdownEmpty";
        empty.textContent = "No project spend by platform yet";
        breakdownEl.appendChild(empty);
        return;
      }
      totals.forEach(function(item) {
        const row = document.createElement("div");
        row.className = "projectBreakdownRow";
        const name = document.createElement("div");
        name.className = "projectBreakdownName";
        name.textContent = item.serviceName || item.service;
        const value = document.createElement("div");
        value.className = "projectBreakdownValue";
        value.textContent = "-" + formatCredit(item.total);
        row.appendChild(name);
        row.appendChild(value);
        breakdownEl.appendChild(row);
      });
    }
    function renderTabs(root) {
      Array.from(root.querySelectorAll("[data-tab]")).forEach(function(button) {
        button.classList.toggle("active", button.getAttribute("data-tab") === ctx.runtime.activeTab);
      });
      Array.from(root.querySelectorAll("[data-panel]")).forEach(function(panel) {
        panel.classList.toggle("active", panel.getAttribute("data-panel") === ctx.runtime.activeTab);
      });
    }
    function renderHistory(root, activeProject, hasProject, filterOn) {
      const historyEl = root.querySelector('[data-field="history"]');
      const historyHeader = root.querySelector('[data-field="historyHeader"]');
      if (!historyEl) return;
      if (historyHeader) {
        historyHeader.textContent = "";
        const headerText = document.createElement("span");
        headerText.className = "histHeaderText";
        if (hasProject) {
          const projectTotal = ctx.getProjectAllTimeTotal(activeProject);
          const projectCount = ctx.getProjectEventCount(activeProject);
          if (filterOn) {
            headerText.innerHTML = "Showing project only \xB7 <strong>" + projectCount + " events</strong> \xB7 -" + formatCredit(projectTotal);
          } else {
            headerText.innerHTML = "All history \xB7 Project: <strong>" + escapeHtml(activeProject.name) + "</strong> \xB7 -" + formatCredit(projectTotal);
          }
        } else {
          headerText.textContent = "All history";
        }
        historyHeader.appendChild(headerText);
        const stats = document.createElement("span");
        stats.className = "histStats";
        const sessionStat = document.createElement("span");
        sessionStat.className = "histStat";
        sessionStat.textContent = "Session: " + formatCredit(ctx.getSession().total || 0);
        const todayStat = document.createElement("span");
        todayStat.className = "histStat";
        todayStat.textContent = "Today: " + formatCredit(getTodayTotal2());
        stats.appendChild(sessionStat);
        stats.appendChild(todayStat);
        if (hasProject && filterOn) {
          const showAll = document.createElement("button");
          showAll.type = "button";
          showAll.className = "histShowAll";
          showAll.textContent = "Show all";
          showAll.addEventListener("click", function() {
            ctx.setProjectFilterEnabled(false);
          });
          stats.appendChild(showAll);
        }
        historyHeader.appendChild(stats);
      }
      historyEl.textContent = "";
      const history = ctx.getHistory();
      const displayEvents = filterOn ? ctx.getFilteredHistory(activeProject) : history;
      if (!displayEvents.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = filterOn ? "No spend events for this project yet" : "No history yet";
        historyEl.appendChild(empty);
        return;
      }
      displayEvents.slice(0, ctx.getSettings().historyDisplayLimit).forEach(function(event) {
        historyEl.appendChild(createHistoryItem(event, {
          activeProject,
          hasProject,
          filterOn
        }));
      });
    }
    function renderProjectFields(root) {
      const active = root.activeElement;
      const nameInput = root.querySelector('[data-field="projectName"]');
      const urlInput = root.querySelector('[data-field="projectUrl"]');
      const select = root.querySelector('[data-field="projectSelect"]');
      const hint = root.querySelector('[data-field="projectHint"]');
      const deleteButton = root.querySelector('[data-action="deleteProject"]');
      const editButton = root.querySelector('[data-action="editProject"]');
      const projectBox = root.querySelector('[data-field="projectBox"]');
      const filterRow = root.querySelector('[data-field="projectFilterRow"]');
      const filterToggle = root.querySelector('[data-field="projectFilterToggle"]');
      const miniStat = root.querySelector('[data-field="projectMiniStat"]');
      const activeProject = ctx.runtime.project || sanitizeProject({});
      const activeId = activeProject.id && ctx.findProjectById(activeProject.id) ? activeProject.id : "";
      const compact = ctx.shouldCompactProject();
      const hasProject = ctx.hasActiveProject();
      const filterOn = ctx.isProjectFilterActive();
      const projectLibrary = ctx.getProjectLibrary();
      if (projectBox) {
        projectBox.classList.toggle("compact", compact);
        projectBox.classList.toggle("filterOn", filterOn);
      }
      if (filterRow) {
        filterRow.classList.toggle("visible", hasProject);
      }
      if (filterToggle && document.activeElement !== filterToggle) {
        filterToggle.checked = filterOn;
        filterToggle.disabled = !hasProject;
      }
      if (miniStat) {
        miniStat.textContent = hasProject ? "-" + formatCredit(ctx.getProjectAllTimeTotal(activeProject)) + " total" : "";
      }
      if (select && active !== select) {
        select.textContent = "";
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "\u2014 No active project \u2014";
        select.appendChild(emptyOption);
        projectLibrary.forEach(function(entry) {
          const option = document.createElement("option");
          option.value = entry.id;
          option.textContent = ctx.formatProjectOptionLabel(entry);
          select.appendChild(option);
        });
        select.value = activeId;
      }
      if (nameInput && active !== nameInput) nameInput.value = ctx.runtime.projectDraft.name || "";
      if (urlInput && active !== urlInput) urlInput.value = ctx.runtime.projectDraft.url || "";
      const selectedId = select ? select.value : "";
      if (deleteButton) {
        deleteButton.disabled = !selectedId;
        deleteButton.style.opacity = selectedId ? "1" : "0.45";
        deleteButton.style.pointerEvents = selectedId ? "auto" : "none";
      }
      if (editButton) {
        editButton.disabled = !selectedId;
        editButton.style.opacity = selectedId ? "1" : "0.45";
        editButton.style.pointerEvents = selectedId ? "auto" : "none";
      }
      if (hint) {
        if (activeId && activeProject.name) {
          hint.textContent = "Active: " + activeProject.name;
        } else if (projectLibrary.length) {
          hint.textContent = "Select a saved project or save a new one.";
        } else {
          hint.textContent = "Create your first project and save it to the list.";
        }
      }
    }
    function renderSettingsTab(root) {
      const settings = ctx.getSettings();
      const active = root.activeElement;
      const opacityInput = root.querySelector('[data-field="settingIdleOpacity"]');
      const opacityValue = root.querySelector('[data-field="settingIdleOpacityValue"]');
      const summarySelect = root.querySelector('[data-field="settingSummaryEvents"]');
      const historySelect = root.querySelector('[data-field="settingHistoryLimit"]');
      const widthSelect = root.querySelector('[data-field="settingPanelWidth"]');
      const rememberCheckbox = root.querySelector('[data-field="settingRememberPosition"]');
      const opacityPercent = Math.round(settings.idleOpacity * 100);
      if (opacityInput && active !== opacityInput) {
        opacityInput.value = String(opacityPercent);
      }
      if (opacityValue) {
        opacityValue.textContent = opacityPercent + "%";
      }
      if (summarySelect && active !== summarySelect) {
        summarySelect.value = String(settings.summaryEventsCount);
      }
      if (historySelect && active !== historySelect) {
        historySelect.value = String(settings.historyDisplayLimit);
      }
      if (widthSelect && active !== widthSelect) {
        widthSelect.value = String(settings.panelWidth);
      }
      if (rememberCheckbox && active !== rememberCheckbox) {
        rememberCheckbox.checked = settings.rememberPanelPosition === true;
      }
      const panelMeta = root.querySelector('[data-field="settingAccMetaPanel"]');
      if (panelMeta) {
        panelMeta.textContent = opacityPercent + "% \xB7 " + settings.panelWidth + "px";
      }
      const displayMeta = root.querySelector('[data-field="settingAccMetaDisplay"]');
      if (displayMeta) {
        displayMeta.textContent = settings.summaryEventsCount + " \xB7 " + settings.historyDisplayLimit;
      }
      const sheetsMeta = root.querySelector('[data-field="settingAccMetaSheets"]');
      if (sheetsMeta) {
        if (settings.sheetsLastError) {
          sheetsMeta.textContent = "error";
        } else if (needsSheetsNickname(settings)) {
          sheetsMeta.textContent = "need name";
        } else if (settings.sheetsEnabled) {
          sheetsMeta.textContent = settings.sheetsNickname || "on";
        } else {
          sheetsMeta.textContent = "off";
        }
      }
      const versionsMeta = root.querySelector('[data-field="settingAccMetaVersions"]');
      if (versionsMeta) {
        versionsMeta.textContent = "v" + VERSION;
      }
      renderVersionHistory(root);
      const sheetsEnabled = root.querySelector('[data-field="settingSheetsEnabled"]');
      const sheetsNickname = root.querySelector('[data-field="settingSheetsNickname"]');
      const sheetsUrl = root.querySelector('[data-field="settingSheetsWebAppUrl"]');
      const sheetsToken = root.querySelector('[data-field="settingSheetsSecretToken"]');
      const sheetsStatus = root.querySelector('[data-field="settingSheetsStatus"]');
      if (sheetsEnabled && active !== sheetsEnabled) {
        sheetsEnabled.checked = settings.sheetsEnabled === true;
      }
      if (sheetsNickname && active !== sheetsNickname) {
        sheetsNickname.value = settings.sheetsNickname || "";
      }
      if (sheetsUrl && active !== sheetsUrl) {
        sheetsUrl.value = settings.sheetsWebAppUrl || "";
      }
      if (sheetsToken && active !== sheetsToken) {
        sheetsToken.value = settings.sheetsSecretToken || "";
      }
      if (sheetsStatus) {
        const testButton = root.querySelector('[data-action="testSheetsConnection"]');
        if (testButton && testButton.disabled) return;
        if (settings.sheetsLastError) {
          sheetsStatus.textContent = settings.sheetsLastError;
        } else if (settings.sheetsLastSyncAt) {
          sheetsStatus.textContent = "OK \xB7 " + formatTime(settings.sheetsLastSyncAt);
        } else if (!settings.sheetsEnabled) {
          sheetsStatus.textContent = "Sync off";
        } else if (!String(settings.sheetsSecretToken || "").trim()) {
          sheetsStatus.textContent = "Enter token \u2192 Test";
        } else if (!String(settings.sheetsNickname || "").trim()) {
          sheetsStatus.textContent = "Enter nickname";
        } else {
          sheetsStatus.textContent = "Ready";
        }
      }
    }
    function renderVersionHistory(root) {
      const versionBadge = root.querySelector('[data-field="versionBadge"]');
      if (versionBadge) {
        versionBadge.textContent = "v" + VERSION;
      }
      const list = root.querySelector('[data-field="versionHistory"]');
      if (!list || list.getAttribute("data-rendered-version") === VERSION) return;
      list.textContent = "";
      VERSION_HISTORY.forEach(function(entry) {
        const item = document.createElement("div");
        item.className = "versionItem";
        const top = document.createElement("div");
        top.className = "versionTop";
        const version = document.createElement("span");
        version.textContent = "v" + entry.version;
        const date = document.createElement("span");
        date.className = "versionDate";
        date.textContent = entry.date || "";
        top.appendChild(version);
        top.appendChild(date);
        const changes = document.createElement("ul");
        changes.className = "versionChanges";
        (entry.changes || []).slice(0, 3).forEach(function(change) {
          const li = document.createElement("li");
          li.textContent = change;
          changes.appendChild(li);
        });
        item.appendChild(top);
        item.appendChild(changes);
        list.appendChild(item);
      });
      list.setAttribute("data-rendered-version", VERSION);
    }
    function renderUndoToast(root) {
      const toast = root.querySelector('[data-field="undoToast"]');
      const panel = root.querySelector(".panel");
      if (!toast || !panel) return;
      const undo = ctx.runtime.undoSpend;
      const now = Date.now();
      const visible = !!(undo && undo.expiresAt > now);
      if (!undo || undo.expiresAt <= now) {
        ctx.runtime.undoSpend = null;
      }
      panel.classList.toggle("undo-active", visible);
      if (!visible) {
        toast.setAttribute("aria-hidden", "true");
        return;
      }
      const seconds = Math.max(1, Math.ceil((undo.expiresAt - now) / 1e3));
      const meta = root.querySelector('[data-field="undoMeta"]');
      if (meta) {
        meta.textContent = "-" + formatCredit(undo.amount) + " \xB7 " + (undo.serviceName || "spend") + " \xB7 " + seconds + "s";
      }
      toast.setAttribute("aria-hidden", "false");
      if (!ctx.runtime.undoRenderTimer) {
        ctx.runtime.undoRenderTimer = window.setTimeout(function() {
          ctx.runtime.undoRenderTimer = null;
          renderSoon();
        }, 1e3);
      }
    }
    function renderPanel() {
      if (!ctx.runtime.shadowRoot) return;
      const root = ctx.runtime.shadowRoot;
      const history = ctx.getHistory();
      const source = getDisplaySource();
      const activeProject = ctx.getActiveProject();
      const hasProject = ctx.hasActiveProject();
      const filterOn = ctx.isProjectFilterActive();
      const recentEvents = filterOn ? ctx.getFilteredHistory(activeProject) : history;
      setText(root, "serviceName", ctx.getActiveAdapter().name || "none");
      setText(root, "versionBadge", "v" + VERSION);
      setText(root, "source", source);
      setText(root, "balance", ctx.runtime.balance == null ? "-" : formatCredit(ctx.runtime.balance));
      renderProjectFields(root);
      renderProjectSummary(root, activeProject, hasProject, filterOn);
      renderTabs(root);
      renderSettingsTab(root);
      renderUndoToast(root);
      const nicknameWarn = root.querySelector('[data-field="sheetsNicknameWarn"]');
      if (nicknameWarn) {
        nicknameWarn.hidden = !needsSheetsNickname(ctx.getSettings());
      }
      const debugButton = root.querySelector('[data-action="debug"]');
      if (debugButton) {
        debugButton.classList.toggle("active", ctx.runtime.debug);
        debugButton.setAttribute("data-tooltip", ctx.runtime.debug ? "Collecting debug report" : "Collect debug report");
        debugButton.setAttribute("aria-label", ctx.runtime.debug ? "Collecting debug report" : "Collect debug report");
      }
      const eventsEl = root.querySelector('[data-field="events"]');
      if (!eventsEl) return;
      eventsEl.textContent = "";
      if (!recentEvents.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = filterOn ? "No spend events for this project yet" : "No spend events yet";
        eventsEl.appendChild(empty);
        renderHistory(root, activeProject, hasProject, filterOn);
        return;
      }
      recentEvents.slice(0, ctx.getSettings().summaryEventsCount).forEach(function(event) {
        const row = document.createElement("div");
        row.className = "event";
        const dot = document.createElement("div");
        dot.className = "dot";
        if (event.source === "ui") dot.style.background = "#f2b84b";
        if (event.source === "mixed") dot.style.background = "#28b67a";
        if (event.source === "network") dot.style.background = "#2d6cdf";
        const label = document.createElement("div");
        label.className = "histSpendMain";
        const time = document.createElement("span");
        time.className = "histTime";
        time.textContent = formatTime(event.ts);
        const amount = document.createElement("span");
        amount.className = "histAmount";
        amount.textContent = "-" + formatCredit(event.amount) + (event.estimated ? " est." : "");
        label.appendChild(time);
        label.appendChild(amount);
        const src = document.createElement("div");
        src.className = "source";
        src.textContent = (event.serviceName || event.service || ctx.getActiveAdapter().name) + " \xB7 " + (event.source || "unknown");
        row.appendChild(dot);
        row.appendChild(label);
        row.appendChild(src);
        eventsEl.appendChild(row);
      });
      renderHistory(root, activeProject, hasProject, filterOn);
    }
    function renderSoon() {
      if (ctx.runtime.renderTimer) return;
      ctx.runtime.renderTimer = window.setTimeout(function() {
        ctx.runtime.renderTimer = null;
        renderPanel();
      }, 50);
    }
    return {
      renderSoon,
      renderPanel,
      renderHistory,
      createHistoryItem,
      renderProjectFields,
      renderProjectSummary,
      renderTabs,
      renderSettingsTab,
      renderVersionHistory,
      renderUndoToast,
      setActiveTab,
      setText,
      getDisplaySource,
      getTodayTotal: getTodayTotal2,
      hasDisplayMetadata,
      cleanUiDetailText,
      getHistoryPills,
      formatCredit,
      formatTime
    };
  }

  // src/core/sheets.js
  var SHEETS_POST_HEADERS = { "Content-Type": "text/plain;charset=utf-8" };
  function serviceNameForId(service) {
    const id = String(service || "");
    for (let i = 0; i < ADAPTERS.length; i += 1) {
      if (ADAPTERS[i] && ADAPTERS[i].id === id) return ADAPTERS[i].name;
    }
    if (!id) return "";
    return id.charAt(0).toUpperCase() + id.slice(1);
  }
  function convertRemoteRowToEvent(row) {
    if (!row || !row.eventId) return null;
    const parsedTs = row.syncedAt ? Date.parse(row.syncedAt) : NaN;
    const ts = Number.isFinite(parsedTs) ? parsedTs : Date.now();
    return {
      id: String(row.eventId),
      ts,
      localDate: localDateKey(ts),
      amount: Number(row.amount || 0),
      before: 0,
      after: 0,
      source: "remote",
      service: String(row.service || ""),
      serviceName: serviceNameForId(row.service),
      taskId: null,
      url: "",
      method: "",
      path: "",
      score: null,
      pendingId: null,
      detail: "",
      metadata: {},
      project: { id: "", name: String(row.projectName || ""), url: "" },
      estimated: false,
      user: String(row.user || ""),
      remote: true
    };
  }
  function sanitizeSheetsWebAppUrl(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/script\.googleusercontent\.com/i.test(url)) return "";
    if (/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/(exec|dev)$/i.test(url)) {
      return url.replace(/\/dev$/i, "/exec").slice(0, 500);
    }
    if (/^https:\/\/script\.google\.com\//i.test(url)) {
      return url.slice(0, 500);
    }
    return "";
  }
  function canSyncToSheets(settings) {
    if (!settings || settings.sheetsEnabled !== true) return false;
    if (!sanitizeSheetsWebAppUrl(settings.sheetsWebAppUrl)) return false;
    if (!String(settings.sheetsSecretToken || "").trim()) return false;
    if (!String(settings.sheetsNickname || "").trim()) return false;
    return true;
  }
  function buildSheetsPayload(event, settings) {
    const project = event && event.project || {};
    const projectName = String(project.name || "").trim();
    return {
      eventId: String(event.id || ""),
      amount: event.amount,
      service: String(event.service || ""),
      projectId: String(project.id || ""),
      projectName,
      user: String(settings.sheetsNickname || "").trim(),
      trackerVersion: VERSION
    };
  }
  function loadSyncState() {
    const raw = readJson(SHEETS_SYNC_KEY, {});
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  }
  function saveSyncState(state) {
    const keys = Object.keys(state);
    if (keys.length > 500) {
      const sorted = keys.sort(function(a, b) {
        return String(state[b] || "").localeCompare(String(state[a] || ""));
      });
      sorted.slice(500).forEach(function(key) {
        delete state[key];
      });
    }
    writeJson(SHEETS_SYNC_KEY, state);
  }
  function getSyncState(eventId) {
    const state = loadSyncState();
    return state[String(eventId || "")] || null;
  }
  function markSyncState(eventId, status) {
    if (!eventId) return;
    const state = loadSyncState();
    state[String(eventId)] = status;
    saveSyncState(state);
  }
  function clearSyncState(eventId) {
    if (!eventId) return;
    const state = loadSyncState();
    delete state[String(eventId)];
    saveSyncState(state);
  }
  function updateSheetsStatus(ctx, patch) {
    ctx.runtime.settings = Object.assign({}, ctx.runtime.settings, patch);
    writeJson(SETTINGS_KEY, ctx.runtime.settings);
    if (typeof ctx.renderSoon === "function") ctx.renderSoon();
  }
  function postJsonToSheets(settings, body) {
    const url = sanitizeSheetsWebAppUrl(settings.sheetsWebAppUrl);
    if (!url) {
      return Promise.reject(new Error("invalid web app url \u2014 use .../macros/s/.../exec"));
    }
    const payload = JSON.stringify(Object.assign({}, body, {
      token: String(settings.sheetsSecretToken || "").trim()
    }));
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise(function(resolve, reject) {
        GM_xmlhttpRequest({
          method: "POST",
          url,
          headers: SHEETS_POST_HEADERS,
          data: payload,
          onload: function(response) {
            resolve({
              status: response.status,
              body: response.responseText || "",
              finalUrl: response.finalUrl || ""
            });
          },
          onerror: function(error) {
            reject(error || new Error("network error"));
          },
          ontimeout: function() {
            reject(new Error("timeout"));
          },
          timeout: 2e4
        });
      });
    }
    if (typeof fetch === "function") {
      return fetch(url, {
        method: "POST",
        headers: SHEETS_POST_HEADERS,
        body: payload
      }).then(function(response) {
        return response.text().then(function(text) {
          return {
            status: response.status,
            body: text,
            finalUrl: response.url || ""
          };
        });
      });
    }
    return Promise.reject(new Error("no http client"));
  }
  function parseSheetsResponse(response) {
    const body = response.body || "";
    let data = null;
    try {
      data = JSON.parse(body);
    } catch (_) {
      data = null;
    }
    return { data, status: response.status, body };
  }
  function isSuccessResponse(parsed) {
    const data = parsed.data;
    if (data && data.ok === true) return true;
    if (data && data.error === "duplicate") return true;
    if (parsed.status === 409) return true;
    return false;
  }
  function getSheetsErrorMessage(parsed) {
    const body = parsed.body || "";
    const data = parsed.data;
    if (data && data.error) return String(data.error);
    if (parsed.status === 401 || data && data.error === "unauthorized") return "unauthorized \u2014 check secret token";
    if (parsed.status === 404 || /Страница не найдена|не удалось открыть файл|Page Not Found/i.test(body)) {
      return "web app 404 \u2014 redeploy Apps Script (Execute as Me, Anyone access)";
    }
    if (parsed.status === 405) {
      return "method not allowed \u2014 redeploy Web App deployment";
    }
    if (!data && body && body.charAt(0) === "<") {
      return "invalid web app response \u2014 check /exec URL and deployment";
    }
    if (parsed.status) return "sync failed (" + parsed.status + ")";
    return "sync failed";
  }
  function sendSheetsRequest(ctx, action, payload) {
    const settings = ctx.getSettings();
    if (!canSyncToSheets(settings) && action !== "ping") {
      return Promise.reject(new Error("sheets not configured"));
    }
    if (action === "ping" && !sanitizeSheetsWebAppUrl(settings.sheetsWebAppUrl)) {
      return Promise.reject(new Error("invalid web app url \u2014 use .../macros/s/.../exec"));
    }
    if (action === "ping" && !String(settings.sheetsSecretToken || "").trim()) {
      return Promise.reject(new Error("missing secret token"));
    }
    return postJsonToSheets(settings, {
      action,
      payload: payload || null
    }).then(function(response) {
      const parsed = parseSheetsResponse(response);
      if (isSuccessResponse(parsed)) {
        updateSheetsStatus(ctx, {
          sheetsLastSyncAt: Date.now(),
          sheetsLastError: ""
        });
        return parsed.data || { ok: true };
      }
      const message = getSheetsErrorMessage(parsed);
      updateSheetsStatus(ctx, { sheetsLastError: message });
      throw new Error(message);
    }).catch(function(error) {
      const message = error && error.message ? error.message : "network error";
      updateSheetsStatus(ctx, { sheetsLastError: message });
      throw error;
    });
  }
  function syncEventToSheets(ctx, event) {
    if (!event || !event.id) return Promise.resolve(null);
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    if (getSyncState(event.id) === "synced") return Promise.resolve(null);
    const payload = buildSheetsPayload(event, ctx.getSettings());
    return sendSheetsRequest(ctx, "appendEvent", payload).then(function() {
      markSyncState(event.id, "synced");
      ctx.addDiagnostic("sheets sync ok", event.id);
      return event;
    }).catch(function(error) {
      markSyncState(event.id, "failed");
      ctx.addDiagnostic("sheets sync failed", event.id, error && error.message);
      return null;
    });
  }
  function scheduleEventSyncToSheets(ctx, event, delayMs) {
    if (!event || !event.id) return null;
    if (!canSyncToSheets(ctx.getSettings())) return null;
    const eventId = event.id;
    const current = getSyncState(eventId);
    if (current === "synced") return null;
    ctx.runtime.sheetsSyncTimers = ctx.runtime.sheetsSyncTimers || {};
    if (ctx.runtime.sheetsSyncTimers[eventId]) {
      window.clearTimeout(ctx.runtime.sheetsSyncTimers[eventId]);
    }
    markSyncState(eventId, "pending");
    const delay = Number(delayMs);
    ctx.runtime.sheetsSyncTimers[eventId] = window.setTimeout(function() {
      delete ctx.runtime.sheetsSyncTimers[eventId];
      const stillExists = ctx.getHistory().some(function(item) {
        return item && item.id === eventId;
      });
      if (!stillExists) {
        clearSyncState(eventId);
        ctx.addDiagnostic("sheets sync canceled before append", eventId);
        return;
      }
      syncEventToSheets(ctx, event);
    }, Number.isFinite(delay) && delay >= 0 ? delay : SHEETS_SYNC_DELAY_MS);
    ctx.addDiagnostic("sheets sync scheduled", eventId);
    return event;
  }
  function cancelEventSyncToSheets(ctx, eventId) {
    if (!eventId) return;
    ctx.runtime.sheetsSyncTimers = ctx.runtime.sheetsSyncTimers || {};
    if (ctx.runtime.sheetsSyncTimers[eventId]) {
      window.clearTimeout(ctx.runtime.sheetsSyncTimers[eventId]);
      delete ctx.runtime.sheetsSyncTimers[eventId];
    }
    if (getSyncState(eventId) === "pending") {
      clearSyncState(eventId);
    }
  }
  function deleteEventFromSheets(ctx, event) {
    if (!event || !event.id) return Promise.resolve(null);
    cancelEventSyncToSheets(ctx, event.id);
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    if (getSyncState(event.id) !== "synced") {
      clearSyncState(event.id);
      return Promise.resolve(null);
    }
    return sendSheetsRequest(ctx, "deleteEvent", { eventId: event.id }).then(function() {
      markSyncState(event.id, "deleted");
      ctx.addDiagnostic("sheets delete ok", event.id);
      return event;
    }).catch(function(error) {
      markSyncState(event.id, "deleteFailed");
      ctx.addDiagnostic("sheets delete failed", event.id, error && error.message);
      return null;
    });
  }
  function retryFailedSyncs(ctx) {
    if (!canSyncToSheets(ctx.getSettings())) {
      return Promise.resolve({ retried: 0, synced: 0 });
    }
    const history = ctx.getHistory();
    const failed = history.filter(function(event) {
      return event && getSyncState(event.id) === "failed";
    });
    let synced = 0;
    let chain = Promise.resolve();
    failed.forEach(function(event) {
      chain = chain.then(function() {
        return syncEventToSheets(ctx, event).then(function(result) {
          if (result) synced += 1;
        });
      });
    });
    return chain.then(function() {
      return { retried: failed.length, synced };
    });
  }
  function testSheetsConnection(ctx) {
    return sendSheetsRequest(ctx, "ping", null);
  }
  function pullEventsFromSheets(ctx) {
    const settings = ctx.getSettings();
    if (!canSyncToSheets(settings)) return Promise.resolve(null);
    return postJsonToSheets(settings, { action: "listEvents", payload: null }).then(function(response) {
      const parsed = parseSheetsResponse(response);
      const data = parsed.data;
      if (!data || data.ok !== true || !Array.isArray(data.events)) {
        const message = getSheetsErrorMessage(parsed);
        updateSheetsStatus(ctx, { sheetsLastError: message });
        throw new Error(message);
      }
      const remoteEvents = data.events.map(convertRemoteRowToEvent).filter(function(event) {
        return event && event.id;
      });
      const remoteIds = {};
      remoteEvents.forEach(function(event) {
        remoteIds[event.id] = true;
      });
      const localOnly = ctx.getHistory().filter(function(event) {
        if (!event || !event.id) return false;
        if (remoteIds[event.id]) return false;
        return getSyncState(event.id) !== "synced";
      });
      const merged = mergeEventHistories(remoteEvents, localOnly, MAX_EVENTS);
      ctx.setHistory(sanitizeEvents(merged));
      ctx.saveHistory();
      remoteEvents.forEach(function(event) {
        markSyncState(event.id, "synced");
      });
      updateSheetsStatus(ctx, {
        sheetsLastSyncAt: Date.now(),
        sheetsLastError: ""
      });
      ctx.addDiagnostic("sheets pull ok", remoteEvents.length);
      if (typeof ctx.renderSoon === "function") ctx.renderSoon();
      return { pulled: remoteEvents.length };
    }).catch(function(error) {
      const message = error && error.message ? error.message : "network error";
      updateSheetsStatus(ctx, { sheetsLastError: message });
      ctx.addDiagnostic("sheets pull failed", message);
      throw error;
    });
  }
  function startSheetsAutoPull(ctx) {
    if (ctx.runtime.sheetsPullTimer) {
      window.clearInterval(ctx.runtime.sheetsPullTimer);
      ctx.runtime.sheetsPullTimer = null;
    }
    function runPull() {
      if (!canSyncToSheets(ctx.getSettings())) return;
      pullEventsFromSheets(ctx).catch(function() {
      });
    }
    runPull();
    ctx.runtime.sheetsPullTimer = window.setInterval(runPull, SHEETS_PULL_INTERVAL_MS);
    return ctx.runtime.sheetsPullTimer;
  }
  function createSheets(ctx) {
    return {
      syncEventToSheets: function(event) {
        return syncEventToSheets(ctx, event);
      },
      scheduleEventSyncToSheets: function(event, delayMs) {
        return scheduleEventSyncToSheets(ctx, event, delayMs);
      },
      cancelEventSyncToSheets: function(eventId) {
        return cancelEventSyncToSheets(ctx, eventId);
      },
      deleteEventFromSheets: function(event) {
        return deleteEventFromSheets(ctx, event);
      },
      retryFailedSyncs: function() {
        return retryFailedSyncs(ctx);
      },
      testSheetsConnection: function() {
        return testSheetsConnection(ctx);
      },
      pullEventsFromSheets: function() {
        return pullEventsFromSheets(ctx);
      },
      startSheetsAutoPull: function() {
        return startSheetsAutoPull(ctx);
      },
      buildSheetsPayload: function(event) {
        return buildSheetsPayload(event, ctx.getSettings());
      },
      canSyncToSheets: function() {
        return canSyncToSheets(ctx.getSettings());
      }
    };
  }

  // src/core/app.js
  function sanitizeMeta(value) {
    const balance = isFiniteCredit(Number(value && value.balance)) ? normalizeCredit(Number(value.balance)) : null;
    return {
      balance,
      balanceSource: value && value.balanceSource ? String(value.balanceSource) : "none",
      balancePath: value && value.balancePath ? String(value.balancePath) : "",
      lastBalanceAt: value && value.lastBalanceAt ? Number(value.lastBalanceAt) : null
    };
  }
  function createTracker() {
    const initialUiState = sanitizeUiState(readJson(UI_KEY, {}));
    const runtime = {
      balance: null,
      balanceSource: "none",
      balancePath: "",
      lastBalanceAt: null,
      pending: [],
      sourceSeen: { network: false, ui: false },
      panelHost: null,
      shadowRoot: null,
      panelCollapsed: false,
      panelPersistenceInstalled: false,
      panelPersistenceObserver: null,
      panelReattachTimer: null,
      panelEnsureInterval: null,
      uiObserver: null,
      uiScanTimer: null,
      uiInterval: null,
      renderTimer: null,
      undoRenderTimer: null,
      sheetsPullTimer: null,
      debug: false,
      diagnostics: [],
      lastUiSpend: null,
      undoSpend: null,
      sheetsSyncTimers: {},
      activeTab: initialUiState.activeTab,
      projectFilterEnabled: initialUiState.projectFilterEnabled,
      project: sanitizeProject(readJson(PROJECT_KEY, {})),
      projectDraft: { name: "", url: "" },
      projectEditorOpen: false,
      settings: loadSettings(),
      sheetsNicknameNotified: false
    };
    let history = sanitizeEvents(loadSharedHistory([]));
    let session = sanitizeSession(readJson(SESSION_KEY, null)) || createSession();
    let meta = sanitizeMeta(readJson(META_KEY, {}));
    let projectLibrary = sanitizeProjectLibrary(readJson(PROJECTS_LIBRARY_KEY, []));
    runtime.debug = readJson(DEBUG_KEY, false) === true;
    runtime.balance = meta.balance;
    runtime.balanceSource = meta.balanceSource || "none";
    runtime.balancePath = meta.balancePath || "";
    runtime.lastBalanceAt = meta.lastBalanceAt || null;
    const ctx = {
      runtime,
      getHistory: () => history,
      setHistory: (v) => {
        history = v;
      },
      getSession: () => session,
      setSession: (v) => {
        session = v;
      },
      getMeta: () => meta,
      setMeta: (v) => {
        meta = v;
      },
      getProjectLibrary: () => projectLibrary,
      setProjectLibrary: (v) => {
        projectLibrary = v;
      },
      getActiveAdapter,
      localDateKey
    };
    ctx.saveHistory = function() {
      writeJson(HISTORY_KEY, history);
    };
    ctx.saveSession = function() {
      writeJson(SESSION_KEY, session);
    };
    ctx.saveMeta = function() {
      writeJson(META_KEY, meta);
    };
    ctx.saveProject = function() {
      writeJson(PROJECT_KEY, runtime.project);
    };
    ctx.saveProjectLibrary = function() {
      writeJson(PROJECTS_LIBRARY_KEY, projectLibrary);
    };
    ctx.saveUiState = function() {
      saveUiState(ctx);
    };
    ctx.getSettings = function() {
      return runtime.settings;
    };
    ctx.updateSetting = function(key, value) {
      const next = sanitizeSettings(Object.assign({}, runtime.settings, { [key]: value }));
      runtime.settings = next;
      saveSettings(ctx);
      applyPanelSettings(ctx);
      ctx.renderSoon();
    };
    ctx.resetSettings = function() {
      if (typeof window !== "undefined" && !window.confirm("Reset all settings to defaults?")) return;
      runtime.settings = sanitizeSettings(DEFAULT_SETTINGS);
      saveSettings(ctx);
      applyPanelSettings(ctx);
      ctx.renderSoon();
    };
    ctx.notifyMissingSheetsNickname = function() {
      if (runtime.sheetsNicknameNotified) return;
      if (!needsSheetsNickname(runtime.settings)) return;
      runtime.sheetsNicknameNotified = true;
      ctx.addDiagnostic("sheets nickname required \u2014 open Settings \u2192 Google Sheets");
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("AI Token Tracker: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 nickname \u0432 Settings \u2192 Google Sheets, \u0447\u0442\u043E\u0431\u044B \u0441\u0438\u043D\u043A \u0440\u0430\u0431\u043E\u0442\u0430\u043B \u0441 \u0432\u0430\u0448\u0438\u043C \u0438\u043C\u0435\u043D\u0435\u043C.");
      }
      ctx.renderSoon();
    };
    ctx.addDiagnostic = function() {
      const args = Array.prototype.slice.call(arguments);
      runtime.diagnostics.push({
        ts: Date.now(),
        args: args.map(formatDebugArg)
      });
      runtime.diagnostics = runtime.diagnostics.slice(-120);
    };
    ctx.showUndoSpend = function(event) {
      if (!event || !event.id) return;
      runtime.undoSpend = {
        eventId: event.id,
        amount: event.amount,
        serviceName: event.serviceName || event.service || getActiveAdapter().name,
        expiresAt: Date.now() + SPEND_UNDO_WINDOW_MS
      };
      ctx.renderSoon();
    };
    ctx.hideUndoSpend = function() {
      runtime.undoSpend = null;
      ctx.renderSoon();
    };
    ctx.deleteSpendEvent = function(eventId, options) {
      const id = String(eventId || "");
      if (!id) return null;
      const event = history.find(function(item) {
        return item && item.id === id;
      });
      if (!event) return null;
      if (typeof ctx.cancelEventSyncToSheets === "function") {
        ctx.cancelEventSyncToSheets(id);
      }
      history = history.filter(function(item) {
        return item && item.id !== id;
      });
      session = removeEventFromSession(session, event);
      runtime.lastUiSpend = null;
      if (runtime.undoSpend && runtime.undoSpend.eventId === id) {
        runtime.undoSpend = null;
      }
      ctx.saveHistory();
      ctx.saveSession();
      ctx.addDiagnostic("deleted spend", id);
      if (!options || options.deleteSheets !== false) {
        if (typeof ctx.deleteEventFromSheets === "function") {
          ctx.deleteEventFromSheets(event);
        }
      }
      ctx.renderSoon();
      return event;
    };
    ctx.undoLastSpend = function() {
      if (!runtime.undoSpend || runtime.undoSpend.expiresAt <= Date.now()) {
        runtime.undoSpend = null;
        ctx.renderSoon();
        return null;
      }
      return ctx.deleteSpendEvent(runtime.undoSpend.eventId);
    };
    ctx.recordSpend = function(input, now) {
      if (!input || !isFiniteCredit(input.amount) || input.amount <= 0) return null;
      const duplicate = findDuplicateSpend(history, input, now);
      if (duplicate) {
        duplicate.source = mergeSources(duplicate.source, input.source);
        duplicate.updatedAt = now;
        if (!duplicate.taskId && input.taskId) duplicate.taskId = input.taskId;
        if (duplicate.estimated && !input.estimated) {
          duplicate.estimated = false;
          duplicate.amount = normalizeCredit(input.amount);
          duplicate.before = normalizeCredit(input.before);
          duplicate.after = normalizeCredit(input.after);
          duplicate.path = input.path || duplicate.path;
        }
        ctx.saveHistory();
        ctx.renderSoon();
        ctx.addDiagnostic("merged duplicate spend", duplicate);
        return duplicate;
      }
      const event = {
        id: input.taskId ? "task:" + input.taskId + ":" + input.amount : createEventId(input, now),
        ts: now,
        localDate: localDateKey(now),
        amount: normalizeCredit(input.amount),
        before: normalizeCredit(input.before),
        after: normalizeCredit(input.after),
        source: input.source || "unknown",
        service: input.service || getActiveAdapter().id,
        serviceName: input.serviceName || getActiveAdapter().name,
        taskId: input.taskId || null,
        url: redactUrl(input.url || ""),
        method: input.method || "",
        path: input.path || "",
        score: input.score || null,
        pendingId: input.pendingId || null,
        detail: input.detail || "",
        metadata: sanitizeMetadata(input.metadata || {}),
        project: sanitizeProject(input.project || runtime.project),
        estimated: input.estimated === true,
        user: String(runtime.settings && runtime.settings.sheetsNickname || "").trim()
      };
      history.unshift(event);
      history = sanitizeEvents(history);
      session = addEventToSession(session, event);
      ctx.saveHistory();
      ctx.saveSession();
      ctx.addDiagnostic("recorded spend", event);
      ctx.showUndoSpend(event);
      if (runtime.settings.sheetsEnabled) {
        ctx.scheduleEventSyncToSheets(event, SHEETS_SYNC_DELAY_MS);
        ctx.retryFailedSyncs();
      }
      return event;
    };
    Object.assign(ctx, createProjects(ctx));
    const render = createRender(ctx);
    Object.assign(ctx, render);
    Object.assign(ctx, createSheets(ctx));
    const balance = createBalance(ctx);
    Object.assign(ctx, balance);
    const api = createApi(ctx);
    Object.assign(ctx, api);
    const network = createNetwork(ctx);
    const panel = createPanelModule(ctx);
    ctx.bootWhenBodyExists = panel.bootWhenBodyExists;
    initAdapters({
      addDiagnostic: ctx.addDiagnostic,
      getPanelHost: function() {
        return runtime.panelHost;
      },
      extractBalanceFromPayload,
      looksRelevantForDebug: network.looksRelevantForDebug
    });
    ctx.migrateProjectLibrary();
    ctx.exposeApi();
    network.patchFetch();
    network.patchXMLHttpRequest();
    panel.bootWhenBodyExists();
    if (runtime.settings.sheetsEnabled && typeof ctx.startSheetsAutoPull === "function") {
      ctx.startSheetsAutoPull();
    }
    return {
      version: VERSION,
      getState: ctx.getState,
      runtime
    };
  }

  // src/index.js
  function boot() {
    const pageWindow = getPageWindow();
    if (pageWindow.__AI_TOKEN_TRACKER_INSTALLED__ || pageWindow.__KLING_TOKEN_TRACKER_INSTALLED__) return;
    pageWindow.__AI_TOKEN_TRACKER_INSTALLED__ = true;
    pageWindow.__KLING_TOKEN_TRACKER_INSTALLED__ = true;
    try {
      createTracker();
      console.info("[AI Token Tracker]", VERSION, "started on", location.href);
    } catch (error) {
      console.error("[AI Token Tracker] boot failed:", error);
      pageWindow.__AI_TOKEN_TRACKER_INSTALLED__ = false;
      pageWindow.__KLING_TOKEN_TRACKER_INSTALLED__ = false;
    }
  }
  boot();
})();

