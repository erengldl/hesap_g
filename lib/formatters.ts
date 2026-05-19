export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercent = (value: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('tr-TR').format(value);
};

export const formatDecimal = (value: number, maximumFractionDigits = 1, minimumFractionDigits = 0) => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
};

export const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
};
