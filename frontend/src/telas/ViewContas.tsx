import { useEffect, useState } from "react";
import {
  baixarConta,
  buscarConta,
  buscarNotificacaoWhatsapp,
  enviarNotificacaoNtfy,
  estornarBaixaConta,
  excluirConta,
  listarContas,
} from "../api";
import type { ContaDetalhe, ContaResumo, Funcionalidade } from "../api";

const rotuloSituacao = {
  ABERTA: "Aberta",
  PAGA: "Paga",
  RECEBIDA: "Recebida",
  PARCELADA: "Parcelada",
};
const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ViewContas({
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
    [baixa, setBaixa] = useState<ContaDetalhe | null>(null);
  const [preparandoNotificacao, setPreparandoNotificacao] = useState(false),
    [sucessoNotificacao, setSucessoNotificacao] = useState("");
  const [descricaoFiltro, setDescricaoFiltro] = useState(""),
    [valorFiltro, setValorFiltro] = useState(""),
    [situacaoFiltro, setSituacaoFiltro] = useState(""),
    [dataBaixaFiltro, setDataBaixaFiltro] = useState("");
  async function carregar() {
    try {
      setContas(await listarContas());
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }
  useEffect(() => {
    carregar();
  }, []);
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
  async function estornar() {
    if (
      !menu ||
      !confirm(
        "Confirma o estorno? Todas as parcelas voltarão para pendente e as datas e observações da baixa serão removidas.",
      )
    )
      return;
    try {
      await estornarBaixaConta(menu.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao estornar a baixa.");
    }
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
    try {
      const resultado = await enviarNotificacaoNtfy();
      if (resultado.enviado) mensagens.push(resultado.mensagem);
    } catch (e) {
      if (
        !(
          e instanceof Error &&
          e.message.includes("Associe uma pessoa com ntfy")
        )
      )
        setErro(e instanceof Error ? e.message : "Erro ao enviar ntfy.");
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
      if (
        !(
          e instanceof Error &&
          e.message.includes("Associe uma pessoa com WhatsApp")
        )
      )
        setErro(e instanceof Error ? e.message : "Erro ao preparar WhatsApp.");
    }
    if (mensagens.length) setSucessoNotificacao(mensagens.join(" "));
    if (!mensagens.length && !erro)
      setErro("Nenhuma pessoa com canal de notificação foi encontrada.");
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
      (!valorFiltro || Math.abs(c.valorTotal - Number(valorFiltro)) < 0.005) &&
      (!situacaoFiltro || c.situacao === situacaoFiltro) &&
      (!dataBaixaFiltro ||
        (c.baixadaEm && dataLocal(c.baixadaEm) === dataBaixaFiltro)),
  );
  return (
    <>
      <section className="painel">
        <div className="cabecalho-listagem">
          <div>
            <h1>Contas</h1>
            <p className="subtitulo">
              Todas as contas cadastradas.
              {tem("ALTERAR_CONTAS") ? " Dê dois cliques para alterar." : ""}
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
              <option value="ABERTA">Aberta</option>
              <option value="PARCELADA">Parcelada</option>
              <option value="PAGA">Paga</option>
              <option value="RECEBIDA">Recebida</option>
            </select>
          </label>
          <label className="rotulo-campo">
            Data da baixa
            <input
              className="campo-formulario"
              type="date"
              value={dataBaixaFiltro}
              onChange={(e) => setDataBaixaFiltro(e.target.value)}
            />
          </label>
          <button
            className="botao-limpar-filtros"
            type="button"
            onClick={() => {
              setDescricaoFiltro("");
              setValorFiltro("");
              setSituacaoFiltro("");
              setDataBaixaFiltro("");
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
                <th>Valor</th>
                <th>Situação</th>
                <th>Cadastro</th>
                <th>Baixa</th>
              </tr>
            </thead>
            <tbody>
              {contasFiltradas.map((c) => (
                <tr
                  key={c.id}
                  onDoubleClick={() =>
                    tem("ALTERAR_CONTAS") && !c.possuiBaixas && aoEditar(c.id)
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ id: c.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <td>{c.descricao}</td>
                  <td
                    className={
                      c.tipo === "RECEBER" ? "tipo-receber" : "tipo-pagar"
                    }
                  >
                    {c.tipo === "RECEBER" ? "Receber" : "Pagar"}
                  </td>
                  <td className="valor-conta">{moeda(c.valorTotal)}</td>
                  <td>
                    <span
                      className={`situacao-conta situacao-${c.situacao.toLowerCase()}`}
                    >
                      {rotuloSituacao[c.situacao]}
                    </span>
                  </td>
                  <td>{new Date(c.criadoEm).toLocaleDateString("pt-BR")}</td>
                  <td>
                    {c.baixadaEm
                      ? new Date(c.baixadaEm).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
              {!contasFiltradas.length && (
                <tr>
                  <td colSpan={6} className="lista-vazia">
                    Nenhuma conta encontrada.
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
    </>
  );
}

function IconeNotificacao() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}

function dataLocal(iso: string) {
  const data = new Date(iso);
  return new Date(data.getTime() - data.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
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
  const [pagamento, setPagamento] = useState<"TOTAL" | "PARCIAL">("TOTAL"),
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
                  <td>
                    {p.baixadaEm
                      ? new Date(p.baixadaEm).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {conta.parcelas.length > 1 && (
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
        )}
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
                  {new Date(`${p.dataVencimento}T12:00:00`).toLocaleDateString(
                    "pt-BR",
                  )}
                </option>
              ))}
            </select>
          </label>
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
