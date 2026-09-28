const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatarDataHora(valor: string | Date) {
  return formatoDataHora.format(
    typeof valor === "string" ? new Date(valor) : valor,
  );
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/, 1)[0] ?? "";
}

export function formatarPrimeirosNomes(nomes: string | string[]) {
  const lista = Array.isArray(nomes) ? nomes : nomes.split(",");
  return lista.map(primeiroNome).filter(Boolean).join(", ");
}
