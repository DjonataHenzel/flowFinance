import { FormEvent, useEffect, useState } from "react";
import {
  alterarUsuario,
  cadastrarUsuario,
  listarPapeis,
  listarPessoasVinculaveis,
} from "../../api";
import type { PapelResumo, PessoaVinculavel, UsuarioResumo } from "../../api";

const SENHA_MANTIDA = "********";

export default function Usuario({
  registro,
  aoSalvar,
  aoCancelar,
}: {
  registro?: UsuarioResumo;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [usuario, setUsuario] = useState(registro?.usuario ?? ""),
    [senha, setSenha] = useState(registro ? SENHA_MANTIDA : ""),
    [confirmacao, setConfirmacao] = useState(registro ? SENHA_MANTIDA : ""),
    [mostrarSenha, setMostrarSenha] = useState(false),
    [mostrarConfirmacao, setMostrarConfirmacao] = useState(false),
    [ativo, setAtivo] = useState(registro?.ativo ?? true),
    [visualizarTodos, setVisualizarTodos] = useState(registro?.visualizarCadastrosTodosUsuarios ?? false),
    [papelId, setPapelId] = useState(
      registro?.papelId ? String(registro.papelId) : "",
    ),
    [pessoaId, setPessoaId] = useState(
      registro?.pessoaId ? String(registro.pessoaId) : "",
    ),
    [papeis, setPapeis] = useState<PapelResumo[]>([]),
    [pessoas, setPessoas] = useState<PessoaVinculavel[]>([]),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  useEffect(() => {
    listarPapeis()
      .then((lista) =>
        setPapeis(lista.filter((p) => p.ativo || p.id === registro?.papelId)),
      )
      .catch((e) => setErro(e.message));
    listarPessoasVinculaveis(registro?.id).then(setPessoas).catch((e) => setErro(e.message));
  }, [registro]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha !== confirmacao) {
      setErro("A confirmação da senha não confere.");
      return;
    }

    if (!papelId) {
      setErro("Selecione um papel para o usuário.");
      return;
    }
    setSalvando(true);
    try {
      const senhaParaEnvio =
        registro && senha === SENHA_MANTIDA && confirmacao === SENHA_MANTIDA
          ? ""
          : senha;
      registro
        ? await alterarUsuario(
            registro.id,
            usuario,
            senhaParaEnvio,
            ativo,
            Number(papelId),
            pessoaId ? Number(pessoaId) : null,
            false,
            [],
            false,
            "",
            "08:00",
            0,
            visualizarTodos,
          )
        : await cadastrarUsuario(
            usuario,
            senha,
            Number(papelId),
            pessoaId ? Number(pessoaId) : null,
            false,
            [],
            false,
            "",
            "08:00",
            0,
            visualizarTodos,
          );
      aoSalvar();
    } catch (f) {
      setErro(f instanceof Error ? f.message : "Erro ao salvar usuário.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="painel formulario-movimentacao" onSubmit={salvar}>
      <h1>{registro ? "Alterar usuário" : "Cadastrar usuário"}</h1>
      <label className="rotulo-campo">Usuário *</label>
      <input
        className="campo-formulario"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        maxLength={100}
        required
      />
      <div className="grade-baixa grade-vinculos-usuario">
        <label className="rotulo-campo">
          Papel/permissão *
          <select
            className="campo-formulario"
            value={papelId}
            onChange={(e) => setPapelId(e.target.value)}
            required
          >
            <option value="">Selecione um papel</option>
            {papeis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="rotulo-campo">
          Pessoa vinculada
          <select
            className="campo-formulario"
            value={pessoaId}
            onChange={(e) => setPessoaId(e.target.value)}
          >
            <option value="">Sem pessoa vinculada</option>
            {pessoas.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!papeis.length && (
        <small className="ajuda-campo">
          Cadastre um papel ativo na tela de permissões antes de criar o
          usuário.
        </small>
      )}
      <small className="ajuda-campo">
        Essa pessoa será sugerida nas notificações de novas contas e compromissos.
      </small>
      <label className="rotulo-campo">Senha *</label>
      <div className="campo-senha">
        <input
          className="campo-formulario"
          type={mostrarSenha ? "text" : "password"}
          value={senha}
          onFocus={() => limparSenhaMantida(senha, setSenha, setConfirmacao)}
          onChange={(e) => setSenha(e.target.value)}
          minLength={4}
          maxLength={72}
          required
          autoComplete="new-password"
        />
        <button
          className="botao-visualizar-senha"
          type="button"
          aria-label={mostrarSenha ? "Ocultar senha" : "Visualizar senha"}
          title={mostrarSenha ? "Ocultar senha" : "Visualizar senha"}
          onClick={() => setMostrarSenha((mostrar) => !mostrar)}
        >
          <IconeOlho aberto={mostrarSenha} />
        </button>
      </div>
      <label className="rotulo-campo">Confirmar senha *</label>
      <div className="campo-senha">
        <input
          className="campo-formulario"
          type={mostrarConfirmacao ? "text" : "password"}
          value={confirmacao}
          onFocus={() =>
            limparSenhaMantida(confirmacao, setSenha, setConfirmacao)
          }
          onChange={(e) => setConfirmacao(e.target.value)}
          minLength={4}
          maxLength={72}
          required
          autoComplete="new-password"
        />
        <button
          className="botao-visualizar-senha"
          type="button"
          aria-label={
            mostrarConfirmacao
              ? "Ocultar confirmação da senha"
              : "Visualizar confirmação da senha"
          }
          title={mostrarConfirmacao ? "Ocultar senha" : "Visualizar senha"}
          onClick={() => setMostrarConfirmacao((mostrar) => !mostrar)}
        >
          <IconeOlho aberto={mostrarConfirmacao} />
        </button>
      </div>
      {registro && (
        <label className="rotulo-campo opcao-checkbox">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />{" "}
          Usuário ativo
        </label>
      )}
      <label className="rotulo-campo opcao-checkbox">
        <input
          type="checkbox"
          checked={visualizarTodos}
          onChange={(e) => setVisualizarTodos(e.target.checked)}
        />{" "}
        Visualizar cadastro de todos os usuários
      </label>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="acoes-formulario">
        <button
          className="botao-primario botao-ajustado"
          disabled={salvando || !papeis.length}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button className="botao-secundario" type="button" onClick={aoCancelar}>
          Voltar
        </button>
      </div>
    </form>
  );
}

function limparSenhaMantida(
  valor: string,
  setSenha: (valor: string) => void,
  setConfirmacao: (valor: string) => void,
) {
  if (valor !== SENHA_MANTIDA) return;
  setSenha("");
  setConfirmacao("");
}

function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {!aberto && <path d="m4 4 16 16" />}
    </svg>
  );
}
