import React from "react";
import { MONTH_SHORT } from "../lib/constants.js";
import { bondGroups } from "../lib/investments.js";

function TableMirror({
  snap
}) {
  if (!snap) return null;
  const bonds = Array.isArray(snap.portfolio) ? snap.portfolio : [];
  const goal = snap.invSettings && snap.invSettings.monthlyGoal;
  const cur = snap.settings && snap.settings.mainCurrency || "грн";
  const fmt = n => Math.round(Number(n) || 0).toLocaleString("uk") + " " + cur;
  const totalInvested = bonds.reduce((s, b) => s + (Number(b.invested) || 0), 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "mirror"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mirror-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mirror-title"
  }, "📋 Що зараз у таблиці"), snap.savedAt && /*#__PURE__*/React.createElement("span", {
    className: "mirror-time"
  }, "оновлено ", new Date(snap.savedAt).toLocaleString("uk"))), bonds.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--ink-faded)',
      margin: 0
    }
  }, "Облігацій у таблиці поки немає.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "mirror-summary"
  }, goal != null && /*#__PURE__*/React.createElement("span", null, "Ціль ", /*#__PURE__*/React.createElement("b", null, fmt(goal), "/міс")), /*#__PURE__*/React.createElement("span", null, "Облігацій ", /*#__PURE__*/React.createElement("b", null, bonds.length)), /*#__PURE__*/React.createElement("span", null, "Вкладено ", /*#__PURE__*/React.createElement("b", null, fmt(totalInvested)))), /*#__PURE__*/React.createElement("div", {
    className: "mirror-cards"
  }, bonds.map(b => {
    const gs = bondGroups(b);
    const annual = (Number(b.nominal) || 0) * (Number(b.couponRate) || 0) / 100;
    return /*#__PURE__*/React.createElement("div", {
      key: b.id,
      className: "mirror-card" + (b.status === "redeemed" ? " redeemed" : "")
    }, /*#__PURE__*/React.createElement("div", {
      className: "mc-top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc-isin"
    }, b.isin || "ОВДП"), b.name && /*#__PURE__*/React.createElement("span", {
      className: "mc-name"
    }, b.name), /*#__PURE__*/React.createElement("span", {
      className: "mc-spacer"
    }), gs.map(g => /*#__PURE__*/React.createElement("span", {
      key: g,
      className: "grp-tag g" + g
    }, "Група ", g)), b.status === "redeemed" && /*#__PURE__*/React.createElement("span", {
      className: "mc-status"
    }, "погашена")), /*#__PURE__*/React.createElement("div", {
      className: "mc-fields"
    }, /*#__PURE__*/React.createElement("div", {
      className: "mc-field"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc-k"
    }, "Вкладено"), /*#__PURE__*/React.createElement("span", {
      className: "mc-v"
    }, fmt(b.invested))), /*#__PURE__*/React.createElement("div", {
      className: "mc-field"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc-k"
    }, "Номінал"), /*#__PURE__*/React.createElement("span", {
      className: "mc-v"
    }, fmt(b.nominal))), /*#__PURE__*/React.createElement("div", {
      className: "mc-field"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc-k"
    }, "Купон"), /*#__PURE__*/React.createElement("span", {
      className: "mc-v"
    }, b.couponRate, "%")), /*#__PURE__*/React.createElement("div", {
      className: "mc-field"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc-k"
    }, "Річний дохід"), /*#__PURE__*/React.createElement("span", {
      className: "mc-v"
    }, fmt(annual))), b.maturity && /*#__PURE__*/React.createElement("div", {
      className: "mc-field"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc-k"
    }, "Погашення"), /*#__PURE__*/React.createElement("span", {
      className: "mc-v"
    }, b.maturity))), /*#__PURE__*/React.createElement("div", {
      className: "mc-months"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc-k"
    }, "Виплати:"), (b.payMonths || []).length ? b.payMonths.map(m => /*#__PURE__*/React.createElement("span", {
      key: m,
      className: "mc-month-pill"
    }, MONTH_SHORT[m - 1])) : /*#__PURE__*/React.createElement("span", {
      className: "mc-v"
    }, "—")));
  }))));
}

export { TableMirror };
