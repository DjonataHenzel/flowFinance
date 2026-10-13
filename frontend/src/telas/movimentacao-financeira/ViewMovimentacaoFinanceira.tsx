import { useEffect, useRef, useState } from "react";
import {
  baixarConta,
  buscarConta,
  buscarNotificacaoWhatsapp,
  enviarNotificacaoNtfy,
  estornarBaixaConta,
  excluirConta,
  listarContas,
} from "../../api";
import type { ContaDetalhe, ContaResumo, Funcionalidade } from "../../api";
import { formatarDataHora } from "../../formatadores";

const rotuloSituacao = {
  ABERTA: "Aberta",
  PAGA: "Paga",
  RECEBIDA: "Recebida",
  PARCELADA: "Parcelada",
};
const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataParaInput = (data: Date) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};
const hoje = new Date();
const inicioMesAtual = dataParaInput(
  new Date(hoje.getFullYear(), hoje.getMonth(), 1),
);
const fimMesAtual = dataParaInput(
  new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0),
);

export default function ViewMovimentacaoFinanceira({
  aoEditar,
  aoNovo,
  aoDuplicar,
  funcionalidades,
}: {
  aoEditar: (id: number) => void;
  aoNovo: () => void;
  aoDuplicar: (id: number) => void;
  funcionalidades: Funcionalidade[];
}) {
  const [contas, setContas] = useState<ContaResumo[]>([]),
    [erro, setErro] = useState("");
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(
      null,
    ),
    [baixa, setBaixa] = useState<ContaDetalhe | null>(null),
    [estornoSelecionado, setEstornoSelecionado] = useState<ContaDetalhe | null>(
      null,
    ),
    [parcelaEstorno, setParcelaEstorno] = useState("");
  const [preparandoNotificacao, setPreparandoNotificacao] = useState(false),
    [sucessoNotificacao, setSucessoNotificacao] = useState("");
  const [resumo, setResumo] = useState<{
    conta: ContaDetalhe | null;
    carregando: boolean;
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const cacheResumos = useRef(new Map<number, ContaDetalhe>());
  const resumoAtual = useRef<number | null>(null);
  const [descricaoFiltro, setDescricaoFiltro] = useState(""),
    [valorFiltro, setValorFiltro] = useState(""),
    [situacaoFiltro, setSituacaoFiltro] = useState("ABERTA"),
    [dataInicialFiltro, setDataInicialFiltro] = useState(inicioMesAtual),
    [dataFinalFiltro, setDataFinalFiltro] = useState(fimMesAtual);
  async function carregar() {
    if (
      dataInicialFiltro &&
      dataFinalFiltro &&
      dataFinalFiltro < dataInicialFiltro
    ) {
      setErro("A data final não pode ser anterior à data inicial.");
      return;
    }
    try {
      setContas(await listarContas(dataInicialFiltro, dataFinalFiltro));
      cacheResumos.current.clear();
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }
  useEffect(() => {
    carregar();
  }, [dataInicialFiltro, dataFinalFiltro]);
  async function exibirResumo(conta: ContaResumo, x: number, y: number) {
    resumoAtual.current = conta.id;
    const posicao = {
      x: Math.max(8, Math.min(x + 14, window.innerWidth - 374)),
      y: Math.max(8, Math.min(y + 14, window.innerHeight - 300)),
    };
    const armazenada = cacheResumos.current.get(conta.id) ?? null;
    setResumo({
      conta: armazenada,
      carregando: !armazenada,
      id: conta.id,
      ...posicao,
    });
    if (armazenada) return;
    try {
      const detalhe = await buscarConta(conta.id);
      cacheResumos.current.set(conta.id, detalhe);
      if (resumoAtual.current === conta.id)
        setResumo({
          conta: detalhe,
          carregando: false,
          id: conta.id,
          ...posicao,
        });
    } catch {
      if (resumoAtual.current === conta.id)
        setResumo({ conta: null, carregando: false, id: conta.id, ...posicao });
    }
  }
  function ocultarResumo() {
    resumoAtual.current = null;
    setResumo(null);
  }
  async function excluir() {
    if (!menu) return;
    if (
      !confirm(
        "Deseja excluir definitivamente esta conta, suas parcelas e anexos?",
      )
    )
      return;
    try {
      await excluirConta(menu.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro na operação.");
    }
  }
  async function concluirEstorno(id: number, numeroParcela?: number) {
    try {
      await estornarBaixaConta(id, numeroParcela);
      setMenu(null);
      setEstornoSelecionado(null);
      setParcelaEstorno("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao estornar a baixa.");
    }
  }
  async function estornar() {
    if (!menu || !selecionada) return;
    const id = menu.id;
    if (selecionada.totalParcelas > 1) {
      setMenu(null);
      try {
        setEstornoSelecionado(await buscarConta(id));
        setParcelaEstorno("");
      } catch (e) {
        setErro(
          e instanceof Error ? e.message : "Erro ao carregar as parcelas.",
        );
      }
      return;
    }
    if (
      !confirm(
        "Confirma o estorno desta conta? A baixa será removida e ela voltará para pendente.",
      )
    )
      return;
    await concluirEstorno(id);
  }
  async function estornarParcelaSelecionada() {
    if (!estornoSelecionado || !parcelaEstorno) return;
    const parcela = estornoSelecionado.parcelas.find(
      (item) => item.numero === Number(parcelaEstorno),
    );
    if (!parcela) return;
    if (
      !confirm(
        `Confirma o estorno da parcela ${parcela.numero}/${estornoSelecionado.parcelas.length}, no valor de ${moeda(parcela.valor)}?`,
      )
    )
      return;
    await concluirEstorno(estornoSelecionado.id, parcela.numero);
  }
  async function abrirBaixa() {
    if (!menu) return;
    try {
      setBaixa(await buscarConta(menu.id));
      setMenu(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar a conta.");
    }
  }
  async function notificarVencimentos() {
    setPreparandoNotificacao(true);
    setErro("");
    setSucessoNotificacao("");
    const mensagens: string[] = [];
    const erros: string[] = [];
    const avisos: string[] = [];
    try {
      const resultado = await enviarNotificacaoNtfy();
      if (resultado.enviado) mensagens.push(resultado.mensagem);
      else avisos.push(resultado.mensagem);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro ao enviar ntfy.";
      if (
        !mensagem.includes("Cadastre um tópico ntfy") &&
        !mensagem.includes("O tópico ntfy está cadastrado")
      )
        erros.push(mensagem);
      else avisos.push(mensagem);
    }
    try {
      const whatsapp = await buscarNotificacaoWhatsapp();
      whatsapp.contatos.forEach((numero) =>
        window.open(
          `https://wa.me/${numero}?text=${encodeURIComponent(whatsapp.mensagem)}`,
          "_blank",
          "noopener,noreferrer",
        ),
      );
      mensagens.push(
        "WhatsApp preparado para os contatos das pessoas vinculadas.",
      );
    } catch (e) {
      const mensagem =
        e instanceof Error ? e.message : "Erro ao preparar WhatsApp.";
      if (!mensagem.includes("Associe uma pessoa com WhatsApp"))
        erros.push(mensagem);
      else avisos.push(mensagem);
    }
    if (mensagens.length) setSucessoNotificacao(mensagens.join(" "));
    setErro(
      erros.length
        ? erros.join(" ")
        : !mensagens.length
          ? avisos.join(" ") ||
            "Nenhuma pessoa com canal de notificação foi encontrada."
          : "",
    );
    setPreparandoNotificacao(false);
  }
  const selecionada = menu ? contas.find((c) => c.id === menu.id) : undefined;
  const tem = (f: Funcionalidade) => funcionalidades.includes(f);
  const baixada =
    selecionada && ["PAGA", "RECEBIDA"].includes(selecionada.situacao);
  const contasFiltradas = contas.filter(
    (c) =>
      (!descricaoFiltro ||
        c.descricao
          .toLocaleLowerCase("pt-BR")
          .includes(descricaoFiltro.toLocaleLowerCase("pt-BR"))) &&
      (!valorFiltro || Math.abs(c.valor - Number(valorFiltro)) < 0.005) &&
      (!situacaoFiltro ||
        (situacaoFiltro === "ABERTA"
          ? ["ABERTA", "PARCELADA"].includes(c.situacao)
          : c.situacao === situacaoFiltro)),
  );
  return (
    <>
      <section className="painel">
        <div className="cabecalho-listagem">
          <div>
            <h1>Contas</h1>
            <p className="subtitulo">
              Todas as contas cadastradas.
              {tem("ALTERAR_CONTAS") || tem("BAIXAR_RECEBER_CONTAS")
                ? " Dê dois cliques para abrir a conta."
                : ""}
            </p>
          </div>
          <div className="acoes-cabecalho">
            <button
              className="botao-whatsapp"
              onClick={notificarVencimentos}
              disabled={preparandoNotificacao}
              aria-label="Notificar contas vencendo hoje no celular"
            >
              <IconeNotificacao />
              {preparandoNotificacao ? "Enviando..." : "Notificar vencimentos"}
            </button>
            {tem("CADASTRAR_CONTAS") && (
              <button className="botao-adicionar" onClick={aoNovo}>
                + Nova conta
              </button>
            )}
          </div>
        </div>
        {erro && <p className="mensagem-erro">{erro}</p>}
        {sucessoNotificacao && (
          <p className="mensagem-sucesso">{sucessoNotificacao}</p>
        )}
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
            Valor
            <input
              className="campo-formulario"
              type="number"
              min="0"
              step="0.01"
              value={valorFiltro}
              placeholder="0,00"
              onChange={(e) => setValorFiltro(e.target.value)}
            />
          </label>
          <label className="rotulo-campo">
            Situação
            <select
              className="campo-formulario"
              value={situacaoFiltro}
              onChange={(e) => setSituacaoFiltro(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="ABERTA">Aberta / Parcelada</option>
              <option value="PAGA">Paga</option>
              <option value="RECEBIDA">Recebida</option>
            </select>
          </label>
          <label className="rotulo-campo">
            Vencimento inicial
            <input
              className="campo-formulario"
              type="date"
              value={dataInicialFiltro}
              max={dataFinalFiltro || undefined}
              onChange={(e) => setDataInicialFiltro(e.target.value)}
            />
          </label>
          <label className="rotulo-campo">
            Vencimento final
            <input
              className="campo-formulario"
              type="date"
              value={dataFinalFiltro}
              min={dataInicialFiltro || undefined}
              onChange={(e) => setDataFinalFiltro(e.target.value)}
            />
          </label>
          <button
            className="botao-limpar-filtros"
            type="button"
            onClick={() => {
              setDescricaoFiltro("");
              setValorFiltro("");
              setSituacaoFiltro("ABERTA");
              setDataInicialFiltro(inicioMesAtual);
              setDataFinalFiltro(fimMesAtual);
            }}
          >
            Limpar filtros
          </button>
        </div>
        <div className="tabela-responsiva">
          <table className="tabela-usuarios tabela-contas">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Parcela</th>
                <th>Valor</th>
                <th>Valor total</th>
                <th>Situação</th>
                <th>Prox. Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {contasFiltradas.map((c) => (
                <tr
                  key={c.id}
                  onMouseEnter={(e) => exibirResumo(c, e.clientX, e.clientY)}
                  onMouseLeave={ocultarResumo}
                  onDoubleClick={() =>
                    (tem("ALTERAR_CONTAS") || tem("BAIXAR_RECEBER_CONTAS")) &&
                    aoEditar(c.id)
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ id: c.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <td className="celula-texto-longo">{c.descricao}</td>
                  <td
                    className={
                      c.tipo === "RECEBER" ? "tipo-receber" : "tipo-pagar"
                    }
                  >
                    {c.tipo === "RECEBER" ? "Receber" : "Pagar"}
                  </td>
                  <td>
                    {c.proximaParcela}/{c.totalParcelas}
                  </td>
                  <td className="valor-conta">{moeda(c.valor)}</td>
                  <td className="valor-conta">{moeda(c.valorTotal)}</td>
                  <td>
                    <span
                      className={`situacao-conta situacao-${c.situacao.toLowerCase()}`}
                    >
                      {rotuloSituacao[c.situacao]}
                    </span>
                  </td>
                  <td>
                    {c.dataVencimento
                      ? new Date(
                          `${c.dataVencimento}T12:00:00`,
                        ).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
              {!contasFiltradas.length && (
                <tr>
                  <td colSpan={7} className="lista-vazia">
                    Nenhuma conta encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {resumo && (
          <ResumoContaFlutuante
            conta={resumo.conta}
            carregando={resumo.carregando}
            x={resumo.x}
            y={resumo.y}
          />
        )}
        {menu && (
          <>
            <button
              className="fechar-menu-contexto"
              aria-label="Fechar"
              onClick={() => setMenu(null)}
            />
            <div
              className="menu-contexto"
              style={{ left: menu.x, top: menu.y }}
            >
              {tem("BAIXAR_RECEBER_CONTAS") && selecionada && !baixada && (
                <button onClick={abrirBaixa}>
                  {selecionada.tipo === "PAGAR"
                    ? "Baixar conta"
                    : "Receber conta"}
                </button>
              )}
              {tem("ESTORNAR_BAIXAS") && selecionada?.possuiBaixas && (
                <button onClick={estornar}>Estornar baixa</button>
              )}
              {tem("DUPLICAR_CONTAS") && (
                <button
                  onClick={() => {
                    aoDuplicar(menu.id);
                    setMenu(null);
                  }}
                >
                  Duplicar registro
                </button>
              )}
              {tem("EXCLUIR_CONTAS") && (
                <button className="acao-perigosa" onClick={excluir}>
                  Excluir
                </button>
              )}
            </div>
          </>
        )}
      </section>
      {baixa && (
        <DialogBaixa
          conta={baixa}
          fechar={() => setBaixa(null)}
          concluir={async () => {
            setBaixa(null);
            await carregar();
          }}
        />
      )}
      {estornoSelecionado && (
        <div className="fundo-modal">
          <section
            className="modal-parcelas modal-estorno"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-estorno"
          >
            <h2 id="titulo-estorno">
              Estornar{" "}
              {estornoSelecionado.tipo === "PAGAR"
                ? "pagamento"
                : "recebimento"}
            </h2>
            <p className="subtitulo">{estornoSelecionado.descricao}</p>
            <label className="rotulo-campo">
              Parcela baixada
              <select
                className="campo-formulario"
                value={parcelaEstorno}
                onChange={(evento) => setParcelaEstorno(evento.target.value)}
                required
              >
                <option value="">Selecione a parcela</option>
                {estornoSelecionado.parcelas
                  .filter((parcela) => parcela.situacao !== "PENDENTE")
                  .map((parcela) => (
                    <option key={parcela.numero} value={parcela.numero}>
                      {parcela.numero}/{estornoSelecionado.parcelas.length} ·{" "}
                      {moeda(parcela.valor)}
                      {parcela.baixadaEm
                        ? ` · ${formatarDataHora(parcela.baixadaEm)}`
                        : ""}
                    </option>
                  ))}
              </select>
            </label>
            <div className="acoes-formulario">
              <button
                className="botao-primario botao-ajustado"
                type="button"
                disabled={!parcelaEstorno}
                onClick={estornarParcelaSelecionada}
              >
                Estornar parcela
              </button>
              <button
                className="botao-secundario"
                type="button"
                onClick={() => {
                  setEstornoSelecionado(null);
                  setParcelaEstorno("");
                }}
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ResumoContaFlutuante({
  conta,
  carregando,
  x,
  y,
}: {
  conta: ContaDetalhe | null;
  carregando: boolean;
  x: number;
  y: number;
}) {
  if (carregando)
    return (
      <aside className="resumo-conta-flutuante" style={{ left: x, top: y }}>
        Carregando resumo...
      </aside>
    );
  if (!conta)
    return (
      <aside className="resumo-conta-flutuante" style={{ left: x, top: y }}>
        Não foi possível carregar o resumo.
      </aside>
    );

  const baixadas = conta.parcelas.filter((p) => p.situacao !== "PENDENTE");
  const pendentes = conta.parcelas.filter((p) => p.situacao === "PENDENTE");
  const numeros = (parcelas: ContaDetalhe["parcelas"]) =>
    parcelas.map((p) => p.numero).join(", ");

  return (
    <aside
      className="resumo-conta-flutuante"
      style={{ left: x, top: y }}
      role="tooltip"
    >
      <strong>{conta.descricao}</strong>
      <dl>
        <div>
          <dt>Tipo</dt>
          <dd>{conta.tipo === "PAGAR" ? "Pagar" : "Receber"}</dd>
        </div>
        <div>
          <dt>Valor total</dt>
          <dd>{moeda(conta.valorTotal)}</dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>{rotuloSituacao[conta.situacao]}</dd>
        </div>
        <div>
          <dt>Parcelas</dt>
          <dd>{conta.parcelas.length}</dd>
        </div>
      </dl>
      {conta.parcelas.length > 1 && (
        <div className="resumo-situacao-parcelas">
          <p className="parcelas-baixadas">
            <b>Baixadas ({baixadas.length})</b>
            <span>{baixadas.length ? numeros(baixadas) : "Nenhuma"}</span>
          </p>
          <p className="parcelas-pendentes">
            <b>Pendentes ({pendentes.length})</b>
            <span>{pendentes.length ? numeros(pendentes) : "Nenhuma"}</span>
          </p>
        </div>
      )}
    </aside>
  );
}

function IconeNotificacao() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}

function DialogBaixa({
  conta,
  fechar,
  concluir,
}: {
  conta: ContaDetalhe;
  fechar: () => void;
  concluir: () => Promise<void>;
}) {
  const [pagamento, setPagamento] = useState<"TOTAL" | "PARCIAL">(
      conta.situacao === "PARCELADA" ? "PARCIAL" : "TOTAL",
    ),
    [parcela, setParcela] = useState(""),
    [observacao, setObservacao] = useState(""),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  const pendentes = conta.parcelas.filter(
    (p) => (p.situacao ?? "PENDENTE") === "PENDENTE",
  );
  async function confirmar() {
    if (pagamento === "PARCIAL" && !parcela) {
      setErro("Selecione a parcela.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await baixarConta(
        conta.id,
        pagamento,
        pagamento === "PARCIAL" ? Number(parcela) : null,
        observacao,
      );
      await concluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar a baixa.");
      setSalvando(false);
    }
  }
  return (
    <div className="fundo-modal">
      <section
        className="modal-parcelas modal-baixa"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-baixa"
      >
        <h2 id="titulo-baixa">
          {conta.tipo === "PAGAR" ? "Baixar conta" : "Receber conta"}
        </h2>
        <div className="grade-baixa">
          <label className="rotulo-campo">
            Descrição
            <input
              className="campo-formulario"
              value={conta.descricao}
              disabled
            />
          </label>
          <label className="rotulo-campo">
            Tipo
            <input
              className="campo-formulario"
              value={
                conta.tipo === "PAGAR" ? "Conta a pagar" : "Conta a receber"
              }
              disabled
            />
          </label>
          <label className="rotulo-campo">
            Valor total
            <input
              className="campo-formulario"
              value={moeda(conta.valorTotal)}
              disabled
            />
          </label>
          <label className="rotulo-campo">
            Situação
            <input
              className="campo-formulario"
              value={rotuloSituacao[conta.situacao]}
              disabled
            />
          </label>
        </div>
        <h3 className="titulo-parcelas-baixa">Parcelas</h3>
        <div className="tabela-responsiva">
          <table className="tabela-usuarios tabela-parcelas tabela-baixa">
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Data da baixa</th>
              </tr>
            </thead>
            <tbody>
              {conta.parcelas.map((p) => (
                <tr key={p.numero}>
                  <td>
                    {p.numero}/{conta.parcelas.length}
                  </td>
                  <td>{moeda(p.valor)}</td>
                  <td>
                    {new Date(
                      `${p.dataVencimento}T12:00:00`,
                    ).toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    <span
                      className={`situacao-conta situacao-${(p.situacao ?? "PENDENTE").toLowerCase()}`}
                    >
                      {p.situacao === "PAGA"
                        ? "Paga"
                        : p.situacao === "RECEBIDA"
                          ? "Recebida"
                          : "Pendente"}
                    </span>
                  </td>
                  <td>{p.baixadaEm ? formatarDataHora(p.baixadaEm) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {conta.parcelas.length > 1 && (
          <div className="grade-pagamento-parcela">
            <label className="rotulo-campo">
              Pagamento
              <select
                className="campo-formulario"
                value={pagamento}
                onChange={(e) => {
                  setPagamento(e.target.value as "TOTAL" | "PARCIAL");
                  setParcela("");
                }}
              >
                <option value="TOTAL">Total</option>
                <option value="PARCIAL">Parcial</option>
              </select>
            </label>
            {pagamento === "PARCIAL" && (
              <label className="rotulo-campo">
                Parcela
                <select
                  className="campo-formulario"
                  value={parcela}
                  onChange={(e) => setParcela(e.target.value)}
                  required
                >
                  <option value="">Selecione uma parcela</option>
                  {pendentes.map((p) => (
                    <option key={p.numero} value={p.numero}>
                      {p.numero}/{conta.parcelas.length} — {moeda(p.valor)} —
                      vencimento{" "}
                      {new Date(
                        `${p.dataVencimento}T12:00:00`,
                      ).toLocaleDateString("pt-BR")}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        <label className="rotulo-campo">
          Observações
          <textarea
            className="campo-formulario campo-observacoes"
            value={observacao}
            maxLength={1000}
            placeholder="Informações opcionais sobre a baixa ou pagamento"
            onChange={(e) => setObservacao(e.target.value)}
          />
        </label>
        {erro && <p className="mensagem-erro">{erro}</p>}
        <div className="acoes-formulario">
          <button
            className="botao-primario botao-ajustado"
            type="button"
            disabled={salvando}
            onClick={confirmar}
          >
            {salvando
              ? "Registrando..."
              : conta.tipo === "PAGAR"
                ? "Confirmar baixa"
                : "Confirmar recebimento"}
          </button>
          <button
            className="botao-secundario"
            type="button"
            disabled={salvando}
            onClick={fechar}
          >
            Voltar
          </button>
        </div>
      </section>
    </div>
  );
}
