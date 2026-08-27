export interface ResumoFinanceiro {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface RespostaLogin {
  autenticado: boolean;
  usuario: string;
  papelId: number | null;
  papel: string | null;
  funcionalidades: import('./api').Funcionalidade[];
}
