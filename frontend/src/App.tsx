import { useEffect,useState } from 'react';
import Home from './telas/Home';
import Login from './telas/Login';
import type { RespostaLogin } from './types';
import {sair} from './api';

export default function App() {
  const [sessao, setSessao] = useState<RespostaLogin | null>(null);
  useEffect(()=>{const expirar=()=>setSessao(null);window.addEventListener('flowfinance:sessao-expirada',expirar);return()=>window.removeEventListener('flowfinance:sessao-expirada',expirar)},[]);
  return sessao
    ? <Home usuario={sessao.usuario} funcionalidades={sessao.funcionalidades} aoSair={() => {sair().finally(()=>setSessao(null))}} />
    : <Login aoAutenticar={setSessao} />;
}
