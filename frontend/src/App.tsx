import { useState } from 'react';
import Home from './telas/Home';
import Login from './telas/Login';
import type { RespostaLogin } from './types';

export default function App() {
  const [sessao, setSessao] = useState<RespostaLogin | null>(null);
  return sessao
    ? <Home usuario={sessao.usuario} funcionalidades={sessao.funcionalidades} aoSair={() => setSessao(null)} />
    : <Login aoAutenticar={setSessao} />;
}
