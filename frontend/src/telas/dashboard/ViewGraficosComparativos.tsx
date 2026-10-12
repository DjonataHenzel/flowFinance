import { FormEvent, useState } from "react";
import { buscarResumoFinanceiro, buscarSerieMensal } from "../../api";
import type { ResumoMensal } from "../../api";
import type { ResumoCategoria, ResumoFinanceiro } from "../../types";

const dataIso = (data: Date) => data.toLocaleDateString("sv-SE");
const inicioMes = () => {
  const hoje = new Date();
  return dataIso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
};
const fimMes = () => {
  const hoje = new Date();
  return dataIso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
};
const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ViewGraficosComparativos() {
  const [dataInicio, setDataInicio] = useState(inicioMes);
  const [dataFim, setDataFim] = useState(fimMes);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [serieMensal, setSerieMensal] = useState<ResumoMensal[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function gerar(evento: FormEvent) {
    evento.preventDefault();
    if (dataFim < dataInicio) {
      setErro("A data final não pode ser anterior à data inicial.");
      return;
    }
    setErro("");
    setCarregando(true);
    setResumo(null);
    setSerieMensal(null);
    try {
      const [novoResumo, novaSerie] = await Promise.all([
        buscarResumoFinanceiro(dataInicio, dataFim),
        buscarSerieMensal(dataInicio, dataFim),
      ]);
      setResumo(novoResumo);
      setSerieMensal(novaSerie);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível gerar o gráfico.",
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="resumo-financeiro graficos-comparativos">
      <h1>Gráfico comparativo</h1>
      <p className="subtitulo">
        Compare entradas e saídas por mês e veja as despesas por subcategoria no
        período.
      </p>
      <form className="filtros-resumo filtros-periodo" onSubmit={gerar}>
        <label className="rotulo-campo">
          Data inicial
          <input
            className="campo-formulario"
            type="date"
            value={dataInicio}
            onChange={(evento) => setDataInicio(evento.target.value)}
            required
          />
        </label>
        <label className="rotulo-campo">
          Data final
          <input
            className="campo-formulario"
            type="date"
            value={dataFim}
            onChange={(evento) => setDataFim(evento.target.value)}
            required
          />
        </label>
        <button className="botao-adicionar" type="submit" disabled={carregando}>
          {carregando ? "Gerando..." : "Gerar gráfico"}
        </button>
      </form>
      {erro && <p className="mensagem-erro">{erro}</p>}
      {resumo && (
        <div className="grade-graficos-comparativos">
          <GraficoResumido
            dados={serieMensal ?? []}
            dataInicio={dataInicio}
            dataFim={dataFim}
            periodo={resumo.month}
          />
          <GraficoSubcategorias
            dados={resumo.categorias ?? []}
            periodo={resumo.month}
          />
        </div>
      )}
    </section>
  );
}

function GraficoResumido({
  dados,
  dataInicio,
  dataFim,
  periodo,
}: {
  dados: ResumoMensal[];
  dataInicio: string;
  dataFim: string;
  periodo: string;
}) {
  const meses = criarMesesGrafico(dataInicio, dataFim, dados);
  const maior = Math.max(
    0,
    ...meses.flatMap((mes) => [mes.receitas, mes.despesas]),
  );
  const ticks = [4, 3, 2, 1, 0].map((divisor) => (maior * divisor) / 4);
  const larguraMinima = Math.max(720, meses.length * 76);

  return (
    <section
      className="grafico-resumo grafico-periodo-comparativo"
      aria-label={`Comparativo mensal de entradas e saídas no período ${periodo}`}
    >
      <div className="cabecalho-grafico">
        <div>
          <h2>Entradas e saídas por mês</h2>
          <p>Período: {periodo}</p>
        </div>
        <div className="legenda-grafico">
          <span className="legenda-receita">Entradas</span>
          <span className="legenda-despesa">Saídas</span>
        </div>
      </div>
      <div className="grafico-mensal-rolagem">
        <div
          className="grafico-mensal-conteudo"
          style={{ minWidth: `${larguraMinima}px` }}
        >
          <div className="eixo-mensal" aria-hidden="true">
            {ticks.map((valor, indice) => (
              <span key={indice}>{moedaCompacta.format(valor)}</span>
            ))}
          </div>
          <div className="plot-mensal">
            <div className="linhas-mensais" aria-hidden="true">
              {ticks.map((_, indice) => (
                <i key={indice} />
              ))}
            </div>
            <div
              className="grupos-mensais"
              style={{
                gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))`,
              }}
            >
              {meses.map((mes) => (
                <div className="grupo-mensal" key={mes.chave}>
                  <div className="barras-mensais">
                    <div
                      className="barra-mensal barra-mensal-entrada"
                      style={{
                        height: `${alturaPercentual(mes.receitas, maior)}%`,
                      }}
                      title={`Entradas: ${moeda(mes.receitas)}`}
                      role="img"
                      aria-label={`Entradas: ${moeda(mes.receitas)}`}
                    />
                    <div
                      className="barra-mensal barra-mensal-saida"
                      style={{
                        height: `${alturaPercentual(mes.despesas, maior)}%`,
                      }}
                      title={`Saídas: ${moeda(mes.despesas)}`}
                      role="img"
                      aria-label={`Saídas: ${moeda(mes.despesas)}`}
                    />
                  </div>
                  <span className="rotulo-mes">{mes.rotulo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {maior === 0 && (
          <p className="grafico-sem-dados">
            Nenhum valor encontrado neste período.
          </p>
        )}
      </div>
    </section>
  );
}

const moedaCompacta = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function alturaPercentual(valor: number, maior: number) {
  return maior === 0 || valor === 0 ? 0 : Math.max(1, (valor / maior) * 100);
}

function criarMesesGrafico(inicio: string, fim: string, dados: ResumoMensal[]) {
  const valores = new Map(dados.map((item) => [item.mes, item]));
  const [anoInicio, mesInicio] = inicio.split("-").map(Number);
  const [anoFim, mesFim] = fim.split("-").map(Number);
  const meses = [];

  for (
    let ano = anoInicio, mes = mesInicio;
    ano < anoFim || (ano === anoFim && mes <= mesFim);
  ) {
    const chave = `${ano}-${String(mes).padStart(2, "0")}`;
    const data = new Date(ano, mes - 1, 1);
    meses.push({
      chave,
      rotulo: data
        .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        .replace(".", ""),
      receitas: valores.get(chave)?.receitas ?? 0,
      despesas: valores.get(chave)?.despesas ?? 0,
    });
    if (mes === 12) {
      ano++;
      mes = 1;
    } else {
      mes++;
    }
  }
  return meses;
}

function GraficoSubcategorias({
  dados,
  periodo,
}: {
  dados: ResumoCategoria[];
  periodo: string;
}) {
  const despesas = dados
    .filter((item) => item.despesas > 0)
    .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR"));
  const mapa = new Map<string, ResumoCategoria[]>();
  despesas.forEach((item) =>
    mapa.set(item.categoria, [...(mapa.get(item.categoria) ?? []), item]),
  );
  const grupos = [...mapa.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "pt-BR"),
  );
  const maior = Math.max(0, ...despesas.map((item) => item.despesas));

  return (
    <section className="grafico-resumo grafico-despesas-subcategoria">
      <div className="cabecalho-grafico">
        <div>
          <h2>Despesas por subcategoria</h2>
          <p>Período: {periodo}</p>
        </div>
        <span className="legenda-grafico legenda-despesa">Despesas</span>
      </div>
      {despesas.length > 0 ? (
        <div className="barras-subcategorias">
          {grupos.map(([categoria, itens]) => (
            <section className="grupo-subcategorias" key={categoria}>
              <h3 className="cabecalho-categoria-grafico">{categoria}</h3>
              <div className="itens-subcategoria" role="list">
                {itens
                  .sort((a, b) =>
                    a.subcategoria.localeCompare(b.subcategoria, "pt-BR"),
                  )
                  .map((item) => (
                    <div
                      className="linha-subcategoria"
                      role="listitem"
                      key={item.subcategoria}
                    >
                      <div className="rotulo-subcategoria-grafico">
                        <strong>{item.subcategoria}</strong>
                      </div>
                      <div
                        className="trilho-subcategoria"
                        role="img"
                        aria-label={`${item.subcategoria}: ${moeda(item.despesas)}`}
                      >
                        <i
                          style={{ width: `${(item.despesas / maior) * 100}%` }}
                        />
                        <strong>{moeda(item.despesas)}</strong>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="lista-vazia">Nenhuma despesa encontrada neste período.</p>
      )}
    </section>
  );
}
