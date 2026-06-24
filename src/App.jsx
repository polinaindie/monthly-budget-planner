import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  MONTHS, STORAGE_PREFIX, SETTINGS_KEY, newId, DEFAULT_TEMPLATE, GOALS_KEY,
  DEFAULT_GOALS, KIND_OPTIONS, DEFAULT_SETTINGS, POPULAR_CURRENCIES, NBU_SUPPORTED,
  PORTFOLIO_KEY, INV_SETTINGS_KEY, SYNC_URL_KEY, DEFAULT_INV_SETTINGS,
} from "./lib/constants.js";
import { KIND_MAP, guessKind } from "./lib/budget.js";
import { migrateInvSettings, couponPerPayout, bondGroups } from "./lib/investments.js";
import { fetchNbuRate } from "./lib/nbu.js";
import { Icon } from "./components/Icon.jsx";
import { InvestmentsTab } from "./components/InvestmentsTab.jsx";
import { BondForm } from "./components/BondForm.jsx";
import { InvSettingsModal } from "./components/InvSettingsModal.jsx";
import { TableMirror } from "./components/TableMirror.jsx";
import { SyncModal } from "./components/SyncModal.jsx";

function App() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [data, setData] = useState(DEFAULT_TEMPLATE);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savedMonths, setSavedMonths] = useState([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const tabsRef = useRef(null);
  const [tabInk, setTabInk] = useState({ left: 0, width: 0 });
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState(null);

  // Investment state
  const [activeTab, setActiveTab] = useState("budget");
  useLayoutEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () => {
      const active = el.querySelector(".tab.active");
      if (active) {
        setTabInk({ left: active.offsetLeft, width: active.offsetWidth });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeTab]);
  const [portfolio, setPortfolio] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [invSettings, setInvSettings] = useState(DEFAULT_INV_SETTINGS);
  const [showBondForm, setShowBondForm] = useState(false);
  const [editingBond, setEditingBond] = useState(null);
  const [showInvSettings, setShowInvSettings] = useState(false);
  const [syncUrl, setSyncUrl] = useState("");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // {type:'ok'|'err'|'loading', msg}
  const [tableMirror, setTableMirror] = useState(null); // last snapshot read back from the sheet
  const [sheetUrl, setSheetUrl] = useState(""); // direct link to the spreadsheet, reported by Apps Script

  useEffect(() => {
    const hasSheet = !!localStorage.getItem(SYNC_URL_KEY);
    // If a sheet is connected, it is the source of truth and will be pulled below.
    // Only seed from localStorage when there is no sheet (offline / not connected).
    if (!hasSheet) {
      const p = localStorage.getItem(PORTFOLIO_KEY);
      if (p) {
        try {
          setPortfolio(JSON.parse(p));
        } catch (e) {}
      }
      const gg = localStorage.getItem(GOALS_KEY);
      if (gg) {
        try {
          const parsed = JSON.parse(gg);
          if (Array.isArray(parsed)) setGoals(parsed.map(g => ({
            creditedMonths: [],
            ...g
          })));
        } catch (e) {}
      }
    }
    const is = localStorage.getItem(INV_SETTINGS_KEY);
    if (is) {
      try {
        setInvSettings(migrateInvSettings({
          ...DEFAULT_INV_SETTINGS,
          ...JSON.parse(is)
        }));
      } catch (e) {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
  }, [portfolio]);
  useEffect(() => {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }, [goals]);
  useEffect(() => {
    localStorage.setItem(INV_SETTINGS_KEY, JSON.stringify(invSettings));
  }, [invSettings]);

  // Load saved sync URL, then auto-pull from sheet on startup
  useEffect(() => {
    const u = localStorage.getItem(SYNC_URL_KEY) || "";
    setSyncUrl(u);
    if (u) pullFromSheet(u, true);
  }, []);

  // Build a full snapshot of everything (settings + portfolio + all months)
  const buildSnapshot = () => {
    const months = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) months[k] = localStorage.getItem(k);
    }
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      settings,
      invSettings,
      portfolio,
      goals,
      months
    };
  };
  const applySnapshot = snap => {
    if (!snap || typeof snap !== "object") return;
    if (snap.settings) setSettings(s => ({
      ...DEFAULT_SETTINGS,
      ...snap.settings
    }));
    if (snap.invSettings) setInvSettings(migrateInvSettings({
      ...DEFAULT_INV_SETTINGS,
      ...snap.invSettings
    }));
    // The sheet is the source of truth: apply its portfolio even when empty,
    // so a deletion made elsewhere is reflected here (and not overwritten by old localStorage).
    if ("portfolio" in snap && Array.isArray(snap.portfolio)) {
      setPortfolio(snap.portfolio);
      localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(snap.portfolio));
    }
    if ("goals" in snap && Array.isArray(snap.goals)) {
      const g = snap.goals.map(x => ({ creditedMonths: [], ...x }));
      setGoals(g);
      localStorage.setItem(GOALS_KEY, JSON.stringify(g));
    }
    if (snap.months && typeof snap.months === "object") {
      Object.entries(snap.months).forEach(([k, v]) => {
        if (k.startsWith(STORAGE_PREFIX)) localStorage.setItem(k, v);
      });
      // reload current month view from freshly written storage
      const cur = localStorage.getItem(STORAGE_PREFIX + selectedMonth);
      if (cur) {
        try {
          setData(migrate(JSON.parse(cur)));
        } catch (e) {}
      }
    }
  };
  const pushToSheet = async () => {
    if (!syncUrl) {
      setShowSyncModal(true);
      return;
    }
    setSyncStatus({
      type: "loading",
      msg: "Зберігаю в таблицю…"
    });
    try {
      // text/plain avoids a CORS preflight that Apps Script doesn't answer
      await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(buildSnapshot())
      });
      // Read back what is now actually stored, so the mirror is the sheet's truth
      try {
        const res = await fetch(syncUrl, {
          method: "GET"
        });
        const snap = JSON.parse(await res.text());
        setTableMirror(snap && typeof snap === "object" ? snap : null);
        if (snap && snap.__sheetUrl) setSheetUrl(snap.__sheetUrl);
      } catch (e) {/* mirror just won't update; save itself succeeded */}
      setSyncStatus({
        type: "ok",
        msg: "Збережено в таблицю ✓"
      });
      setTimeout(() => setSyncStatus(null), 2500);
    } catch (e) {
      setSyncStatus({
        type: "err",
        msg: "Не вдалося зберегти. Перевір URL і доступ."
      });
    }
  };

  // Auto-sync after a bond change. Takes the explicit next portfolio to avoid stale state.
  const syncPortfolioSilently = async nextPortfolio => {
    if (!syncUrl) return; // no sheet connected — local only, no error
    setSyncStatus({
      type: "loading",
      msg: "Синхронізую…"
    });
    try {
      const months = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) months[k] = localStorage.getItem(k);
      }
      const snapshot = {
        version: 2,
        savedAt: new Date().toISOString(),
        settings,
        invSettings,
        portfolio: nextPortfolio,
        goals,
        months
      };
      await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(snapshot)
      });
      try {
        const res = await fetch(syncUrl, {
          method: "GET"
        });
        const snap = JSON.parse(await res.text());
        if (snap && typeof snap === "object") setTableMirror(snap);
        if (snap && snap.__sheetUrl) setSheetUrl(snap.__sheetUrl);
      } catch (e) {/* mirror just won't refresh */}
      setSyncStatus({
        type: "ok",
        msg: "Синхронізовано ✓"
      });
      setTimeout(() => setSyncStatus(null), 2000);
    } catch (e) {
      setSyncStatus({
        type: "err",
        msg: "Зміну збережено локально, але не в таблицю. Перевір зв'язок."
      });
    }
  };
  const pullFromSheet = async (urlArg, silent) => {
    const url = urlArg || syncUrl;
    if (!url) {
      setShowSyncModal(true);
      return;
    }
    if (!silent) setSyncStatus({
      type: "loading",
      msg: "Завантажую з таблиці…"
    });
    try {
      const res = await fetch(url, {
        method: "GET"
      });
      const text = await res.text();
      const snap = JSON.parse(text);
      if (snap && snap.__sheetUrl) setSheetUrl(snap.__sheetUrl);
      if (snap && typeof snap === "object") setTableMirror(snap);
      const hasData = snap && typeof snap === "object" && ("portfolio" in snap || "goals" in snap || "months" in snap || "settings" in snap || "invSettings" in snap);
      if (hasData) {
        applySnapshot(snap);
        if (!silent) {
          setSyncStatus({
            type: "ok",
            msg: "Завантажено з таблиці ✓"
          });
          setTimeout(() => setSyncStatus(null), 2500);
        }
      } else if (!silent) {
        setSyncStatus({
          type: "ok",
          msg: "У таблиці поки порожньо."
        });
        setTimeout(() => setSyncStatus(null), 2500);
      }
    } catch (e) {
      if (!silent) setSyncStatus({
        type: "err",
        msg: "Не вдалося завантажити. Перевір URL."
      });
    }
  };
  const saveSyncUrl = u => {
    const clean = (u || "").trim();
    setSyncUrl(clean);
    localStorage.setItem(SYNC_URL_KEY, clean);
    setShowSyncModal(false);
    if (clean) pullFromSheet(clean, false);
  };
  useEffect(() => {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) {
      try {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...JSON.parse(s)
        });
      } catch (e) {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    const months = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        months.push(key.replace(STORAGE_PREFIX, ""));
      }
    }
    months.sort().reverse();
    setSavedMonths(months);
  }, [savedFlash]);
  const migrate = parsed => {
    const defaultEmojis = ["🏠", "☕", "🌱", "✨", "🎀", "🍰"];
    if (parsed.groups) {
      parsed.groups = parsed.groups.map((g, i) => ({
        emoji: g.emoji || defaultEmojis[i % defaultEmojis.length],
        color: g.color || "cream",
        ...g
      }));
    }
    if (parsed.cards) {
      const colorCycle = ["cream", "peach", "butter", "sage", "lavender", "rose"];
      const emojiCycle = ["💳", "✨", "📋", "🌱", "🐷", "💎"];
      parsed.cards = parsed.cards.map((c, i) => ({
        eyebrow: c.eyebrow || "Картка",
        color: c.color || colorCycle[i % colorCycle.length],
        emoji: c.emoji || emojiCycle[i % emojiCycle.length],
        ...c
      }));
    }
    return parsed;
  };
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_PREFIX + selectedMonth);
    if (stored) {
      try {
        setData(migrate(JSON.parse(stored)));
        return;
      } catch (e) {}
    }
    if (savedMonths.length > 0) {
      const prev = localStorage.getItem(STORAGE_PREFIX + savedMonths[0]);
      if (prev) {
        try {
          setData(migrate(JSON.parse(prev)));
          return;
        } catch (e) {}
      }
    }
    setData(DEFAULT_TEMPLATE());
  }, [selectedMonth]);
  const refreshNbuRate = async () => {
    if (!settings.secondaryCurrency) return;
    const code = settings.secondaryCurrency.toUpperCase();
    if (!NBU_SUPPORTED.includes(code)) {
      setRateError("НБУ не дає курс для цієї валюти");
      return;
    }
    setRateLoading(true);
    setRateError(null);
    try {
      const result = await fetchNbuRate(code);
      setSettings(prev => ({
        ...prev,
        rate: result.rate,
        rateSource: "nbu",
        rateUpdatedAt: result.exchangeDate
      }));
    } catch (e) {
      setRateError("Не вдалося оновити курс. Перевір інтернет.");
    } finally {
      setRateLoading(false);
    }
  };
  const saveMonth = () => {
    try {
      localStorage.setItem(STORAGE_PREFIX + selectedMonth, JSON.stringify(data));
      // Авто-зарахування щомісячних внесків у цілі — один раз на місяць.
      setGoals(prev => prev.map(g => {
        const monthly = Number(g.monthly) || 0;
        const credited = Array.isArray(g.creditedMonths) ? g.creditedMonths : [];
        if (monthly > 0 && !credited.includes(selectedMonth)) {
          return {
            ...g,
            saved: (Number(g.saved) || 0) + monthly,
            creditedMonths: [...credited, selectedMonth]
          };
        }
        return g;
      }));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      alert("Не вдалося зберегти: " + e.message);
    }
  };
  const exportPdf = () => {
    try {
      localStorage.setItem(STORAGE_PREFIX + selectedMonth, JSON.stringify(data));
    } catch (e) {}
    const prevTitle = document.title;
    document.title = `Бюджет — ${formatMonthLabel(selectedMonth)}`;
    setTimeout(() => {
      window.print();
      document.title = prevTitle;
    }, 100);
  };
  const resetMonth = () => {
    setData(DEFAULT_TEMPLATE());
    setShowResetModal(false);
  };
  const formatMonthLabel = ymStr => {
    const [y, m] = ymStr.split("-");
    return `${MONTHS[parseInt(m) - 1]} ${y}`;
  };
  const shortMonthLabel = ymStr => {
    const [, m] = ymStr.split("-");
    return MONTHS[parseInt(m) - 1].slice(0, 3);
  };
  const shiftMonth = (ymStr, delta) => {
    const [y, m] = ymStr.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const toMain = (amount, currency) => {
    if (currency === "secondary" && settings.rate) return amount * settings.rate;
    return amount;
  };
  const formatMain = n => Math.round(n).toLocaleString("uk") + " " + settings.mainCurrency;
  const groupTotal = group => group.items.reduce((sum, item) => sum + toMain(Number(item.amount) || 0, item.currency), 0);
  const goalToMain = (amount, currency) => toMain(Number(amount) || 0, currency);
  // Сума запланованих місячних внесків на всі цілі — рахується як витрата типу "save"
  const goalsMonthlyTotal = goals.reduce((s, g) => s + goalToMain(g.monthly, g.currency), 0);
  const groupsSpent = data.groups.reduce((sum, g) => sum + groupTotal(g), 0);
  const totalSpent = groupsSpent + goalsMonthlyTotal;
  const remainder = (Number(data.income) || 0) - totalSpent;
  const cardTotal = card => data.groups.filter(g => card.groupTitleRefs.includes(g.title)).reduce((sum, g) => sum + groupTotal(g), 0);
  // Скільки доходу лишається саме на цю категорію = дохід мінус усе, що вже
  // зайнято рештою (інші категорії + заплановані внески цілей). Жива цифра:
  // змінюєш суми деінде — цей залишок перераховується.
  const spentOutside = group => totalSpent - groupTotal(group);
  const availableForGroup = group => (Number(data.income) || 0) - spentOutside(group);
  // ===== Розподіл 50/30/20 з пріоритетними (зафіксованими) категоріями =====
  // Модель: спершу резервуємо вручну зафіксовані суми (group.fixed, у грн
  // основної валюти). Решта доходу ділиться між НЕзафіксованими категоріями
  // за пропорціями 50/30/20, перенормованими лише на ті типи, де ще лишилися
  // незафіксовані категорії.
  const income = Number(data.income) || 0;
  const pct = n => income > 0 ? Math.round(n / income * 100) : 0;
  const groupKind = group => guessKind(group.title);
  // Зафіксована сума категорії (вже в основній валюті) або null, якщо не задано.
  const isFixed = group => group.fixed !== undefined && group.fixed !== null && group.fixed !== "";
  const groupFixed = group => isFixed(group) ? Number(group.fixed) || 0 : null;
  const kindTotals = {
    need: data.groups.filter(g => groupKind(g) === "need").reduce((s, g) => s + groupTotal(g), 0),
    want: data.groups.filter(g => groupKind(g) === "want").reduce((s, g) => s + groupTotal(g), 0),
    save: data.groups.filter(g => groupKind(g) === "save").reduce((s, g) => s + groupTotal(g), 0) + goalsMonthlyTotal
  };
  const savePct = pct(kindTotals.save);
  // Сумарно зарезервовано пріоритетними категоріями та залишок під 50/30/20.
  const totalFixed = data.groups.reduce((s, g) => s + (groupFixed(g) || 0), 0);
  const availableAfterFixed = Math.max(income - totalFixed, 0);
  // Ваги типів (50/30/20) лише для тих типів, де є незафіксовані категорії,
  // перенормовані до 100%.
  const flexibleGroups = data.groups.filter(g => !isFixed(g));
  const activeKinds = [...new Set(flexibleGroups.map(groupKind))];
  const weightSum = activeKinds.reduce((s, k) => s + KIND_MAP[k].target, 0);
  // Рекомендована сума на категорію:
  // — зафіксована категорія: рекомендація = її ж зафіксована сума (ціль = факт);
  // — інакше: бюджет типу (частка залишку) ділиться між незафіксованими
  //   категоріями цього типу — пропорційно поточним сумам, а якщо всі нульові —
  //   порівну.
  const recommendedFor = group => {
    if (income <= 0) return null;
    if (isFixed(group)) return groupFixed(group);
    if (weightSum <= 0 || availableAfterFixed <= 0) return 0;
    const kind = groupKind(group);
    const kindBudget = availableAfterFixed * (KIND_MAP[kind].target / weightSum);
    const peers = flexibleGroups.filter(g => groupKind(g) === kind);
    const peersTotal = peers.reduce((s, g) => s + groupTotal(g), 0);
    if (peers.length <= 1) return kindBudget;
    if (peersTotal > 0) return kindBudget * (groupTotal(group) / peersTotal);
    return kindBudget / peers.length;
  };
  // ===== Цілі / накопичення (наскрізні) =====
  const updateGoal = (goalId, patch) => {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...patch } : g));
  };
  const addGoal = () => {
    setGoals(prev => [...prev, {
      id: newId(),
      emoji: "🎯",
      title: "Нова ціль",
      target: 0,
      saved: 0,
      monthly: 0,
      currency: settings.secondaryCurrency ? "secondary" : "main",
      creditedMonths: []
    }]);
  };
  const removeGoal = goalId => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
  };
  const updateGroup = (groupId, updater) => {
    setData(prev => ({
      ...prev,
      groups: prev.groups.map(g => g.id === groupId ? updater(g) : g)
    }));
  };
  const updateGroupTitle = (groupId, newTitle) => {
    setData(prev => {
      const oldTitle = prev.groups.find(g => g.id === groupId)?.title;
      return {
        ...prev,
        groups: prev.groups.map(g => g.id === groupId ? {
          ...g,
          title: newTitle
        } : g),
        cards: prev.cards.map(c => ({
          ...c,
          groupTitleRefs: c.groupTitleRefs.map(t => t === oldTitle ? newTitle : t)
        }))
      };
    });
  };
  const updateGroupEmoji = (groupId, emoji) => {
    updateGroup(groupId, g => ({
      ...g,
      emoji
    }));
  };
  const addItem = groupId => {
    updateGroup(groupId, g => ({
      ...g,
      items: [...g.items, {
        id: newId(),
        label: "Нова стаття",
        amount: 0,
        currency: "main"
      }]
    }));
  };
  const updateItem = (groupId, itemId, patch) => {
    updateGroup(groupId, g => ({
      ...g,
      items: g.items.map(it => it.id === itemId ? {
        ...it,
        ...patch
      } : it)
    }));
  };
  const removeItem = (groupId, itemId) => {
    updateGroup(groupId, g => ({
      ...g,
      items: g.items.filter(it => it.id !== itemId)
    }));
  };
  const addGroup = () => {
    setData(prev => ({
      ...prev,
      groups: [...prev.groups, {
        id: newId(),
        emoji: "🌷",
        title: "Нова категорія",
        color: "cream",
        cardName: "",
        items: [{
          id: newId(),
          label: "Нова стаття",
          amount: 0,
          currency: "main"
        }]
      }]
    }));
  };
  const removeGroup = groupId => {
    setData(prev => {
      const removedTitle = prev.groups.find(g => g.id === groupId)?.title;
      return {
        ...prev,
        groups: prev.groups.filter(g => g.id !== groupId),
        cards: prev.cards.map(c => ({
          ...c,
          groupTitleRefs: c.groupTitleRefs.filter(t => t !== removedTitle)
        }))
      };
    });
  };
  const addCard = () => {
    const colors = ["cream", "peach", "butter", "sage", "lavender", "rose", "mint", "sky"];
    const used = data.cards.map(c => c.color);
    const next = colors.find(c => !used.includes(c)) || colors[data.cards.length % colors.length];
    setData(prev => ({
      ...prev,
      cards: [...prev.cards, {
        id: newId(),
        eyebrow: "Рахунок",
        emoji: "💎",
        title: "Новий рахунок",
        subtitle: "опис",
        groupTitleRefs: [],
        color: next
      }]
    }));
  };
  const updateCard = (cardId, patch) => {
    setData(prev => ({
      ...prev,
      cards: prev.cards.map(c => c.id === cardId ? {
        ...c,
        ...patch
      } : c)
    }));
  };
  const removeCard = cardId => {
    setData(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== cardId)
    }));
  };
  const toggleCardGroupRef = (cardId, groupTitle) => {
    setData(prev => ({
      ...prev,
      cards: prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const has = c.groupTitleRefs.includes(groupTitle);
        return {
          ...c,
          groupTitleRefs: has ? c.groupTitleRefs.filter(t => t !== groupTitle) : [...c.groupTitleRefs, groupTitle]
        };
      })
    }));
  };
  const futureMonths = [];
  for (let offset = 1; offset <= 6; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!savedMonths.includes(ym) && ym !== currentMonth) futureMonths.push(ym);
  }
  // Межі перемикання місяців: назад — до найранішого збереженого (або поточного),
  // вперед — до +6 від поточного
  const earliestMonth = savedMonths.length > 0 && savedMonths.slice().sort()[0] < currentMonth ? savedMonths.slice().sort()[0] : currentMonth;
  const latestMonth = shiftMonth(currentMonth, 6);
  const prevMonth = selectedMonth > earliestMonth ? shiftMonth(selectedMonth, -1) : null;
  const nextMonth = selectedMonth < latestMonth ? shiftMonth(selectedMonth, 1) : null;
  const isNbuSupported = settings.secondaryCurrency && NBU_SUPPORTED.includes(settings.secondaryCurrency.toUpperCase());

  // ===== Investment computed values =====
  const activeBonds = portfolio.filter(b => b.status !== "redeemed");
  const investedTotal = portfolio.reduce((s, b) => s + (Number(b.invested) || 0), 0);

  // Invested capital per group (a bond feeding 2 groups splits its invested sum)
  const groupInvested = {
    1: 0,
    2: 0,
    3: 0
  };
  activeBonds.forEach(b => {
    const gs = bondGroups(b);
    if (!gs.length) return;
    const share = (Number(b.invested) || 0) / gs.length;
    gs.forEach(g => {
      groupInvested[g] += share;
    });
  });

  // Real coupon income per calendar month (1..12), summed across active bonds
  const monthlyIncome = Array(12).fill(0);
  activeBonds.forEach(b => {
    const per = couponPerPayout(b);
    (b.payMonths || []).forEach(m => {
      if (m >= 1 && m <= 12) monthlyIncome[m - 1] += per;
    });
  });
  const maxMonthly = Math.max(...monthlyIncome, invSettings.monthlyGoal, 1);
  const avgMonthly = monthlyIncome.reduce((a, c) => a + c, 0) / 12;

  // Weakest group = least invested
  const weakestGroup = [1, 2, 3].sort((a, b) => groupInvested[a] - groupInvested[b])[0];
  const saveBond = bond => {
    setPortfolio(prev => {
      const exists = prev.some(b => b.id === bond.id);
      const next = exists ? prev.map(b => b.id === bond.id ? bond : b) : [...prev, bond];
      syncPortfolioSilently(next);
      return next;
    });
    setShowBondForm(false);
    setEditingBond(null);
  };
  const removeBond = id => setPortfolio(prev => {
    const next = prev.filter(b => b.id !== id);
    syncPortfolioSilently(next);
    return next;
  });
  const exportAll = () => {
    const dump = {
      version: 2,
      exportedAt: new Date().toISOString(),
      settings,
      invSettings,
      portfolio,
      months: {}
    };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) dump.months[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importAll = file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        if (d.settings) setSettings({
          ...DEFAULT_SETTINGS,
          ...d.settings
        });
        if (d.invSettings) setInvSettings(migrateInvSettings({
          ...DEFAULT_INV_SETTINGS,
          ...d.invSettings
        }));
        if (Array.isArray(d.portfolio)) setPortfolio(d.portfolio);
        if (d.months) Object.entries(d.months).forEach(([k, v]) => localStorage.setItem(k, v));
        alert("Дані відновлено. Сторінку буде перезавантажено.");
        location.reload();
      } catch (err) {
        alert("Не вдалося прочитати файл: " + err.message);
      }
    };
    reader.readAsText(file);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "container no-print"
  }, /*#__PURE__*/React.createElement("header", {
    className: "header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow"
  }, "Особистий бюджет · ", savedMonths.length > 0 ? `${savedMonths.length} збережених місяців` : "перший запуск"), /*#__PURE__*/React.createElement("h1", {
    className: "title"
  }, "Бюджет", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("em", null, "на місяць"))), /*#__PURE__*/React.createElement("div", {
    className: "header-controls"
  }, /*#__PURE__*/React.createElement("div", {
    className: "menu-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn-gear",
    onClick: () => setShowMenu(v => !v),
    "aria-label": "Налаштування"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 18
  })), showMenu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "menu-overlay",
    onClick: () => setShowMenu(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "menu-dropdown"
  }, /*#__PURE__*/React.createElement("button", {
    className: "menu-item",
    onClick: () => {
      setShowMenu(false);
      setShowSettings(true);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 16
  }), "Валюта"), /*#__PURE__*/React.createElement("button", {
    className: "menu-item",
    onClick: () => {
      setShowMenu(false);
      setShowSyncModal(true);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: syncUrl ? "refresh" : "plus",
    size: 16
  }), syncUrl ? "Таблиця · змінити URL" : "Підключити таблицю")))))), /*#__PURE__*/React.createElement("div", {
    className: "tabs",
    ref: tabsRef
  }, /*#__PURE__*/React.createElement("button", {
    className: "tab" + (activeTab === "budget" ? " active" : ""),
    onClick: () => setActiveTab("budget")
  }, "Бюджет"), /*#__PURE__*/React.createElement("button", {
    className: "tab" + (activeTab === "invest" ? " active" : ""),
    onClick: () => setActiveTab("invest")
  }, "Інвестиції · ОВДП"), /*#__PURE__*/React.createElement("span", {
    className: "tab-ink",
    style: {
      left: tabInk.left + "px",
      width: tabInk.width + "px",
      opacity: tabInk.width > 0 ? 1 : 0
    }
  })), activeTab === "budget" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "month-switch"
  }, /*#__PURE__*/React.createElement("button", {
    className: "month-switch-arrow",
    onClick: () => prevMonth && setSelectedMonth(prevMonth),
    disabled: !prevMonth,
    "aria-label": "Попередній місяць"
  }, "‹"), /*#__PURE__*/React.createElement("span", {
    className: "month-switch-current"
  }, formatMonthLabel(selectedMonth), selectedMonth === currentMonth && /*#__PURE__*/React.createElement("span", {
    className: "month-switch-now"
  }, "зараз")), /*#__PURE__*/React.createElement("button", {
    className: "month-switch-arrow",
    onClick: () => nextMonth && setSelectedMonth(nextMonth),
    disabled: !nextMonth,
    "aria-label": "Наступний місяць"
  }, "›")), /*#__PURE__*/React.createElement("section", {
    className: "card card-lg income-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "income-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "income-label"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "wallet",
    size: 22,
    color: "#2d1810"
  }), /*#__PURE__*/React.createElement("h2", {
    className: "income-title"
  }, "Дохід місяця")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '0.5rem'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: data.income || "",
    onChange: e => setData({
      ...data,
      income: Number(e.target.value) || 0
    }),
    className: "num-input income-input",
    style: {
      width: 180
    },
    placeholder: "0"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.875rem',
      color: 'var(--ink-soft)'
    }
  }, settings.mainCurrency))), settings.secondaryCurrency && /*#__PURE__*/React.createElement("div", {
    className: "currency-config"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-soft)'
    }
  }, "Курс:"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Fraunces', serif",
      fontWeight: 600
    }
  }, "1 ", settings.secondaryCurrency), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-soft)'
    }
  }, "="), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.0001",
    value: settings.rate,
    onChange: e => setSettings({
      ...settings,
      rate: Number(e.target.value),
      rateSource: "manual"
    }),
    className: "num-input num-input-sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-soft)'
    }
  }, settings.mainCurrency), isNbuSupported && /*#__PURE__*/React.createElement("button", {
    className: "btn-mini",
    onClick: refreshNbuRate,
    disabled: rateLoading
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh",
    size: 12,
    className: rateLoading ? "spinning" : ""
  }), rateLoading ? "..." : "НБУ"), /*#__PURE__*/React.createElement("span", {
    className: "currency-info " + (rateError ? "error" : "")
  }, rateError ? rateError : settings.rateSource === "nbu" && settings.rateUpdatedAt ? `НБУ · ${settings.rateUpdatedAt}` : "вручну"))), /*#__PURE__*/React.createElement("div", {
    className: "split-inline"
  }, /*#__PURE__*/React.createElement("p", {
    className: "split-inline-title"
  }, "Розподіл доходу"), income > 0 && totalFixed > 0 && /*#__PURE__*/React.createElement("div", {
    className: "fixed-banner"
  }, /*#__PURE__*/React.createElement("span", null, "🔒 Зарезервовано пріоритетами: ", /*#__PURE__*/React.createElement("b", null, formatMain(totalFixed)), " (", pct(totalFixed), "%)"), /*#__PURE__*/React.createElement("span", {
    className: availableAfterFixed > 0 ? "" : "fixed-banner-warn"
  }, availableAfterFixed > 0 ? `Під розподіл лишилось: ${formatMain(availableAfterFixed)}` : "⚠ Пріоритети перевищують дохід")), income > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "split-bar"
  }, KIND_OPTIONS.map(k => {
    const p = pct(kindTotals[k.code]);
    return p > 0 ? /*#__PURE__*/React.createElement("div", {
      key: k.code,
      className: "split-seg split-seg-" + k.code,
      style: {
        width: p + "%"
      },
      title: `${k.label}: ${p}%`
    }) : null;
  })), /*#__PURE__*/React.createElement("div", {
    className: "split-legend"
  }, KIND_OPTIONS.map(k => /*#__PURE__*/React.createElement("div", {
    key: k.code,
    className: "split-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "split-item-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "split-dot split-dot-" + k.code
  }), /*#__PURE__*/React.createElement("span", {
    className: "split-name"
  }, k.label)), /*#__PURE__*/React.createElement("p", {
    className: "split-pct",
    style: {
      margin: '0.2rem 0 0'
    }
  }, pct(kindTotals[k.code]), "%", /*#__PURE__*/React.createElement("span", {
    className: "split-target"
  }, " / ціль ", k.target, "%")), /*#__PURE__*/React.createElement("p", {
    className: "split-amount",
    style: {
      margin: 0
    }
  }, formatMain(kindTotals[k.code])))))) : /*#__PURE__*/React.createElement("p", {
    className: "split-inline-sub",
    style: {
      margin: 0,
      fontStyle: 'italic'
    }
  }, "Вкажи дохід місяця вище, щоб побачити свій фактичний розподіл у відсотках."), income > 0 && /*#__PURE__*/React.createElement("p", {
    className: "split-hint" + (savePct < 20 ? " split-hint-warn" : "")
  }, savePct >= 20 ? `🌱 Чудово — на заощадження та цілі йде ${savePct}% доходу. «Спочатку заплати собі» працює.` : `💡 На заощадження зараз ${savePct}%. Базовий орієнтир — 20%+. Спробуй відкласти на цілі ще до витрат, а не «що лишиться».`)), /*#__PURE__*/React.createElement("div", {
    className: "main-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-stack"
  }, /*#__PURE__*/React.createElement("p", {
    className: "col-section-title"
  }, "Витрати за категоріями"), data.groups.map((group, idx) => /*#__PURE__*/React.createElement("div", {
    key: group.id,
    className: "card cat-" + groupKind(group)
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-header-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-emoji",
    onClick: () => {
      const next = prompt("Введи новий емодзі:", group.emoji);
      if (next) updateGroupEmoji(group.id, next.slice(0, 2));
    },
    title: "Натисни щоб змінити"
  }, group.emoji || "📦"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: group.title,
    onChange: e => updateGroupTitle(group.id, e.target.value),
    className: "card-title"
  }), /*#__PURE__*/React.createElement("span", {
    className: "kind-badge kind-badge-" + groupKind(group),
    title: `Тип визначено автоматично за назвою · ціль ${KIND_MAP[groupKind(group)].target}% доходу`
  }, KIND_MAP[groupKind(group)].emoji, " ", KIND_MAP[groupKind(group)].label)), /*#__PURE__*/React.createElement("button", {
    className: "btn-icon",
    onClick: () => removeGroup(group.id),
    title: "Видалити категорію"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 14
  }))), group.items.map(item => /*#__PURE__*/React.createElement("div", {
    key: item.id,
    className: "row"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: 1,
    value: item.label,
    onChange: e => updateItem(group.id, item.id, {
      label: e.target.value
    }),
    ref: el => {
      if (el) {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
    },
    className: "row-label-input"
  }), /*#__PURE__*/React.createElement("div", {
    className: "row-input-wrap"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: item.amount || "",
    onChange: e => updateItem(group.id, item.id, {
      amount: Number(e.target.value) || 0
    }),
    className: "num-input",
    placeholder: "0"
  }), settings.secondaryCurrency ? /*#__PURE__*/React.createElement("select", {
    value: item.currency,
    onChange: e => updateItem(group.id, item.id, {
      currency: e.target.value
    }),
    style: {
      padding: '2px 4px',
      fontSize: '0.75rem',
      borderBottomWidth: '1px'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "main"
  }, settings.mainCurrency), /*#__PURE__*/React.createElement("option", {
    value: "secondary"
  }, settings.secondaryCurrency)) : /*#__PURE__*/React.createElement("span", {
    className: "row-unit"
  }, settings.mainCurrency), /*#__PURE__*/React.createElement("button", {
    className: "btn-icon",
    onClick: () => removeItem(group.id, item.id),
    title: "Видалити"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 12
  }))))), group.items.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "empty"
  }, "Поки порожньо"), /*#__PURE__*/React.createElement("button", {
    className: "btn-add",
    onClick: () => addItem(group.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 12
  }), " додати статтю"), /*#__PURE__*/React.createElement("div", {
    className: "card-total"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-total-label"
  }, "Разом"), /*#__PURE__*/React.createElement("span", {
    className: "card-total-value"
  }, formatMain(groupTotal(group)), income > 0 && /*#__PURE__*/React.createElement("span", {
    className: "card-pct"
  }, pct(groupTotal(group)), "% доходу"))), income > 0 && (() => {
    const avail = availableForGroup(group);
    const used = groupTotal(group);
    const over = used > avail + 0.5;
    const ratio = avail > 0 ? Math.min(used / avail, 1) : (used > 0 ? 1 : 0);
    return /*#__PURE__*/React.createElement("div", {
      className: "avail-row" + (over ? " avail-over" : "")
    }, /*#__PURE__*/React.createElement("div", {
      className: "avail-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "avail-label"
    }, over ? "⚠ Перевищує доступне на цю категорію" : "Доступно на цю категорію"), /*#__PURE__*/React.createElement("span", {
      className: "avail-value"
    }, formatMain(Math.max(avail, 0)))), /*#__PURE__*/React.createElement("div", {
      className: "avail-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "avail-bar-fill",
      style: { width: ratio * 100 + "%" }
    })), over && /*#__PURE__*/React.createElement("div", {
      className: "avail-note"
    }, "На ", formatMain(used - avail), " більше, ніж лишилось доходу"));
  })(), income > 0 && /*#__PURE__*/React.createElement("div", {
    className: "fix-row" + (isFixed(group) ? " fix-on" : "")
  }, /*#__PURE__*/React.createElement("label", {
    className: "fix-toggle",
    title: "Зафіксувати суму на цю категорію — решта рахується із залишку"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: isFixed(group),
    onChange: e => updateGroup(group.id, g => e.target.checked ? {
      ...g,
      fixed: Math.round(groupTotal(g)) || 0
    } : (() => {
      const { fixed, ...rest } = g;
      return rest;
    })())
  }), /*#__PURE__*/React.createElement("span", null, "🔒 Пріоритет")), isFixed(group) && /*#__PURE__*/React.createElement("div", {
    className: "fix-input-wrap"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    className: "fix-input",
    value: group.fixed,
    min: 0,
    onChange: e => updateGroup(group.id, g => ({
      ...g,
      fixed: e.target.value
    })),
    placeholder: "сума"
  }), /*#__PURE__*/React.createElement("span", {
    className: "fix-suffix"
  }, settings.mainCurrency, income > 0 && " · " + pct(groupFixed(group) || 0) + "% зп"))), income > 0 && isFixed(group) && /*#__PURE__*/React.createElement("div", {
    className: "rec-row rec-fixed"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rec-label"
  }, "🔒 Пріоритет · зарезервовано перш за все"), /*#__PURE__*/React.createElement("span", {
    className: "rec-value"
  }, formatMain(groupFixed(group) || 0))), income > 0 && !isFixed(group) && (() => {
    const rec = recommendedFor(group);
    if (rec === null) return null;
    const diff = groupTotal(group) - rec;
    const over = diff > Math.max(rec * 0.05, 1);
    const under = diff < -Math.max(rec * 0.05, 1);
    return /*#__PURE__*/React.createElement("div", {
      className: "rec-row " + (over ? "rec-over" : under ? "rec-under" : "rec-ok")
    }, /*#__PURE__*/React.createElement("span", {
      className: "rec-label"
    }, "Рекомендація · ", KIND_MAP[groupKind(group)].target, "%-правило із залишку"), /*#__PURE__*/React.createElement("span", {
      className: "rec-value"
    }, "≈ ", formatMain(rec), over ? ` · ⬆ на ${formatMain(Math.abs(diff))} більше` : under ? ` · ⬇ є запас ${formatMain(Math.abs(diff))}` : " · ✓ в межах"));
  })(), /*#__PURE__*/React.createElement("div", {
    className: "hold-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hold-emoji"
  }, "📋"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: group.cardName || "",
    onChange: e => updateGroup(group.id, g => ({
      ...g,
      cardName: e.target.value
    })),
    className: "hold-input",
    placeholder: "на якій картці / рахунку тримати"
  }), /*#__PURE__*/React.createElement("span", {
    className: "hold-amount"
  }, formatMain(groupTotal(group)))))), /*#__PURE__*/React.createElement("button", {
    className: "btn-add btn-add-ticket",
    onClick: addGroup
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), " додати категорію"))), /*#__PURE__*/React.createElement("section", {
    className: "summary"
  }, /*#__PURE__*/React.createElement("div", {
    className: "summary-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "stat-label"
  }, "Дохід"), /*#__PURE__*/React.createElement("p", {
    className: "stat-value"
  }, Number(data.income).toLocaleString("uk"), " ", /*#__PURE__*/React.createElement("span", {
    className: "stat-unit"
  }, settings.mainCurrency))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "stat-label"
  }, "Витрати"), /*#__PURE__*/React.createElement("p", {
    className: "stat-value"
  }, Math.round(totalSpent).toLocaleString("uk"), " ", /*#__PURE__*/React.createElement("span", {
    className: "stat-unit"
  }, settings.mainCurrency))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "stat-label"
  }, "Залишок"), /*#__PURE__*/React.createElement("p", {
    className: "stat-value " + (remainder < 0 ? "stat-value-red" : remainder > 0 ? "stat-value-green" : "")
  }, Math.round(remainder).toLocaleString("uk"), " ", /*#__PURE__*/React.createElement("span", {
    className: "stat-unit"
  }, settings.mainCurrency))))), /*#__PURE__*/React.createElement("section", {
    className: "actions"
  }, /*#__PURE__*/React.createElement("div", {
    className: "btn-group"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: saveMonth,
    className: "btn btn-primary " + (savedFlash ? "save-flash" : "")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "save",
    size: 16
  }), savedFlash ? "Збережено!" : "Зберегти місяць"), /*#__PURE__*/React.createElement("button", {
    onClick: () => syncUrl ? pushToSheet() : setShowSyncModal(true),
    className: "btn btn-secondary"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh",
    size: 16
  }), "Зберегти в таблицю"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowResetModal(true),
    className: "btn btn-secondary"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "reset",
    size: 16
  }), "Скинути")), syncStatus && /*#__PURE__*/React.createElement("p", {
    className: "actions-note",
    style: {
      color: syncStatus.type === "err" ? "#b91c1c" : syncStatus.type === "ok" ? "#15803d" : "var(--ink-soft)"
    }
  }, syncStatus.msg), /*#__PURE__*/React.createElement("p", {
    className: "actions-note"
  }, "Дані зберігаються у браузері (localStorage). Новий місяць копіює налаштування з попереднього."))), activeTab === "budget" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "col-section-title",
    style: {
      marginTop: '0.5rem'
    }
  }, "Цілі та накопичення"), goals.map(goal => {
    const target = goalToMain(goal.target, goal.currency);
    const saved = goalToMain(goal.saved, goal.currency);
    const monthly = goalToMain(goal.monthly, goal.currency);
    const progress = target > 0 ? Math.min(100, Math.round(saved / target * 100)) : 0;
    const remaining = Math.max(0, target - saved);
    const monthsLeft = monthly > 0 && remaining > 0 ? Math.ceil(remaining / monthly) : null;
    const credited = (goal.creditedMonths || []).length;
    return /*#__PURE__*/React.createElement("div", {
      key: goal.id,
      className: "goal card-c-cream"
    }, /*#__PURE__*/React.createElement("div", {
      className: "goal-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "goal-emoji",
      onClick: () => {
        const next = prompt("Введи новий емодзі:", goal.emoji);
        if (next) updateGoal(goal.id, {
          emoji: next.slice(0, 2)
        });
      },
      title: "Натисни щоб змінити"
    }, goal.emoji || "🎯"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: goal.title,
      onChange: e => updateGoal(goal.id, {
        title: e.target.value
      }),
      className: "goal-title-input"
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn-icon",
      onClick: () => removeGoal(goal.id),
      title: "Видалити ціль"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "trash",
      size: 14
    }))), /*#__PURE__*/React.createElement("div", {
      className: "goal-progress-track"
    }, /*#__PURE__*/React.createElement("div", {
      className: "goal-progress-fill" + (progress >= 100 ? " done" : ""),
      style: {
        width: progress + "%"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "goal-meta"
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, formatMain(saved)), " з ", formatMain(target)), /*#__PURE__*/React.createElement("span", null, progress, "%")), /*#__PURE__*/React.createElement("div", {
      className: "goal-fields"
    }, /*#__PURE__*/React.createElement("div", {
      className: "goal-field"
    }, /*#__PURE__*/React.createElement("label", null, "Ціль"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: goal.target || "",
      onChange: e => updateGoal(goal.id, {
        target: Number(e.target.value) || 0
      }),
      className: "num-input",
      placeholder: "0"
    })), /*#__PURE__*/React.createElement("div", {
      className: "goal-field"
    }, /*#__PURE__*/React.createElement("label", null, "Накопичено"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: goal.saved || "",
      onChange: e => updateGoal(goal.id, {
        saved: Number(e.target.value) || 0
      }),
      className: "num-input",
      placeholder: "0"
    })), /*#__PURE__*/React.createElement("div", {
      className: "goal-field"
    }, /*#__PURE__*/React.createElement("label", null, "На місяць"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: goal.monthly || "",
      onChange: e => updateGoal(goal.id, {
        monthly: Number(e.target.value) || 0
      }),
      className: "num-input",
      placeholder: "0"
    }))), settings.secondaryCurrency && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.62rem',
        color: 'var(--ink-faded)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }
    }, "Валюта:"), /*#__PURE__*/React.createElement("select", {
      value: goal.currency,
      onChange: e => updateGoal(goal.id, {
        currency: e.target.value
      }),
      style: {
        padding: '2px 6px',
        fontSize: '0.75rem'
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: "main"
    }, settings.mainCurrency), /*#__PURE__*/React.createElement("option", {
      value: "secondary"
    }, settings.secondaryCurrency))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
        marginTop: '0.5rem'
      }
    }, monthsLeft !== null ? /*#__PURE__*/React.createElement("p", {
      className: "goal-eta",
      style: {
        margin: 0
      }
    }, "⏳ За поточного темпу — ще ", monthsLeft, " ", monthsLeft === 1 ? "місяць" : monthsLeft < 5 ? "місяці" : "місяців", " (~", Math.ceil(monthsLeft / 12 * 10) / 10, " р.)") : progress >= 100 ? /*#__PURE__*/React.createElement("p", {
      className: "goal-eta",
      style: {
        margin: 0
      }
    }, "✅ Ціль досягнута!") : /*#__PURE__*/React.createElement("span", null), credited > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.68rem',
        color: 'var(--ink-faded)',
        fontFamily: "'DM Mono', monospace"
      },
      title: (goal.creditedMonths || []).join(", ")
    }, "зараховано місяців: ", credited)));
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn-add btn-add-ticket",
    onClick: addGoal,
    style: {
      marginBottom: '1.5rem'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), " додати ціль"), tableMirror && tableMirror.goals && Array.isArray(tableMirror.goals) && /*#__PURE__*/React.createElement("section", {
    className: "split-card",
    style: {
      marginTop: '1.5rem'
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "split-title"
  }, "📊 Що зараз у таблиці"), /*#__PURE__*/React.createElement("p", {
    className: "split-sub"
  }, "Дзеркало останнього стану накопичень у Google-таблиці."), tableMirror.goals.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "split-sub",
    style: {
      margin: 0
    }
  }, "У таблиці поки порожньо.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem'
    }
  }, tableMirror.goals.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: g.id || i,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '0.82rem',
      color: 'var(--ink-soft)',
      paddingBottom: '0.3rem',
      borderBottom: '1px dashed var(--border-cream)'
    }
  }, /*#__PURE__*/React.createElement("span", null, g.emoji || "🎯", " ", g.title || "Ціль"), /*#__PURE__*/React.createElement("span", null, Math.round(Number(g.saved) || 0).toLocaleString("uk"), " / ", Math.round(Number(g.target) || 0).toLocaleString("uk"))))))), activeTab === "invest" && /*#__PURE__*/React.createElement(InvestmentsTab, {
    portfolio: portfolio,
    activeBonds: activeBonds,
    invSettings: invSettings,
    investedTotal: investedTotal,
    groupInvested: groupInvested,
    monthlyIncome: monthlyIncome,
    maxMonthly: maxMonthly,
    avgMonthly: avgMonthly,
    weakestGroup: weakestGroup,
    onAdd: () => {
      setEditingBond(null);
      setShowBondForm(true);
    },
    onEdit: b => {
      setEditingBond(b);
      setShowBondForm(true);
    },
    onRemove: removeBond,
    onOpenSettings: () => setShowInvSettings(true),
    syncUrl: syncUrl,
    sheetUrl: sheetUrl,
    syncStatus: syncStatus,
    tableMirror: tableMirror,
    onPush: pushToSheet,
    onPull: () => pullFromSheet(),
    onConnect: () => setShowSyncModal(true),
    onExport: exportAll,
    onImport: importAll
  }), showBondForm && /*#__PURE__*/React.createElement(BondForm, {
    bond: editingBond,
    onSave: saveBond,
    onCancel: () => {
      setShowBondForm(false);
      setEditingBond(null);
    }
  }), showInvSettings && /*#__PURE__*/React.createElement(InvSettingsModal, {
    invSettings: invSettings,
    onSave: s => {
      setInvSettings(s);
      setShowInvSettings(false);
    },
    onCancel: () => setShowInvSettings(false)
  }), showSyncModal && /*#__PURE__*/React.createElement(SyncModal, {
    current: syncUrl,
    onSave: saveSyncUrl,
    onCancel: () => setShowSyncModal(false)
  }), showSettings && /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => {
      if (e.target === e.currentTarget) setShowSettings(false);
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal"
  }, /*#__PURE__*/React.createElement("h3", null, "Налаштування валюти"), /*#__PURE__*/React.createElement("p", null, "Обери основну валюту для підсумків. За потреби додай другу — тоді кожну статтю можна вводити в будь-якій з двох. Курс автоматично оновлюється з НБУ."), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Основна валюта"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: settings.mainCurrency,
    onChange: e => setSettings({
      ...settings,
      mainCurrency: e.target.value
    }),
    className: "modal-input",
    placeholder: "напр. грн, USD, EUR"
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Друга валюта (опціонально)"), /*#__PURE__*/React.createElement("select", {
    value: settings.secondaryCurrency,
    onChange: e => {
      const code = e.target.value;
      setSettings({
        ...settings,
        secondaryCurrency: code,
        rate: code ? settings.rate : 1,
        rateSource: code ? settings.rateSource : "manual",
        rateUpdatedAt: code ? settings.rateUpdatedAt : null
      });
      setRateError(null);
    },
    className: "modal-input",
    style: {
      cursor: 'pointer'
    }
  }, POPULAR_CURRENCIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.code || "none",
    value: c.code
  }, c.label)))), settings.secondaryCurrency && /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Курс: 1 ", settings.secondaryCurrency, " = ? ", settings.mainCurrency), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.0001",
    value: settings.rate,
    onChange: e => setSettings({
      ...settings,
      rate: Number(e.target.value),
      rateSource: "manual"
    }),
    className: "modal-input"
  }), isNbuSupported && /*#__PURE__*/React.createElement("button", {
    className: "btn-mini",
    onClick: refreshNbuRate,
    disabled: rateLoading
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh",
    size: 12,
    className: rateLoading ? "spinning" : ""
  }), rateLoading ? "..." : "НБУ")), settings.rateSource === "nbu" && settings.rateUpdatedAt && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.75rem',
      color: '#15803d',
      margin: '0.4rem 0 0 0'
    }
  }, "✓ Офіційний курс НБУ на ", settings.rateUpdatedAt), rateError && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.75rem',
      color: '#b91c1c',
      margin: '0.4rem 0 0 0'
    }
  }, rateError)), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => setShowSettings(false)
  }, "Готово")))), showResetModal && /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => {
      if (e.target === e.currentTarget) setShowResetModal(false);
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal"
  }, /*#__PURE__*/React.createElement("h3", null, "Скинути до шаблону?"), /*#__PURE__*/React.createElement("p", null, "Усі категорії та картки цього місяця будуть замінені на стандартний шаблон. Інші збережені місяці не зачепить."), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: () => setShowResetModal(false)
  }, "Скасувати"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: resetMonth
  }, "Скинути"))))), /*#__PURE__*/React.createElement("div", {
    className: "print-area"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "pa-subtitle"
  }, "Особистий бюджет"), /*#__PURE__*/React.createElement("h1", {
    className: "pa-title"
  }, formatMonthLabel(selectedMonth))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      fontSize: '8pt',
      color: '#78716c'
    }
  }, settings.secondaryCurrency && /*#__PURE__*/React.createElement("div", null, "1 ", settings.secondaryCurrency, " = ", settings.rate, " ", settings.mainCurrency, settings.rateSource === "nbu" && settings.rateUpdatedAt ? ` (НБУ · ${settings.rateUpdatedAt})` : ""))), /*#__PURE__*/React.createElement("div", {
    className: "pa-income"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pa-income-label"
  }, "Дохід місяця"), /*#__PURE__*/React.createElement("span", {
    className: "pa-income-value"
  }, Number(data.income).toLocaleString("uk"), " ", settings.mainCurrency)), /*#__PURE__*/React.createElement("div", {
    className: "two-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-section-title"
  }, "Витрати за категоріями"), data.groups.map(group => /*#__PURE__*/React.createElement("div", {
    key: group.id,
    className: "pa-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-group-title"
  }, group.emoji, " ", group.title), group.items.map(item => {
    const inMain = toMain(Number(item.amount) || 0, item.currency);
    const isSecondary = item.currency === "secondary" && settings.secondaryCurrency;
    return /*#__PURE__*/React.createElement("div", {
      key: item.id,
      className: "pa-row"
    }, /*#__PURE__*/React.createElement("span", null, item.label), /*#__PURE__*/React.createElement("span", null, isSecondary ? `${item.amount} ${settings.secondaryCurrency} (${Math.round(inMain).toLocaleString("uk")} ${settings.mainCurrency})` : `${Math.round(inMain).toLocaleString("uk")} ${settings.mainCurrency}`));
  }), /*#__PURE__*/React.createElement("div", {
    className: "pa-row-total"
  }, /*#__PURE__*/React.createElement("span", null, "Разом"), /*#__PURE__*/React.createElement("span", null, formatMain(groupTotal(group))))))), /*#__PURE__*/React.createElement("div", {
    className: "pa-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-section-title"
  }, "Тримати на картках / рахунках"), data.groups.filter(g => (g.cardName || "").trim()).map(group => /*#__PURE__*/React.createElement("div", {
    key: group.id,
    className: "pa-row"
  }, /*#__PURE__*/React.createElement("span", null, group.emoji, " ", group.cardName, /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#78716c'
    }
  }, " — ", group.title)), /*#__PURE__*/React.createElement("span", null, formatMain(groupTotal(group))))), data.groups.filter(g => (g.cardName || "").trim()).length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "pa-card-sub"
  }, "Картки не вказані"))), income > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pa-section",
    style: {
      gridColumn: '1 / -1'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-section-title"
  }, "Розподіл 50 / 30 / 20"), KIND_OPTIONS.map(k => /*#__PURE__*/React.createElement("div", {
    key: k.code,
    className: "pa-row"
  }, /*#__PURE__*/React.createElement("span", null, k.emoji, " ", k.label, " (ціль ", k.target, "%)"), /*#__PURE__*/React.createElement("span", null, pct(kindTotals[k.code]), "% · ", formatMain(kindTotals[k.code]))))), goals.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "pa-section",
    style: {
      gridColumn: '1 / -1'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-section-title"
  }, "Цілі та накопичення"), goals.map(goal => {
    const target = goalToMain(goal.target, goal.currency);
    const saved = goalToMain(goal.saved, goal.currency);
    const progress = target > 0 ? Math.min(100, Math.round(saved / target * 100)) : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: goal.id,
      className: "pa-row"
    }, /*#__PURE__*/React.createElement("span", null, goal.emoji, " ", goal.title), /*#__PURE__*/React.createElement("span", null, formatMain(saved), " / ", formatMain(target), " (", progress, "%)"));
  })), /*#__PURE__*/React.createElement("div", {
    className: "pa-summary"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pa-stat-label"
  }, "Дохід"), /*#__PURE__*/React.createElement("div", {
    className: "pa-stat-value"
  }, Number(data.income).toLocaleString("uk"), " ", settings.mainCurrency)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pa-stat-label"
  }, "Витрати"), /*#__PURE__*/React.createElement("div", {
    className: "pa-stat-value"
  }, Math.round(totalSpent).toLocaleString("uk"), " ", settings.mainCurrency)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pa-stat-label"
  }, "Залишок"), /*#__PURE__*/React.createElement("div", {
    className: "pa-stat-value " + (remainder < 0 ? "pa-stat-red" : remainder > 0 ? "pa-stat-green" : "")
  }, Math.round(remainder).toLocaleString("uk"), " ", settings.mainCurrency))), /*#__PURE__*/React.createElement("div", {
    className: "pa-foot"
  }, "Згенеровано ", new Date().toLocaleDateString("uk"), " · Бюджет на місяць")));
}

export default App;
