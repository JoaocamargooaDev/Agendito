export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(valueInCents: number, locale = "pt-BR", currency = "BRL") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(valueInCents / 100);
}
