import { FormEvent, useState } from "react";
import { entrar } from "../../api";
import type { RespostaLogin } from "../../types";

interface PropriedadesLogin {
  aoAutenticar: (sessao: RespostaLogin) => void;
}

const CHAVE_USUARIO = "flowfinance.usuario";

export default function Login({ aoAutenticar }: PropriedadesLogin) {
  const [usuario, setUsuario] = useState(
    () => localStorage.getItem(CHAVE_USUARIO) ?? "",
  );
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(() =>
    Boolean(localStorage.getItem(CHAVE_USUARIO)),
  );
  const [mensagemErro, setMensagemErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setMensagemErro("");
    setCarregando(true);
    try {
      const resposta = await entrar(usuario, senha);
      if (lembrar) localStorage.setItem(CHAVE_USUARIO, usuario);
      else localStorage.removeItem(CHAVE_USUARIO);
      aoAutenticar(resposta);
    } catch (erro) {
      setMensagemErro(
        erro instanceof Error ? erro.message : "Erro ao realizar login.",
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="pagina-login">
      <form className="cartao-login" onSubmit={enviarFormulario}>
        <div className="identidade-login">
          <div className="logotipo">
            <img src="/flowfinance-icon.png" alt="" />
          </div>
          <h1>FlowFinance</h1>
          <p className="subtitulo-login">Acesse sua conta para continuar</p>
        </div>
        <label className="rotulo-campo" htmlFor="usuario">
          Usuário
        </label>
        <input
          className="campo-formulario"
          id="usuario"
          value={usuario}
          onChange={(evento) => setUsuario(evento.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
        <label className="rotulo-campo" htmlFor="senha">
          Senha
        </label>
        <input
          className="campo-formulario"
          id="senha"
          type="password"
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          autoComplete="current-password"
          required
        />
        <label className="lembrar-login">
          <input
            type="checkbox"
            checked={lembrar}
            onChange={(evento) => setLembrar(evento.target.checked)}
          />
          <span>Lembrar usuário</span>
        </label>
        {mensagemErro && (
          <p className="mensagem-erro" role="alert">
            {mensagemErro}
          </p>
        )}
        <button className="botao-primario" type="submit" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
