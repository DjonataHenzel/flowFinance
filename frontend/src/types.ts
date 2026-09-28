export interface ResumoFinanceiro {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  categorias: ResumoCategoria[];
}

export interface ResumoCategoria {
  categoria: string;
  subcategoria: string;
  receitas: number;
  despesas: number;
  movimentacoes: number;
}

export interface RespostaLogin {
  autenticado: boolean;
  usuario: string;
  papelId: number | null;
  papel: string | null;
  funcionalidades: import('./api').Funcionalidade[];
}
