import React, { useState } from "react";

function SyncModal({
  current,
  onSave,
  onCancel
}) {
  const [u, setU] = useState(current || "");
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-bg",
    onClick: e => {
      if (e.target === e.currentTarget) onCancel();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: {
      maxWidth: '32rem'
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Підключення Google-таблиці"), /*#__PURE__*/React.createElement("p", null, "Встав URL веб-додатка Apps Script (закінчується на ", /*#__PURE__*/React.createElement("b", null, "/exec"), "). Інструкцію зі створення дивись у файлі AppsScript.gs."), /*#__PURE__*/React.createElement("div", {
    className: "modal-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "modal-label"
  }, "URL веб-додатка"), /*#__PURE__*/React.createElement("input", {
    className: "modal-input",
    value: u,
    onChange: e => setU(e.target.value),
    placeholder: "https://script.google.com/macros/s/.../exec"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.72rem',
      color: 'var(--ink-faded)',
      lineHeight: 1.5
    }
  }, "Будь-хто з цим URL зможе читати й писати твої дані. Не публікуй його. Дані зберігаються як JSON в окремому аркуші таблиці."), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-secondary",
    onClick: onCancel
  }, "Скасувати"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onSave(u)
  }, "Зберегти й підключити"))));
}

export { SyncModal };
