import { FormEvent, useState } from "react";
import { buscarRelatorioCompromissos } from "../../api";
import type { CompromissoRelatorio, SituacaoCompromisso } from "../../api";
import { formatarDataHora, formatarPrimeirosNomes } from "../../formatadores";

const iso = (d: Date) => d.toLocaleDateString("sv-SE");
const hoje = () => iso(new Date());
const rotulos: Record<SituacaoCompromisso, string> = {
  PENDENTE: "Pendentes",
  RESOLVIDO: "Resolvidos",
  REAGENDADO: "Reagendados",
  CONCLUIDO: "Concluídos",
  NOTIFICADO: "Notificados",
};
const ordem: SituacaoCompromisso[] = [
  "PENDENTE",
  "REAGENDADO",
  "NOTIFICADO",
  "RESOLVIDO",
  "CONCLUIDO",
];

export default function ViewRelatorioCompromissos() {
  const [inicio, setInicio] = useState(hoje),
    [fim, setFim] = useState(hoje),
    [dados, setDados] = useState<CompromissoRelatorio[] | null>(null),
    [erro, setErro] = useState(""),
    [carregando, setCarregando] = useState(false);
  const resumoCategorias = dados ? resumirCategorias(dados) : [];
  async function gerar(e: FormEvent) {
    e.preventDefault();
    if (fim < inicio) {
      setErro("A data final não pode ser anterior à data inicial.");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      setDados(await buscarRelatorioCompromissos(inicio, fim));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar relatório.");
    } finally {
      setCarregando(false);
    }
  }
  return (
    <section className="resumo-financeiro relatorio">
      <h1>Relatório de compromissos por período</h1>
      <p className="subtitulo">
        Compromissos lançados entre as datas informadas, agrupados por situação.
      </p>
      <form className="filtros-resumo filtros-periodo" onSubmit={gerar}>
        <label className="rotulo-campo">
          Período inicial
          <input
            className="campo-formulario"
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            required
          />
        </label>
        <label className="rotulo-campo">
          Período final
          <input
            className="campo-formulario"
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            required
          />
        </label>
        <button className="botao-adicionar" disabled={carregando}>
          {carregando ? "Gerando..." : "Gerar relatório"}
        </button>
      </form>
      {erro && <p className="mensagem-erro">{erro}</p>}
      {dados && dados.length > 0 && (
        <>
          <ResumoCategorias itens={resumoCategorias} />
          {ordem.map((s) => {
            const itens = dados.filter((x) => x.situacao === s);
            return itens.length ? (
              <Grupo key={s} titulo={rotulos[s]} itens={itens} />
            ) : null;
          })}
          <div className="totalizador-relatorio totalizador-compromissos">
            <span>
              Total de compromissos <strong>{dados.length}</strong>
            </span>
          </div>
        </>
      )}
      {dados && dados.length === 0 && (
        <p className="lista-vazia mensagem-relatorio-vazio">
          Nenhum compromisso encontrado no período.
        </p>
      )}
    </section>
  );
}

type LinhaResumo = {
  categoria: string;
  subcategoria: string;
  total: number;
  situacoes: Record<SituacaoCompromisso, number>;
};

function resumirCategorias(dados: CompromissoRelatorio[]) {
  const mapa = new Map<string, LinhaResumo>();
  dados.forEach((x) => {
    const categoria = x.categoria ?? "Sem categoria",
      subcategoria = x.subcategoria ?? "Sem subcategoria",
      chave = `${categoria}\u0000${subcategoria}`;
    const atual = mapa.get(chave) ?? {
      categoria,
      subcategoria,
      total: 0,
      situacoes: {
        PENDENTE: 0,
        REAGENDADO: 0,
        NOTIFICADO: 0,
        RESOLVIDO: 0,
        CONCLUIDO: 0,
      },
    };
    atual.total++;
    atual.situacoes[x.situacao]++;
    mapa.set(chave, atual);
  });
  return [...mapa.values()].sort(
    (a, b) =>
      b.total - a.total ||
      a.categoria.localeCompare(b.categoria, "pt-BR") ||
      a.subcategoria.localeCompare(b.subcategoria, "pt-BR"),
  );
}

function ResumoCategorias({ itens }: { itens: LinhaResumo[] }) {
  return (
    <section className="grupo-relatorio resumo-categorias-compromissos">
      <h2>
        <span>Resumo por categoria e subcategoria</span>
        <small>{itens.length} agrupamento(s)</small>
      </h2>
      <div className="tabela-responsiva">
        <table className="tabela-usuarios tabela-relatorio">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Subcategoria</th>
              <th>Pendentes</th>
              <th>Reagendados</th>
              <th>Notificados</th>
              <th>Resolvidos</th>
              <th>Concluídos</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((x) => (
              <tr key={`${x.categoria}-${x.subcategoria}`}>
                <td>{x.categoria}</td>
                <td>{x.subcategoria}</td>
                <td>{x.situacoes.PENDENTE}</td>
                <td>{x.situacoes.REAGENDADO}</td>
                <td>{x.situacoes.NOTIFICADO}</td>
                <td>{x.situacoes.RESOLVIDO}</td>
                <td>{x.situacoes.CONCLUIDO}</td>
                <td>
                  <strong>{x.total}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Grupo({
  titulo,
  itens,
}: {
  titulo: string;
  itens: CompromissoRelatorio[];
}) {
  return (
    <section className="grupo-relatorio">
      <h2>
        {titulo} <small>({itens.length})</small>
      </h2>
      <div className="tabela-responsiva">
        <table className="tabela-usuarios tabela-relatorio">
          <thead>
            <tr>
              <th>Data e horário</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Subcategoria</th>
              <th>Pessoa</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((x) => (
              <tr key={x.id}>
                <td>{formatarDataHora(x.dataHora)}</td>
                <td className="celula-texto-longo">{x.descricao}</td>
                <td>{x.categoria ?? "Sem categoria"}</td>
                <td>{x.subcategoria ?? "Sem subcategoria"}</td>
                <td>{formatarPrimeirosNomes(x.pessoa)}</td>
              </tr>
            ))}
            {!itens.length && (
              <tr>
                <td className="lista-vazia" colSpan={5}>
                  Nenhum compromisso encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
