import { useEffect, useMemo, useRef, useState } from "react";
import {
  alterarSituacaoCompromisso,
  baixarAnexoCompromisso,
  excluirCompromisso,
  listarCompromissos,
} from "../../api";
import type { CompromissoResumo } from "../../api";
import { formatarPrimeirosNomes } from "../../formatadores";
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
type MenuDia = { data: string; x: number; y: number } | null;

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
  const detalheDialogRef = useRef<HTMLDialogElement>(null);
  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  );
  const [lista, setLista] = useState<CompromissoResumo[]>([]);
  const [edicao, setEdicao] = useState<number | null | undefined>(undefined);
  const [duplicando, setDuplicando] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [menuDia, setMenuDia] = useState<MenuDia>(null);
  const [dataInicial, setDataInicial] = useState("");
  const [detalhe, setDetalhe] = useState<CompromissoResumo | null>(null);
  const [anexoBaixando, setAnexoBaixando] = useState<number | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState("");
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

  useEffect(() => {
    if (detalhe && !detalheDialogRef.current?.open)
      detalheDialogRef.current?.showModal();
  }, [detalhe]);

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
    lista
      .filter(
        (compromisso) =>
          compromisso.situacao !== "CONCLUIDO" &&
          compromisso.situacao !== "RESOLVIDO",
      )
      .forEach((compromisso) => {
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
        dataInicial={dataInicial || undefined}
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

  function novo(data?: string) {
    setDuplicando(false);
    setDataInicial(data ?? "");
    setEdicao(null);
    setMenuDia(null);
  }

  function abrirMenuDia(data: Date, evento: React.MouseEvent<HTMLDivElement>) {
    evento.preventDefault();
    setMenu(null);
    setMenuDia({
      data: chaveDia(data),
      x: Math.max(8, Math.min(evento.clientX, window.innerWidth - 200)),
      y: Math.max(8, Math.min(evento.clientY, window.innerHeight - 90)),
    });
  }

  function editar(compromisso: CompromissoResumo) {
    setDuplicando(false);
    setEdicao(compromisso.id);
    setMenu(null);
    setMenuDia(null);
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

  async function marcarResolvido() {
    if (!menu) return;
    try {
      await alterarSituacaoCompromisso(menu.compromisso.id, "RESOLVIDO");
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao resolver compromisso.");
    }
  }

  async function baixarAnexo(anexo: CompromissoResumo["anexos"][number]) {
    if (!detalhe) return;
    setAnexoBaixando(anexo.id);
    setErroDetalhe("");
    try {
      await baixarAnexoCompromisso(detalhe.id, anexo);
    } catch (e) {
      setErroDetalhe(
        e instanceof Error ? e.message : "Não foi possível baixar o anexo.",
      );
    } finally {
      setAnexoBaixando(null);
    }
  }

  return (
    <section className="painel calendario-painel">
      <div className="cabecalho-listagem calendario-cabecalho">
        <div>
          <h1>Calendário de compromissos</h1>
          <p className="subtitulo">Visualize e organize sua agenda mensal.</p>
        </div>
        <button className="botao-adicionar" onClick={() => novo()}>
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
              tabIndex={0}
              aria-label={`Dia ${data.getDate()}`}
              onContextMenu={(evento) => abrirMenuDia(data, evento)}
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
                        type="button"
                        className={`item-compromisso item-compromisso-${compromisso.situacao.toLowerCase()}`}
                        key={compromisso.id}
                        title="Abrir detalhes do compromisso"
                        onClick={() => {
                          setErroDetalhe("");
                          setDetalhe(compromisso);
                        }}
                        onDoubleClick={() => editar(compromisso)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuDia(null);
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
                          {formatarPrimeirosNomes(compromisso.pessoas)} ·{" "}
                          {rotuloSituacao(compromisso.situacao)}
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
      {detalhe && (
        <dialog
          ref={detalheDialogRef}
          className="fundo-modal detalhe-compromisso-fundo"
          aria-modal="true"
          aria-labelledby="titulo-detalhe-compromisso"
          onClose={() => setDetalhe(null)}
        >
          <section className="modal-detalhe-compromisso">
            <header className="cabecalho-detalhe-compromisso">
              <span className="rotulo-detalhe-compromisso">
                {rotuloSituacao(detalhe.situacao)}
              </span>
              <button
                type="button"
                className="fechar-detalhe-compromisso"
                aria-label="Fechar detalhes"
                onClick={() => setDetalhe(null)}
              >
                ×
              </button>
            </header>
            <h2 id="titulo-detalhe-compromisso">{detalhe.descricao}</h2>
            <div className="grade-detalhe-compromisso">
              <div>
                <span>Data e horário</span>
                <strong>
                  {dataCompromisso(detalhe.dataHora).toLocaleString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </div>
              <div>
                <span>Notificação</span>
                <strong>{detalhe.horaNotificacao.slice(0, 5)}</strong>
              </div>
              <div>
                <span>Categoria</span>
                <strong>
                  {[detalhe.categoria, detalhe.subcategoria]
                    .filter(Boolean)
                    .join(" · ") || "Sem categoria"}
                </strong>
              </div>
              <div>
                <span>Pessoas</span>
                <strong>{detalhe.pessoas.join(", ") || "Sem pessoas"}</strong>
              </div>
            </div>
            {(detalhe.logradouro || detalhe.cidade || detalhe.cep) && (
              <section className="secao-detalhe-compromisso">
                <h3>Local</h3>
                <p>
                  {[
                    [detalhe.logradouro, detalhe.numero]
                      .filter(Boolean)
                      .join(", "),
                    detalhe.complemento,
                    detalhe.bairro,
                    [detalhe.cidade, detalhe.uf].filter(Boolean).join(" - "),
                    detalhe.cep,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </section>
            )}
            <section className="secao-detalhe-compromisso">
              <h3>WhatsApp</h3>
              {detalhe.whatsapp.length ? (
                <ul className="lista-detalhe-compromisso">
                  {detalhe.whatsapp.map((contato) => (
                    <li key={`${contato.numero}-${contato.descricao}`}>
                      <span>
                        <strong>{contato.descricao}</strong>
                        <small>{contato.numero}</small>
                      </span>
                      <a
                        className="acao-whatsapp-detalhe"
                        href={`https://wa.me/${normalizarWhatsappLink(contato.numero)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <IconeWhatsappDetalhe />
                        Enviar mensagem
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sem WhatsApp vinculado.</p>
              )}
            </section>
            <section className="secao-detalhe-compromisso">
              <h3>Anexos</h3>
              {detalhe.anexos.length ? (
                <ul className="lista-detalhe-compromisso">
                  {detalhe.anexos.map((anexo) => (
                    <li key={anexo.id}>
                      <span>
                        <strong>{anexo.nomeArquivo}</strong>
                        <small>
                          {anexo.descricao} · {formatarTamanho(anexo.tamanho)}
                        </small>
                      </span>
                      <button
                        type="button"
                        className="acao-download-detalhe"
                        disabled={anexoBaixando === anexo.id}
                        onClick={() => baixarAnexo(anexo)}
                      >
                        <IconeDownloadDetalhe />
                        {anexoBaixando === anexo.id ? "Baixando..." : "Baixar"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sem anexos.</p>
              )}
            </section>
            {erroDetalhe && <p className="mensagem-erro">{erroDetalhe}</p>}
            <div className="acoes-detalhe-compromisso">
              <button
                type="button"
                className="botao-acao-detalhe botao-editar-detalhe"
                onClick={() => editar(detalhe)}
              >
                Alterar compromisso
              </button>
              <button
                type="button"
                className="botao-acao-detalhe botao-fechar-detalhe"
                onClick={() => setDetalhe(null)}
              >
                Fechar
              </button>
            </div>
          </section>
        </dialog>
      )}
      {menu && (
        <>
          <button
            className="fechar-menu-contexto"
            aria-label="Fechar menu"
            onClick={() => setMenu(null)}
          />
          <div className="menu-contexto" style={{ left: menu.x, top: menu.y }}>
            {menu.compromisso.situacao !== "RESOLVIDO" &&
              menu.compromisso.situacao !== "CONCLUIDO" && (
                <button onClick={marcarResolvido}>Marcar como resolvido</button>
              )}
            <button onClick={duplicar}>Duplicar compromisso</button>
            <button className="acao-perigosa" onClick={excluir}>
              Excluir compromisso
            </button>
          </div>
        </>
      )}
      {menuDia && (
        <>
          <button
            type="button"
            className="fechar-menu-contexto"
            aria-label="Fechar menu do dia"
            onClick={() => setMenuDia(null)}
          />
          <div
            className="menu-contexto"
            style={{ left: menuDia.x, top: menuDia.y }}
          >
            <button type="button" onClick={() => novo(`${menuDia.data}T09:00`)}>
              Adicionar compromisso
            </button>
          </div>
        </>
      )}
      <small className="ajuda-campo">
        Clique abre os detalhes, duplo clique altera. O botão direito adiciona
        no dia ou mostra ações do compromisso.
      </small>
    </section>
  );
}

function rotuloSituacao(situacao: CompromissoResumo["situacao"]) {
  return {
    PENDENTE: "Pendente",
    NOTIFICADO: "Notificado",
    RESOLVIDO: "Resolvido",
    REAGENDADO: "Reagendado",
    CONCLUIDO: "Concluído",
  }[situacao];
}

function normalizarWhatsappLink(numero: string) {
  const digitos = numero.replace(/\D/g, "");
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

function formatarTamanho(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function IconeWhatsappDetalhe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" />
      <path d="M9 8.5c.5 2.8 2.2 4.5 5 5l1-1.2c.3-.3.7-.4 1-.2l1.5.7" />
    </svg>
  );
}

function IconeDownloadDetalhe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}
