import { useEffect, useState } from "react";
import {
  alterarSituacaoCompromisso,
  excluirCompromisso,
  listarCompromissos,
  listarPessoas,
} from "../../api";
import type {
  CompromissoResumo,
  PessoaResumo,
  SituacaoCompromisso,
} from "../../api";
import { formatarDataHora, formatarPrimeirosNomes } from "../../formatadores";
import Compromisso from "./Compromisso";
const situacao = {
  PENDENTE: "Pendente",
  RESOLVIDO: "Resolvido",
  REAGENDADO: "Reagendado",
  CONCLUIDO: "Concluído",
  NOTIFICADO: "Notificado",
};
function dataLocal(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
function periodoMesAtual() {
  const hoje = new Date();
  return {
    inicio: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    fim: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  };
}
export default function ViewCompromissos() {
  const periodoInicial = periodoMesAtual();
  const [lista, setLista] = useState<CompromissoResumo[]>([]),
    [edicao, setEdicao] = useState<number | null | undefined>(undefined),
    [duplicando, setDuplicando] = useState(false),
    [erro, setErro] = useState(""),
    [descricaoFiltro, setDescricaoFiltro] = useState(""),
    [pessoaFiltro, setPessoaFiltro] = useState(""),
    [situacaoFiltro, setSituacaoFiltro] = useState<SituacaoCompromisso | "">(
      "PENDENTE",
    ),
    [dataInicio, setDataInicio] = useState(periodoInicial.inicio),
    [dataFim, setDataFim] = useState(periodoInicial.fim),
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
  async function marcarResolvido() {
    if (!menu) return;
    try {
      await alterarSituacaoCompromisso(menu.id, "RESOLVIDO");
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao resolver compromisso.");
    }
  }
  function duplicar() {
    if (!menu) return;
    setEdicao(menu.id);
    setDuplicando(true);
    setMenu(null);
  }
  const filtradas = lista.filter((c) => {
    const data = dataLocal(new Date(c.dataHora));
    return (
      (!descricaoFiltro ||
        c.descricao
          .toLocaleLowerCase("pt-BR")
          .includes(descricaoFiltro.toLocaleLowerCase("pt-BR"))) &&
      (!pessoaFiltro || c.pessoaIds.includes(Number(pessoaFiltro))) &&
      (!situacaoFiltro || c.situacao === situacaoFiltro) &&
      (!dataInicio || data >= dataInicio) &&
      (!dataFim || data <= dataFim)
    );
  });
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
      <div className="filtros-contas">
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
        <label className="rotulo-campo">
          Situação
          <select
            className="campo-formulario"
            value={situacaoFiltro}
            onChange={(e) =>
              setSituacaoFiltro(e.target.value as SituacaoCompromisso | "")
            }
          >
            <option value="">Todos</option>
            {Object.entries(situacao).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="rotulo-campo">
          Data inicial
          <input
            className="campo-formulario"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </label>
        <label className="rotulo-campo">
          Data final
          <input
            className="campo-formulario"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </label>
        <button
          className="botao-limpar-filtros"
          type="button"
          onClick={() => {
            setDescricaoFiltro("");
            setPessoaFiltro("");
            setSituacaoFiltro("PENDENTE");
            const periodo = periodoMesAtual();
            setDataInicio(periodo.inicio);
            setDataFim(periodo.fim);
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
              <th>Subcategoria</th>
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
                <td>{formatarDataHora(c.dataHora)}</td>
                <td className="celula-texto-longo">{c.descricao}</td>
                <td>{formatarPrimeirosNomes(c.pessoas)}</td>
                <td>{c.categoria ?? "Sem categoria"}</td>
                <td>{c.subcategoria ?? "Sem subcategoria"}</td>
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
                <td colSpan={7} className="lista-vazia">
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
            {lista.find((c) => c.id === menu.id)?.situacao !== "RESOLVIDO" &&
              lista.find((c) => c.id === menu.id)?.situacao !== "CONCLUIDO" && (
                <button onClick={marcarResolvido}>Marcar como resolvido</button>
              )}
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
