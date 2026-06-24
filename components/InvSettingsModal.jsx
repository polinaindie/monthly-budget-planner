import React, { useState } from "react";

function InvSettingsModal({
  invSettings,
  onSave,
  onCancel
}) {
  const [s, setS] = useState(JSON.parse(JSON.stringify(invSettings)));
  const setPhase = (i, k, v) => setS(p => ({
    ...p,
    phases: p.phases.map((ph, j) => j === i ? {
      ...ph,
      [k]: v
    } : ph)
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
  }, /*#__PURE__*/React.createElement("h3", null, "Налаштування цілі"), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Ціль пасивного доходу, грн/міс"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "number",
    value: s.monthlyGoal,
    onChange: e => setS({
      ...s,
      monthlyGoal: Number(e.target.value) || 0
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "Старт роудмапу (місяць)"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "month",
    value: s.startDate || "",
    onChange: e => setS({
      ...s,
      startDate: e.target.value
    })
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.68rem',
      color: 'var(--ink-faded)',
      margin: '0.3rem 0 0'
    }
  }, "Від цієї дати рахується, на якій фазі ти зараз і яку суму радити вкладати.")), /*#__PURE__*/React.createElement("label", {
    className: "modal-label",
    style: {
      display: 'block',
      marginTop: '0.5rem'
    }
  }, "Фази роудмапу (внесок/міс)"), s.phases.map((ph, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "modal-field",
    style: {
      border: '1px solid var(--border-cream)',
      borderRadius: '0.6rem',
      padding: '0.6rem'
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    value: ph.name,
    onChange: e => setPhase(i, "name", e.target.value),
    style: {
      marginBottom: '0.4rem'
    },
    placeholder: "назва фази"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '0.4rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label",
    style: {
      fontSize: '0.62rem'
    }
  }, "Місяці: з"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "number",
    value: ph.fromMonth,
    onChange: e => setPhase(i, "fromMonth", Number(e.target.value) || 1)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label",
    style: {
      fontSize: '0.62rem'
    }
  }, "по"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "number",
    value: ph.toMonth,
    onChange: e => setPhase(i, "toMonth", Number(e.target.value) || 1)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '0.5rem'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label",
    style: {
      fontSize: '0.62rem'
    }
  }, "Мінімум, грн"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "number",
    value: ph.min,
    onChange: e => setPhase(i, "min", Number(e.target.value) || 0)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label",
    style: {
      fontSize: '0.62rem'
    }
  }, "Бажано, грн"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    type: "number",
    value: ph.max,
    onChange: e => setPhase(i, "max", Number(e.target.value) || 0)
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: onCancel
  }, "Скасувати"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onSave(s)
  }, "Готово"))));
}

export { InvSettingsModal };
