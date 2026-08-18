export type TipoMovimentacao = 'income' | 'expense';

export interface Movimentacao {
  description: string;
  type: TipoMovimentacao;
  amount: number;
}

export interface ResumoFinanceiro {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  recentTransactions?: Movimentacao[];
}

export interface RespostaLogin {
  autenticado: boolean;
  usuario: string;
  papelId: number | null;
  papel: string | null;
  funcionalidades: import('./api').Funcionalidade[];
}
