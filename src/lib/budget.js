import { KIND_OPTIONS } from "./constants.js";

const KIND_MAP = Object.fromEntries(KIND_OPTIONS.map(k => [k.code, k]));
// Автоматичне визначення типу категорії за назвою (50/30/20)
const guessKind = title => {
  const t = (title || "").toLowerCase();
  if (/(заощад|накопич|інвест|подушк|ціл|пенс|резерв|маржа|відклад)/.test(t)) return "save";
  if (/(приємн|розваг|хобі|кафе|ресторан|подорож|імпульс|бажан|подарун|краса|шопінг|розкіш)/.test(t)) return "want";
  return "need";
};

export { KIND_MAP, guessKind };
