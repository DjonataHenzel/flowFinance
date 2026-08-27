import { FormEvent, useEffect, useState } from "react";
import { alterarUsuario, cadastrarUsuario, listarPapeis } from "../../api";
import type { PapelResumo, UsuarioResumo } from "../../api";

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
    [senha, setSenha] = useState(""),
    [confirmacao, setConfirmacao] = useState(""),
    [ativo, setAtivo] = useState(registro?.ativo ?? true),
    [visualizarTodos, setVisualizarTodos] = useState(registro?.visualizarCadastrosTodosUsuarios ?? false),
    [papelId, setPapelId] = useState(
      registro?.papelId ? String(registro.papelId) : "",
    ),
    [papeis, setPapeis] = useState<PapelResumo[]>([]),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  useEffect(() => {
    listarPapeis()
      .then((lista) =>
        setPapeis(lista.filter((p) => p.ativo || p.id === registro?.papelId)),
      )
      .catch((e) => setErro(e.message));
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
      registro
        ? await alterarUsuario(
            registro.id,
            usuario,
            senha,
            ativo,
            Number(papelId),
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
      <label className="rotulo-campo">Papel/permissão *</label>
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
      {!papeis.length && (
        <small className="ajuda-campo">
          Cadastre um papel ativo na tela de permissões antes de criar o
          usuário.
        </small>
      )}
      <label className="rotulo-campo">
        Senha {registro ? "(deixe em branco para manter)" : "*"}
      </label>
      <input
        className="campo-formulario"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        minLength={4}
        maxLength={72}
        required={!registro}
      />
      <label className="rotulo-campo">
        Confirmar senha {registro ? "" : "*"}
      </label>
      <input
        className="campo-formulario"
        type="password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        required={!registro}
      />
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
