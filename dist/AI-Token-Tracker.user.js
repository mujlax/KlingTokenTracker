// ==UserScript==
// @name         AI Token Tracker
// @namespace    http://tampermonkey.net/
// @version      1.2.2
// @description  Учёт расхода AI-кредитов при генерации: панель, проекты, история, синхронизация с Google Sheets.
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
  var VERSION = "1.2.2";
  var VERSION_HISTORY = [
    {
      version: "1.2.2",
      date: "2026-08-12",
      changes: [
        "\u0423\u043C\u043D\u044B\u0439 \u043F\u043E\u0438\u0441\u043A \u0434\u0443\u0431\u043B\u0435\u0439 \u043E\u0440\u0438\u0435\u043D\u0442\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043D\u0430 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443, \u0430 \u043D\u0435 \u043D\u0430 \u043E\u0431\u0449\u0438\u0439 \u0445\u043E\u0441\u0442",
        "\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435 \xAB\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0442\u0430\u043A\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C\xBB \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u0441\u0442\u0440\u043E\u0436\u0435",
        "\u0412 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430\u0445 \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0432\u0438\u0434\u043D\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430"
      ]
    },
    {
      version: "1.2.1",
      date: "2026-08-11",
      changes: [
        "\u0412 \u0447\u0438\u043F\u0430\u0445 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0445 \u0442\u0440\u0430\u0442 \u0443\u0431\u0440\u0430\u043D\u044B \u043F\u043E\u0434\u043F\u0438\u0441\u0438 remote/local",
        "\u0427\u0438\u0441\u043B\u043E \u0437\u0430\u0442\u0440\u0430\u0442\u044B \u0432 \u0447\u0438\u043F\u0435 \u0443\u0432\u0435\u043B\u0438\u0447\u0435\u043D\u043E"
      ]
    },
    {
      version: "1.2.0",
      date: "2026-08-10",
      changes: [
        "\u0421\u0435\u043B\u0435\u043A\u0442\u043E\u0440 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0432 \u0434\u0432\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0434\u043B\u044F \u0431\u043E\u043B\u0435\u0435 \u0434\u043B\u0438\u043D\u043D\u044B\u0445 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0439",
        "\u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0447\u0438\u043F\u044B \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0445 \u0442\u0440\u0430\u0442 \u0441 \u043F\u0440\u043E\u043A\u0440\u0443\u0442\u043A\u043E\u0439 \u0438 \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0435\u0439 \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F",
        "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0441\u0432\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0430\u043A\u043A\u043E\u0440\u0434\u0435\u043E\u043D\u043E\u043C; \u0443\u0431\u0440\u0430\u043D\u044B \u043B\u0438\u0448\u043D\u0438\u0435 \u0441\u0432\u0435\u0447\u0435\u043D\u0438\u044F \u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0435"
      ]
    },
    {
      version: "1.0.0",
      date: "2026-07-29",
      changes: [
        "\u041F\u043E\u043B\u043D\u044B\u0439 \u0440\u0435\u0434\u0438\u0437\u0430\u0439\u043D \u043F\u0430\u043D\u0435\u043B\u0438 \u0432 \u0441\u0442\u0438\u043B\u0435 \u0447\u0451\u0440\u043D\u043E\u0433\u043E glass + blue aurora",
        "\u0421\u0432\u043E\u0434\u043A\u0430 \u0441\u0442\u0430\u043B\u0430 \u043A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u0435\u0435 \u0438 \u0432\u0441\u0435\u0433\u0434\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0442\u0440\u0430\u0442\u044B \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430",
        "\u0412 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0444\u0438\u043B\u044C\u0442\u0440 \u0412\u0441\u0435 / \u041F\u0440\u043E\u0435\u043A\u0442"
      ]
    },
    {
      version: "0.9.6",
      date: "2026-07-21",
      changes: [
        "\u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043F\u0440\u044F\u043C\u043E \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u043E\u0442\u043C\u0435\u043D\u044B \u0442\u0440\u0430\u0442\u044B",
        "\u0410\u0432\u0442\u043E\u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0438\u0437 \u043F\u043E\u0438\u0441\u043A\u043E\u0432\u043E\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0430",
        "\u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0441\u0440\u0430\u0437\u0443 \u043F\u0440\u0438\u0432\u044F\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043A \u0442\u0440\u0430\u0442\u0435 \u0438 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u043C"
      ]
    },
    {
      version: "0.9.5",
      date: "2026-07-20",
      changes: [
        "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u043F\u0435\u0440\u0435\u0441\u0431\u043E\u0440\u043A\u0430 dist \u0434\u043B\u044F Tampermonkey",
        "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u0432\u0435\u0440\u0441\u0438\u044F \u0432\u043E \u0432\u0441\u0435\u0445 \u0430\u0440\u0442\u0435\u0444\u0430\u043A\u0442\u0430\u0445 \u043F\u0440\u043E\u0435\u043A\u0442\u0430"
      ]
    },
    {
      version: "0.9.4",
      date: "2026-07-20",
      changes: [
        "\u041F\u043E\u043B\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0432\u043E\u0434 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043F\u0430\u043D\u0435\u043B\u0438 \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u0438\u0439 \u044F\u0437\u044B\u043A",
        "\u0420\u0443\u0441\u0441\u043A\u0438\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043E\u0431 \u043E\u0448\u0438\u0431\u043A\u0430\u0445 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 Google Sheets",
        "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 userscript \u0434\u043B\u044F Tampermonkey"
      ]
    },
    {
      version: "0.9.3",
      date: "2026-07-20",
      changes: [
        "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u043F\u043E\u0438\u0441\u043A \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u043F\u043E \u0438\u043C\u0435\u043D\u0438 \u0432 \u043E\u0442\u043C\u0435\u043D\u0435",
        "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u0432 \u043E\u0442\u043C\u0435\u043D\u0435 \u043F\u043E \u0434\u0430\u0442\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F (\u043D\u043E\u0432\u044B\u0435 \u043F\u0435\u0440\u0432\u044B\u043C\u0438)",
        "\u0411\u044B\u0441\u0442\u0440\u044B\u0439 \u043F\u043E\u0438\u0441\u043A \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u0432 \u043A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438"
      ]
    },
    {
      version: "0.9.2",
      date: "2026-07-20",
      changes: [
        "\u0421\u043C\u0435\u043D\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043F\u0440\u0438 \u043E\u0442\u043C\u0435\u043D\u0435 \u0442\u0440\u0430\u0442\u044B",
        "\u041F\u0430\u0443\u0437\u0430 \u0442\u0430\u0439\u043C\u0435\u0440\u043E\u0432 \u043E\u0442\u043C\u0435\u043D\u044B \u0438 Sheets \u043F\u0440\u0438 \u0432\u044B\u0431\u043E\u0440\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430",
        "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0441\u043E\u0431\u044B\u0442\u0438\u0439"
      ]
    },
    {
      version: "0.9.1",
      date: "2026-07-17",
      changes: [
        "\u041E\u0431\u043D\u043E\u0432\u043B\u0451\u043D URL \u0432\u0435\u0431-\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F Google Sheets \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E",
        "\u0410\u0432\u0442\u043E\u043C\u0438\u0433\u0440\u0430\u0446\u0438\u044F \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u0445 URL \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0438\u0437 \u043A\u044D\u0448\u0430"
      ]
    },
    {
      version: "0.9.0",
      date: "2026-07-17",
      changes: [
        "\u041E\u0431\u0449\u0438\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u0432 Google Sheets",
        "\u0423\u043C\u043D\u044B\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u043E\u0432 \u043F\u0440\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432",
        "\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0435 \u0430\u0440\u0445\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u0431\u0449\u0438\u0445 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432"
      ]
    },
    {
      version: "0.8.8",
      date: "2026-07-06",
      changes: [
        "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F pull \u0438\u0437 Google Sheets",
        "\u0423\u043F\u0440\u043E\u0449\u0435\u043D\u044B \u0441\u0442\u043E\u043B\u0431\u0446\u044B Sheets \u0434\u043E \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0433\u043E \u043C\u0438\u043D\u0438\u043C\u0443\u043C\u0430",
        "\u0410\u0432\u0442\u043E\u0440 \u0442\u0440\u0430\u0442\u044B \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u0442\u0441\u044F \u0432 \u0438\u0441\u0442\u043E\u0440\u0438\u0438"
      ]
    },
    {
      version: "0.8.7",
      date: "2026-07-06",
      changes: [
        "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u043E\u0431 \u043E\u0442\u043C\u0435\u043D\u0435 \u0432 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0435 \u043F\u0430\u043D\u0435\u043B\u0438",
        "\u0417\u0430\u043C\u0435\u043D\u0430 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0430 \u043F\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u043E\u0442\u043C\u0435\u043D\u0435",
        "\u041F\u043E\u0434\u0441\u0432\u0435\u0442\u043A\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0442\u0440\u0430\u0442"
      ]
    },
    {
      version: "0.8.6",
      date: "2026-07-06",
      changes: [
        "\u0418\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u0431\u0430\u043B\u0430\u043D\u0441\u0430 Kling",
        "\u041D\u043E\u0440\u043C\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043A\u0440\u0435\u0434\u0438\u0442\u043E\u0432 point/ticket",
        "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0440\u0435\u0433\u0440\u0435\u0441\u0441\u0438\u043E\u043D\u043D\u043E\u0435 \u043F\u043E\u043A\u0440\u044B\u0442\u0438\u0435"
      ]
    },
    {
      version: "0.8.5",
      date: "2026-07-06",
      changes: [
        "\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u0442\u0440\u0430\u0442 \u0438\u0437 \u0438\u0441\u0442\u043E\u0440\u0438\u0438",
        "10-\u0441\u0435\u043A\u0443\u043D\u0434\u043D\u0430\u044F \u043E\u0442\u043C\u0435\u043D\u0430 \u043D\u0435\u0434\u0430\u0432\u043D\u0438\u0445 \u0442\u0440\u0430\u0442",
        "\u041E\u0442\u043B\u043E\u0436\u0435\u043D\u043D\u0430\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F Sheets \u0441 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u043E\u0439 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F"
      ]
    },
    {
      version: "0.8.4",
      date: "2026-07-06",
      changes: [
        "\u0421\u043E\u043A\u0440\u0430\u0449\u0451\u043D \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u043F\u0430\u043D\u0435\u043B\u0438 \u0434\u043E AITT",
        "\u041A\u043B\u0438\u043A\u0430\u0431\u0435\u043B\u044C\u043D\u044B\u0439 \u0437\u043D\u0430\u0447\u043E\u043A \u0432\u0435\u0440\u0441\u0438\u0438",
        "Changelog \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445"
      ]
    },
    {
      version: "0.8.3",
      date: "2026-07-06",
      changes: [
        "\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 SJinn Seedance",
        "\u0420\u0430\u0441\u0447\u0451\u0442 \u0442\u0440\u0430\u0442 Seedance \u043F\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u043C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u043C",
        "\u0410\u0434\u0430\u043F\u0442\u0435\u0440\u044B \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u044B \u0432 \u0444\u0430\u0431\u0440\u0438\u0447\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A"
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
  var PANEL_KEY = STORAGE_PREFIX + "panel.v1";
  var UI_KEY = STORAGE_PREFIX + "ui.v1";
  var SETTINGS_KEY = STORAGE_PREFIX + "settings.v1";
  var SHEETS_SYNC_KEY = STORAGE_PREFIX + "sheetsSync.v1";
  var PROJECTS_SYNC_KEY = STORAGE_PREFIX + "projectsSync.v1";
  var DEFAULT_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz9bp6ZWtJD5jJYdYPi-rjLkJO71L2dMJL8hxmayfuKtImtd_qbnVfTP25saOL0hlCj_Q/exec";
  var LEGACY_SHEETS_WEB_APP_URLS = [
    "https://script.google.com/macros/s/AKfycbyBKgzw0oZmfdaOSHU4iBdsRY6l-tXupdUNjcRbMDNw7-glxMuw9kC2rJCljgJquDZORA/exec",
    "https://script.google.com/macros/s/AKfycbxi3YrJYesMvttSYoFVA-_E_RxIeSHXIOjmGvFVc4HVmOp0QDka_rUo2Oxw82fTP2HXmg/exec",
    "https://script.google.com/macros/s/AKfycbwZ4SqCwMEvByu8L1MNO1OdRz30Q96HDGabFl5nj_ZvoT2Lw1Z9iWLH5vvswalTwV90kg/exec",
    "https://script.google.com/macros/s/AKfycbwG2o3NIhF6zUURKV_0G0YBRm3nYIPHfbnLKIf4kuOQb2NuGljoqAD8AbG5blBRUAXc5g/exec",
    "https://script.google.com/macros/s/AKfycbzYAcB-tOiiNjUs9_wNM2VbIYqobqn9BMGJSuQzXTzZgwsp9-gRNYOdlpTF8JhabtTPfg/exec"
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
  var SHARED_KEYS = /* @__PURE__ */ new Set([HISTORY_KEY, PROJECT_KEY, PROJECTS_LIBRARY_KEY, PROJECTS_SYNC_KEY]);
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
    const status = value && value.status === "archived" ? "archived" : "active";
    return {
      id: project.id || createId("project"),
      name: project.name,
      url: project.url,
      status,
      createdAt: Number(value && value.createdAt || Date.now()),
      updatedAt: Number(value && value.updatedAt || Date.now()),
      updatedBy: String(value && value.updatedBy || "").trim().slice(0, 80)
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
  function replaceEventProject(history, eventId, project, now) {
    const id = String(eventId || "");
    const nextProject = sanitizeProject(project || {});
    let updatedEvent = null;
    const nextHistory = (Array.isArray(history) ? history : []).map(function(event) {
      if (!event || event.id !== id) return event;
      updatedEvent = Object.assign({}, event, {
        project: nextProject,
        updatedAt: Number(now || Date.now())
      });
      return updatedEvent;
    });
    return {
      history: nextHistory,
      event: updatedEvent
    };
  }
  function getTodayTotal(history, serviceId) {
    const today = localDateKey(Date.now());
    return normalizeCredit(history.reduce(function(sum, event) {
      if (event.localDate !== today) return sum;
      if (!eventMatchesService(event, serviceId)) return sum;
      return sum + Number(event.amount || 0);
    }, 0));
  }

  // src/core/project-search.js
  function normalizeUnicode(value) {
    const raw = String(value || "");
    try {
      return raw.normalize("NFKC");
    } catch (_) {
      return raw;
    }
  }
  function normalizeProjectName2(value) {
    return normalizeUnicode(value).toLowerCase().replace(/ё/g, "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  }
  function normalizeProjectUrl(value) {
    const raw = normalizeUnicode(value).trim();
    if (!raw) return "";
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw;
    try {
      const parsed = new URL(candidate);
      const host = parsed.hostname.toLowerCase().replace(/^www\./i, "");
      let path = parsed.pathname || "";
      try {
        path = decodeURIComponent(path);
      } catch (_) {
      }
      path = path.toLowerCase().replace(/\/+$/, "");
      return host + path;
    } catch (_) {
      return raw.toLowerCase().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
    }
  }
  function getUrlPath(normalized) {
    if (!normalized) return "";
    const slash = normalized.indexOf("/");
    return slash >= 0 ? normalized.slice(slash) : "";
  }
  function levenshteinDistance(left, right) {
    if (left === right) return 0;
    if (!left) return right.length;
    if (!right) return left.length;
    let previous = Array.from({ length: right.length + 1 }, function(_, index) {
      return index;
    });
    for (let i = 1; i <= left.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left.charAt(i - 1) === right.charAt(j - 1) ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost
        );
      }
      previous = current;
    }
    return previous[right.length];
  }
  function significantTokens(value) {
    return String(value || "").split(" ").filter(function(token) {
      return token.length >= 4;
    });
  }
  function nameMatchScore(query, candidate) {
    if (!query || !candidate) return 0;
    if (query === candidate) return 0.98;
    if (candidate.indexOf(query) === 0 || query.indexOf(candidate) === 0) return 0.86;
    if (candidate.indexOf(query) >= 0 || query.indexOf(candidate) >= 0) return 0.8;
    if (query.length < 4 || candidate.length < 4) return 0;
    const queryTokens = significantTokens(query);
    const candidateTokens = significantTokens(candidate);
    if (!queryTokens.length || !candidateTokens.length) return 0;
    let shared = 0;
    let bestTokenSimilarity = 0;
    queryTokens.forEach(function(token) {
      if (candidateTokens.indexOf(token) >= 0) shared += 1;
      candidateTokens.forEach(function(candidateToken) {
        const tokenLength = Math.max(token.length, candidateToken.length);
        const tokenSimilarity = 1 - levenshteinDistance(token, candidateToken) / tokenLength;
        if (tokenSimilarity > bestTokenSimilarity) bestTokenSimilarity = tokenSimilarity;
      });
    });
    const overlapRatio = shared / queryTokens.length;
    const minShared = queryTokens.length >= 3 ? 2 : 1;
    const tokenScore = shared >= minShared && overlapRatio >= 0.6 ? 0.78 * overlapRatio : 0;
    const tokenTypoScore = bestTokenSimilarity >= 0.8 ? 0.76 * bestTokenSimilarity : 0;
    const maxLength = Math.max(query.length, candidate.length);
    const similarity = maxLength ? 1 - levenshteinDistance(query, candidate) / maxLength : 0;
    const typoScore = similarity >= 0.8 ? 0.78 * similarity : 0;
    return Math.max(tokenScore, tokenTypoScore, typoScore);
  }
  function urlMatchScore(query, candidate) {
    if (!query || !candidate) return 0;
    if (query === candidate) return 1;
    const queryPath = getUrlPath(query);
    const candidatePath = getUrlPath(candidate);
    if (!queryPath || !candidatePath || queryPath.length < 2 || candidatePath.length < 2) {
      return 0;
    }
    if (candidate.indexOf(query) === 0 || query.indexOf(candidate) === 0) return 0.96;
    if (candidatePath.indexOf(queryPath) === 0 || queryPath.indexOf(candidatePath) === 0) {
      const queryHost = query.split("/")[0];
      const candidateHost = candidate.split("/")[0];
      if (queryHost && queryHost === candidateHost) return 0.94;
    }
    return 0;
  }
  var SUGGESTION_SCORE_THRESHOLD = 0.72;
  var SEARCH_SCORE_THRESHOLD = 0.55;
  function scoreProjectMatch(project, query) {
    const nameQuery = normalizeProjectName2(query && query.name);
    const urlQuery = normalizeProjectUrl(query && query.url);
    const projectName = normalizeProjectName2(project && project.name);
    const projectUrl = normalizeProjectUrl(project && project.url);
    const nameScore = nameMatchScore(nameQuery, projectName);
    const urlScore = urlMatchScore(urlQuery, projectUrl);
    if (urlQuery && projectUrl && urlQuery !== projectUrl && urlScore < 0.94) {
      if (nameScore < 0.86) {
        return {
          score: 0,
          exact: false,
          nameScore,
          urlScore
        };
      }
      return {
        score: nameScore,
        exact: nameQuery === projectName,
        nameScore,
        urlScore
      };
    }
    let score = Math.max(nameScore, urlScore);
    if (nameScore >= SUGGESTION_SCORE_THRESHOLD && urlScore >= 0.94) {
      score = Math.min(1, score + 0.03);
    }
    return {
      score,
      exact: nameQuery && nameQuery === projectName || urlQuery && urlQuery === projectUrl,
      nameScore,
      urlScore
    };
  }
  function findProjectSuggestions(projects, query, options) {
    const settings = options || {};
    const limit = Number(settings.limit) > 0 ? Number(settings.limit) : 5;
    const excludeId = String(settings.excludeId || "");
    const nameQuery = normalizeProjectName2(query && query.name);
    const urlQuery = normalizeProjectUrl(query && query.url);
    if (nameQuery.length < 4 && !urlQuery) return [];
    return (Array.isArray(projects) ? projects : []).filter(function(project) {
      return project && project.status !== "archived" && project.id !== excludeId;
    }).map(function(project) {
      const match = scoreProjectMatch(project, query || {});
      return Object.assign({}, project, {
        matchScore: match.score,
        matchExact: match.exact
      });
    }).filter(function(project) {
      return project.matchScore >= SUGGESTION_SCORE_THRESHOLD;
    }).sort(function(left, right) {
      if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;
      return Number(right.updatedAt || 0) - Number(left.updatedAt || 0);
    }).slice(0, limit);
  }
  function sortProjectsByCreatedAt(projects) {
    return (Array.isArray(projects) ? projects : []).filter(function(project) {
      return project && project.status !== "archived";
    }).slice().sort(function(left, right) {
      const createdDiff = Number(right.createdAt || 0) - Number(left.createdAt || 0);
      if (createdDiff) return createdDiff;
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }
  function searchProjectsByName(projects, query, options) {
    const settings = options || {};
    const limit = Number(settings.limit) > 0 ? Number(settings.limit) : Infinity;
    const needle = normalizeProjectName2(query);
    const sorted = sortProjectsByCreatedAt(projects);
    const matches = needle ? sorted.filter(function(project) {
      return nameMatchScore(needle, normalizeProjectName2(project.name)) >= SEARCH_SCORE_THRESHOLD;
    }) : sorted;
    return matches.slice(0, limit);
  }
  function projectsAreEquivalent(left, right) {
    const leftUrl = normalizeProjectUrl(left && left.url);
    const rightUrl = normalizeProjectUrl(right && right.url);
    if (leftUrl && rightUrl && leftUrl === rightUrl) return true;
    const leftName = normalizeProjectName2(left && left.name);
    const rightName = normalizeProjectName2(right && right.name);
    if (!leftName || leftName !== rightName) return false;
    return !leftUrl || !rightUrl || leftUrl === rightUrl;
  }

  // src/core/projects.js
  function createProjects(ctx) {
    function findProjectRecordById(id) {
      const needle = String(id || "").trim();
      if (!needle) return null;
      const library = ctx.getProjectLibrary();
      for (let i = 0; i < library.length; i += 1) {
        if (library[i].id === needle) return library[i];
      }
      return null;
    }
    function findProjectById(id) {
      const entry = findProjectRecordById(id);
      return entry && entry.status !== "archived" ? entry : null;
    }
    function createProjectEntry(name, url) {
      const now = Date.now();
      return sanitizeProjectEntry({
        id: createId("project"),
        name,
        url,
        status: "active",
        createdAt: now,
        updatedAt: now,
        updatedBy: String(ctx.getSettings && ctx.getSettings().sheetsNickname || "")
      });
    }
    function listProjects() {
      return ctx.getProjectLibrary().filter(function(entry) {
        return entry.status !== "archived";
      }).map(function(entry) {
        return deepClone(entry);
      });
    }
    function getProjectSuggestions(name, url, excludeId) {
      return findProjectSuggestions(ctx.getProjectLibrary(), {
        name,
        url
      }, {
        limit: 5,
        excludeId
      });
    }
    function getProjectsByCreatedAt() {
      return sortProjectsByCreatedAt(ctx.getProjectLibrary()).map(function(entry) {
        return deepClone(entry);
      });
    }
    function searchProjects(name, limit) {
      return searchProjectsByName(ctx.getProjectLibrary(), name, { limit }).map(function(entry) {
        return deepClone(entry);
      });
    }
    function closeProjectSearch() {
      ctx.runtime.projectSearchOpen = false;
      ctx.runtime.projectSearchQuery = "";
    }
    function toggleProjectSearch() {
      ctx.runtime.projectSearchOpen = !ctx.runtime.projectSearchOpen;
      ctx.runtime.projectSearchQuery = "";
      ctx.renderSoon();
      return ctx.runtime.projectSearchOpen;
    }
    function setProjectSearchQuery(value) {
      ctx.runtime.projectSearchQuery = String(value || "");
      ctx.renderSoon();
    }
    function selectProjectSearchResult(id) {
      closeProjectSearch();
      return selectProject(id);
    }
    function formatProjectOptionLabel(entry) {
      const name = entry.name || "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F";
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
      if (project.id) return findProjectById(project.id) ? project : sanitizeProject({});
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
      ctx.renderSoon();
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
      } else if (active.id && !findProjectById(active.id)) {
        const stored = findProjectRecordById(active.id);
        if (stored && stored.status === "archived") {
          active.id = "";
          active.name = "";
          active.url = "";
        } else if (active.name) {
          const match = library.find(function(entry) {
            return entry.status !== "archived" && entry.name === active.name && entry.url === active.url;
          });
          active.id = match ? match.id : "";
        }
      }
      ctx.runtime.project = active;
      syncProjectDraftFromActive();
      ctx.runtime.projectEditorOpen = !active.id && !listProjects().length;
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
      closeProjectSearch();
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
      if (typeof ctx.queueProjectUpsert === "function") ctx.queueProjectUpsert(entry);
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
      entry.status = "active";
      entry.updatedAt = Date.now();
      entry.updatedBy = String(ctx.getSettings && ctx.getSettings().sheetsNickname || "").trim();
      ctx.setProjectLibrary(sanitizeProjectLibrary(ctx.getProjectLibrary()));
      ctx.saveProjectLibrary();
      if (typeof ctx.queueProjectUpsert === "function") ctx.queueProjectUpsert(entry);
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
      const entry = findProjectById(needle);
      if (!entry) return false;
      entry.status = "archived";
      entry.updatedAt = Date.now();
      entry.updatedBy = String(ctx.getSettings && ctx.getSettings().sheetsNickname || "").trim();
      ctx.setProjectLibrary(sanitizeProjectLibrary(ctx.getProjectLibrary()));
      ctx.saveProjectLibrary();
      if (typeof ctx.queueProjectArchive === "function") ctx.queueProjectArchive(entry);
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
      ctx.runtime.project = sanitizeProject({
        id: entry.id,
        name: entry.name,
        url: entry.url
      });
      closeProjectSearch();
      syncProjectDraftFromActive();
      ctx.runtime.projectEditorOpen = false;
      ctx.saveProject();
      ctx.renderSoon();
      return ctx.getState();
    }
    function openProjectEditor() {
      closeProjectSearch();
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
      closeProjectSearch();
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
      if (typeof ctx.syncProjectsFromSheets === "function") {
        ctx.syncProjectsFromSheets().catch(function() {
        });
      }
    }
    function deleteSelectedProject(root) {
      const select = root.querySelector('[data-field="projectSelect"]');
      const selectedId = select ? select.value : "";
      if (!selectedId || !deleteProject(selectedId)) return false;
      beginNewProjectForm(root);
      return true;
    }
    function reconcileProjectIds(idMap) {
      const mapping = idMap && typeof idMap === "object" ? idMap : {};
      if (!Object.keys(mapping).length) return;
      let historyChanged = false;
      const nextHistory = ctx.getHistory().map(function(event) {
        const project = sanitizeProject(event && event.project || {});
        const nextId = mapping[project.id];
        if (!nextId) return event;
        historyChanged = true;
        return Object.assign({}, event, {
          project: sanitizeProject({ id: nextId, name: project.name, url: project.url })
        });
      });
      if (historyChanged) {
        ctx.setHistory(nextHistory);
        ctx.saveHistory();
      }
      const active = sanitizeProject(ctx.runtime.project || {});
      if (mapping[active.id]) {
        active.id = mapping[active.id];
        ctx.runtime.project = active;
        ctx.saveProject();
      }
    }
    function replaceProjectEntry(value) {
      const entry = sanitizeProjectEntry(value || {});
      const library = ctx.getProjectLibrary().filter(function(item) {
        return item.id !== entry.id;
      });
      library.push(entry);
      ctx.setProjectLibrary(sanitizeProjectLibrary(library));
      ctx.saveProjectLibrary();
      if (ctx.runtime.project && ctx.runtime.project.id === entry.id) {
        if (entry.status === "archived") {
          ctx.runtime.project = sanitizeProject({});
          ctx.runtime.projectFilterEnabled = false;
        } else {
          ctx.runtime.project = sanitizeProject(entry);
        }
        syncProjectDraftFromActive();
        ctx.saveProject();
        ctx.saveUiState();
      }
      ctx.renderSoon();
      return deepClone(entry);
    }
    return {
      findProjectRecordById,
      findProjectById,
      createProjectEntry,
      listProjects,
      getProjectSuggestions,
      getProjectsByCreatedAt,
      searchProjects,
      toggleProjectSearch,
      closeProjectSearch,
      setProjectSearchQuery,
      selectProjectSearchResult,
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
      deleteSelectedProject,
      reconcileProjectIds,
      replaceProjectEntry
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
    function handlePayload(payload, context) {
      const activeAdapter = ctx.getActiveAdapter();
      if (!activeAdapter || !activeAdapter.networkEnabled) return;
      const taskId = extractTaskId(payload);
      if (taskId && context.pending) {
        context.pending.taskId = taskId;
      }
      const balanceCandidate = activeAdapter.extractBalance(payload, context.url);
      if (!balanceCandidate) return;
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
      stringifyBody
    };
  }

  // src/core/api.js
  function createApi(ctx) {
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
        diagnostics: ctx.runtime.diagnostics.slice(-80)
      });
    }
    function resetSession() {
      ctx.setSession(createSession());
      ctx.saveSession();
      ctx.renderSoon();
      return getState();
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
      ctx.runtime.projectSearchOpen = false;
      ctx.runtime.projectSearchQuery = "";
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
    function exposeApi() {
      const api = {
        version: VERSION,
        getState,
        resetSession,
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
        syncProjectsFromSheets: ctx.syncProjectsFromSheets
      };
      const pageWindow = getPageWindow();
      pageWindow.AITokenTracker = api;
      pageWindow.KlingTokenTracker = api;
    }
    return {
      exposeApi,
      getState,
      resetSession,
      clearHistory,
      forgetBalance,
      resetAll,
      deleteSpendEvent: ctx.deleteSpendEvent,
      undoLastSpend: ctx.undoLastSpend
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
      search: [
        '<circle cx="11" cy="11" r="7"/>',
        '<path d="M20 20l-4-4"/>'
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

  // src/ui/panel-styles.js
  var PANEL_STYLES = [
    ":host{display:block;position:relative}",
    ":host(:hover) .panel,.panel.undo-active{opacity:1}",
    ':host{--ktt-idle-opacity:.24;--ktt-font:"Google Sans","Roboto",Arial,sans-serif;--ktt-radius-sm:14px;--ktt-radius-md:20px;--ktt-radius-lg:32px;--ktt-radius-pill:999px;--ktt-black:#000;--ktt-surface:rgba(0,0,0,.78);--ktt-surface-elevated:rgba(255,255,255,.06);--ktt-surface-container:rgba(255,255,255,.08);--ktt-surface-container-high:rgba(255,255,255,.12);--ktt-surface-hover:rgba(255,255,255,.14);--ktt-glass:rgba(255,255,255,.10);--ktt-on-surface:#f8fafc;--ktt-on-surface-variant:#94a3b8;--ktt-on-surface-muted:#64748b;--ktt-outline:rgba(255,255,255,.12);--ktt-outline-variant:rgba(255,255,255,.06);--ktt-primary:#38bdf8;--ktt-primary-deep:#1d4ed8;--ktt-on-primary:#fff;--ktt-primary-container:rgba(56,189,248,.16);--ktt-on-primary-container:#bae6fd;--ktt-link:#7dd3fc;--ktt-warning:#fbbf24;--ktt-warning-container:rgba(251,191,36,.12);--ktt-blur:blur(14px);--ktt-glow:0 8px 28px rgba(0,0,0,.45);--ktt-glow-hover:0 10px 36px rgba(0,0,0,.55);--ktt-focus-ring:0 0 0 2px rgba(0,0,0,.8),0 0 0 4px rgba(56,189,248,.75);--ktt-gradient-spectrum:linear-gradient(90deg,#f87171,#fbbf24,#4ade80,#38bdf8,#818cf8,#e879f9);--ktt-gradient-blue-v:linear-gradient(180deg,#7dd3fc 0%,#3b82f6 38%,#1e3a8a 72%,#000 100%);--ktt-gradient-blue-h:linear-gradient(90deg,#67e8f9 0%,#3b82f6 55%,#1d4ed8 100%);--ktt-gradient-blue-soft:linear-gradient(145deg,rgba(125,211,252,.22) 0%,rgba(59,130,246,.14) 50%,rgba(30,58,138,.08) 100%);--ktt-gradient-header:linear-gradient(180deg,rgba(125,211,252,.18) 0%,rgba(59,130,246,.08) 45%,transparent 100%);--ktt-gradient-hero:radial-gradient(ellipse 90% 80% at 50% 0%,rgba(56,189,248,.28),rgba(29,78,216,.12) 45%,transparent 70%),linear-gradient(180deg,rgba(125,211,252,.12),rgba(0,0,0,.2));--ktt-gradient-undo:linear-gradient(90deg,rgba(56,189,248,.35),rgba(129,140,248,.2),transparent);--ktt-gradient-progress:linear-gradient(90deg,#67e8f9,#38bdf8,#3b82f6,#818cf8);--ktt-gradient-text:linear-gradient(180deg,#e0f2fe 0%,#7dd3fc 40%,#3b82f6 100%);--ktt-accent-ui:#fbbf24;--ktt-accent-mixed:#4ade80;--ktt-accent-network:#38bdf8;--ktt-accent-default:#60a5fa}',
    "@media (prefers-color-scheme:light){:host{--ktt-surface:rgba(255,255,255,.88);--ktt-surface-elevated:rgba(255,255,255,.95);--ktt-surface-container:rgba(15,23,42,.05);--ktt-surface-container-high:rgba(15,23,42,.08);--ktt-surface-hover:rgba(15,23,42,.07);--ktt-glass:rgba(255,255,255,.72);--ktt-on-surface:#0f172a;--ktt-on-surface-variant:#475569;--ktt-on-surface-muted:#64748b;--ktt-outline:rgba(15,23,42,.12);--ktt-outline-variant:rgba(15,23,42,.06);--ktt-primary:#0284c7;--ktt-primary-deep:#1d4ed8;--ktt-on-primary:#fff;--ktt-primary-container:rgba(2,132,199,.10);--ktt-on-primary-container:#0369a1;--ktt-link:#0284c7;--ktt-glow:0 8px 24px rgba(15,23,42,.12);--ktt-glow-hover:0 10px 32px rgba(15,23,42,.16);--ktt-gradient-header:linear-gradient(180deg,rgba(125,211,252,.20) 0%,transparent 100%);--ktt-gradient-hero:radial-gradient(ellipse 90% 80% at 50% 0%,rgba(56,189,248,.14),transparent 65%),linear-gradient(180deg,rgba(241,245,249,.9),rgba(255,255,255,.6));--ktt-gradient-undo:linear-gradient(90deg,rgba(2,132,199,.16),transparent);--ktt-gradient-text:linear-gradient(180deg,#0369a1,#0284c7,#0ea5e9)}}",
    "@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}",
    /* ── Panel: black glass + spectral rim ── */
    ".panel{position:relative;width:286px;color:var(--ktt-on-surface);background:var(--ktt-surface);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);border-radius:var(--ktt-radius-lg);overflow:hidden;font:13px/1.45 var(--ktt-font);opacity:var(--ktt-idle-opacity);transition:opacity .35s cubic-bezier(.4,0,.2,1),box-shadow .35s cubic-bezier(.4,0,.2,1);box-shadow:var(--ktt-glow)}",
    '.panel::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:rgba(255,255,255,.14);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.55}',
    '.panel::after{content:"";position:absolute;inset:1px;border-radius:calc(var(--ktt-radius-lg) - 1px);background:linear-gradient(180deg,rgba(125,211,252,.06),transparent 35%);pointer-events:none;z-index:0}',
    ".panelAura{display:none}",
    ":host(:hover) .panel{box-shadow:var(--ktt-glow-hover);opacity:1}",
    ".panel.collapsed .panelContent{display:none}",
    ".panelContent{position:relative;z-index:1}",
    /* ── Header ── */
    ".header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:10px 12px 9px;background:var(--ktt-gradient-header),var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);user-select:none;min-height:34px;cursor:move;overflow:hidden;border-bottom:1px solid var(--ktt-outline-variant)}",
    '.header::after{content:"";position:absolute;left:10%;right:10%;top:0;height:1px;background:rgba(255,255,255,.18);opacity:.7;pointer-events:none}',
    ".headerDefault{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;flex:1;position:relative;z-index:1}",
    ".panel.undo-active .header{background:var(--ktt-gradient-undo),var(--ktt-primary-container)}",
    "@keyframes undoFlash{0%,100%{filter:brightness(1)}50%{filter:brightness(1.2)}}",
    "@keyframes orbPulse{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}",
    "@keyframes spectrumShift{0%,100%{filter:hue-rotate(0deg)}50%{filter:hue-rotate(18deg)}}",
    ".panel.undo-fresh .header{animation:undoFlash .6s ease-in-out 4,orbPulse 2.4s ease-in-out infinite}",
    ".panel.undo-active .headerDefault{display:none}",
    ".headerDrag{display:flex;align-items:center;gap:9px;min-width:0;flex:1;cursor:move}",
    ".headerControls{display:flex;align-items:center;gap:6px;flex-shrink:0;position:relative;z-index:1}",
    ".headerBtn{width:28px;height:28px;flex-shrink:0;cursor:pointer;border-radius:var(--ktt-radius-pill);background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);border-color:var(--ktt-outline-variant)}",
    ".headerBtn svg{width:13px;height:13px}",
    ".brandMark{position:relative;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--ktt-glass);border:1px solid var(--ktt-outline-variant);color:var(--ktt-on-surface-variant);font-size:10px;font-weight:700;flex-shrink:0}",
    ".brandMark::before{display:none}",
    ".title{font-weight:800;letter-spacing:-.03em;font-size:13px;color:#fff}",
    ".versionBtn{appearance:none;border:1px solid var(--ktt-outline-variant);background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);color:var(--ktt-on-surface-variant);border-radius:var(--ktt-radius-pill);padding:5px 11px;font:11px var(--ktt-font);cursor:pointer;white-space:nowrap;transition:background .2s cubic-bezier(.4,0,.2,1),color .2s ease,box-shadow .2s ease}",
    ".versionBtn:hover{background:var(--ktt-surface-hover);color:#fff}",
    ".badge{font-size:9px;border-radius:var(--ktt-radius-pill);padding:4px 10px;background:var(--ktt-glass);border:1px solid var(--ktt-outline-variant);color:var(--ktt-on-surface-variant);text-transform:uppercase;font-weight:700;letter-spacing:.07em}",
    /* ── Project strip ── */
    ".projectBox{margin:0;padding:8px 12px 7px;border-bottom:1px solid var(--ktt-outline-variant);display:grid;gap:6px;background:linear-gradient(180deg,rgba(255,255,255,.04),transparent)}",
    ".projectBox.filterOn{border-bottom-color:transparent;background:linear-gradient(90deg,rgba(56,189,248,.14),transparent);box-shadow:inset 3px 0 0 var(--ktt-primary)}",
    ".projectStrip{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;align-items:stretch}",
    ".projectStrip .select.field{width:100%;min-width:0;padding:6px 24px 6px 10px;font-size:10px;min-height:30px;border-radius:var(--ktt-radius-pill);font-weight:600;background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur)}",
    ".projectActionRail{display:flex;align-items:stretch;width:100%;border-radius:var(--ktt-radius-pill);background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);border:1px solid var(--ktt-outline-variant);overflow:hidden;isolation:isolate}",
    ".projectActionBtn{flex:1 1 0;width:auto;min-width:28px;height:28px;border:none!important;border-radius:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:transparent!important;padding:0;color:var(--ktt-on-surface-variant);box-shadow:none!important;transition:background .22s cubic-bezier(.4,0,.2,1),color .22s ease}",
    ".projectActionBtn svg{width:13px;height:13px}",
    ".projectActionBtn:hover{background:rgba(255,255,255,.1)!important;color:#fff;box-shadow:none!important;transform:none}",
    ".projectActionBtn:active{transform:scale(.96)!important}",
    ".projectActionBtn.is-active{background:var(--ktt-gradient-blue-h)!important;color:#fff!important;box-shadow:none!important}",
    ".projectActionBtn--accent:hover{background:var(--ktt-primary-container)!important;color:var(--ktt-link)!important}",
    ".projectActionBtn--danger:hover{background:rgba(248,113,113,.14)!important;color:#fca5a5!important}",
    ".projectActionSep{width:1px;align-self:stretch;margin:5px 0;background:var(--ktt-outline-variant);flex-shrink:0}",
    ".projectSearchPanel{display:grid;gap:6px}",
    ".projectSearchPanel[hidden]{display:none}",
    ".projectSearchInputRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}",
    ".projectSearchInputRow .field{padding:8px 11px;font-size:11px;min-height:34px}",
    ".projectSearchClose{width:34px;height:34px;border-radius:var(--ktt-radius-pill);border:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
    ".projectSearchResults{display:grid;gap:5px;max-height:150px;overflow:auto}",
    ".projectSearchResult{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;padding:9px 11px;text-align:left;background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);border:1px solid var(--ktt-outline-variant);border-radius:var(--ktt-radius-md);cursor:pointer;transition:background .2s ease,box-shadow .2s ease,transform .2s ease}",
    ".projectSearchResult:hover{background:rgba(56,189,248,.12);transform:translateX(2px)}",
    ".projectSearchResultName{font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".projectSearchResultMeta{color:var(--ktt-on-surface-muted);font-size:9px;white-space:nowrap}",
    ".projectSearchEmpty{padding:4px 2px;color:var(--ktt-on-surface-muted);font-size:10px}",
    ".projectEditor{display:grid;gap:8px}",
    ".projectBox.compact .projectEditor{display:none}",
    ".projectFields{display:grid;gap:6px}",
    ".projectSuggestions{display:grid;gap:6px;padding:10px;border:1px solid rgba(251,191,36,.35);border-radius:var(--ktt-radius-md);background:var(--ktt-warning-container)}",
    ".projectSuggestions[hidden]{display:none}",
    ".projectSuggestionsTitle{font-size:10px;line-height:1.35;color:var(--ktt-warning);font-weight:700}",
    ".projectSuggestionsList{display:grid;gap:5px}",
    ".projectSuggestion{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;text-align:left;padding:8px 10px;background:var(--ktt-glass);border:1px solid var(--ktt-outline-variant);border-radius:var(--ktt-radius-sm);cursor:pointer;transition:background .15s ease}",
    ".projectSuggestion:hover{background:var(--ktt-surface-hover)}",
    ".projectSuggestion.exact{border-color:rgba(251,191,36,.5);background:var(--ktt-warning-container)}",
    ".projectSuggestionMain{min-width:0;display:grid;gap:2px}",
    ".projectSuggestionName{font-size:11px;font-weight:700;line-height:1.35;white-space:normal;overflow-wrap:anywhere;word-break:break-word}",
    ".projectSuggestionMeta{font-size:9px;color:var(--ktt-on-surface-muted);line-height:1.3;white-space:normal;overflow-wrap:anywhere;word-break:break-word}",
    ".projectSuggestionAction{font-size:9px;color:var(--ktt-link);align-self:start;padding-top:1px;font-weight:700;flex-shrink:0}",
    ".projectCreateAnyway{font-size:10px;padding:7px 10px;background:transparent;border-color:var(--ktt-outline)}",
    ".projectActionsRow{display:grid;grid-template-columns:1fr auto;gap:6px}",
    ".projectActionsRow button{font-weight:700}",
    ".projectHint{color:var(--ktt-on-surface-muted);font-size:11px;line-height:1.35}",
    /* ── Tabs: frosted segmented control ── */
    ".tabs{padding:7px 12px 0}",
    ".tabsTrack{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;padding:3px;border-radius:var(--ktt-radius-pill);background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);border:1px solid var(--ktt-outline-variant);overflow:hidden;isolation:isolate}",
    ".tab{appearance:none;border:none;outline:none;background:transparent;color:var(--ktt-on-surface-variant);border-radius:var(--ktt-radius-pill);padding:6px 8px;font:11px var(--ktt-font);cursor:pointer;transition:background .25s cubic-bezier(.4,0,.2,1),color .25s ease,box-shadow .25s ease;font-weight:600;overflow:hidden;background-clip:padding-box}",
    ".tab:hover{background:rgba(255,255,255,.08);color:#fff}",
    ".tab.active{background:var(--ktt-gradient-blue-h);color:#fff}",
    ".tabPanel{display:none}",
    ".tabPanel.active{display:block}",
    ".body{padding:10px 12px 14px}",
    /* ── Summary: service chips only ── */
    ".summaryCard{position:relative;padding:9px 10px;border-radius:var(--ktt-radius-md);background:var(--ktt-gradient-hero);border:1px solid var(--ktt-outline-variant);overflow:hidden;margin-bottom:6px}",
    ".summaryCard::before{display:none}",
    ".summaryCardGlow{display:none}",
    ".summaryChips{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:5px;align-items:center}",
    ".summaryChips:empty{display:none}",
    ".serviceChip{display:inline-flex;align-items:baseline;gap:4px;padding:5px 10px;border-radius:var(--ktt-radius-pill);background:rgba(255,255,255,.07);border:1px solid var(--ktt-outline-variant);font-size:11px;line-height:1.2;white-space:nowrap}",
    ".serviceChipName{color:var(--ktt-on-surface-variant);font-weight:600;font-size:10px}",
    ".serviceChipValue{color:#fff;font-weight:800;font-size:11px}",
    ".sectionHead{display:flex;align-items:center;gap:6px;margin:2px 0 6px}",
    '.sectionHead::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(56,189,248,.3),transparent)}',
    ".sectionTitle{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ktt-on-surface-muted)}",
    /* ── Recent events: horizontal chips ── */
    ".events{display:flex;flex-direction:row;flex-wrap:nowrap;gap:6px;align-items:stretch;overflow-x:auto;overflow-y:hidden;padding:1px 2px 6px;margin:0 -2px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}",
    ".events::-webkit-scrollbar{height:4px}",
    ".events::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:999px}",
    ".events::-webkit-scrollbar-track{background:transparent}",
    ".events > .empty{flex:1 0 100%;margin:0}",
    ".eventCard{display:flex;flex:0 0 auto;align-items:center;gap:7px;min-width:108px;max-width:148px;padding:5px 11px 5px 10px;border-radius:var(--ktt-radius-pill);background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);border:1px solid var(--ktt-outline-variant);overflow:hidden;scroll-snap-align:start;will-change:transform}",
    '.eventCard::before{content:"";width:6px;height:6px;border-radius:50%;flex-shrink:0;background:var(--ktt-primary)}',
    ".eventCard--ui::before{background:var(--ktt-accent-ui)}",
    ".eventCard--mixed::before{background:var(--ktt-accent-mixed)}",
    ".eventCard--network::before{background:var(--ktt-accent-network)}",
    ".eventBody{flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;gap:0 8px;align-items:center;padding:0}",
    ".eventTop{display:flex;align-items:center;gap:6px;min-width:0;flex:1}",
    ".histSpendMain{display:contents}",
    ".histTime{font-size:10px;font-weight:700;color:var(--ktt-on-primary-container);white-space:nowrap}",
    ".eventBody .histAmount{color:#fff;font-weight:800;font-size:16px;line-height:1.1;letter-spacing:-.03em;flex-shrink:0}",
    ".histSpendService{color:var(--ktt-on-surface-variant);white-space:nowrap;font-size:10px}",
    ".source{color:var(--ktt-on-surface-muted);text-transform:uppercase;font-size:8px;letter-spacing:.06em;font-weight:700;flex-shrink:0}",
    ".eventTime{grid-column:1;grid-row:1}",
    ".eventAmount{grid-column:2;grid-row:1/span 2;align-self:center;justify-self:end}",
    ".eventService{grid-column:1;grid-row:2;min-width:0;color:var(--ktt-on-surface-variant);font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "@keyframes eventChipEnter{from{opacity:0;transform:translateX(-18px) scale(.96)}to{opacity:1;transform:translateX(0) scale(1)}}",
    ".eventCard--enter{animation:eventChipEnter .34s cubic-bezier(.4,0,.2,1) both}",
    "@media (prefers-reduced-motion:reduce){.eventCard--enter{animation:none}}",
    /* ── History ── */
    ".history{display:flex;flex-direction:column;gap:6px;max-height:360px;overflow:auto;padding-right:2px}",
    ".histItem{display:flex;flex-direction:column;border-radius:var(--ktt-radius-sm);background:rgba(15,23,42,.65);border:1px solid var(--ktt-outline-variant);border-left:3px solid var(--ktt-primary);transition:transform .15s ease,border-color .15s ease;position:relative;overflow:hidden;flex:0 0 auto;min-height:44px}",
    ".histAccent{display:none!important}",
    ".histItem--ui{border-left-color:var(--ktt-accent-ui)}",
    ".histItem--mixed{border-left-color:var(--ktt-accent-mixed)}",
    ".histItem--network{border-left-color:var(--ktt-accent-network)}",
    ".histBody{padding:8px 10px;display:flex;flex-direction:column;gap:4px;min-width:0;min-height:0;flex:1 1 auto}",
    ".histHead{display:flex;align-items:center;justify-content:space-between;gap:8px}",
    ".histMain{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}",
    ".histBody .histAmount{color:#fff;font-weight:800;font-size:14px;line-height:1.2;letter-spacing:-.02em}",
    ".histSub{display:flex;flex-wrap:wrap;align-items:center;gap:6px}",
    ".histService{font-size:11px;font-weight:700;color:var(--ktt-link);white-space:nowrap}",
    ".histItem:hover{transform:translateY(-1px);border-color:rgba(56,189,248,.28)}",
    ".histDelete{width:24px;height:24px;flex-shrink:0;border:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;opacity:.5;padding:0}",
    ".histDelete:hover{opacity:1;background:rgba(255,255,255,.12)!important}",
    ".histMeta{color:var(--ktt-on-surface-variant);font-size:10px;display:flex;flex-wrap:wrap;gap:5px}",
    ".pill{border:1px solid var(--ktt-outline-variant);border-radius:var(--ktt-radius-pill);padding:2px 8px;background:rgba(255,255,255,.08);font-size:10px;font-weight:600;color:var(--ktt-on-surface-variant)}",
    ".raw{color:var(--ktt-on-surface-muted);font-size:11px;line-height:1.45;word-break:break-word}",
    ".rawLink{color:var(--ktt-link);text-decoration:none;font-weight:600}",
    ".rawLink:hover{text-decoration:underline}",
    ".histHeader{display:flex;flex-direction:column;gap:4px;font-size:10px;color:var(--ktt-on-surface-variant);min-width:0;flex:1;text-align:left}",
    ".histHeaderTop{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}",
    ".histHeaderLeft{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden}",
    ".histFilterBadge{flex-shrink:0;background:var(--ktt-gradient-blue-h);color:#fff;border-radius:var(--ktt-radius-pill);padding:3px 10px;font-size:10px;font-weight:800;line-height:1.35}",
    ".histHeaderSummary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".histHeader strong{color:#fff}",
    ".histHeaderMeta{color:var(--ktt-on-surface-muted);font-size:10px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".histAccBar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;padding:4px}",
    ".histAccToggle{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 8px;border:none;border-radius:var(--ktt-radius-sm);background:transparent;color:#fff;cursor:pointer;text-align:left;min-width:0}",
    ".histAccToggle:hover{background:rgba(255,255,255,.06)}",
    ".historyAcc.open .histAccToggle{background:linear-gradient(90deg,rgba(56,189,248,.10),transparent)}",
    ".histAccFilter{display:flex;align-items:center;padding-right:4px}",
    ".histAccFilter:empty{display:none}",
    ".histAccBody{padding:0 8px 8px;gap:0}",
    ".histAccBody .history{max-height:320px;min-height:0}",
    ".historyAcc:not(.open) .histAccBody{display:none!important}",
    ".acc.historyAcc.open>.accBody.histAccBody{display:block!important}",
    ".histShowAll{flex-shrink:0;appearance:none;border:1px solid var(--ktt-outline-variant);background:var(--ktt-glass);color:var(--ktt-link);border-radius:var(--ktt-radius-pill);padding:5px 12px;font:10px/1.3 var(--ktt-font);cursor:pointer;font-weight:700;transition:background .2s ease}",
    ".histShowAll:hover{background:var(--ktt-surface-hover)}",
    ".histShowAll.active{background:var(--ktt-gradient-blue-h);border-color:transparent;color:#fff}",
    ".histItem--matched{border-color:rgba(56,189,248,.45);background:linear-gradient(135deg,rgba(56,189,248,.16),rgba(15,23,42,.62))}",
    ".grid{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:baseline}",
    ".label{color:var(--ktt-on-surface-variant)}",
    ".value{font-weight:700;text-align:right;color:#fff;font-size:14px}",
    ".muted{color:var(--ktt-on-surface-variant)}",
    /* ── Form controls ── */
    ".select.field{cursor:pointer;padding-right:28px}",
    ".field{width:100%;box-sizing:border-box;border:1px solid var(--ktt-outline-variant);background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);color:#fff;border-radius:var(--ktt-radius-sm);padding:9px 12px;font:12px var(--ktt-font);outline:none;transition:border-color .2s ease,box-shadow .2s ease}",
    ".field:focus{border-color:rgba(56,189,248,.6);box-shadow:var(--ktt-focus-ring)}",
    ".field:focus-visible{outline:none}",
    ".miniBtn{width:30px;height:30px}",
    ".miniBtn svg{width:14px;height:14px}",
    ".miniBtn.is-active{background:var(--ktt-primary-container)!important;border-color:rgba(56,189,248,.5)!important;color:var(--ktt-link)!important;box-shadow:none!important}",
    ".miniBtn.is-disabled{opacity:.35;pointer-events:none}",
    /* ── M3 Expressive checkboxes ── */
    ".m3Check{position:relative;display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none}",
    ".m3Check input{position:absolute;opacity:0;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}",
    ".m3CheckBox{position:relative;flex-shrink:0;width:20px;height:20px;border-radius:6px;border:2px solid var(--ktt-outline);background:rgba(0,0,0,.22);box-sizing:border-box;transition:border-color .22s cubic-bezier(.4,0,.2,1),background .22s ease,box-shadow .22s ease,transform .18s cubic-bezier(.4,0,.2,1)}",
    ".m3Check:hover .m3CheckBox{border-color:rgba(56,189,248,.55)}",
    ".m3Check input:focus-visible+.m3CheckBox{box-shadow:var(--ktt-focus-ring)}",
    ".m3Check input:checked+.m3CheckBox{border-color:transparent;background:var(--ktt-gradient-blue-h);transform:scale(1.04)}",
    '.m3Check input:checked+.m3CheckBox::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}',
    ".filterChip .m3CheckBox{width:16px;height:16px;border-radius:5px;border-width:1.5px}",
    ".filterChip:has(input:checked) .m3CheckBox{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.55);box-shadow:none;transform:none}",
    ".filterChip:has(input:checked) .m3CheckBox::after{left:4px;top:1px;width:4px;height:8px;border-width:0 2px 2px 0}",
    /* ── Buttons ── */
    "button{appearance:none;border:1px solid var(--ktt-outline-variant);background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur);color:#fff;border-radius:var(--ktt-radius-pill);padding:8px 12px;font:12px var(--ktt-font);cursor:pointer;min-width:0;transition:background .2s ease,box-shadow .2s ease,transform .15s ease;font-weight:600}",
    "button:hover{background:rgba(255,255,255,.14)}",
    "button:active{transform:scale(.98)}",
    "button:focus-visible{outline:none;box-shadow:var(--ktt-focus-ring)}",
    "button.active{background:var(--ktt-gradient-blue-h);border:none}",
    ".tabsTrack .tab{border:none;backdrop-filter:none;-webkit-backdrop-filter:none;overflow:hidden;background-clip:padding-box}",
    ".tabsTrack .tab.active{border:none;backdrop-filter:none;-webkit-backdrop-filter:none;transform:none}",
    ".projectActionRail .projectActionBtn{border:none;backdrop-filter:none;-webkit-backdrop-filter:none}",
    ".histFilterBadge,.undoAction{border:none}",
    ".iconBtn{position:relative;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:var(--ktt-radius-pill)}",
    ".iconBtn svg{width:17px;height:17px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}",
    ".iconBtn[data-tooltip]::after{content:attr(data-tooltip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);padding:6px 10px;border-radius:var(--ktt-radius-sm);background:rgba(0,0,0,.9);border:1px solid var(--ktt-outline-variant);color:#fff;font-size:11px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s,transform .12s;z-index:2}",
    '.iconBtn[data-tooltip]::before{content:"";position:absolute;left:50%;bottom:calc(100% + 3px);transform:translateX(-50%);border:5px solid transparent;border-top-color:rgba(0,0,0,.9);opacity:0;pointer-events:none;transition:opacity .12s;z-index:2}',
    ".iconBtn[data-tooltip]:hover::after{opacity:1;transform:translateX(-50%) translateY(-2px)}",
    ".iconBtn[data-tooltip]:hover::before{opacity:1}",
    ".empty{color:var(--ktt-on-surface-variant);font-size:12px;padding:14px 10px;text-align:center;border-radius:var(--ktt-radius-md);background:var(--ktt-glass);border:1px dashed var(--ktt-outline-variant)}",
    /* ── Settings ── */
    ".settingsForm{display:grid;gap:8px}",
    ".acc{border:1px solid var(--ktt-outline-variant);border-radius:var(--ktt-radius-md);overflow:hidden;background:var(--ktt-glass);backdrop-filter:var(--ktt-blur);-webkit-backdrop-filter:var(--ktt-blur)}",
    ".accHead{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:10px 12px;background:transparent;border:none;color:#fff;font:11px/1.2 var(--ktt-font);cursor:pointer;text-align:left;transition:background .2s ease}",
    ".accHead:hover{background:rgba(255,255,255,.06)}",
    ".acc.open .accHead{background:linear-gradient(90deg,rgba(56,189,248,.14),transparent)}",
    ".accTitle{font-weight:800}",
    ".accMeta{color:var(--ktt-on-surface-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}",
    ".accChevron{width:12px;height:12px;opacity:.75;transition:transform .25s cubic-bezier(.4,0,.2,1);display:inline-flex}",
    ".accChevron svg{width:12px;height:12px;stroke:currentColor}",
    ".acc.open .accChevron{transform:rotate(180deg)}",
    ".accBody{display:none;padding:10px 12px 12px;gap:7px}",
    ".acc.open .accBody{display:grid}",
    ".settingsCompactRow{display:grid;grid-template-columns:72px minmax(0,1fr);gap:4px 6px;align-items:center}",
    ".settingsLabel{color:var(--ktt-on-surface-variant);font-size:10px;font-weight:600}",
    ".settingsInline{display:flex;align-items:center;gap:6px;min-width:0}",
    ".settingsValue{color:#fff;font-weight:800;font-size:10px;min-width:28px;text-align:right}",
    ".settingsCompactRow .field{padding:5px 8px;font-size:11px;min-height:30px;border-radius:var(--ktt-radius-pill)}",
    '.settingsCompactRow input[type="range"]{padding:0;min-height:0;height:20px;accent-color:var(--ktt-primary)}',
    ".settingsCheck{display:inline-flex;align-items:center;gap:10px;color:#fff;font-size:10px;cursor:pointer;user-select:none;grid-column:1/-1;font-weight:600;padding:4px 0}",
    ".settingsStatus{color:var(--ktt-on-surface-muted);font-size:10px;line-height:1.3;word-break:break-word;grid-column:1/-1}",
    ".settingsActions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;grid-column:1/-1}",
    ".settingsActions--pair{grid-template-columns:1fr 1fr}",
    ".settingsActions button,.settingsReset{padding:7px 9px;font-size:10px}",
    ".settingsReset{margin-top:2px}",
    ".versionList{display:grid;gap:8px}",
    ".versionItem{display:grid;gap:3px;border-top:1px solid var(--ktt-outline-variant);padding-top:8px}",
    ".versionItem:first-child{border-top:none;padding-top:0}",
    ".versionTop{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#fff;font-weight:800;font-size:11px}",
    ".versionDate{color:var(--ktt-on-surface-muted);font-weight:400}",
    ".versionChanges{margin:0;padding-left:14px;color:var(--ktt-on-surface-variant);font-size:10px;line-height:1.35}",
    /* ── Undo ── */
    ".undoToast{display:none;width:100%;grid-template-columns:auto minmax(0,1fr) auto auto;gap:6px;align-items:center;position:relative;z-index:1}",
    ".panel.undo-active .undoToast{display:grid}",
    ".undoIcon{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--ktt-gradient-blue-h);color:#fff}",
    ".undoIcon svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}",
    ".undoText{display:grid;gap:0;min-width:0;color:var(--ktt-on-surface-variant);font-size:10px;line-height:1.2}",
    ".undoText strong{color:#fff;font-size:11px;line-height:1.15}",
    ".undoProjectButton{appearance:none;border:0;background:transparent;color:#fff;padding:0;min-width:0;max-width:100%;font:700 11px/1.15 var(--ktt-font);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}",
    ".undoProjectButton:hover{color:var(--ktt-link);text-decoration:underline}",
    ".undoMeta{color:var(--ktt-on-surface-variant);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".undoAction{padding:7px 13px;font-size:11px;font-weight:800;border-radius:var(--ktt-radius-pill);background:var(--ktt-gradient-blue-h);border-color:transparent;color:#fff}",
    ".undoClose{width:28px;height:28px;border-radius:50%}",
    ".undoProgressTrack{display:none;position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.08);overflow:hidden}",
    ".panel.undo-active .undoProgressTrack{display:block}",
    ".undoProgressBar{display:block;width:100%;height:100%;background:var(--ktt-gradient-progress);transform-origin:left center;transition:transform .1s linear}",
    ".undoProjectPicker{display:none;width:100%;position:relative;z-index:1}",
    ".panel.undo-picking .undoToast{display:none}",
    ".panel.undo-picking .undoProjectPicker{display:block}",
    ".panel.undo-picking .header{background:var(--ktt-gradient-undo),var(--ktt-primary-container)}",
    ".undoProjectChoose{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:5px;align-items:center}",
    ".undoProjectCreate{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:5px;align-items:center}",
    ".undoProjectChoose[hidden],.undoProjectCreate[hidden]{display:none}",
    ".undoProjectPicker .field{min-height:32px;padding:6px 28px 6px 10px;font-size:10px}",
    ".undoProjectSearch{grid-column:1/-1;padding-right:10px!important}",
    ".undoProjectCreate .field{grid-column:1/-1;padding-right:10px}",
    ".undoCreateProject{grid-column:1/-1;padding:8px 11px;font-size:10px;background:var(--ktt-primary-container);border-color:rgba(56,189,248,.4);color:var(--ktt-on-primary-container);font-weight:700}",
    ".undoPickerAction{padding:7px 10px;font-size:10px;font-weight:800;background:var(--ktt-gradient-blue-h);border-color:transparent;color:#fff}",
    ".undoPickerCancel{padding:7px 10px;font-size:10px}",
    ".sheetsNicknameWarn{padding:9px 14px;background:var(--ktt-warning-container);border-bottom:1px solid rgba(251,191,36,.25);color:var(--ktt-warning);font-size:10px;line-height:1.35;cursor:pointer;font-weight:600}",
    ".sheetsNicknameWarn[hidden]{display:none}",
    '.tabPanel[data-panel="settings"]{max-height:280px;overflow:auto;padding-top:4px}'
  ].join("");

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
  function installPanelListeners(ctx, shadow, setPanelCollapsed) {
    function createProjectFromUndoInputs() {
      const nameInput = shadow.querySelector('[data-field="undoProjectCreateName"]');
      const urlInput = shadow.querySelector('[data-field="undoProjectCreateUrl"]');
      const created = ctx.createProjectForUndo(
        nameInput ? nameInput.value : "",
        urlInput ? urlInput.value : ""
      );
      if (!created && nameInput) {
        nameInput.focus();
        nameInput.setCustomValidity("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430");
        nameInput.reportValidity();
      }
    }
    shadow.addEventListener("click", function(event) {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      const action = actionEl.getAttribute("data-action");
      switch (action) {
        case "reset":
          ctx.resetSession();
          break;
        case "resetAll":
          ctx.resetAll();
          break;
        case "undoSpend":
          ctx.undoLastSpend();
          break;
        case "openUndoProjectPicker":
          event.stopPropagation();
          if (ctx.openUndoProjectPicker()) {
            window.setTimeout(function() {
              const input = shadow.querySelector('[data-field="undoProjectSearch"]');
              if (input) input.focus();
            }, 0);
          }
          break;
        case "applyUndoProject": {
          const select = shadow.querySelector('[data-field="undoProjectSelect"]');
          ctx.applyUndoProject(select ? select.value : "");
          break;
        }
        case "cancelUndoProject":
          ctx.resumeUndoProjectPicker();
          break;
        case "openUndoProjectCreator":
          if (ctx.openUndoProjectCreator()) {
            window.setTimeout(function() {
              const input = shadow.querySelector('[data-field="undoProjectCreateName"]');
              if (input) {
                input.focus();
                input.select();
              }
            }, 0);
          }
          break;
        case "backUndoProjectPicker":
          ctx.closeUndoProjectCreator();
          break;
        case "cancelUndoProjectCreate":
          ctx.resumeUndoProjectPicker();
          break;
        case "createUndoProject":
          createProjectFromUndoInputs();
          break;
        case "closeUndoToast":
          ctx.hideUndoSpend();
          break;
        case "showVersions":
          event.preventDefault();
          event.stopPropagation();
          ctx.setActiveTab("settings");
          window.setTimeout(function() {
            const versionsAcc = shadow.querySelector('[data-acc="versions"]');
            if (versionsAcc) versionsAcc.classList.add("open");
          }, 60);
          break;
        case "clearProject":
          ctx.clearProject();
          break;
        case "toggleProjectSearch": {
          const opened = ctx.toggleProjectSearch();
          if (opened) {
            window.setTimeout(function() {
              const input = shadow.querySelector('[data-field="projectSearchInput"]');
              if (input) input.focus();
            }, 0);
          }
          break;
        }
        case "closeProjectSearch":
          ctx.closeProjectSearch();
          ctx.renderSoon();
          break;
        case "editProject":
          ctx.openProjectEditor();
          break;
        case "cancelProjectEdit":
          ctx.syncProjectDraftFromActive();
          ctx.closeProjectEditor();
          break;
        case "newProject":
          ctx.beginNewProjectForm(shadow);
          break;
        case "deleteProject":
          ctx.deleteSelectedProject(shadow);
          break;
        case "saveProject":
        case "createProjectAnyway":
          ctx.saveProjectFromForm(shadow);
          break;
        case "toggleCollapse":
          event.stopPropagation();
          setPanelCollapsed(!ctx.runtime.panelCollapsed);
          break;
        case "toggleSettingsAcc": {
          const acc = actionEl.closest("[data-acc]");
          if (acc) {
            const open = acc.classList.toggle("open");
            const toggle = acc.querySelector(".histAccToggle, .accHead");
            if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
          }
          break;
        }
        case "toggleProjectFilter":
          event.stopPropagation();
          ctx.setProjectFilterEnabled(!ctx.isProjectFilterActive());
          break;
        case "testSheetsConnection":
          applySheetsFieldsFromForm(ctx, shadow);
          {
            const statusEl = shadow.querySelector('[data-field="settingSheetsStatus"]');
            const testButton = shadow.querySelector('[data-action="testSheetsConnection"]');
            if (statusEl) statusEl.textContent = "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F\u2026";
            if (testButton) testButton.disabled = true;
            const runTest = typeof ctx.testSheetsConnection === "function" ? ctx.testSheetsConnection() : Promise.reject(new Error("sheets module not ready"));
            runTest.then(function() {
              if (statusEl) statusEl.textContent = "\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 OK";
            }).catch(function() {
            }).finally(function() {
              if (testButton) testButton.disabled = false;
              ctx.renderSoon();
            });
          }
          break;
        case "retrySheetsSync":
          applySheetsFieldsFromForm(ctx, shadow);
          Promise.all([ctx.retryFailedSyncs(), ctx.retryProjectSyncs()]).then(function() {
            ctx.renderSoon();
          });
          break;
        case "refreshSheetsData":
          applySheetsFieldsFromForm(ctx, shadow);
          {
            const statusEl = shadow.querySelector('[data-field="settingSheetsStatus"]');
            const refreshButton = shadow.querySelector('[data-action="refreshSheetsData"]');
            if (statusEl) statusEl.textContent = "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0445\u2026";
            if (refreshButton) refreshButton.disabled = true;
            Promise.resolve(ctx.refreshSheetsData()).catch(function() {
            }).then(function() {
              if (refreshButton) refreshButton.disabled = false;
              ctx.renderSoon();
            });
          }
          break;
        case "resetSettings":
          ctx.resetSettings();
          break;
        default:
          break;
      }
    });
    shadow.querySelector('[data-field="undoProjectSearch"]').addEventListener("input", function(event) {
      const select = shadow.querySelector('[data-field="undoProjectSelect"]');
      ctx.setUndoProjectSearchQuery(event.currentTarget.value, select ? select.value : "");
    });
    shadow.querySelector('[data-field="undoProjectSelect"]').addEventListener("change", function(event) {
      ctx.setUndoPendingProject(event.currentTarget.value);
    });
    ["undoProjectCreateName", "undoProjectCreateUrl"].forEach(function(field) {
      shadow.querySelector('[data-field="' + field + '"]').addEventListener("input", function() {
        const nameInput = shadow.querySelector('[data-field="undoProjectCreateName"]');
        const urlInput = shadow.querySelector('[data-field="undoProjectCreateUrl"]');
        if (nameInput) nameInput.setCustomValidity("");
        ctx.setUndoProjectCreateDraft(
          nameInput ? nameInput.value : "",
          urlInput ? urlInput.value : ""
        );
      });
      shadow.querySelector('[data-field="' + field + '"]').addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
          event.preventDefault();
          createProjectFromUndoInputs();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          ctx.closeUndoProjectCreator();
        }
      });
    });
    shadow.querySelector('[data-field="projectSearchInput"]').addEventListener("input", function(event) {
      ctx.setProjectSearchQuery(event.currentTarget.value);
    });
    shadow.querySelector('[data-field="projectSearchInput"]').addEventListener("keydown", function(event) {
      if (event.key !== "Escape") return;
      ctx.closeProjectSearch();
      ctx.renderSoon();
    });
    shadow.querySelector('[data-field="projectSearchResults"]').addEventListener("click", function(event) {
      const button = event.target.closest("[data-project-search-id]");
      if (!button) return;
      ctx.selectProjectSearchResult(button.getAttribute("data-project-search-id"));
    });
    shadow.querySelector('[data-field="projectSuggestionsList"]').addEventListener("click", function(event) {
      const button = event.target.closest("[data-project-id]");
      if (!button) return;
      ctx.selectProject(button.getAttribute("data-project-id"));
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
    Array.from(shadow.querySelectorAll("[data-tab]")).forEach(function(button) {
      button.addEventListener("click", function() {
        ctx.setActiveTab(button.getAttribute("data-tab"));
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
  }
  function createPanelModule(ctx) {
    function getPanelMount() {
      return document.documentElement || document.body || null;
    }
    function createPanel() {
      const mount = getPanelMount();
      if (!mount) return;
      if (ctx.runtime.panelHost) {
        const existingShadow = ctx.runtime.panelHost.shadowRoot;
        const needsRecreate = existingShadow && (!existingShadow.querySelector(".summaryChips") || existingShadow.querySelector(".statChip") || existingShadow.querySelector(".summaryStats") || existingShadow.querySelector(".summaryTop") || existingShadow.querySelector('[data-field="source"]'));
        if (needsRecreate) {
          ctx.runtime.panelHost.remove();
          ctx.runtime.panelHost = null;
          ctx.runtime.shadowRoot = null;
        } else {
          if (!ctx.runtime.panelHost.isConnected) {
            mount.appendChild(ctx.runtime.panelHost);
          }
          if (existingShadow) {
            const styleEl = existingShadow.querySelector("style");
            if (styleEl) styleEl.textContent = PANEL_STYLES;
          }
          return;
        }
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
        font: '13px/1.4 "Google Sans",Roboto,Arial,sans-serif'
      });
      host.style.setProperty("--ktt-idle-opacity", String(ctx.runtime.settings && ctx.runtime.settings.idleOpacity || 0.2));
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = [
        "<style>",
        PANEL_STYLES,
        "</style>",
        '<div class="panel' + (ctx.runtime.panelCollapsed ? " collapsed" : "") + '">',
        '  <div class="panelAura" aria-hidden="true"></div>',
        '  <div class="header" data-drag-handle>',
        '    <div class="headerDefault" data-field="headerDefault">',
        '      <div class="headerDrag">',
        '        <span class="brandMark" aria-hidden="true">\u2726</span>',
        '        <div class="title">AITT</div>',
        '        <div class="badge" data-field="serviceName">none</div>',
        "      </div>",
        '      <div class="headerControls">',
        '        <button type="button" class="versionBtn" data-action="showVersions" data-field="versionBadge" aria-label="\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0432\u0435\u0440\u0441\u0438\u0439">v-</button>',
        '        <button type="button" class="iconBtn headerBtn" data-action="toggleCollapse" data-tooltip="\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C" aria-label="\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C">' + iconSvg(ctx.runtime.panelCollapsed ? "chevron-up" : "chevron-down") + "</button>",
        "      </div>",
        "    </div>",
        '    <div class="undoToast" data-field="undoToast" aria-hidden="true">',
        '      <span class="undoIcon">' + iconSvg("rotate-ccw") + "</span>",
        '      <span class="undoText"><button type="button" class="undoProjectButton" data-action="openUndoProjectPicker" data-field="undoProjectName" aria-label="\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442">\u0411\u0435\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u25BE</button><span class="undoMeta" data-field="undoMeta"></span></span>',
        '      <button type="button" class="undoAction" data-action="undoSpend">\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C</button>',
        '      <button type="button" class="iconBtn undoClose" data-action="closeUndoToast" data-tooltip="\u0417\u0430\u043A\u0440\u044B\u0442\u044C" aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043E\u0442\u043C\u0435\u043D\u0443">' + iconSvg("x") + "</button>",
        "    </div>",
        '    <div class="undoProjectPicker" data-field="undoProjectPicker">',
        '      <div class="undoProjectChoose" data-field="undoProjectChoose">',
        '        <input class="field undoProjectSearch" data-field="undoProjectSearch" type="search" placeholder="\u041F\u043E\u0438\u0441\u043A \u043F\u0440\u043E\u0435\u043A\u0442\u0430">',
        '        <select class="field select" data-field="undoProjectSelect" aria-label="\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442"></select>',
        '        <button type="button" class="undoPickerAction" data-action="applyUndoProject">\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C</button>',
        '        <button type="button" class="undoPickerCancel" data-action="cancelUndoProject">\u041E\u0442\u043C\u0435\u043D\u0430</button>',
        '        <button type="button" class="undoCreateProject" data-action="openUndoProjectCreator">+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442</button>',
        "      </div>",
        '      <div class="undoProjectCreate" data-field="undoProjectCreate" hidden>',
        '        <input class="field" data-field="undoProjectCreateName" type="text" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430">',
        '        <input class="field" data-field="undoProjectCreateUrl" type="url" placeholder="URL \u043F\u0440\u043E\u0435\u043A\u0442\u0430 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)">',
        '        <button type="button" class="undoPickerAction" data-action="createUndoProject">\u0421\u043E\u0437\u0434\u0430\u0442\u044C</button>',
        '        <button type="button" class="undoPickerCancel" data-action="backUndoProjectPicker">\u041D\u0430\u0437\u0430\u0434</button>',
        '        <button type="button" class="undoPickerCancel" data-action="cancelUndoProjectCreate">\u041E\u0442\u043C\u0435\u043D\u0430</button>',
        "      </div>",
        "    </div>",
        '    <span class="undoProgressTrack" aria-hidden="true"><span class="undoProgressBar" data-field="undoProgressBar"></span></span>',
        "  </div>",
        '  <div class="panelContent">',
        '  <div class="projectBox compact" data-field="projectBox">',
        '    <div class="projectStrip">',
        '      <select class="field select" data-field="projectSelect" aria-label="\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442"></select>',
        '      <div class="projectActionRail" role="toolbar" aria-label="\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u043C">',
        '        <button type="button" class="iconBtn projectActionBtn" data-action="toggleProjectSearch" data-tooltip="\u041F\u043E\u0438\u0441\u043A \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432" aria-label="\u041F\u043E\u0438\u0441\u043A \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432">' + iconSvg("search") + "</button>",
        '        <button type="button" class="iconBtn projectActionBtn" data-action="editProject" data-tooltip="\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442" aria-label="\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442">' + iconSvg("pencil") + "</button>",
        '        <span class="projectActionSep" aria-hidden="true"></span>',
        '        <button type="button" class="iconBtn projectActionBtn projectActionBtn--accent" data-action="newProject" data-tooltip="\u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442" aria-label="\u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442">' + iconSvg("plus") + "</button>",
        '        <span class="projectActionSep" aria-hidden="true"></span>',
        '        <button type="button" class="iconBtn projectActionBtn projectActionBtn--danger" data-action="deleteProject" data-tooltip="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442" aria-label="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442">' + iconSvg("trash-2") + "</button>",
        '        <button type="button" class="iconBtn projectActionBtn" data-action="clearProject" data-tooltip="\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442" aria-label="\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442">' + iconSvg("x") + "</button>",
        "      </div>",
        "    </div>",
        '    <div class="projectSearchPanel" data-field="projectSearchPanel" hidden>',
        '      <div class="projectSearchInputRow">',
        '        <input class="field" data-field="projectSearchInput" type="search" placeholder="\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E">',
        '        <button type="button" class="iconBtn projectSearchClose" data-action="closeProjectSearch" data-tooltip="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0438\u0441\u043A" aria-label="\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0438\u0441\u043A">' + iconSvg("x") + "</button>",
        "      </div>",
        '      <div class="projectSearchResults" data-field="projectSearchResults"></div>',
        "    </div>",
        '    <div class="projectEditor" data-field="projectEditor">',
        '      <div class="projectFields">',
        '        <input class="field" data-field="projectName" type="text" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438">',
        '        <input class="field" data-field="projectUrl" type="url" placeholder="URL \u0437\u0430\u0434\u0430\u0447\u0438">',
        "      </div>",
        '      <div class="projectSuggestions" data-field="projectSuggestions" hidden>',
        '        <div class="projectSuggestionsTitle" data-field="projectSuggestionsTitle"></div>',
        '        <div class="projectSuggestionsList" data-field="projectSuggestionsList"></div>',
        '        <button type="button" class="projectCreateAnyway" data-action="createProjectAnyway">\u0412\u0441\u0451 \u0440\u0430\u0432\u043D\u043E \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439</button>',
        "      </div>",
        '      <div class="projectActionsRow">',
        '        <button type="button" data-action="saveProject" data-field="saveProjectButton">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432 \u0441\u043F\u0438\u0441\u043E\u043A</button>',
        '        <button type="button" data-action="cancelProjectEdit">\u041E\u0442\u043C\u0435\u043D\u0430</button>',
        "      </div>",
        '      <div class="projectHint" data-field="projectHint">\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u044B\u0439.</div>',
        "    </div>",
        "  </div>",
        '  <div class="sheetsNicknameWarn" data-field="sheetsNicknameWarn" hidden>\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0438\u043C\u044F \u0432 \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u2192 Google Sheets</div>',
        '  <div class="tabs">',
        '    <div class="tabsTrack">',
        '      <button type="button" class="tab" data-tab="summary">\u0421\u0432\u043E\u0434\u043A\u0430</button>',
        '      <button type="button" class="tab" data-tab="history">\u0418\u0441\u0442\u043E\u0440\u0438\u044F</button>',
        '      <button type="button" class="tab" data-tab="settings">\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</button>',
        "    </div>",
        "  </div>",
        '  <div class="body">',
        '   <div class="tabPanel" data-panel="summary">',
        '    <div class="summaryCard" data-field="projectGrid" hidden>',
        '      <div class="summaryCardGlow" aria-hidden="true"></div>',
        '      <div class="summaryChips" data-field="projectBreakdown"></div>',
        "    </div>",
        '    <div class="sectionHead"><span class="sectionTitle">\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435</span></div>',
        '    <div class="events" data-field="events"></div>',
        "   </div>",
        '   <div class="tabPanel" data-panel="history">',
        '    <div class="acc historyAcc open" data-acc="history">',
        '      <div class="histAccBar">',
        '        <button type="button" class="accHead histAccToggle" data-action="toggleSettingsAcc" aria-expanded="true">',
        '          <div class="histHeader" data-field="historyHeader"></div>',
        '          <span class="accChevron">' + iconSvg("chevron-down") + "</span>",
        "        </button>",
        '        <div class="histAccFilter" data-field="historyFilter"></div>',
        "      </div>",
        '      <div class="accBody histAccBody">',
        '        <div class="history" data-field="history"></div>',
        "      </div>",
        "    </div>",
        "   </div>",
        '   <div class="tabPanel" data-panel="settings">',
        '    <div class="settingsForm">',
        '      <div class="acc open" data-acc="panel">',
        '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
        '          <span class="accTitle">\u041F\u0430\u043D\u0435\u043B\u044C</span>',
        '          <span class="accMeta" data-field="settingAccMetaPanel">20% \xB7 286px</span>',
        '          <span class="accChevron">' + iconSvg("chevron-down") + "</span>",
        "        </button>",
        '        <div class="accBody">',
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">\u041F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C</span>',
        '            <div class="settingsInline">',
        '              <input class="field" data-field="settingIdleOpacity" type="range" min="10" max="80" step="5">',
        '              <span class="settingsValue" data-field="settingIdleOpacityValue">20%</span>',
        "            </div>",
        "          </div>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">\u0428\u0438\u0440\u0438\u043D\u0430</span>',
        '            <select class="field select" data-field="settingPanelWidth">',
        '              <option value="260">260 px</option>',
        '              <option value="286">286 px</option>',
        '              <option value="320">320 px</option>',
        "            </select>",
        "          </div>",
        '          <label class="m3Check settingsCheck">',
        '            <input type="checkbox" data-field="settingRememberPosition">',
        '            <span class="m3CheckBox" aria-hidden="true"></span>',
        "            <span>\u0417\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u0442\u044C \u043F\u043E\u0437\u0438\u0446\u0438\u044E</span>",
        "          </label>",
        "        </div>",
        "      </div>",
        '      <div class="acc" data-acc="display">',
        '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
        '          <span class="accTitle">\u041E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435</span>',
        '          <span class="accMeta" data-field="settingAccMetaDisplay">3 \xB7 50</span>',
        '          <span class="accChevron">' + iconSvg("chevron-down") + "</span>",
        "        </button>",
        '        <div class="accBody">',
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">\u0421\u0432\u043E\u0434\u043A\u0430</span>',
        '            <select class="field select" data-field="settingSummaryEvents">',
        '              <option value="1">1</option>',
        '              <option value="3">3</option>',
        '              <option value="5">5</option>',
        '              <option value="10">10</option>',
        "            </select>",
        "          </div>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">\u0418\u0441\u0442\u043E\u0440\u0438\u044F</span>',
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
        '          <span class="accTitle">\u0412\u0435\u0440\u0441\u0438\u0438</span>',
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
        '          <label class="m3Check settingsCheck">',
        '            <input type="checkbox" data-field="settingSheetsEnabled">',
        '            <span class="m3CheckBox" aria-hidden="true"></span>',
        "            <span>\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u0442\u0440\u0430\u0442 \u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432</span>",
        "          </label>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">\u0418\u043C\u044F</span>',
        '            <input class="field" data-field="settingSheetsNickname" type="text" placeholder="\u0418\u043C\u044F \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0435">',
        "          </div>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">\u0422\u043E\u043A\u0435\u043D</span>',
        '            <input class="field" data-field="settingSheetsSecretToken" type="password" placeholder="\u0421\u0435\u043A\u0440\u0435\u0442">',
        "          </div>",
        '          <div class="settingsCompactRow">',
        '            <span class="settingsLabel">URL</span>',
        '            <input class="field" data-field="settingSheetsWebAppUrl" type="url" placeholder=".../exec">',
        "          </div>",
        '          <div class="settingsStatus" data-field="settingSheetsStatus">\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u0441 Sheets \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430.</div>',
        '          <div class="settingsActions">',
        '            <button type="button" data-action="testSheetsConnection">\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C</button>',
        '            <button type="button" data-action="retrySheetsSync">\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C</button>',
        '            <button type="button" data-action="refreshSheetsData">\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C</button>',
        "          </div>",
        "        </div>",
        "      </div>",
        '      <div class="acc" data-acc="data">',
        '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
        '          <span class="accTitle">\u0414\u0430\u043D\u043D\u044B\u0435</span>',
        '          <span class="accMeta">2</span>',
        '          <span class="accChevron">' + iconSvg("chevron-down") + "</span>",
        "        </button>",
        '        <div class="accBody">',
        '          <div class="settingsActions settingsActions--pair">',
        '            <button type="button" data-action="reset">\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0441\u0435\u0441\u0441\u0438\u044E</button>',
        '            <button type="button" data-action="resetAll">\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0441\u0451</button>',
        "          </div>",
        "        </div>",
        "      </div>",
        '      <button type="button" class="settingsReset" data-action="resetSettings">\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</button>',
        "    </div>",
        "   </div>",
        "  </div>",
        "</div>"
      ].join("");
      installPanelListeners(ctx, shadow, setPanelCollapsed);
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
        const label = ctx.runtime.panelCollapsed ? "\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C" : "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C";
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
  function getUndoVisualState(undo, now) {
    const current = Number(now || Date.now());
    const expiresAt = Number(undo && undo.expiresAt || 0);
    const startedAt = Number(undo && undo.startedAt || expiresAt - SPEND_UNDO_WINDOW_MS);
    const paused = undo && undo.pickerOpen === true;
    const remainingMs = paused ? Math.max(0, Number(undo.remainingMs || 0)) : Math.max(0, expiresAt - current);
    return {
      visible: remainingMs > 0,
      seconds: Math.max(0, Math.ceil(remainingMs / 1e3)),
      progress: Math.max(0, Math.min(1, remainingMs / SPEND_UNDO_WINDOW_MS)),
      fresh: !paused && remainingMs > 0 && current - startedAt < 2200,
      paused
    };
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
    function getHistorySourceClass(event) {
      const sourceType = event.source || "default";
      if (sourceType === "ui" || sourceType === "mixed" || sourceType === "network") {
        return " histItem--" + sourceType;
      }
      return "";
    }
    function createHistoryItem(event, context) {
      context = context || {};
      const item = document.createElement("div");
      item.className = "histItem" + getHistorySourceClass(event);
      if (context.hasProject && !context.filterOn && eventMatchesProject(event, context.activeProject)) {
        item.className += " histItem--matched";
      }
      const body = document.createElement("div");
      body.className = "histBody";
      const header = document.createElement("div");
      header.className = "histHead";
      const main = document.createElement("div");
      main.className = "histMain";
      const amount = document.createElement("div");
      amount.className = "histAmount";
      amount.textContent = "\u2212" + formatCredit(event.amount) + (event.estimated ? " est." : "");
      const sub = document.createElement("div");
      sub.className = "histSub";
      const time = document.createElement("span");
      time.className = "histTime";
      time.textContent = formatTime(event.ts);
      const service = document.createElement("span");
      service.className = "histService";
      service.textContent = event.serviceName || event.service || ctx.getActiveAdapter().name;
      sub.appendChild(time);
      sub.appendChild(service);
      main.appendChild(amount);
      main.appendChild(sub);
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "iconBtn miniBtn histDelete";
      deleteButton.setAttribute("aria-label", "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u0440\u0430\u0442\u0443");
      deleteButton.setAttribute("data-tooltip", "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u0440\u0430\u0442\u0443");
      deleteButton.innerHTML = iconSvg("trash-2");
      deleteButton.addEventListener("click", function(clickEvent) {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        ctx.deleteSpendEvent(event.id);
      });
      header.appendChild(main);
      header.appendChild(deleteButton);
      body.appendChild(header);
      const pills = getHistoryPills(event, { hideProjectPill: context.filterOn === true });
      if (pills.length) {
        const meta = document.createElement("div");
        meta.className = "histMeta";
        pills.forEach(function(text) {
          const pill = document.createElement("span");
          pill.className = "pill";
          pill.textContent = text;
          meta.appendChild(pill);
        });
        body.appendChild(meta);
      }
      const detailText = event.metadata && event.metadata.prompt ? compactText(event.metadata.prompt).slice(0, 180) : hasDisplayMetadata(event) ? "" : cleanUiDetailText(event.detail, event);
      const showProjectLink = event.project && event.project.url;
      const showDetail = !!detailText;
      if (showProjectLink || showDetail) {
        const raw = document.createElement("div");
        raw.className = "raw";
        if (showProjectLink) {
          const link = document.createElement("a");
          link.href = event.project.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "rawLink";
          link.textContent = event.project.name || event.project.url;
          raw.appendChild(link);
          if (showDetail) raw.appendChild(document.createTextNode(" \xB7 " + detailText));
        } else {
          raw.textContent = detailText;
        }
        body.appendChild(raw);
      }
      item.appendChild(body);
      return item;
    }
    function renderProjectSummary(root, activeProject, hasProject) {
      const projectGrid = root.querySelector('[data-field="projectGrid"]');
      const breakdownEl = root.querySelector('[data-field="projectBreakdown"]');
      if (!projectGrid) return;
      if (breakdownEl) breakdownEl.textContent = "";
      if (!hasProject) {
        projectGrid.hidden = true;
        return;
      }
      const totals = ctx.getProjectTotalsByService(activeProject);
      projectGrid.hidden = !totals.length;
      if (!breakdownEl || !totals.length) return;
      totals.forEach(function(item) {
        const chip = document.createElement("span");
        chip.className = "serviceChip";
        chip.innerHTML = '<span class="serviceChipName">' + escapeHtml(item.serviceName || item.service) + '</span><span class="serviceChipValue">\u2212' + formatCredit(item.total) + "</span>";
        breakdownEl.appendChild(chip);
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
      const historyFilter = root.querySelector('[data-field="historyFilter"]');
      const historyAcc = root.querySelector('[data-acc="history"]');
      if (!historyEl) return;
      if (historyAcc) {
        const toggle = historyAcc.querySelector(".histAccToggle");
        if (toggle) {
          toggle.setAttribute("aria-expanded", historyAcc.classList.contains("open") ? "true" : "false");
        }
      }
      if (historyHeader) {
        historyHeader.textContent = "";
        const top = document.createElement("div");
        top.className = "histHeaderTop";
        const left = document.createElement("div");
        left.className = "histHeaderLeft";
        if (hasProject) {
          const projectTotal = ctx.getProjectAllTimeTotal(activeProject);
          const projectCount = ctx.getProjectEventCount(activeProject);
          if (filterOn) {
            const badge = document.createElement("span");
            badge.className = "histFilterBadge";
            badge.textContent = "\u041F\u0440\u043E\u0435\u043A\u0442";
            left.appendChild(badge);
            const summary = document.createElement("span");
            summary.className = "histHeaderSummary";
            summary.innerHTML = "<strong>\u2212" + formatCredit(projectTotal) + "</strong> \xB7 " + projectCount + " \u0441\u043E\u0431.";
            left.appendChild(summary);
          } else {
            const summary = document.createElement("span");
            summary.className = "histHeaderSummary";
            summary.innerHTML = "<strong>" + escapeHtml(activeProject.name) + "</strong> \xB7 \u2212" + formatCredit(projectTotal);
            left.appendChild(summary);
          }
        } else {
          const summary = document.createElement("span");
          summary.className = "histHeaderSummary";
          summary.textContent = "\u0412\u0441\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u044F";
          left.appendChild(summary);
        }
        top.appendChild(left);
        historyHeader.appendChild(top);
        const meta = document.createElement("div");
        meta.className = "histHeaderMeta";
        meta.textContent = formatCredit(ctx.getSession().total || 0) + " \xB7 " + formatCredit(getTodayTotal2());
        historyHeader.appendChild(meta);
      }
      if (historyFilter) {
        historyFilter.textContent = "";
        if (hasProject) {
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "histShowAll" + (filterOn ? " active" : "");
          toggle.setAttribute("data-action", "toggleProjectFilter");
          toggle.textContent = filterOn ? "\u041F\u0440\u043E\u0435\u043A\u0442" : "\u0412\u0441\u0435";
          historyFilter.appendChild(toggle);
        }
      }
      historyEl.textContent = "";
      const history = ctx.getHistory();
      const displayEvents = filterOn ? ctx.getFilteredHistory(activeProject) : history;
      if (!displayEvents.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = filterOn ? "\u041D\u0435\u0442 \u0442\u0440\u0430\u0442 \u043F\u043E \u044D\u0442\u043E\u043C\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0443" : "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u0443\u0441\u0442\u0430";
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
      const suggestionsBox = root.querySelector('[data-field="projectSuggestions"]');
      const suggestionsTitle = root.querySelector('[data-field="projectSuggestionsTitle"]');
      const suggestionsList = root.querySelector('[data-field="projectSuggestionsList"]');
      const saveButton = root.querySelector('[data-field="saveProjectButton"]');
      const searchPanel = root.querySelector('[data-field="projectSearchPanel"]');
      const searchInput = root.querySelector('[data-field="projectSearchInput"]');
      const searchResults = root.querySelector('[data-field="projectSearchResults"]');
      const searchButton = root.querySelector('[data-action="toggleProjectSearch"]');
      const activeProject = ctx.runtime.project || sanitizeProject({});
      const activeId = activeProject.id && ctx.findProjectById(activeProject.id) ? activeProject.id : "";
      const compact = ctx.shouldCompactProject();
      const hasProject = ctx.hasActiveProject();
      const projectLibrary = ctx.listProjects();
      if (projectBox) {
        projectBox.classList.toggle("compact", compact);
        projectBox.classList.toggle("filterOn", false);
      }
      if (select && active !== select) {
        select.textContent = "";
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "\u2014 \u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u2014";
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
      const searchOpen = ctx.runtime.projectSearchOpen === true;
      if (searchPanel) searchPanel.hidden = !searchOpen;
      if (searchButton) searchButton.classList.toggle("is-active", searchOpen);
      if (searchInput && active !== searchInput) {
        searchInput.value = ctx.runtime.projectSearchQuery || "";
      }
      if (searchResults) {
        searchResults.textContent = "";
        if (searchOpen) {
          const results = ctx.searchProjects(ctx.runtime.projectSearchQuery, 5);
          if (!results.length) {
            const empty = document.createElement("div");
            empty.className = "projectSearchEmpty";
            empty.textContent = "\u041F\u0440\u043E\u0435\u043A\u0442\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B";
            searchResults.appendChild(empty);
          }
          results.forEach(function(entry) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "projectSearchResult";
            button.setAttribute("data-project-search-id", entry.id);
            const name = document.createElement("span");
            name.className = "projectSearchResultName";
            name.textContent = entry.name;
            const meta = document.createElement("span");
            meta.className = "projectSearchResultMeta";
            try {
              meta.textContent = new Date(entry.createdAt).toLocaleDateString();
            } catch (_) {
              meta.textContent = "";
            }
            button.appendChild(name);
            button.appendChild(meta);
            searchResults.appendChild(button);
          });
        }
      }
      const suggestions = ctx.runtime.projectEditorOpen && !activeId ? ctx.getProjectSuggestions(
        ctx.runtime.projectDraft.name,
        ctx.runtime.projectDraft.url,
        ""
      ) : [];
      if (suggestionsBox) suggestionsBox.hidden = suggestions.length === 0;
      if (saveButton) saveButton.hidden = suggestions.length > 0;
      if (suggestionsTitle) {
        suggestionsTitle.textContent = suggestions.some(function(entry) {
          return entry.matchExact;
        }) ? "\u0422\u0430\u043A\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0435\u0433\u043E \u0438\u043B\u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0433\u043E." : "\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0442\u0430\u043A\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C:";
      }
      if (suggestionsList) {
        suggestionsList.textContent = "";
        suggestions.forEach(function(entry) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "projectSuggestion" + (entry.matchExact ? " exact" : "");
          button.setAttribute("data-project-id", entry.id);
          const main = document.createElement("span");
          main.className = "projectSuggestionMain";
          const name = document.createElement("span");
          name.className = "projectSuggestionName";
          name.textContent = entry.name;
          const meta = document.createElement("span");
          meta.className = "projectSuggestionMeta";
          meta.textContent = [entry.url, entry.updatedBy ? "by " + entry.updatedBy : ""].filter(Boolean).join(" \xB7 ");
          const action = document.createElement("span");
          action.className = "projectSuggestionAction";
          action.textContent = "\u0412\u044B\u0431\u0440\u0430\u0442\u044C";
          main.appendChild(name);
          main.appendChild(meta);
          button.appendChild(main);
          button.appendChild(action);
          suggestionsList.appendChild(button);
        });
      }
      const selectedId = select ? select.value : "";
      if (deleteButton) {
        deleteButton.disabled = !selectedId;
        deleteButton.classList.toggle("is-disabled", !selectedId);
      }
      if (editButton) {
        editButton.disabled = !selectedId;
        editButton.classList.toggle("is-disabled", !selectedId);
      }
      if (hint) {
        if (activeId && activeProject.name) {
          hint.textContent = "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0439: " + activeProject.name;
        } else if (projectLibrary.length) {
          hint.textContent = "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043D\u043E\u0432\u044B\u0439.";
        } else {
          hint.textContent = "\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0435\u0433\u043E \u0432 \u0441\u043F\u0438\u0441\u043E\u043A.";
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
          sheetsMeta.textContent = "\u043E\u0448\u0438\u0431\u043A\u0430";
        } else if (needsSheetsNickname(settings)) {
          sheetsMeta.textContent = "\u043D\u0443\u0436\u043D\u043E \u0438\u043C\u044F";
        } else if (settings.sheetsEnabled) {
          sheetsMeta.textContent = settings.sheetsNickname || "\u0432\u043A\u043B";
        } else {
          sheetsMeta.textContent = "\u0432\u044B\u043A\u043B";
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
          sheetsStatus.textContent = "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u0432\u044B\u043A\u043B";
        } else if (!String(settings.sheetsSecretToken || "").trim()) {
          sheetsStatus.textContent = "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u043E\u043A\u0435\u043D \u2192 \u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C";
        } else if (!String(settings.sheetsNickname || "").trim()) {
          sheetsStatus.textContent = "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043C\u044F";
        } else {
          sheetsStatus.textContent = "\u0413\u043E\u0442\u043E\u0432\u043E";
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
      const visual = getUndoVisualState(undo, now);
      const visible = !!(undo && visual.visible);
      if (!visible) {
        ctx.runtime.undoSpend = null;
      }
      panel.classList.toggle("undo-active", visible);
      panel.classList.toggle("undo-fresh", visible && visual.fresh);
      panel.classList.toggle("undo-picking", visible && visual.paused);
      if (!visible) {
        toast.setAttribute("aria-hidden", "true");
        return;
      }
      const projectName = root.querySelector('[data-field="undoProjectName"]');
      if (projectName) projectName.textContent = (undo.projectName || "\u0411\u0435\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430") + " \u25BE";
      const meta = root.querySelector('[data-field="undoMeta"]');
      if (meta) {
        meta.textContent = "-" + formatCredit(undo.amount) + " \xB7 " + (undo.serviceName || "spend") + " \xB7 " + visual.seconds + "s";
      }
      const progressBar = root.querySelector('[data-field="undoProgressBar"]');
      if (progressBar) progressBar.style.transform = "scaleX(" + visual.progress.toFixed(3) + ")";
      const projectSelect = root.querySelector('[data-field="undoProjectSelect"]');
      const undoSearch = root.querySelector('[data-field="undoProjectSearch"]');
      const projectChoose = root.querySelector('[data-field="undoProjectChoose"]');
      const projectCreate = root.querySelector('[data-field="undoProjectCreate"]');
      const createName = root.querySelector('[data-field="undoProjectCreateName"]');
      const createUrl = root.querySelector('[data-field="undoProjectCreateUrl"]');
      const createButton = root.querySelector('[data-action="openUndoProjectCreator"]');
      const creatingProject = visual.paused && undo.projectCreateOpen === true;
      if (projectChoose) projectChoose.hidden = creatingProject;
      if (projectCreate) projectCreate.hidden = !creatingProject;
      if (undoSearch && root.activeElement !== undoSearch) {
        undoSearch.value = String(undo.projectSearchQuery || "");
      }
      if (createName && root.activeElement !== createName) {
        createName.value = String(undo.projectCreateName || "");
      }
      if (createUrl && root.activeElement !== createUrl) {
        createUrl.value = String(undo.projectCreateUrl || "");
      }
      if (createButton) {
        const draftName = String(undo.projectSearchQuery || "").trim();
        createButton.textContent = draftName ? "+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \xAB" + draftName + "\xBB" : "+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442";
      }
      if (projectSelect && visual.paused && !creatingProject && root.activeElement !== projectSelect) {
        projectSelect.textContent = "";
        const noProject = document.createElement("option");
        noProject.value = "";
        noProject.textContent = "\u0411\u0435\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430";
        projectSelect.appendChild(noProject);
        const filteredProjects = ctx.searchProjects(undo.projectSearchQuery || "");
        const selectedId = String(undo.pendingProjectId || "");
        const selectedVisible = filteredProjects.some(function(project) {
          return project.id === selectedId;
        });
        if (selectedId && !selectedVisible) {
          const current = ctx.findProjectById(selectedId);
          if (current) {
            const currentOption = document.createElement("option");
            currentOption.value = current.id;
            currentOption.textContent = "\u0422\u0435\u043A\u0443\u0449\u0438\u0439: " + ctx.formatProjectOptionLabel(current);
            projectSelect.appendChild(currentOption);
          }
        }
        filteredProjects.forEach(function(project) {
          const option = document.createElement("option");
          option.value = project.id;
          option.textContent = ctx.formatProjectOptionLabel(project);
          projectSelect.appendChild(option);
        });
        projectSelect.value = selectedId;
      }
      toast.setAttribute("aria-hidden", "false");
      if (!visual.paused && !ctx.runtime.undoRenderTimer) {
        ctx.runtime.undoRenderTimer = window.setTimeout(function() {
          ctx.runtime.undoRenderTimer = null;
          renderSoon();
        }, 100);
      }
    }
    function renderPanel() {
      if (!ctx.runtime.shadowRoot) return;
      const root = ctx.runtime.shadowRoot;
      const history = ctx.getHistory();
      const activeProject = ctx.getActiveProject();
      const hasProject = ctx.hasActiveProject();
      const summaryEvents = hasProject ? ctx.getFilteredHistory(activeProject) : history;
      setText(root, "serviceName", ctx.getActiveAdapter().name || "none");
      setText(root, "versionBadge", "v" + VERSION);
      renderProjectFields(root);
      renderProjectSummary(root, activeProject, hasProject);
      renderTabs(root);
      renderSettingsTab(root);
      renderUndoToast(root);
      const nicknameWarn = root.querySelector('[data-field="sheetsNicknameWarn"]');
      if (nicknameWarn) {
        nicknameWarn.hidden = !needsSheetsNickname(ctx.getSettings());
      }
      renderRecentEvents(root, summaryEvents, hasProject);
      renderHistory(root, activeProject, hasProject, ctx.isProjectFilterActive());
    }
    function createEventChip(event) {
      const sourceType = event.source || "default";
      const sourceClass = sourceType === "ui" || sourceType === "mixed" || sourceType === "network" ? " eventCard--" + sourceType : "";
      const row = document.createElement("div");
      row.className = "eventCard" + sourceClass;
      row.setAttribute("data-event-id", String(event.id || ""));
      const body = document.createElement("div");
      body.className = "eventBody";
      const time = document.createElement("span");
      time.className = "histTime eventTime";
      time.textContent = formatTime(event.ts);
      const amount = document.createElement("span");
      amount.className = "histAmount eventAmount";
      amount.textContent = "\u2212" + formatCredit(event.amount) + (event.estimated ? "~" : "");
      const service = document.createElement("span");
      service.className = "eventService";
      service.textContent = event.serviceName || event.service || ctx.getActiveAdapter().name;
      body.appendChild(time);
      body.appendChild(amount);
      body.appendChild(service);
      row.appendChild(body);
      return row;
    }
    function renderRecentEvents(root, summaryEvents, hasProject) {
      const eventsEl = root.querySelector('[data-field="events"]');
      if (!eventsEl) return;
      const nextEvents = summaryEvents.slice(0, ctx.getSettings().summaryEventsCount);
      const nextIds = nextEvents.map(function(event) {
        return String(event && event.id || "");
      });
      const prevIds = Array.isArray(ctx.runtime.summaryEventIds) ? ctx.runtime.summaryEventIds.slice() : [];
      if (!nextEvents.length) {
        eventsEl.textContent = "";
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = hasProject ? "\u041D\u0435\u0442 \u0442\u0440\u0430\u0442 \u043F\u043E \u044D\u0442\u043E\u043C\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0443" : "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0442\u0440\u0430\u0442";
        eventsEl.appendChild(empty);
        ctx.runtime.summaryEventIds = [];
        return;
      }
      const sameList = prevIds.join("|") === nextIds.join("|") && eventsEl.querySelectorAll(".eventCard").length === nextIds.length;
      if (sameList) return;
      const firstIsNew = !!nextIds[0] && nextIds[0] !== prevIds[0];
      const shiftedTail = nextIds.slice(1).join("|") === prevIds.slice(0, Math.max(0, nextIds.length - 1)).join("|");
      const canIncremental = firstIsNew && prevIds.length > 0 && shiftedTail && eventsEl.querySelectorAll(".eventCard").length > 0;
      if (canIncremental) {
        const oldCards = Array.from(eventsEl.querySelectorAll(".eventCard"));
        const prevRects = /* @__PURE__ */ new Map();
        oldCards.forEach(function(card) {
          prevRects.set(card.getAttribute("data-event-id"), card.getBoundingClientRect());
        });
        const chip = createEventChip(nextEvents[0]);
        chip.classList.add("eventCard--enter");
        eventsEl.insertBefore(chip, eventsEl.firstChild);
        while (eventsEl.querySelectorAll(".eventCard").length > nextIds.length) {
          const last = eventsEl.lastElementChild;
          if (!last || !last.classList.contains("eventCard")) break;
          eventsEl.removeChild(last);
        }
        window.requestAnimationFrame(function() {
          oldCards.forEach(function(card) {
            if (!card.isConnected) return;
            const prev = prevRects.get(card.getAttribute("data-event-id"));
            if (!prev) return;
            const nextRect = card.getBoundingClientRect();
            const dx = prev.left - nextRect.left;
            if (Math.abs(dx) < 1) return;
            card.style.transform = "translateX(" + dx + "px)";
            card.style.transition = "none";
            window.requestAnimationFrame(function() {
              card.style.transition = "transform .34s cubic-bezier(.4,0,.2,1)";
              card.style.transform = "";
              const clear = function() {
                card.style.transition = "";
                card.removeEventListener("transitionend", clear);
              };
              card.addEventListener("transitionend", clear);
            });
          });
          if (typeof eventsEl.scrollTo === "function") {
            eventsEl.scrollTo({ left: 0, behavior: "smooth" });
          } else {
            eventsEl.scrollLeft = 0;
          }
        });
        ctx.runtime.summaryEventIds = nextIds;
        return;
      }
      eventsEl.textContent = "";
      nextEvents.forEach(function(event, index) {
        const chip = createEventChip(event);
        if (firstIsNew && prevIds.length && index === 0) {
          chip.classList.add("eventCard--enter");
        }
        eventsEl.appendChild(chip);
      });
      ctx.runtime.summaryEventIds = nextIds;
      if (firstIsNew && prevIds.length) {
        eventsEl.scrollLeft = 0;
      }
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
  function convertRemoteRowToEvent(row, knownProjectIds) {
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
      project: {
        id: knownProjectIds && knownProjectIds[String(row.projectId || "")] ? String(row.projectId || "") : "",
        name: String(row.projectName || ""),
        url: ""
      },
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
  function buildEventProjectPayload(event) {
    const project = event && event.project || {};
    return {
      eventId: String(event && event.id || ""),
      projectId: String(project.id || ""),
      projectName: String(project.name || "").trim()
    };
  }
  function buildProjectPayload(project, settings) {
    const entry = sanitizeProjectEntry(project || {});
    const createdAt = Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now();
    return {
      projectId: entry.id,
      name: entry.name,
      url: entry.url,
      status: entry.status,
      createdAt: new Date(createdAt).toISOString(),
      updatedBy: String(settings && settings.sheetsNickname || "").trim(),
      trackerVersion: VERSION
    };
  }
  function convertRemoteRowToProject(row) {
    if (!row || !row.projectId || !row.name) return null;
    const createdAt = Date.parse(row.createdAt || "");
    const updatedAt = Date.parse(row.updatedAt || "");
    return sanitizeProjectEntry({
      id: String(row.projectId),
      name: String(row.name),
      url: String(row.url || ""),
      status: row.status === "archived" ? "archived" : "active",
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      updatedBy: String(row.updatedBy || "")
    });
  }
  function loadProjectSyncState() {
    const raw = readJson(PROJECTS_SYNC_KEY, {});
    const pending = raw && raw.pending && typeof raw.pending === "object" && !Array.isArray(raw.pending) ? raw.pending : {};
    return {
      initialized: raw && raw.initialized === true,
      pending: Object.assign({}, pending)
    };
  }
  function saveProjectSyncState(state) {
    writeJson(PROJECTS_SYNC_KEY, {
      initialized: state && state.initialized === true,
      pending: Object.assign({}, state && state.pending || {})
    });
  }
  function mergeProjectCatalogs(localProjects, remoteProjects, syncState) {
    const local = sanitizeProjectLibrary(localProjects);
    const remote = sanitizeProjectLibrary(remoteProjects);
    const state = syncState || { initialized: false, pending: {} };
    const initialMerge = state.initialized !== true;
    const pending = Object.assign({}, state.pending || {});
    const remoteById = {};
    const usedRemote = {};
    const result = [];
    const idMap = {};
    remote.forEach(function(entry) {
      remoteById[entry.id] = entry;
    });
    local.forEach(function(entry) {
      const sameId = remoteById[entry.id];
      if (sameId) {
        usedRemote[sameId.id] = true;
        result.push(pending[entry.id] ? entry : sameId);
        return;
      }
      let equivalent = null;
      if (initialMerge) {
        equivalent = remote.find(function(candidate) {
          return !usedRemote[candidate.id] && projectsAreEquivalent(entry, candidate);
        }) || null;
      }
      if (equivalent) {
        usedRemote[equivalent.id] = true;
        idMap[entry.id] = equivalent.id;
        delete pending[entry.id];
        result.push(equivalent);
        return;
      }
      if (initialMerge || pending[entry.id]) {
        result.push(entry);
        if (!pending[entry.id]) {
          pending[entry.id] = entry.status === "archived" ? "archive" : "upsert";
        }
      }
    });
    remote.forEach(function(entry) {
      if (!usedRemote[entry.id]) result.push(entry);
    });
    return {
      projects: sanitizeProjectLibrary(result),
      idMap,
      state: {
        initialized: true,
        pending
      }
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
            reject(error || new Error("\u0441\u0435\u0442\u0435\u0432\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430"));
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
    if (parsed.status === 401 || data && data.error === "unauthorized") return "\u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D";
    if (parsed.status === 404 || /Страница не найдена|не удалось открыть файл|Page Not Found/i.test(body)) {
      return "\u0432\u0435\u0431-\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 404 \u2014 \u043F\u0435\u0440\u0435\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0438\u0442\u0435 Apps Script (Execute as Me, Anyone access)";
    }
    if (parsed.status === 405) {
      return "\u043C\u0435\u0442\u043E\u0434 \u043D\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D \u2014 \u043F\u0435\u0440\u0435\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0438\u0442\u0435 \u0432\u0435\u0431-\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435";
    }
    if (!data && body && body.charAt(0) === "<") {
      return "\u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u0432\u0435\u0431-\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 URL /exec \u0438 \u0440\u0430\u0437\u0432\u0451\u0440\u0442\u044B\u0432\u0430\u043D\u0438\u0435";
    }
    if (parsed.status) return "\u043E\u0448\u0438\u0431\u043A\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 (" + parsed.status + ")";
    return "\u043E\u0448\u0438\u0431\u043A\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438";
  }
  function sendSheetsRequest(ctx, action, payload) {
    const settings = ctx.getSettings();
    if (!canSyncToSheets(settings) && action !== "ping") {
      return Promise.reject(new Error("sheets \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D"));
    }
    if (action === "ping" && !sanitizeSheetsWebAppUrl(settings.sheetsWebAppUrl)) {
      return Promise.reject(new Error("\u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 URL \u0432\u0435\u0431-\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u2014 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 .../macros/s/.../exec"));
    }
    if (action === "ping" && !String(settings.sheetsSecretToken || "").trim()) {
      return Promise.reject(new Error("\u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D"));
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
      const message = error && error.message ? error.message : "\u0441\u0435\u0442\u0435\u0432\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430";
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
  function updateEventProjectInSheets(ctx, event) {
    if (!event || !event.id) return Promise.resolve(null);
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    return sendSheetsRequest(ctx, "updateEventProject", buildEventProjectPayload(event)).then(function(data) {
      if (data && data.updated === false) return data;
      markSyncState(event.id, "synced");
      ctx.addDiagnostic("sheets event project update ok", event.id);
      return data || { ok: true, updated: true };
    }).catch(function(error) {
      markSyncState(event.id, "projectUpdateFailed");
      ctx.addDiagnostic("sheets event project update failed", event.id, error && error.message);
      return null;
    });
  }
  function resumeEventSyncAfterUndo(ctx, event, delayMs) {
    if (!event || !event.id) return Promise.resolve(null);
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    if (getSyncState(event.id) !== "synced") {
      scheduleEventSyncToSheets(ctx, event, delayMs);
      return Promise.resolve({ scheduled: true });
    }
    return updateEventProjectInSheets(ctx, event).then(function(data) {
      if (data && data.updated === false) {
        clearSyncState(event.id);
        scheduleEventSyncToSheets(ctx, event, delayMs);
        return { scheduled: true, missingRemote: true };
      }
      return data;
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
      const currentEvent = ctx.getHistory().find(function(item) {
        return item && item.id === eventId;
      });
      if (!currentEvent) {
        clearSyncState(eventId);
        ctx.addDiagnostic("sheets sync canceled before append", eventId);
        return;
      }
      syncEventToSheets(ctx, currentEvent);
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
      const status = event && getSyncState(event.id);
      return status === "failed" || status === "projectUpdateFailed";
    });
    let synced = 0;
    let chain = Promise.resolve();
    failed.forEach(function(event) {
      chain = chain.then(function() {
        const retry = getSyncState(event.id) === "projectUpdateFailed" ? updateEventProjectInSheets(ctx, event) : syncEventToSheets(ctx, event);
        return retry.then(function(result) {
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
  function setPendingProjectOperation(projectId, operation) {
    const id = String(projectId || "");
    if (!id) return;
    const state = loadProjectSyncState();
    state.pending[id] = operation;
    saveProjectSyncState(state);
  }
  function clearPendingProjectOperation(projectId) {
    const id = String(projectId || "");
    if (!id) return;
    const state = loadProjectSyncState();
    delete state.pending[id];
    saveProjectSyncState(state);
  }
  function queueProjectUpsert(ctx, project) {
    if (!project || !project.id) return null;
    setPendingProjectOperation(project.id, "upsert");
    if (canSyncToSheets(ctx.getSettings())) {
      const state = loadProjectSyncState();
      const sync = state.initialized ? flushPendingProjectSyncs(ctx) : syncProjectsFromSheets(ctx);
      sync.catch(function() {
      });
    }
    return project;
  }
  function queueProjectArchive(ctx, project) {
    if (!project || !project.id) return null;
    setPendingProjectOperation(project.id, "archive");
    if (canSyncToSheets(ctx.getSettings())) {
      const state = loadProjectSyncState();
      const sync = state.initialized ? flushPendingProjectSyncs(ctx) : syncProjectsFromSheets(ctx);
      sync.catch(function() {
      });
    }
    return project;
  }
  function flushPendingProjectSyncs(ctx) {
    if (!canSyncToSheets(ctx.getSettings())) {
      return Promise.resolve({ retried: 0, synced: 0 });
    }
    if (ctx.runtime.projectsFlushPromise) return ctx.runtime.projectsFlushPromise;
    const initialState = loadProjectSyncState();
    const ids = Object.keys(initialState.pending);
    let synced = 0;
    let chain = Promise.resolve();
    ids.forEach(function(id) {
      chain = chain.then(function() {
        const state = loadProjectSyncState();
        const operation = state.pending[id];
        const entry = typeof ctx.findProjectRecordById === "function" ? ctx.findProjectRecordById(id) : null;
        if (!operation || !entry) {
          clearPendingProjectOperation(id);
          return null;
        }
        const action = operation === "archive" ? "archiveProject" : "upsertProject";
        return sendSheetsRequest(ctx, action, buildProjectPayload(entry, ctx.getSettings())).then(function(data) {
          const canonical = convertRemoteRowToProject(data && data.project);
          if (canonical && typeof ctx.replaceProjectEntry === "function") {
            ctx.replaceProjectEntry(canonical);
          }
          clearPendingProjectOperation(id);
          synced += 1;
          ctx.addDiagnostic("project sync ok", id, action);
          return canonical;
        }).catch(function(error) {
          ctx.addDiagnostic("project sync failed", id, error && error.message);
          return null;
        });
      });
    });
    ctx.runtime.projectsFlushPromise = chain.then(function() {
      return { retried: ids.length, synced };
    }).finally(function() {
      ctx.runtime.projectsFlushPromise = null;
    });
    return ctx.runtime.projectsFlushPromise;
  }
  function applyProjectCatalog(ctx, merged) {
    const library = sanitizeProjectLibrary(merged.projects);
    ctx.setProjectLibrary(library);
    ctx.saveProjectLibrary();
    if (typeof ctx.reconcileProjectIds === "function") {
      ctx.reconcileProjectIds(merged.idMap);
    }
    const active = sanitizeProject(ctx.runtime.project || {});
    if (active.id) {
      const canonical = library.find(function(entry) {
        return entry.id === active.id;
      });
      if (!canonical || canonical.status === "archived") {
        ctx.runtime.project = sanitizeProject({});
        ctx.runtime.projectFilterEnabled = false;
      } else {
        ctx.runtime.project = sanitizeProject(canonical);
      }
      if (typeof ctx.syncProjectDraftFromActive === "function") ctx.syncProjectDraftFromActive();
      ctx.saveProject();
      ctx.saveUiState();
    }
    if (typeof ctx.renderSoon === "function") ctx.renderSoon();
  }
  function syncProjectsFromSheets(ctx) {
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    if (ctx.runtime.projectsSyncPromise) return ctx.runtime.projectsSyncPromise;
    ctx.runtime.projectsSyncPromise = sendSheetsRequest(ctx, "listProjects", null).then(function(data) {
      if (!data || data.ok !== true || !Array.isArray(data.projects)) {
        throw new Error("invalid projects response");
      }
      const remote = data.projects.map(convertRemoteRowToProject).filter(Boolean);
      const merged = mergeProjectCatalogs(
        ctx.getProjectLibrary(),
        remote,
        loadProjectSyncState()
      );
      saveProjectSyncState(merged.state);
      applyProjectCatalog(ctx, merged);
      return flushPendingProjectSyncs(ctx).then(function(result) {
        ctx.addDiagnostic("projects pull ok", remote.length);
        return {
          pulled: remote.length,
          pushed: result.synced,
          mergedIds: Object.keys(merged.idMap).length
        };
      });
    }).catch(function(error) {
      ctx.addDiagnostic("projects pull failed", error && error.message);
      throw error;
    }).finally(function() {
      ctx.runtime.projectsSyncPromise = null;
    });
    return ctx.runtime.projectsSyncPromise;
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
      const knownProjectIds = {};
      ctx.getProjectLibrary().forEach(function(project) {
        if (project && project.id) knownProjectIds[project.id] = true;
      });
      const remoteEvents = data.events.map(function(row) {
        return convertRemoteRowToEvent(row, knownProjectIds);
      }).filter(function(event) {
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
      const message = error && error.message ? error.message : "\u0441\u0435\u0442\u0435\u0432\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430";
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
      Promise.all([
        pullEventsFromSheets(ctx),
        syncProjectsFromSheets(ctx)
      ]).catch(function() {
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
      resumeEventSyncAfterUndo: function(event, delayMs) {
        return resumeEventSyncAfterUndo(ctx, event, delayMs);
      },
      updateEventProjectInSheets: function(event) {
        return updateEventProjectInSheets(ctx, event);
      },
      deleteEventFromSheets: function(event) {
        return deleteEventFromSheets(ctx, event);
      },
      retryFailedSyncs: function() {
        return retryFailedSyncs(ctx);
      },
      retryProjectSyncs: function() {
        return flushPendingProjectSyncs(ctx);
      },
      testSheetsConnection: function() {
        return testSheetsConnection(ctx);
      },
      pullEventsFromSheets: function() {
        return pullEventsFromSheets(ctx);
      },
      syncProjectsFromSheets: function() {
        return syncProjectsFromSheets(ctx);
      },
      refreshSheetsData: function() {
        return Promise.all([
          pullEventsFromSheets(ctx),
          syncProjectsFromSheets(ctx)
        ]);
      },
      queueProjectUpsert: function(project) {
        return queueProjectUpsert(ctx, project);
      },
      queueProjectArchive: function(project) {
        return queueProjectArchive(ctx, project);
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
  function createAndAssignUndoProject(ctx, undo, name, url) {
    if (!undo || !undo.pickerOpen || !undo.projectCreateOpen) return null;
    undo.projectCreateName = String(name || "");
    undo.projectCreateUrl = String(url || "");
    const entry = ctx && typeof ctx.addProject === "function" ? ctx.addProject(undo.projectCreateName, undo.projectCreateUrl) : null;
    if (!entry) return null;
    if (typeof ctx.addDiagnostic === "function") {
      ctx.addDiagnostic("project created from undo", entry.id, entry.name);
    }
    return typeof ctx.applyUndoProject === "function" ? ctx.applyUndoProject(entry.id) : null;
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
      diagnostics: [],
      lastUiSpend: null,
      undoSpend: null,
      sheetsSyncTimers: {},
      activeTab: initialUiState.activeTab,
      projectFilterEnabled: initialUiState.projectFilterEnabled,
      project: sanitizeProject(readJson(PROJECT_KEY, {})),
      projectDraft: { name: "", url: "" },
      projectEditorOpen: false,
      projectSearchOpen: false,
      projectSearchQuery: "",
      settings: loadSettings(),
      sheetsNicknameNotified: false
    };
    let history = sanitizeEvents(loadSharedHistory([]));
    let session = sanitizeSession(readJson(SESSION_KEY, null)) || createSession();
    let meta = sanitizeMeta(readJson(META_KEY, {}));
    let projectLibrary = sanitizeProjectLibrary(readJson(PROJECTS_LIBRARY_KEY, []));
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
      if (typeof window !== "undefined" && !window.confirm("\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0441\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E?")) return;
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
        window.alert("AITT: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u0438\u043C\u044F \u0432 \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u2192 Google Sheets, \u0447\u0442\u043E\u0431\u044B \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u043B\u0430 \u0441 \u0432\u0430\u0448\u0438\u043C \u0438\u043C\u0435\u043D\u0435\u043C.");
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
      const startedAt = Date.now();
      runtime.undoSpend = {
        eventId: event.id,
        amount: event.amount,
        serviceName: event.serviceName || event.service || getActiveAdapter().name,
        projectName: String(event.project && event.project.name || "").trim() || "\u0411\u0435\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430",
        startedAt,
        expiresAt: startedAt + SPEND_UNDO_WINDOW_MS,
        pickerOpen: false,
        pausedAt: null,
        remainingMs: SPEND_UNDO_WINDOW_MS
      };
      ctx.renderSoon();
    };
    ctx.openUndoProjectPicker = function() {
      const undo = runtime.undoSpend;
      if (!undo || undo.pickerOpen) return false;
      const now = Date.now();
      const remainingMs = Math.max(0, Number(undo.expiresAt || 0) - now);
      if (!remainingMs) {
        runtime.undoSpend = null;
        ctx.renderSoon();
        return false;
      }
      const event = history.find(function(item) {
        return item && item.id === undo.eventId;
      });
      if (!event) return false;
      undo.pickerOpen = true;
      undo.pausedAt = now;
      undo.remainingMs = remainingMs;
      undo.pendingProjectId = String(event.project && event.project.id || "");
      undo.projectSearchQuery = "";
      undo.projectCreateOpen = false;
      undo.projectCreateName = "";
      undo.projectCreateUrl = "";
      if (typeof ctx.cancelEventSyncToSheets === "function") {
        ctx.cancelEventSyncToSheets(undo.eventId);
      }
      ctx.renderSoon();
      return true;
    };
    ctx.resumeUndoProjectPicker = function() {
      const undo = runtime.undoSpend;
      if (!undo || !undo.pickerOpen) return false;
      const remainingMs = Math.max(1, Number(undo.remainingMs || 0));
      const now = Date.now();
      undo.pickerOpen = false;
      undo.pausedAt = null;
      undo.expiresAt = now + remainingMs;
      const event = history.find(function(item) {
        return item && item.id === undo.eventId;
      });
      if (event && typeof ctx.resumeEventSyncAfterUndo === "function") {
        ctx.resumeEventSyncAfterUndo(event, remainingMs);
      }
      ctx.renderSoon();
      return true;
    };
    ctx.applyUndoProject = function(projectId) {
      const undo = runtime.undoSpend;
      if (!undo || !undo.pickerOpen) return null;
      const id = String(projectId || "");
      const entry = id && typeof ctx.findProjectById === "function" ? ctx.findProjectById(id) : null;
      if (id && !entry) return null;
      const project = entry ? sanitizeProject({ id: entry.id, name: entry.name, url: entry.url }) : sanitizeProject({});
      const changed = replaceEventProject(history, undo.eventId, project, Date.now());
      if (!changed.event) return null;
      history = changed.history;
      ctx.saveHistory();
      undo.projectName = project.name || "\u0411\u0435\u0437 \u043F\u0440\u043E\u0435\u043A\u0442\u0430";
      if (entry) ctx.selectProject(entry.id);
      else ctx.clearProject();
      ctx.addDiagnostic("undo project changed", undo.eventId, project.id || "none");
      ctx.resumeUndoProjectPicker();
      return changed.event;
    };
    ctx.setUndoProjectSearchQuery = function(value, selectedProjectId) {
      const undo = runtime.undoSpend;
      if (!undo || !undo.pickerOpen) return;
      undo.projectSearchQuery = String(value || "");
      if (selectedProjectId != null) undo.pendingProjectId = String(selectedProjectId || "");
      ctx.renderSoon();
    };
    ctx.setUndoPendingProject = function(projectId) {
      const undo = runtime.undoSpend;
      if (!undo || !undo.pickerOpen) return;
      undo.pendingProjectId = String(projectId || "");
    };
    ctx.openUndoProjectCreator = function() {
      const undo = runtime.undoSpend;
      if (!undo || !undo.pickerOpen) return false;
      undo.projectCreateOpen = true;
      undo.projectCreateName = String(undo.projectSearchQuery || "").trim();
      undo.projectCreateUrl = "";
      ctx.renderSoon();
      return true;
    };
    ctx.closeUndoProjectCreator = function() {
      const undo = runtime.undoSpend;
      if (!undo || !undo.pickerOpen || !undo.projectCreateOpen) return false;
      undo.projectCreateOpen = false;
      ctx.renderSoon();
      return true;
    };
    ctx.setUndoProjectCreateDraft = function(name, url) {
      const undo = runtime.undoSpend;
      if (!undo || !undo.pickerOpen || !undo.projectCreateOpen) return;
      undo.projectCreateName = String(name || "");
      undo.projectCreateUrl = String(url || "");
    };
    ctx.createProjectForUndo = function(name, url) {
      const undo = runtime.undoSpend;
      return createAndAssignUndoProject(ctx, undo, name, url);
    };
    ctx.hideUndoSpend = function() {
      if (runtime.undoSpend && runtime.undoSpend.pickerOpen) {
        ctx.resumeUndoProjectPicker();
      }
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
      const undo = runtime.undoSpend;
      const expired = !undo || !undo.pickerOpen && undo.expiresAt <= Date.now();
      if (expired) {
        runtime.undoSpend = null;
        ctx.renderSoon();
        return null;
      }
      return ctx.deleteSpendEvent(undo.eventId);
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
      extractBalanceFromPayload
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

