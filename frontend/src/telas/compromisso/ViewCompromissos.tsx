import { useEffect, useState } from "react";
import { excluirCompromisso, listarCompromissos } from "../../api";
import type { CompromissoResumo, PessoaResumo } from "../../api";
import { listarPessoas } from "../../api";
import Compromisso from "./Compromisso";
const situacao = {
  PENDENTE: "Pendente",
  RESOLVIDO: "Resolvido",
  REAGENDADO: "Reagendado",
  CONCLUIDO: "Concluído",
  NOTIFICADO: "Notificado",
};
export default function ViewCompromissos() {
  const [lista, setLista] = useState<CompromissoResumo[]>([]),
    [edicao, setEdicao] = useState<number | null | undefined>(undefined),
    [duplicando, setDuplicando] = useState(false),
    [erro, setErro] = useState(""),
    [descricaoFiltro, setDescricaoFiltro] = useState(""),
    [pessoaFiltro, setPessoaFiltro] = useState(""),
    [pessoas, setPessoas] = useState<PessoaResumo[]>([]),
    [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(
      null,
    );
  async function carregar() {
    try {
      setLista(await listarCompromissos());
      setErro("");
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Erro ao carregar compromissos.",
      );
    }
  }
  useEffect(() => {
    carregar();
    listarPessoas()
      .then(setPessoas)
      .catch(() => undefined);
  }, []);
  if (edicao !== undefined)
    return (
      <Compromisso
        registro={edicao ? lista.find((x) => x.id === edicao) : undefined}
        duplicando={duplicando}
        aoSalvar={() => {
          setEdicao(undefined);
          setDuplicando(false);
          carregar();
        }}
        aoCancelar={() => {
          setEdicao(undefined);
          setDuplicando(false);
        }}
      />
    );
  async function excluir() {
    if (!menu || !confirm("Excluir este compromisso?")) return;
    try {
      await excluirCompromisso(menu.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }
  function duplicar() {
    if (!menu) return;
    setEdicao(menu.id);
    setDuplicando(true);
    setMenu(null);
  }
  const filtradas = lista.filter(
    (c) =>
      (!descricaoFiltro ||
        c.descricao
          .toLocaleLowerCase("pt-BR")
          .includes(descricaoFiltro.toLocaleLowerCase("pt-BR"))) &&
      (!pessoaFiltro || c.pessoaIds.includes(Number(pessoaFiltro))),
  );
  return (
    <section className="painel">
      <div className="cabecalho-listagem">
        <div>
          <h1>Compromissos</h1>
          <p className="subtitulo">Agenda de notificações.</p>
        </div>
        <button
          className="botao-adicionar"
          onClick={() => {
            setDuplicando(false);
            setEdicao(null);
          }}
        >
          + Novo compromisso
        </button>
      </div>
      <div className="filtros-contas filtros-pessoas">
        <label className="rotulo-campo">
          Descrição
          <input
            className="campo-formulario"
            value={descricaoFiltro}
            placeholder="Buscar descrição"
            onChange={(e) => setDescricaoFiltro(e.target.value)}
          />
        </label>
        <label className="rotulo-campo">
          Pessoa
          <select
            className="campo-formulario"
            value={pessoaFiltro}
            onChange={(e) => setPessoaFiltro(e.target.value)}
          >
            <option value="">Todas</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <button
          className="botao-limpar-filtros"
          type="button"
          onClick={() => {
            setDescricaoFiltro("");
            setPessoaFiltro("");
          }}
        >
          Limpar filtros
        </button>
      </div>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="tabela-responsiva">
        <table className="tabela-usuarios">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Pessoa</th>
              <th>Categoria</th>
              <th>Notificar</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr
                key={c.id}
                onDoubleClick={() => setEdicao(c.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id: c.id, x: e.clientX, y: e.clientY });
                }}
              >
                <td>{new Date(c.dataHora).toLocaleString("pt-BR")}</td>
                <td>{c.descricao}</td>
                <td>{c.pessoas.join(", ")}</td>
                <td>{c.categoria ?? "Sem categoria"}</td>
                <td>{c.horaNotificacao.slice(0, 5)}</td>
                <td>
                  <span
                    className={`situacao-conta situacao-${c.situacao.toLowerCase()}`}
                  >
                    {situacao[c.situacao]}
                  </span>
                </td>
              </tr>
            ))}
            {!filtradas.length && (
              <tr>
                <td colSpan={6} className="lista-vazia">
                  Nenhum compromisso cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {menu && (
        <>
          <button
            className="fechar-menu-contexto"
            aria-label="Fechar menu"
            onClick={() => setMenu(null)}
          />
          <div className="menu-contexto" style={{ left: menu.x, top: menu.y }}>
            <button onClick={duplicar}>Duplicar compromisso</button>
            <button className="acao-perigosa" onClick={excluir}>
              Excluir compromisso
            </button>
          </div>
        </>
      )}
      <small className="ajuda-campo">
        Dois cliques alteram. No botão direito estão duplicar e excluir.
      </small>
    </section>
  );
}
