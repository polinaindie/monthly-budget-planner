const MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const STORAGE_PREFIX = "budget_v2:";
const SETTINGS_KEY = "budget_v2_settings";
const newId = () => Math.random().toString(36).slice(2, 10);
const DEFAULT_TEMPLATE = () => {
  const fixedTitle = "Фіксовані";
  const regularTitle = "Регулярні витрати";
  const goalsTitle = "Заощадження та цілі";
  const pleasureTitle = "На приємне";
  return {
    income: 0,
    groups: [{
      id: newId(),
      title: fixedTitle,
      emoji: "🏠",
      color: "cream",
      cardName: "Обовʼязкові платежі",
      items: [{
        id: newId(),
        label: "Житло",
        amount: 0,
        currency: "main"
      }, {
        id: newId(),
        label: "Комунальні",
        amount: 0,
        currency: "main"
      }, {
        id: newId(),
        label: "Інтернет / звʼязок",
        amount: 0,
        currency: "main"
      }, {
        id: newId(),
        label: "Підписки",
        amount: 0,
        currency: "main"
      }]
    }, {
      id: newId(),
      title: regularTitle,
      emoji: "☕",
      color: "cream",
      cardName: "Картка для життя",
      items: [{
        id: newId(),
        label: "Продукти",
        amount: 0,
        currency: "main"
      }, {
        id: newId(),
        label: "Транспорт",
        amount: 0,
        currency: "main"
      }, {
        id: newId(),
        label: "Кафе / їжа поза домом",
        amount: 0,
        currency: "main"
      }]
    }, {
      id: newId(),
      title: goalsTitle,
      emoji: "🌱",
      color: "cream",
      cardName: "Накопичувальний рахунок",
      items: [{
        id: newId(),
        label: "Інвестиції",
        amount: 0,
        currency: "main"
      }, {
        id: newId(),
        label: "Подушка / накопичення",
        amount: 0,
        currency: "main"
      }]
    }, {
      id: newId(),
      title: pleasureTitle,
      emoji: "✨",
      color: "cream",
      cardName: "Картка на приємне",
      items: [{
        id: newId(),
        label: "Розваги",
        amount: 0,
        currency: "main"
      }, {
        id: newId(),
        label: "Імпульсивне",
        amount: 0,
        currency: "main"
      }]
    }],
    cards: [{
      id: newId(),
      eyebrow: "Картка 1",
      emoji: "💳",
      title: "Життя",
      subtitle: "Регулярні щоденні витрати",
      groupTitleRefs: [regularTitle],
      color: "cream"
    }, {
      id: newId(),
      eyebrow: "Картка 2",
      emoji: "✨",
      title: "На приємне",
      subtitle: "Окрема картка, тільки звідти",
      groupTitleRefs: [pleasureTitle],
      color: "peach"
    }, {
      id: newId(),
      eyebrow: "Рахунок",
      emoji: "📋",
      title: "Обовʼязкові платежі",
      subtitle: "Чекає дати оплати",
      groupTitleRefs: [fixedTitle],
      color: "butter"
    }, {
      id: newId(),
      eyebrow: "Перекази",
      emoji: "🌱",
      title: "Інвестиції & пенсія",
      subtitle: "Відправити одразу",
      groupTitleRefs: [goalsTitle],
      color: "sage"
    }, {
      id: newId(),
      eyebrow: "Подушка",
      emoji: "🐷",
      title: "Накопичувальний",
      subtitle: "Рахунок без картки",
      groupTitleRefs: [],
      color: "lavender"
    }]
  };
};
// Наскрізні цілі накопичення (не залежать від місяця, як портфель ОВДП)
const GOALS_KEY = "budget_v2_goals";
const DEFAULT_GOALS = () => [{
  id: newId(),
  emoji: "🚗",
  title: "Авто",
  target: 15000,
  saved: 0,
  monthly: 0,
  currency: "main",
  creditedMonths: []
}, {
  id: newId(),
  emoji: "🏡",
  title: "Свій дім",
  target: 65000,
  saved: 0,
  monthly: 0,
  currency: "main",
  creditedMonths: []
}, {
  id: newId(),
  emoji: "🛟",
  title: "Подушка безпеки",
  target: 0,
  saved: 0,
  monthly: 0,
  currency: "main",
  creditedMonths: []
}];
// Тип категорії для правила 50/30/20
const KIND_OPTIONS = [{
  code: "need",
  label: "Потреба",
  emoji: "🔑",
  target: 50
}, {
  code: "want",
  label: "Бажання",
  emoji: "🌸",
  target: 30
}, {
  code: "save",
  label: "Заощадження",
  emoji: "🌱",
  target: 20
}];
const DEFAULT_SETTINGS = {
  mainCurrency: "грн",
  secondaryCurrency: "",
  rate: 1,
  rateSource: "manual",
  rateUpdatedAt: null
};
const POPULAR_CURRENCIES = [{
  code: "",
  label: "— без другої валюти —"
}, {
  code: "EUR",
  label: "Євро (EUR)"
}, {
  code: "USD",
  label: "Долар США (USD)"
}, {
  code: "PLN",
  label: "Польський злотий (PLN)"
}];
const NBU_SUPPORTED = ["EUR", "USD", "PLN"];
const TICKET_COLOR_OPTIONS = [{
  code: "cream",
  label: "Кремова"
}, {
  code: "peach",
  label: "Персикова"
}, {
  code: "butter",
  label: "Вершкова"
}, {
  code: "sage",
  label: "Шавлієва"
}, {
  code: "mint",
  label: "Мʼятна"
}, {
  code: "sky",
  label: "Небесна"
}, {
  code: "lavender",
  label: "Лавандова"
}, {
  code: "rose",
  label: "Трояндова"
}];

