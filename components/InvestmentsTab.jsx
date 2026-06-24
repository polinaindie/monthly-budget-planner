import React, { useState } from "react";
import { MONTHS, MONTH_SHORT, GROUP_OF_MONTH, GROUP_MONTHS, GROUP_LABEL } from "../lib/constants.js";
import { couponPerPayout, bondGroups, fmtUah, CRITERIA } from "../lib/investments.js";
import { Icon } from "./Icon.jsx";

function InvestmentsTab(props) {
  const {
    activeBonds,
    invSettings,
    investedTotal,
    groupInvested,
    monthlyIncome,
    maxMonthly,
    avgMonthly,
    weakestGroup,
    onAdd,
    onEdit,
    onRemove,
    onOpenSettings,
    syncUrl,
    sheetUrl,
    syncStatus,
    tableMirror,
    onPush,
    onPull,
    onConnect,
    onExport,
    onImport
  } = props;
  const [checked, setChecked] = useState({});
  const goal = Number(invSettings.monthlyGoal) || 5000;
  const now = new Date();
  const curMonthIdx = now.getMonth(); // 0-11
  const weakMonthsLabel = GROUP_MONTHS[weakestGroup].map(m => MONTH_SHORT[m - 1]).join(" / ");
  const criteria = CRITERIA(weakMonthsLabel);

  // months below goal (the "holes")
  const holes = monthlyIncome.map((v, i) => ({
    v,
    i
  })).filter(o => o.v < goal);

  // Активна фаза роудмапу: рахуємо номер місяця від дати старту
  let activePhase = null;
  let roadmapMonth = null;
  if (invSettings.startDate && Array.isArray(invSettings.phases)) {
    const [sy, sm] = invSettings.startDate.split("-").map(Number);
    if (sy && sm) {
      // 1-based: місяць старту = 1
      roadmapMonth = (now.getFullYear() - sy) * 12 + (now.getMonth() + 1 - sm) + 1;
      if (roadmapMonth >= 1) {
        activePhase = invSettings.phases.find(p => roadmapMonth >= p.fromMonth && roadmapMonth <= p.toMonth) || null;
        // якщо вже за межами останньої фази — беремо останню
        if (!activePhase && invSettings.phases.length) {
          const last = invSettings.phases[invSettings.phases.length - 1];
          if (roadmapMonth > last.toMonth) activePhase = last;
        }
      }
    }
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "card card-lg card-c-peach"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-header-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-emoji"
  }, "🎯"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Fraunces',serif",
      fontWeight: 600,
      fontSize: '1.1rem'
    }
  }, "Підказка на цей місяць")), /*#__PURE__*/React.createElement("button", {
    className: "btn-icon",
    onClick: onOpenSettings,
    title: "Налаштування цілі"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 14
  }))), activeBonds.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--ink-soft)',
      fontSize: '0.9rem',
      lineHeight: 1.5
    }
  }, "Поки портфель порожній. Почни з будь-якої гривневої ОВДП за критеріями нижче — і далі додаток підкаже, який слот латати.") : /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--ink-soft)',
      fontSize: '0.9rem',
      lineHeight: 1.5
    }
  }, "Найслабша зараз — ", /*#__PURE__*/React.createElement("b", null, GROUP_LABEL[weakestGroup]), " (вкладено ", fmtUah(groupInvested[weakestGroup]), "). Шукай папір, що латає цей слот:"), /*#__PURE__*/React.createElement("div", {
    className: "hint-target"
  }, "Купуй ОВДП із виплатами у:"), /*#__PURE__*/React.createElement("div", {
    className: "month-pills"
  }, GROUP_MONTHS[weakestGroup].map(m => /*#__PURE__*/React.createElement("span", {
    key: m,
    className: "month-pill"
  }, MONTH_SHORT[m - 1]))), activePhase ? /*#__PURE__*/React.createElement("div", {
    className: "invest-amount"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ia-head"
  }, "💰 Сума інвестиції цього місяця", /*#__PURE__*/React.createElement("span", {
    className: "ia-phase"
  }, activePhase.name, roadmapMonth ? " · місяць " + roadmapMonth : "")), /*#__PURE__*/React.createElement("div", {
    className: "ia-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ia-box ia-min"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ia-label"
  }, "Мінімум"), /*#__PURE__*/React.createElement("span", {
    className: "ia-val"
  }, fmtUah(activePhase.min))), /*#__PURE__*/React.createElement("div", {
    className: "ia-box ia-max"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ia-label"
  }, "Бажано"), /*#__PURE__*/React.createElement("span", {
    className: "ia-val"
  }, fmtUah(activePhase.max))))) : /*#__PURE__*/React.createElement("div", {
    className: "invest-amount ia-empty"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.82rem',
      color: 'var(--ink-soft)'
    }
  }, "Щоб показувати рекомендовану суму, вкажи дату старту роудмапу в", /*#__PURE__*/React.createElement("button", {
    className: "link-btn",
    onClick: onOpenSettings
  }, "налаштуваннях цілі"), ".")), /*#__PURE__*/React.createElement("ul", {
    className: "checklist"
  }, criteria.map(c => /*#__PURE__*/React.createElement("li", {
    key: c.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "ck-box" + (checked[c.id] ? " on" : ""),
    onClick: () => setChecked(p => ({
      ...p,
      [c.id]: !p[c.id]
    }))
  }, checked[c.id] ? "✓" : ""), /*#__PURE__*/React.createElement("span", null, c.text))))), /*#__PURE__*/React.createElement("div", {
    className: "inv-hero",
    style: {
      marginTop: '1.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card card-c-sage"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-sub"
  }, "Середній купонний дохід / міс"), /*#__PURE__*/React.createElement("div", {
    className: "stat-big"
  }, fmtUah(avgMonthly)), /*#__PURE__*/React.createElement("div", {
    className: "progress-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "progress-fill",
    style: {
      width: Math.min(100, avgMonthly / goal * 100) + "%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "stat-sub"
  }, "Ціль: ", fmtUah(goal), " · ", Math.round(avgMonthly / goal * 100), "%")), /*#__PURE__*/React.createElement("div", {
    className: "card card-c-lavender"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-sub"
  }, "Накопичене тіло капіталу"), /*#__PURE__*/React.createElement("div", {
    className: "stat-big"
  }, fmtUah(investedTotal)), /*#__PURE__*/React.createElement("div", {
    className: "stat-sub",
    style: {
      marginTop: '0.9rem'
    }
  }, "Активних паперів: ", activeBonds.length, " · Г1 ", fmtUah(groupInvested[1]), " · Г2 ", fmtUah(groupInvested[2]), " · Г3 ", fmtUah(groupInvested[3])))), /*#__PURE__*/React.createElement("section", {
    className: "card card-lg",
    style: {
      marginTop: '1.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-header"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Fraunces',serif",
      fontWeight: 600,
      fontSize: '1.1rem'
    }
  }, "Календар купонів — реальний дохід по місяцях")), /*#__PURE__*/React.createElement("div", {
    className: "cal-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-goalline",
    style: {
      bottom: goal / maxMonthly * 100 + "%"
    }
  }, /*#__PURE__*/React.createElement("span", null, "ціль ", Math.round(goal / 1000), "к")), monthlyIncome.map((v, i) => {
    const g = GROUP_OF_MONTH[i + 1];
    const h = v > 0 ? Math.max(2, v / maxMonthly * 100) : 0;
    const below = v < goal;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "cal-bar-wrap"
    }, v > 0 && /*#__PURE__*/React.createElement("span", {
      className: "cal-val"
    }, Math.round(v / 1000 * 10) / 10, "к"), /*#__PURE__*/React.createElement("div", {
      className: "cal-bar " + (v > 0 ? "g" + g : "empty") + (below && v > 0 ? " below" : ""),
      style: {
        height: (v > 0 ? h : 4) + "%"
      },
      title: MONTH_SHORT[i] + ": " + fmtUah(v)
    }), /*#__PURE__*/React.createElement("span", {
      className: "cal-month",
      style: {
        fontWeight: i === curMonthIdx ? 700 : 400
      }
    }, MONTH_SHORT[i]));
  })), /*#__PURE__*/React.createElement("div", {
    className: "legend"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    style: {
      background: '#7aa7c7'
    }
  }), "Група 1"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    style: {
      background: '#e0b84a'
    }
  }), "Група 2"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    style: {
      background: '#6f9b6a'
    }
  }), "Група 3"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)'
    }
  }, "— — лінія цілі ", fmtUah(goal))), activeBonds.length > 0 && holes.length > 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.78rem',
      color: 'var(--ink-soft)',
      marginTop: '0.8rem'
    }
  }, "Нижче цілі: ", holes.map(o => MONTH_SHORT[o.i]).join(", "), " — ось де ще є прогалини.")), /*#__PURE__*/React.createElement("section", {
    className: "card card-lg",
    style: {
      marginTop: '1.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-header"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Fraunces',serif",
      fontWeight: 600,
      fontSize: '1.1rem'
    }
  }, "Мої облігації"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: onAdd
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), " Додати")), activeBonds.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--ink-faded)',
      fontSize: '0.88rem'
    }
  }, "Ще нічого не додано."), props.portfolio.map(b => {
    const gs = bondGroups(b);
    return /*#__PURE__*/React.createElement("div", {
      key: b.id,
      className: "bond-row"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: '0.92rem'
      }
    }, b.isin || "ОВДП"), b.name && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.8rem',
        color: 'var(--ink-soft)'
      }
    }, b.name), b.status === "redeemed" && /*#__PURE__*/React.createElement("span", {
      className: "grp-tag",
      style: {
        background: 'rgba(139,111,71,0.15)',
        color: 'var(--ink-faded)'
      }
    }, "погашена"), gs.map(g => /*#__PURE__*/React.createElement("span", {
      key: g,
      className: "grp-tag g" + g
    }, "Г", g))), /*#__PURE__*/React.createElement("div", {
      className: "bond-meta"
    }, fmtUah(b.invested), " вкладено · номінал ", fmtUah(b.nominal), " · ", b.couponRate, "% · купон ", fmtUah(couponPerPayout(b)), "/виплату · виплати: ", (b.payMonths || []).map(m => MONTH_SHORT[m - 1]).join("/") || "—", b.maturity && " · погашення " + b.maturity)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '0.3rem'
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn-icon",
      onClick: () => onEdit(b),
      title: "Редагувати"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "settings",
      size: 14
    })), /*#__PURE__*/React.createElement("button", {
      className: "btn-icon",
      onClick: () => {
        if (confirm("Видалити цей папір?")) onRemove(b.id);
      },
      title: "Видалити"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "trash",
      size: 14
    }))));
  }), /*#__PURE__*/React.createElement("div", {
    className: "sync-zone"
  }, /*#__PURE__*/React.createElement("div", {
    className: "actions"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onPush,
    className: "btn btn-primary"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "save",
    size: 16
  }), " Зберегти в таблицю"), sheetUrl && /*#__PURE__*/React.createElement("a", {
    href: sheetUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "btn btn-secondary",
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pdf",
    size: 16
  }), " Перейти до таблиці")), syncStatus && /*#__PURE__*/React.createElement("p", {
    className: "actions-note",
    style: {
      textAlign: 'left',
      margin: '0.6rem 0 0',
      color: syncStatus.type === "err" ? "#b91c1c" : syncStatus.type === "ok" ? "#15803d" : "var(--ink-soft)"
    }
  }, syncStatus.msg), /*#__PURE__*/React.createElement("div", {
    className: "actions",
    style: {
      marginTop: '0.7rem'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onExport,
    className: "btn btn-secondary"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "save",
    size: 16
  }), " Експорт (бекап JSON)"), /*#__PURE__*/React.createElement("label", {
    className: "btn btn-secondary",
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh",
    size: 16
  }), " Імпорт із файлу", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "application/json",
    style: {
      display: 'none'
    },
    onChange: e => {
      if (e.target.files[0]) onImport(e.target.files[0]);
      e.target.value = "";
    }
  }))), /*#__PURE__*/React.createElement(TableMirror, {
    snap: tableMirror
  }))), /*#__PURE__*/React.createElement("p", {
    className: "disclaimer"
  }, "Це інструмент для організації твоїх власних рішень, а не інвестиційна порада. Усі цифри — те, що вводиш ти; додаток лише рахує й підсвічує слабкі слоти за твоїм алгоритмом. Рішення про конкретну покупку — за тобою."));
}

export { InvestmentsTab };
