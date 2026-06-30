import React, { useState } from "react";
import { MONTH_SHORT } from "../lib/constants.js";

function BondForm({
  bond,
  onSave,
  onCancel
}) {
  const [f, setF] = useState(bond || {
    id: Math.random().toString(36).slice(2, 10),
    isin: "",
    name: "",
    buyDate: "",
    invested: 0,
    nominal: 0,
    couponRate: 15.5,
    payMonths: [],
    maturity: "",
    status: "active"
  });
  const toggleMonth = m => setF(p => ({
    ...p,
    payMonths: p.payMonths.includes(m) ? p.payMonths.filter(x => x !== m) : [...p.payMonths, m].sort((a, b) => a - b)
  }));
  const set = (k, v) => setF(p => ({
    ...p,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => {
      if (e.target === e.currentTarget) onCancel();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: '30rem'
    }
  }, /*#__PURE__*/React.createElement("h3", null, bond ? "Редагувати облігацію" : "Додати облігацію"), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "ISIN"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    value: f.isin,
    onChange: e => set("isin", e.target.value),
    placeholder: "UA4000..."
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Назва / нотатка (необов'язково)"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    value: f.name,
    onChange: e => set("name", e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "mini-grid",
    style: {
      gridTemplateColumns: '1fr 1fr'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Дата купівлі"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "date",
    value: f.buyDate,
    onChange: e => set("buyDate", e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Дата погашення"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "date",
    value: f.maturity,
    onChange: e => set("maturity", e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mini-grid",
    style: {
      gridTemplateColumns: '1fr 1fr 1fr'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Вкладено, грн"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "number",
    value: f.invested || "",
    onChange: e => set("invested", Number(e.target.value) || 0)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Сум. номінал, грн"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "number",
    value: f.nominal || "",
    onChange: e => set("nominal", Number(e.target.value) || 0)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Купон, %"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "number",
    step: "0.01",
    value: f.couponRate || "",
    onChange: e => set("couponRate", Number(e.target.value) || 0)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Місяці виплати купона"), /*#__PURE__*/React.createElement("div", {
    className: "month-check"
  }, MONTH_SHORT.map((mn, i) => /*#__PURE__*/React.createElement("label", {
    key: i,
    className: f.payMonths.includes(i + 1) ? "on" : ""
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: f.payMonths.includes(i + 1),
    onChange: () => toggleMonth(i + 1)
  }), mn))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.68rem',
      color: 'var(--ink-faded)',
      margin: '0.4rem 0 0'
    }
  }, "Купон за виплату = номінал × ставка% ÷ кількість виплат.")), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Статус"), /*#__PURE__*/React.createElement("select", {
    className: "modal-input",
    value: f.status,
    onChange: e => set("status", e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "active"
  }, "Активна"), /*#__PURE__*/React.createElement("option", {
    value: "redeemed"
  }, "Погашена"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: onCancel
  }, "Скасувати"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onSave(f)
  }, "Зберегти"))));
}

export { BondForm };
