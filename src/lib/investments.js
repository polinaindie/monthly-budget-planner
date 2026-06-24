import React from "react";
import { DEFAULT_INV_SETTINGS, GROUP_OF_MONTH } from "./constants.js";

function migrateInvSettings(s) {
  if (!s || !Array.isArray(s.phases)) return s;
  s.phases = s.phases.map((ph, i) => {
    if (typeof ph.min === "number" && typeof ph.max === "number") return ph;
    let min = 0,
      max = 0;
    if (typeof ph.contribution === "string") {
      const nums = ph.contribution.replace(/\s/g, "").match(/\d+/g);
      if (nums && nums.length >= 2) {
        min = Number(nums[0]);
        max = Number(nums[1]);
      } else if (nums && nums.length === 1) {
        min = max = Number(nums[0]);
      }
    }
    const def = DEFAULT_INV_SETTINGS.phases[i];
    return {
      name: ph.name || def && def.name || "Фаза",
      fromMonth: ph.fromMonth || def && def.fromMonth || 1,
      toMonth: ph.toMonth || def && def.toMonth || 12,
      min: min || def && def.min || 0,
      max: max || def && def.max || 0
    };
  });
  return s;
}


// Coupon per single payout = nominal * rate% / payoutsPerYear
const couponPerPayout = bond => {
  const nominal = Number(bond.nominal) || 0;
  const rate = Number(bond.couponRate) || 0;
  const payouts = bond.payMonths && bond.payMonths.length || 0;
  if (!payouts) return 0;
  return nominal * rate / 100 / payouts;
};
const annualCoupon = bond => couponPerPayout(bond) * (bond.payMonths && bond.payMonths.length || 0);

// Which groups does this bond feed (a semiannual bond can touch two)
const bondGroups = bond => {
  const gs = new Set();
  (bond.payMonths || []).forEach(m => {
    if (GROUP_OF_MONTH[m]) gs.add(GROUP_OF_MONTH[m]);
  });
  return [...gs];
};

const fmtUah = n => Math.round(n).toLocaleString("uk") + " грн";
const CRITERIA = weakMonths => [{
  id: "slot",
  text: /*#__PURE__*/React.createElement(React.Fragment, null, "Платить купон у ", /*#__PURE__*/React.createElement("b", null, weakMonths), " — закриває найслабшу групу")
}, {
  id: "rate",
  text: /*#__PURE__*/React.createElement(React.Fragment, null, "Фіксований купон ", /*#__PURE__*/React.createElement("b", null, "15–16%"), " (не плаваючий, щоб прогноз був точний)")
}, {
  id: "maturity",
  text: /*#__PURE__*/React.createElement(React.Fragment, null, "Погашення через ", /*#__PURE__*/React.createElement("b", null, "12–18 міс"), " (для першої покупки)")
}, {
  id: "liquidity",
  text: /*#__PURE__*/React.createElement(React.Fragment, null, "Великий обсяг випуску — легше продати на вторинному ринку")
}, {
  id: "fee",
  text: /*#__PURE__*/React.createElement(React.Fragment, null, "Нульова комісія брокера за купівлю")
}];

export { migrateInvSettings, couponPerPayout, annualCoupon, bondGroups, fmtUah, CRITERIA };