// ===== Investment (ОВДП) domain constants =====
const PORTFOLIO_KEY = "budget_v2_portfolio";
const INV_SETTINGS_KEY = "budget_v2_inv_settings";
const SYNC_URL_KEY = "budget_v2_sync_url";
const MONTH_SHORT = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
// Group by payout months (1-indexed): Q1=1,4,7,10  Q2=2,5,8,11  Q3=3,6,9,12
const GROUP_OF_MONTH = {
  1: 1,
  4: 1,
  7: 1,
  10: 1,
  2: 2,
  5: 2,
  8: 2,
  11: 2,
  3: 3,
  6: 3,
  9: 3,
  12: 3
};
const GROUP_MONTHS = {
  1: [1, 4, 7, 10],
  2: [2, 5, 8, 11],
  3: [3, 6, 9, 12]
};
const GROUP_LABEL = {
  1: "Група 1 · січ / кві / лип / жов",
  2: "Група 2 · лют / тра / сер / лис",
  3: "Група 3 · бер / чер / вер / гру"
};
const DEFAULT_INV_SETTINGS = {
  monthlyGoal: 5000,
  startDate: "",
  // YYYY-MM, коли стартував роудмап; порожньо = ще не задано
  phases: [{
    name: "MVP (Beta)",
    fromMonth: 1,
    toMonth: 6,
    min: 8000,
    max: 10000
  }, {
    name: "Scaling",
    fromMonth: 7,
    toMonth: 18,
    min: 15000,
    max: 17000
  }, {
    name: "Launch (Gold)",
    fromMonth: 19,
    toMonth: 24,
    min: 18000,
    max: 20000
  }]
};

export { MONTHS, STORAGE_PREFIX, SETTINGS_KEY, newId, DEFAULT_TEMPLATE, GOALS_KEY, DEFAULT_GOALS, KIND_OPTIONS, DEFAULT_SETTINGS, POPULAR_CURRENCIES, NBU_SUPPORTED, TICKET_COLOR_OPTIONS, PORTFOLIO_KEY, INV_SETTINGS_KEY, SYNC_URL_KEY, MONTH_SHORT, GROUP_OF_MONTH, GROUP_MONTHS, GROUP_LABEL, DEFAULT_INV_SETTINGS };
