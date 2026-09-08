import { FormEvent, useEffect, useState } from "react";
import {
  alterarConta,
  buscarConta,
  cadastrarConta,
  visualizarAnexo,
  listarPessoas,
  buscarPessoaSugerida,
  listarContasBancarias,
  listarCategorias,
  listarSubCategorias,
} from "../../api";
import type {
  AnexoConta,
  AnexoNovo,
  ParcelaConta,
  TipoContaEnum,
  PessoaResumo,
  ContaBancaria,
  FrequenciaRecorrencia,
  Categoria,
  SubCategoria,
} from "../../api";

export default function MovimentacaoFinanceira({
  tipo,
  contaId,
  origemId,
  aoConcluir,
}: {
  tipo: TipoContaEnum;
  contaId: number | null;
  origemId: number | null;
  aoConcluir: () => void;
}) {
  const [descricao, setDescricao] = useState(""),
    [valor, setValor] = useState(""),
    [quantidade, setQuantidade] = useState("1"),
    [vencimento, setVencimento] = useState("");
  const [parcelas, setParcelas] = useState<ParcelaConta[]>([]),
    [anexos, setAnexos] = useState<AnexoNovo[]>([]),
    [existentes, setExistentes] = useState<AnexoConta[]>([]);
  const [pessoas, setPessoas] = useState<PessoaResumo[]>([]),
    [pessoaIds, setPessoaIds] = useState<number[]>([]),
    [categorias, setCategorias] = useState<Categoria[]>([]),
    [categoriaId, setCategoriaId] = useState<number | null>(null),
    [subcategorias, setSubcategorias] = useState<SubCategoria[]>([]),
    [subcategoriaId, setSubcategoriaId] = useState<number | null>(null),
    [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]),
    [contaBancariaId, setContaBancariaId] = useState<number | null>(null),
    [debitoAutomatico, setDebitoAutomatico] = useState(false),
    [recorrente, setRecorrente] = useState(false),
    [frequenciaRecorrencia, setFrequenciaRecorrencia] =
      useState<FrequenciaRecorrencia>("MENSAL");
  const [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false),
    [modal, setModal] = useState(false),
    [tipoAtual, setTipoAtual] = useState(tipo);
  const [parcelasAbertas, setParcelasAbertas] = useState(false),
    [anexosAbertos, setAnexosAbertos] = useState(false);
  const somaParcelas = parcelas.reduce((s, p) => s + Number(p.valor), 0);
  const parcelasValidas =
    Math.round(somaParcelas * 100) === Math.round(moedaParaNumero(valor) * 100);

  useEffect(() => {
    const fonte = contaId ?? origemId;
    Promise.all([
      listarPessoas(),
      fonte ? Promise.resolve(null) : buscarPessoaSugerida().catch(() => null),
    ])
      .then(([lista, sugestao]) => {
        setPessoas(lista);
        if (sugestao) setPessoaIds([sugestao.id]);
      })
      .catch(() => undefined);
    listarContasBancarias()
      .then(setContasBancarias)
      .catch(() => undefined);
    listarCategorias()
      .then(setCategorias)
      .catch(() => undefined);
    listarSubCategorias()
      .then(setSubcategorias)
      .catch(() => undefined);
    setTipoAtual(tipo);
    setDescricao("");
    setValor("");
    setQuantidade("1");
    setVencimento("");
    setParcelas([]);
    setAnexos([]);
    setExistentes([]);
    setPessoaIds([]);
    setCategoriaId(null);
    setSubcategoriaId(null);
    setContaBancariaId(null);
    setDebitoAutomatico(false);
    setRecorrente(false);
    setFrequenciaRecorrencia("MENSAL");
    if (fonte)
      buscarConta(fonte)
        .then((c) => {
          setDescricao(c.descricao);
          setValor(formatarMoeda(c.valorTotal));
          setTipoAtual(c.tipo);
          setPessoaIds(c.pessoaIds ?? []);
          setCategoriaId(c.categoriaId ?? null);
          setSubcategoriaId(c.subcategoriaId ?? null);
          setContaBancariaId(c.contaBancariaId ?? null);
          setDebitoAutomatico(c.debitoAutomatico);
          setRecorrente(c.recorrente);
          setFrequenciaRecorrencia(c.frequenciaRecorrencia ?? "MENSAL");
          setParcelas(
            origemId
              ? c.parcelas.map((p) => ({
                  numero: p.numero,
                  valor: p.valor,
                  dataVencimento: p.dataVencimento,
                }))
              : c.parcelas,
          );
          setQuantidade(String(c.parcelas.length));
          setVencimento(c.parcelas[0]?.dataVencimento ?? "");
          setExistentes(c.anexos);
          setParcelasAbertas(c.parcelas.length > 1);
          setAnexosAbertos(c.anexos.length > 0);
        })
        .catch((e) => setErro(e.message));
  }, [contaId, origemId, tipo]);

  function preparar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (moedaParaNumero(valor) <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    if (!categoriaId) {
      setErro("Selecione uma categoria.");
      return;
    }
    if (debitoAutomatico && !contaBancariaId) {
      setErro("Selecione uma conta bancária para o débito automático.");
      return;
    }
    if (
      [
        ...anexos.map((a) => a.descricao),
        ...existentes.map((a) => a.descricao),
      ].some((d) => !d.trim())
    ) {
      setErro("Informe a descrição de todos os anexos.");
      return;
    }
    if (parcelas.length > 1 && parcelas.length === Number(quantidade)) {
      if (!parcelasValidas) {
        setErro("A soma das parcelas deve ser igual ao valor total.");
        return;
      }
      salvar(parcelas);
      return;
    }
    const novas = criarParcelas(
      moedaParaNumero(valor),
      Number(quantidade) || 1,
      vencimento,
    );
    setParcelas(novas);
    novas.length > 1 ? setModal(true) : salvar(novas);
  }
  async function salvar(p: ParcelaConta[]) {
    setSalvando(true);
    setErro("");
    try {
      const dados = {
        descricao,
        valorTotal: moedaParaNumero(valor),
        tipo: tipoAtual,
        pessoaIds,
        categoriaId: categoriaId!,
        subcategoriaId,
        contaBancariaId,
        debitoAutomatico,
        recorrente,
        frequenciaRecorrencia: recorrente ? frequenciaRecorrencia : null,
        parcelas: p,
      };
      await (contaId
        ? alterarConta(contaId, dados, anexos, existentes)
        : cadastrarConta(dados, anexos, origemId ? existentes : []));
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }
  function mudarQuantidade(q: string) {
    setQuantidade(q);
    setParcelasAbertas(Number(q) > 1);
    if (Number(q) > 0 && valor && vencimento)
      setParcelas(criarParcelas(moedaParaNumero(valor), Number(q), vencimento));
  }
  function selecionarSubcategoria(valor: string) {
    setSubcategoriaId(valor ? Number(valor) : null);
    const subcategoria = subcategorias.find(
      (item) => item.id === Number(valor),
    );
    if (subcategoria) setCategoriaId(subcategoria.categoriaId);
  }
  function arquivos(fs: FileList | null) {
    if (fs && fs.length) {
      const selecionados = Array.from(fs).map((arquivo) => ({
        arquivo,
        descricao: "",
      }));
      setAnexos((a) => [...a, ...selecionados]);
      setAnexosAbertos(true);
    }
  }

  return (
    <>
      <form className="painel formulario-movimentacao" onSubmit={preparar}>
        <h1>
          {contaId
            ? "Alterar conta"
            : origemId
              ? "Duplicar conta"
              : `Conta a ${tipoAtual === "PAGAR" ? "pagar" : "receber"}`}
        </h1>
        <label className="rotulo-campo">Descrição *</label>
        <input
          className="campo-formulario"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
        />
        <div className="grade-baixa">
          <label className="rotulo-campo">
            Categoria *
            <select
              className="campo-formulario"
              value={categoriaId ?? ""}
              onChange={(e) => {
                setCategoriaId(e.target.value ? Number(e.target.value) : null);
                setSubcategoriaId(null);
              }}
              required
            >
              <option value="">Selecione uma categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="rotulo-campo">
            Subcategoria
            <select
              className="campo-formulario"
              value={subcategoriaId ?? ""}
              onChange={(e) => selecionarSubcategoria(e.target.value)}
            >
              <option value="">Sem subcategoria</option>
              {subcategorias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!categorias.length && (
          <small className="ajuda-campo">
            Cadastre uma categoria em Ferramentas → Categorias antes de lançar a
            movimentação.
          </small>
        )}
        <label className="rotulo-campo">Conta bancária</label>
        <select
          className="campo-formulario"
          value={contaBancariaId ?? ""}
          onChange={(e) =>
            setContaBancariaId(e.target.value ? Number(e.target.value) : null)
          }
          required={debitoAutomatico}
        >
          <option value="">Sem conta bancária vinculada</option>
          {contasBancarias.map((c) => (
            <option key={c.id} value={c.id}>
              {rotuloBanco(c.banco)} · Ag. {c.agencia} · Conta {c.numeroConta}
            </option>
          ))}
        </select>
        <div className="opcoes-lancamento">
          <label className="opcao-checkbox">
            <input
              type="checkbox"
              checked={debitoAutomatico}
              onChange={(e) => setDebitoAutomatico(e.target.checked)}
            />{" "}
            Débito automático
          </label>
          <label className="opcao-checkbox">
            <input
              type="checkbox"
              checked={recorrente}
              disabled={Boolean(contaId)}
              onChange={(e) => setRecorrente(e.target.checked)}
            />{" "}
            Recorrente
          </label>
        </div>
        {debitoAutomatico && !contasBancarias.length && (
          <p className="aviso-informativo">
            Cadastre uma conta bancária em Ferramentas → Contas bancárias para
            utilizar débito automático.
          </p>
        )}
        {recorrente && (
          <section className="secao-recorrencia">
            <h2>Recorrência</h2>
            <p className="subtitulo">
              Serão criadas novas contas até o final do ano do primeiro
              vencimento.
            </p>
            <label className="rotulo-campo">Frequência *</label>
            <select
              className="campo-formulario"
              value={frequenciaRecorrencia}
              onChange={(e) =>
                setFrequenciaRecorrencia(
                  e.target.value as FrequenciaRecorrencia,
                )
              }
            >
              <option value="DIARIA">Diariamente</option>
              <option value="SEMANAL">Semanalmente</option>
              <option value="MENSAL">Mensalmente</option>
              <option value="ANUAL">Anualmente</option>
            </select>
          </section>
        )}
        <label className="rotulo-campo">Tipo *</label>
        <select
          className="campo-formulario"
          value={tipoAtual}
          onChange={(e) => setTipoAtual(e.target.value as TipoContaEnum)}
        >
          <option value="RECEBER">Receber</option>
          <option value="PAGAR">Pagar</option>
        </select>
        <div className="rotulo-campo">
          Pessoas para notificações
          <span className="lista-selecao-pessoas">
            {pessoas.map((p) => (
              <span className="item-selecao-pessoa" key={p.id}>
                <input
                  type="checkbox"
                  checked={pessoaIds.includes(p.id)}
                  onChange={(e) =>
                    setPessoaIds((atuais) =>
                      e.target.checked
                        ? [...atuais, p.id]
                        : atuais.filter((id) => id !== p.id),
                    )
                  }
                />
                <span>{p.nome}</span>
              </span>
            ))}
            {!pessoas.length && (
              <span className="lista-pessoas-vazia">
                Nenhuma pessoa cadastrada.
              </span>
            )}
          </span>
        </div>
        <label className="rotulo-campo">Valor total *</label>
        <input
          className="campo-formulario"
          type="text"
          inputMode="numeric"
          value={valor}
          placeholder="R$ 0,00"
          onChange={(e) => {
            const v = mascararMoeda(e.target.value);
            setValor(v);
            if (Number(quantidade) > 1 && vencimento)
              setParcelas(
                criarParcelas(
                  moedaParaNumero(v),
                  Number(quantidade),
                  vencimento,
                ),
              );
          }}
          required
        />
        <label className="rotulo-campo">Parcelas</label>
        <input
          className="campo-formulario"
          type="number"
          min="1"
          value={quantidade}
          onChange={(e) => mudarQuantidade(e.target.value)}
        />
        <label className="rotulo-campo">Primeiro vencimento *</label>
        <input
          className="campo-formulario"
          type="date"
          value={vencimento}
          onChange={(e) => {
            setVencimento(e.target.value);
            if (Number(quantidade) > 1 && valor)
              setParcelas(
                criarParcelas(
                  moedaParaNumero(valor),
                  Number(quantidade),
                  e.target.value,
                ),
              );
            else if (parcelas.length)
              setParcelas((p) =>
                p.map((x, i) =>
                  i === 0 ? { ...x, dataVencimento: e.target.value } : x,
                ),
              );
          }}
          required
        />
        {parcelas.length > 1 && (
          <section className="secao-expansivel">
            <button
              type="button"
              className="cabecalho-secao"
              onClick={() => setParcelasAbertas((x) => !x)}
            >
              <span>Parcelas da conta ({parcelas.length})</span>
              <span>{parcelasAbertas ? "▴" : "▾"}</span>
            </button>
            {parcelasAbertas && (
              <div className="conteudo-secao">
                <p className="subtitulo">
                  Altere os valores e vencimentos conforme necessário.
                </p>
                <TabelaParcelas parcelas={parcelas} alterar={setParcelas} />
                <p
                  className={
                    parcelasValidas ? "mensagem-sucesso" : "mensagem-erro"
                  }
                >
                  Total das parcelas: {formatarMoeda(somaParcelas)}
                </p>
              </div>
            )}
          </section>
        )}
        <section className="secao-expansivel">
          <button
            type="button"
            className="cabecalho-secao"
            onClick={() => setAnexosAbertos((x) => !x)}
          >
            <span>Anexos ({existentes.length + anexos.length})</span>
            <span>{anexosAbertos ? "▴" : "▾"}</span>
          </button>
          {anexosAbertos && (
            <div className="conteudo-secao">
              <label className="seletor-anexo">
                <span>+ Selecionar arquivos</span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const lista = e.currentTarget.files;
                    arquivos(lista);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {existentes.length + anexos.length === 0 && (
                <p className="lista-vazia">Nenhum anexo selecionado.</p>
              )}
              <ul className="lista-anexos">
                {existentes.map((a, i) => (
                  <li key={a.id}>
                    <div className="dados-anexo">
                      <strong>{a.nomeArquivo}</strong>
                      <small>
                        {formatarTamanho(a.tamanho)} · Anexo registrado
                      </small>
                      <input
                        className="campo-formulario descricao-anexo"
                        placeholder="Descrição do anexo *"
                        value={a.descricao}
                        onChange={(e) =>
                          setExistentes((x) =>
                            x.map((v, n) =>
                              n === i ? { ...v, descricao: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="acoes-anexo">
                      <button
                        type="button"
                        aria-label={`Visualizar ${a.nomeArquivo}`}
                        title="Visualizar"
                        onClick={() => {
                          const fonte = contaId ?? origemId;
                          if (fonte)
                            visualizarAnexo(fonte, a.id).catch((e) =>
                              setErro(e.message),
                            );
                        }}
                      >
                        <IconeVisualizar />
                      </button>
                      <button
                        className="remover-anexo"
                        type="button"
                        aria-label={`Remover ${a.nomeArquivo}`}
                        title="Remover"
                        onClick={() =>
                          setExistentes((x) => x.filter((_, n) => n !== i))
                        }
                      >
                        <IconeRemover />
                      </button>
                    </div>
                  </li>
                ))}
                {anexos.map((a, i) => (
                  <li key={`${a.arquivo.name}-${a.arquivo.lastModified}-${i}`}>
                    <div className="dados-anexo">
                      <strong>{a.arquivo.name}</strong>
                      <small>
                        {formatarTamanho(a.arquivo.size)} · Novo anexo
                      </small>
                      <input
                        className="campo-formulario descricao-anexo"
                        placeholder="Descrição do anexo *"
                        value={a.descricao}
                        onChange={(e) =>
                          setAnexos((x) =>
                            x.map((v, n) =>
                              n === i ? { ...v, descricao: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="acoes-anexo">
                      <button
                        type="button"
                        aria-label={`Visualizar ${a.arquivo.name}`}
                        title="Visualizar"
                        onClick={() => visualizarArquivoLocal(a.arquivo)}
                      >
                        <IconeVisualizar />
                      </button>
                      <button
                        className="remover-anexo"
                        type="button"
                        aria-label={`Remover ${a.arquivo.name}`}
                        title="Remover"
                        onClick={() =>
                          setAnexos((x) => x.filter((_, n) => n !== i))
                        }
                      >
                        <IconeRemover />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        {erro && !modal && <p className="mensagem-erro">{erro}</p>}
        <div className="acoes-formulario">
          <button
            className="botao-primario botao-ajustado"
            disabled={salvando || (parcelas.length > 1 && !parcelasValidas)}
          >
            Salvar
          </button>
          <button
            type="button"
            className="botao-secundario"
            onClick={aoConcluir}
          >
            Voltar
          </button>
        </div>
      </form>
      {modal && (
        <Modal
          parcelas={parcelas}
          total={moedaParaNumero(valor)}
          erro={erro}
          salvando={salvando}
          alterar={setParcelas}
          fechar={() => setModal(false)}
          salvar={() => salvar(parcelas)}
        />
      )}
    </>
  );
}

function rotuloBanco(banco: ContaBancaria["banco"]) {
  return {
    NUBANK: "Nubank",
    SICREDI: "Sicredi",
    SICOOB: "Sicoob",
    BANCO_DO_BRASIL: "Banco do Brasil",
    CAIXA: "Caixa",
    PLUXE: "Pluxe",
  }[banco];
}

function TabelaParcelas({
  parcelas,
  alterar,
}: {
  parcelas: ParcelaConta[];
  alterar: (p: ParcelaConta[]) => void;
}) {
  return (
    <div className="tabela-responsiva">
      <table className="tabela-usuarios tabela-parcelas">
        <thead>
          <tr>
            <th>Número</th>
            <th>Valor</th>
            <th>Data de vencimento</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map((p, i) => (
            <tr key={p.numero}>
              <td>
                {p.numero}/{parcelas.length}
              </td>
              <td>
                <input
                  className="campo-tabela"
                  type="text"
                  inputMode="numeric"
                  value={formatarMoeda(p.valor)}
                  onChange={(e) =>
                    alterar(
                      parcelas.map((x, n) =>
                        n === i
                          ? { ...x, valor: moedaParaNumero(e.target.value) }
                          : x,
                      ),
                    )
                  }
                />
              </td>
              <td>
                <input
                  className="campo-tabela"
                  type="date"
                  value={p.dataVencimento}
                  onChange={(e) =>
                    alterar(
                      parcelas.map((x, n) =>
                        n === i ? { ...x, dataVencimento: e.target.value } : x,
                      ),
                    )
                  }
                />
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
                {p.baixadaEm && (
                  <small className="data-baixa-parcela">
                    {new Date(p.baixadaEm).toLocaleString("pt-BR")}
                  </small>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Modal({
  parcelas,
  total,
  erro,
  salvando,
  alterar,
  fechar,
  salvar,
}: {
  parcelas: ParcelaConta[];
  total: number;
  erro: string;
  salvando: boolean;
  alterar: (p: ParcelaConta[]) => void;
  fechar: () => void;
  salvar: () => void;
}) {
  const soma = parcelas.reduce((s, p) => s + Number(p.valor), 0),
    ok = Math.round(soma * 100) === Math.round(total * 100);
  return (
    <div className="fundo-modal">
      <section className="modal-parcelas">
        <h2>Provisionar vencimentos</h2>
        <TabelaParcelas parcelas={parcelas} alterar={alterar} />
        {!ok && (
          <p className="mensagem-erro">A soma deve corresponder ao total.</p>
        )}
        {erro && <p className="mensagem-erro">{erro}</p>}
        <div className="acoes-formulario">
          <button
            className="botao-primario botao-ajustado"
            disabled={!ok || salvando}
            onClick={salvar}
          >
            Confirmar
          </button>
          <button className="botao-secundario" onClick={fechar}>
            Voltar
          </button>
        </div>
      </section>
    </div>
  );
}
function criarParcelas(total: number, qtd: number, data: string) {
  const cents = Math.round(total * 100),
    base = Math.floor(cents / qtd),
    sobra = cents % qtd,
    inicial = new Date(`${data}T12:00:00`);
  return Array.from({ length: qtd }, (_, i) => {
    const d = new Date(inicial);
    d.setDate(d.getDate() + i * 30);
    return {
      numero: i + 1,
      valor: (base + (i < sobra ? 1 : 0)) / 100,
      dataVencimento: d.toISOString().slice(0, 10),
    };
  });
}
function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function moedaParaNumero(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  return digitos ? Number(digitos) / 100 : 0;
}
function mascararMoeda(valor: string) {
  return formatarMoeda(moedaParaNumero(valor));
}
function formatarTamanho(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function visualizarArquivoLocal(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function IconeVisualizar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}
function IconeRemover() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
    </svg>
  );
}
