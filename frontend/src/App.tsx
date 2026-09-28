import { useEffect, useState } from "react";
import Home from "./telas/dashboard/Home";
import Login from "./telas/autenticacao/Login";
import type { RespostaLogin } from "./types";
import { buscarSessao, sair } from "./api";

export default function App() {
  const [sessao, setSessao] = useState<RespostaLogin | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const downloadPendente = new URLSearchParams(window.location.search).get(
    "download",
  );
  useEffect(() => {
    const expirar = () => setSessao(null);
    window.addEventListener("flowfinance:sessao-expirada", expirar);
    buscarSessao()
      .then(setSessao)
      .catch(() => setSessao(null))
      .finally(() => setVerificandoSessao(false));
    return () =>
      window.removeEventListener("flowfinance:sessao-expirada", expirar);
  }, []);
  if (verificandoSessao)
    return (
      <main className="pagina-login">
        <p>Carregando...</p>
      </main>
    );
  return sessao ? (
    <Home
      usuario={sessao.usuario}
      funcionalidades={sessao.funcionalidades}
      aoSair={() => {
        sair().finally(() => setSessao(null));
      }}
    />
  ) : (
    <Login
      aoAutenticar={(novaSessao) => {
        setSessao(novaSessao);
        if (downloadPendente && downloadPendente.startsWith("/api/")) {
          window.history.replaceState(null, "", "/");
          window.location.assign(downloadPendente);
        }
      }}
    />
  );
}
