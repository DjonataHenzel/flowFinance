import { useEffect, useMemo, useState } from "react";
import { excluirCompromisso, listarCompromissos } from "../../api";
import type { CompromissoResumo } from "../../api";
import Compromisso from "./Compromisso";

const nomesMeses = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const nomesDias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

type Menu = { compromisso: CompromissoResumo; x: number; y: number } | null;

function chaveDia(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataCompromisso(valor: string) {
  return new Date(valor);
}

export default function ViewCalendarioCompromissos() {
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  );
  const [lista, setLista] = useState<CompromissoResumo[]>([]);
  const [edicao, setEdicao] = useState<number | null | undefined>(undefined);
  const [duplicando, setDuplicando] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [erro, setErro] = useState("");

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
  }, []);

  const dias = useMemo(() => {
    const inicio = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
    const total = new Date(
      mesAtual.getFullYear(),
      mesAtual.getMonth() + 1,
      0,
    ).getDate();
    const anterior = inicio.getDay();
    const quantidade = Math.ceil((anterior + total) / 7) * 7;
    return Array.from({ length: quantidade }, (_, indice) => {
      const data = new Date(
        mesAtual.getFullYear(),
        mesAtual.getMonth(),
        indice - anterior + 1,
      );
      return { data, noMes: data.getMonth() === mesAtual.getMonth() };
    });
  }, [mesAtual]);

  const porDia = useMemo(() => {
    const agrupados = new Map<string, CompromissoResumo[]>();
    lista.forEach((compromisso) => {
      const chave = chaveDia(dataCompromisso(compromisso.dataHora));
      const itens = agrupados.get(chave) ?? [];
      itens.push(compromisso);
      agrupados.set(chave, itens);
    });
    return agrupados;
  }, [lista]);

  if (edicao !== undefined) {
    return (
      <Compromisso
        registro={edicao ? lista.find((item) => item.id === edicao) : undefined}
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
  }

  function mudarMes(delta: number) {
    setMesAtual(
      (atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1),
    );
  }

  function novo() {
    setDuplicando(false);
    setEdicao(null);
  }

  function editar(compromisso: CompromissoResumo) {
    setDuplicando(false);
    setEdicao(compromisso.id);
    setMenu(null);
  }

  function duplicar() {
    if (!menu) return;
    setDuplicando(true);
    setEdicao(menu.compromisso.id);
    setMenu(null);
  }

  async function excluir() {
    if (!menu || !confirm("Excluir este compromisso?")) return;
    try {
      await excluirCompromisso(menu.compromisso.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir compromisso.");
    }
  }

  return (
    <section className="painel calendario-painel">
      <div className="cabecalho-listagem calendario-cabecalho">
        <div>
          <h1>Calendário de compromissos</h1>
          <p className="subtitulo">Visualize e organize sua agenda mensal.</p>
        </div>
        <button className="botao-adicionar" onClick={novo}>
          + Novo compromisso
        </button>
      </div>
      <div className="calendario-controles">
        <button
          className="botao-calendario"
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <h2>
          {nomesMeses[mesAtual.getMonth()]} {mesAtual.getFullYear()}
        </h2>
        <button
          className="botao-calendario"
          onClick={() => mudarMes(1)}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div
        className="calendario-grade"
        role="grid"
        aria-label="Calendário mensal"
      >
        {nomesDias.map((dia) => (
          <div className="calendario-dia-semana" key={dia}>
            {dia}
          </div>
        ))}
        {dias.map(({ data, noMes }) => {
          const compromissos = porDia.get(chaveDia(data)) ?? [];
          return (
            <div
              className={`calendario-dia ${noMes ? "" : "calendario-dia-fora"} ${chaveDia(data) === chaveDia(hoje) ? "calendario-dia-hoje" : ""}`}
              key={chaveDia(data)}
              role="gridcell"
            >
              <span className="numero-dia">{data.getDate()}</span>
              {compromissos.length > 0 && (
                <div className="resumo-compromissos-dia">
                  <div
                    className="indicador-compromissos"
                    aria-label={`${compromissos.length} compromisso(s)`}
                  >
                    <span className="pontos-compromissos" aria-hidden="true">
                      {compromissos.slice(0, 3).map((compromisso) => (
                        <i
                          className={`ponto-compromisso ponto-${compromisso.situacao.toLowerCase()}`}
                          key={compromisso.id}
                        />
                      ))}
                    </span>
                    <strong>
                      {compromissos.length}{" "}
                      {compromissos.length === 1
                        ? "compromisso"
                        : "compromissos"}
                    </strong>
                  </div>
                  <div className="popup-compromissos-dia">
                    <strong className="titulo-popup-dia">
                      Compromissos do dia
                    </strong>
                    {compromissos.map((compromisso) => (
                      <button
                        className={`item-compromisso item-compromisso-${compromisso.situacao.toLowerCase()}`}
                        key={compromisso.id}
                        onDoubleClick={() => editar(compromisso)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMenu({ compromisso, x: e.clientX, y: e.clientY });
                        }}
                      >
                        <strong>
                          {dataCompromisso(
                            compromisso.dataHora,
                          ).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </strong>
                        <span>{compromisso.descricao}</span>
                        <small>
                          {[compromisso.categoria, compromisso.subcategoria]
                            .filter(Boolean)
                            .join(" · ") || "Sem categoria"}
                        </small>
                        <small>
                          {compromisso.pessoas.join(", ")} ·{" "}
                          {compromisso.situacao === "NOTIFICADO"
                            ? "Notificado"
                            : compromisso.situacao === "CONCLUIDO"
                            ? "Concluído"
                            : compromisso.situacao === "RESOLVIDO"
                            ? "Resolvido"
                            : compromisso.situacao === "REAGENDADO"
                              ? "Reagendado"
                              : "Pendente"}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
