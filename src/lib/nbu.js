async function fetchNbuRate(currencyCode) {
  const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${currencyCode}&json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не вдалося отримати курс");
  const data = await response.json();
  if (!data || !data.length) throw new Error("Курс не знайдено");
  return {
    rate: data[0].rate,
    exchangeDate: data[0].exchangedate
  };
}

export { fetchNbuRate };
