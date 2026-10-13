import { FormEvent, useEffect, useState } from "react";
import {
  alterarConta,
  baixarConta,
  estornarBaixaConta,
  buscarConta,
  cadastrarConta,
  baixarAnexoConta,
  listarPessoas,
  buscarPessoaSugerida,
  listarContasBancarias,
  listarCategorias,
  listarSubCategorias,
} from "../../api";
import { formatarDataHora } from "../../formatadores";
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
  podeAlterar,
  podeBaixar,
  podeEstornar,
  aoConcluir,
}: {
  tipo: TipoContaEnum;
  contaId: number | null;
  origemId: number | null;
  podeAlterar: boolean;
  podeBaixar: boolean;
  podeEstornar: boolean;
  aoConcluir: () => void;
}) {
  const [descricao, setDescricao] = useState(""),
    [valor, setValor] = useState(""),
    [quantidade, setQuantidade] = useState("1"),
    [vencimento, setVencimento] = useState(proximoPrimeiroVencimento);
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
    [parcelasParaDialog, setParcelasParaDialog] = useState<
      ParcelaConta[] | null
    >(null),
    [tipoAtual, setTipoAtual] = useState(tipo);
  const [parcelasAbertas, setParcelasAbertas] = useState(false),
    [anexosAbertos, setAnexosAbertos] = useState(false);
  const [menuParcela, setMenuParcela] = useState<{
    numero: number;
    x: number;
    y: number;
  } | null>(null);
  const [baixandoParcela, setBaixandoParcela] = useState(false);
  const somaParcelasCentavos = somarParcelasCentavos(parcelas);
  const somaParcelas = somaParcelasCentavos / 100;
  const categoriasContas = categorias.filter(
    (categoria) => categoria.tipoUtilizacao === "CONTAS",
  );
  const idsCategoriasContas = new Set(
    categoriasContas.map((categoria) => categoria.id),
  );
  const subcategoriasDisponiveis = subcategorias.filter((subcategoria) =>
    categoriaId
      ? subcategoria.categoriaId === categoriaId
      : idsCategoriasContas.has(subcategoria.categoriaId),
  );
  const parcelasValidas =
    recorrente || somaParcelasCentavos === moedaParaCentavos(valor);
  const bloqueiaEdicao =
    Boolean(contaId) &&
    (!podeAlterar ||
      parcelas.some((p) => (p.situacao ?? "PENDENTE") !== "PENDENTE"));

  function aplicarConta(c: Awaited<ReturnType<typeof buscarConta>>) {
    setDescricao(c.descricao);
    setValor(
      formatarMoeda(
        c.recorrente ? (c.parcelas[0]?.valor ?? c.valorTotal) : c.valorTotal,
      ),
    );
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
        ? c.parcelas.map(({ numero, valor, dataVencimento }) => ({
            numero,
            valor,
            dataVencimento,
          }))
        : c.parcelas,
    );
    setQuantidade(String(c.parcelas.length));
    setVencimento(c.parcelas[0]?.dataVencimento ?? "");
    setExistentes(c.anexos);
    setParcelasAbertas(c.parcelas.length > 1);
    setAnexosAbertos(c.anexos.length > 0);
  }

  function abrirMenuParcela(numero: number, x: number, y: number) {
    setMenuParcela({
      numero,
      x: Math.max(8, Math.min(x, window.innerWidth - 220)),
      y: Math.max(8, Math.min(y, window.innerHeight - 80)),
    });
  }

  async function executarAcaoParcela() {
    if (!contaId || !menuParcela) return;
    const numero = menuParcela.numero;
    const parcela = parcelas.find((item) => item.numero === numero);
    if (!parcela) return;
    const estorno = (parcela.situacao ?? "PENDENTE") !== "PENDENTE";
    if ((estorno && !podeEstornar) || (!estorno && !podeBaixar)) return;
    const mensagem = estorno
      ? `Confirma o estorno da parcela ${numero}/${parcelas.length}? A baixa e suas observações serão removidas.`
      : `Confirmar ${tipoAtual === "PAGAR" ? "o pagamento" : "o recebimento"} da parcela ${numero}/${parcelas.length}? Alterações ainda não salvas serão descartadas.`;
    if (!confirm(mensagem)) {
      setMenuParcela(null);
      return;
    }
    setBaixandoParcela(true);
    setErro("");
    try {
      if (estorno) await estornarBaixaConta(contaId, numero);
      else
        await baixarConta(
          contaId,
          parcelas.length > 1 ? "PARCIAL" : "TOTAL",
          parcelas.length > 1 ? numero : null,
          "",
        );
      aplicarConta(await buscarConta(contaId));
      setMenuParcela(null);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível baixar a parcela.",
      );
      setMenuParcela(null);
    } finally {
      setBaixandoParcela(false);
    }
  }

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
    setVencimento(proximoPrimeiroVencimento());
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
          setValor(
            formatarMoeda(
              c.recorrente
                ? (c.parcelas[0]?.valor ?? c.valorTotal)
                : c.valorTotal,
            ),
          );
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
    const valoresDigitados = new Map(
      Array.from(
        e.currentTarget.querySelectorAll<HTMLInputElement>(
          "[data-numero-parcela]",
        ),
        (input) =>
          [
            Number(input.dataset.numeroParcela),
            moedaParaNumero(input.value),
          ] as const,
      ),
    );
    const parcelasAtuais = parcelas.map((parcela) => ({
      ...parcela,
      valor: valoresDigitados.get(parcela.numero) ?? parcela.valor,
    }));
    setParcelas(parcelasAtuais);
    if (!recorrente)
      setValor(formatarMoeda(somarParcelasCentavos(parcelasAtuais) / 100));

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
    if (recorrente) {
      if (
        parcelasAtuais.length > 0 &&
        parcelasAtuais.length === Number(quantidade)
      ) {
        if (parcelasAtuais.some((parcela) => parcela.valor <= 0)) {
          setErro("Cada ocorrência deve ter um valor maior que zero.");
          return;
        }
        if (parcelasAtuais.length > 1) setParcelasParaDialog(parcelasAtuais);
        else salvar(parcelasAtuais);
        return;
      }
      const recorrencias = criarParcelasRecorrentes(
        moedaParaNumero(valor),
        vencimento,
        frequenciaRecorrencia,
        Number(quantidade) || 1,
      );
      setParcelas(recorrencias);
      setQuantidade(String(recorrencias.length));
      setParcelasAbertas(recorrencias.length > 1);
      recorrencias.length > 1
        ? setParcelasParaDialog(recorrencias)
        : salvar(recorrencias);
      return;
    }
    if (
      parcelasAtuais.length > 1 &&
      parcelasAtuais.length === Number(quantidade)
    ) {
      if (somarParcelasCentavos(parcelasAtuais) <= 0) {
        setErro("A soma das parcelas deve ser igual ao valor total.");
        return;
      }
      setParcelasParaDialog(parcelasAtuais);
      return;
    }
    const novas = criarParcelas(
      moedaParaNumero(valor),
      Number(quantidade) || 1,
      vencimento,
    );
    setParcelas(novas);
    novas.length > 1 ? setParcelasParaDialog(novas) : salvar(novas);
  }
  async function salvar(p: ParcelaConta[]) {
    setSalvando(true);
    setErro("");
    try {
      const dados = {
        descricao,
        valorTotal: somarParcelasCentavos(p) / 100,
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
    if (recorrente && Number(q) > 0)
      atualizarRecorrencias(
        valor,
        vencimento,
        frequenciaRecorrencia,
        Number(q),
      );
    else if (Number(q) > 0 && valor && vencimento)
      setParcelas(criarParcelas(moedaParaNumero(valor), Number(q), vencimento));
  }
  function alterarParcelas(novas: ParcelaConta[]) {
    setParcelas(novas);
    setValor(formatarMoeda(somarParcelasCentavos(novas) / 100));
  }
  function atualizarRecorrencias(
    valorAtual = valor,
    dataAtual = vencimento,
    frequencia = frequenciaRecorrencia,
    quantidadeAtual = Number(quantidade) || 1,
  ) {
    if (!valorAtual || !dataAtual) return;
    const novas = criarParcelasRecorrentes(
      moedaParaNumero(valorAtual),
      dataAtual,
      frequencia,
      quantidadeAtual,
    );
    setParcelas(novas);
    setParcelasAbertas(novas.length > 1);
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
        <h1
          className={`titulo-formulario-conta titulo-conta-${tipoAtual.toLowerCase()}`}
        >
          <IconeTipoConta tipo={tipoAtual} />
          <span>
            {contaId
              ? bloqueiaEdicao
                ? "Visualizar conta"
                : "Alterar conta"
              : origemId
                ? "Duplicar conta"
                : `Conta a ${tipoAtual === "PAGAR" ? "pagar" : "receber"}`}
          </span>
        </h1>
        <fieldset className="campos-conta" disabled={bloqueiaEdicao}>
          <label className="rotulo-campo">Descrição *</label>
          <input
            className="campo-formulario"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
          />
          <div className="grade-configuracao-conta">
            <label className="rotulo-campo campo-conta-bancaria">
              Conta bancária
              <select
                className="campo-formulario"
                value={contaBancariaId ?? ""}
                onChange={(e) =>
                  setContaBancariaId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                required={debitoAutomatico}
              >
                <option value="">Sem conta bancária vinculada</option>
                {contasBancarias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {rotuloBanco(c.banco)} · Ag. {c.agencia} · Conta{" "}
                    {c.numeroConta}
                  </option>
                ))}
              </select>
            </label>
            <div className="opcoes-lancamento opcoes-lancamento-em-linha">
              <label className="opcao-checkbox">
                <input
                  type="checkbox"
                  checked={debitoAutomatico}
                  onChange={(e) => setDebitoAutomatico(e.target.checked)}
                />
                Débito automático
              </label>
              <label className="opcao-checkbox">
                <input
                  type="checkbox"
                  checked={recorrente}
                  disabled={Boolean(contaId)}
                  onChange={(e) => {
                    const ativo = e.target.checked;
                    setRecorrente(ativo);
                    if (ativo) {
                      setQuantidade("1");
                      atualizarRecorrencias(
                        valor,
                        vencimento,
                        frequenciaRecorrencia,
                        1,
                      );
                    } else {
                      setQuantidade("1");
                      setParcelas(
                        criarParcelas(moedaParaNumero(valor), 1, vencimento),
                      );
                    }
                  }}
                />
                Recorrente
              </label>
            </div>
            <label className="rotulo-campo campo-tipo-conta">
              Tipo *
              <select
                className="campo-formulario"
                value={tipoAtual}
                onChange={(e) => setTipoAtual(e.target.value as TipoContaEnum)}
              >
                <option value="RECEBER">Receber</option>
                <option value="PAGAR">Pagar</option>
              </select>
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
                Informe quantas ocorrências desta conta devem ser criadas.
              </p>
              <label className="rotulo-campo">Frequência *</label>
              <select
                className="campo-formulario"
                value={frequenciaRecorrencia}
                onChange={(e) => {
                  const frequencia = e.target.value as FrequenciaRecorrencia;
                  setFrequenciaRecorrencia(frequencia);
                  atualizarRecorrencias(valor, vencimento, frequencia);
                }}
              >
                <option value="DIARIA">Diariamente</option>
                <option value="SEMANAL">Semanalmente</option>
                <option value="MENSAL">Mensalmente</option>
                <option value="ANUAL">Anualmente</option>
              </select>
            </section>
          )}
          <div className="grade-valores-conta">
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
                if (recorrente) atualizarRecorrencias(v, vencimento);
                else if (Number(quantidade) > 1 && vencimento)
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
              onBlur={() => mudarQuantidade(quantidade)}
            />
            <label className="rotulo-campo">Primeiro vencimento *</label>
            <input
              className="campo-formulario"
              type="date"
              value={vencimento}
              onChange={(e) => {
                setVencimento(e.target.value);
                if (recorrente) atualizarRecorrencias(valor, e.target.value);
                else if (Number(quantidade) > 1 && valor)
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
          </div>
        </fieldset>
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
                <TabelaParcelas
                  parcelas={parcelas}
                  alterar={alterarParcelas}
                  podeBaixar={Boolean(contaId && podeBaixar)}
                  podeEstornar={Boolean(contaId && podeEstornar)}
                  abrirMenu={abrirMenuParcela}
                />
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
        <fieldset className="campos-conta" disabled={bloqueiaEdicao}>
          <div className="grade-notificacao-conta">
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
            <div className="grade-classificacao-conta">
              <label className="rotulo-campo">
                Categoria *
                <select
                  className="campo-formulario"
                  value={categoriaId ?? ""}
                  onChange={(e) => {
                    setCategoriaId(
                      e.target.value ? Number(e.target.value) : null,
                    );
                    setSubcategoriaId(null);
                  }}
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {categoriasContas.map((c) => (
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
                  {subcategoriasDisponiveis.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {!categorias.some((c) => c.tipoUtilizacao === "CONTAS") && (
            <small className="ajuda-campo">
              Cadastre uma categoria em Ferramentas → Categorias antes de lançar
              a movimentação.
            </small>
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
                        <div
                          className="identificacao-anexo"
                          title={a.nomeArquivo}
                        >
                          <strong>{a.nomeArquivo}</strong>
                          <small>
                            {formatarTamanho(a.tamanho)} · Registrado
                          </small>
                        </div>
                        <input
                          className="campo-formulario descricao-anexo"
                          placeholder="Descrição do anexo *"
                          value={a.descricao}
                          onChange={(e) =>
                            setExistentes((x) =>
                              x.map((v, n) =>
                                n === i
                                  ? { ...v, descricao: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="acoes-anexo">
                        <button
                          type="button"
                          aria-label={`Baixar ${a.nomeArquivo}`}
                          title="Baixar"
                          onClick={() => {
                            const fonte = contaId ?? origemId;
                            if (fonte)
                              baixarAnexoConta(fonte, a).catch((e) =>
                                setErro(e.message),
                              );
                          }}
                        >
                          <IconeBaixar />
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
                    <li
                      key={`${a.arquivo.name}-${a.arquivo.lastModified}-${i}`}
                    >
                      <div className="dados-anexo">
                        <div
                          className="identificacao-anexo"
                          title={a.arquivo.name}
                        >
                          <strong>{a.arquivo.name}</strong>
                          <small>
                            {formatarTamanho(a.arquivo.size)} · Novo
                          </small>
                        </div>
                        <input
                          className="campo-formulario descricao-anexo"
                          placeholder="Descrição do anexo *"
                          value={a.descricao}
                          onChange={(e) =>
                            setAnexos((x) =>
                              x.map((v, n) =>
                                n === i
                                  ? { ...v, descricao: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="acoes-anexo">
                        <button
                          type="button"
                          aria-label={`Baixar ${a.arquivo.name}`}
                          title="Baixar"
                          onClick={() => baixarArquivoLocal(a.arquivo)}
                        >
                          <IconeBaixar />
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
        </fieldset>
        {bloqueiaEdicao && (
          <p className="aviso-informativo">
            Esta conta não pode ser alterada após uma baixa. Use o botão direito
            sobre uma parcela pendente para pagar ou receber.
          </p>
        )}
        {erro && !parcelasParaDialog && <p className="mensagem-erro">{erro}</p>}
        <div className="acoes-formulario">
          <button
            className="botao-primario botao-ajustado"
            disabled={
              bloqueiaEdicao ||
              salvando ||
              (parcelas.length > 1 && !parcelasValidas)
            }
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
      {menuParcela && (
        <>
          <button
            className="fechar-menu-contexto"
            type="button"
            aria-label="Fechar menu da parcela"
            onClick={() => setMenuParcela(null)}
          />
          <div
            className="menu-contexto"
            style={{ left: menuParcela.x, top: menuParcela.y }}
          >
            <button
              type="button"
              disabled={baixandoParcela}
              onClick={executarAcaoParcela}
            >
              {baixandoParcela
                ? "Processando..."
                : (() => {
                    const parcela = parcelas.find(
                      (item) => item.numero === menuParcela.numero,
                    );
                    if ((parcela?.situacao ?? "PENDENTE") !== "PENDENTE")
                      return "Estornar parcela";
                    return tipoAtual === "PAGAR"
                      ? "Pagar parcela"
                      : "Receber parcela";
                  })()}
            </button>
          </div>
        </>
      )}
      {parcelasParaDialog && (
        <Modal
          parcelas={parcelasParaDialog}
          totalCentavos={somarParcelasCentavos(parcelasParaDialog)}
          validarTotal={!recorrente}
          erro={erro}
          salvando={salvando}
          alterar={(novas) => {
            setParcelas(novas);
            setParcelasParaDialog(novas);
            setValor(formatarMoeda(somarParcelasCentavos(novas) / 100));
          }}
          fechar={() => setParcelasParaDialog(null)}
          salvar={() => salvar(parcelasParaDialog)}
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
  podeBaixar,
  podeEstornar,
  abrirMenu,
}: {
  parcelas: ParcelaConta[];
  alterar: (p: ParcelaConta[]) => void;
  podeBaixar?: boolean;
  podeEstornar?: boolean;
  abrirMenu?: (numero: number, x: number, y: number) => void;
}) {
  const [valoresEmEdicao, setValoresEmEdicao] = useState<
    Record<number, string>
  >({});

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
            <tr
              key={p.numero}
              onContextMenu={(evento) => {
                if (
                  ((podeBaixar && (p.situacao ?? "PENDENTE") === "PENDENTE") ||
                    (podeEstornar &&
                      (p.situacao ?? "PENDENTE") !== "PENDENTE")) &&
                  abrirMenu
                ) {
                  evento.preventDefault();
                  abrirMenu(p.numero, evento.clientX, evento.clientY);
                }
              }}
            >
              <td>
                {p.numero}/{parcelas.length}
              </td>
              <td>
                <input
                  className="campo-tabela"
                  type="text"
                  inputMode="numeric"
                  data-numero-parcela={p.numero}
                  value={valoresEmEdicao[p.numero] ?? formatarMoeda(p.valor)}
                  onChange={(e) => {
                    const valorNumerico = moedaParaNumero(e.target.value);
                    setValoresEmEdicao((atuais) => ({
                      ...atuais,
                      [p.numero]: formatarMoeda(valorNumerico),
                    }));
                    alterar(
                      parcelas.map((x, n) =>
                        n === i ? { ...x, valor: valorNumerico } : x,
                      ),
                    );
                  }}
                  onBlur={(evento) => {
                    const valorNumerico = moedaParaNumero(
                      evento.currentTarget.value,
                    );
                    alterar(
                      parcelas.map((x, n) =>
                        n === i ? { ...x, valor: valorNumerico } : x,
                      ),
                    );
                    setValoresEmEdicao((atuais) => {
                      const proximos = { ...atuais };
                      delete proximos[p.numero];
                      return proximos;
                    });
                  }}
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
                    {formatarDataHora(p.baixadaEm)}
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
  totalCentavos,
  validarTotal,
  erro,
  salvando,
  alterar,
  fechar,
  salvar,
}: {
  parcelas: ParcelaConta[];
  totalCentavos: number;
  validarTotal: boolean;
  erro: string;
  salvando: boolean;
  alterar: (p: ParcelaConta[]) => void;
  fechar: () => void;
  salvar: () => void;
}) {
  const somaCentavos = somarParcelasCentavos(parcelas),
    ok = !validarTotal || somaCentavos === totalCentavos;
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
            type="button"
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
function criarParcelasRecorrentes(
  valor: number,
  data: string,
  frequencia: FrequenciaRecorrencia,
  quantidade: number,
) {
  if (!data || valor <= 0) return [];
  const [ano, mes, dia] = data.split("-").map(Number);
  const primeiro = new Date(ano, mes - 1, dia);
  const datas: Date[] = [];
  for (let ocorrencia = 0; ocorrencia < quantidade; ocorrencia++) {
    let atual: Date;
    if (frequencia === "MENSAL") {
      const mesAlvo = mes - 1 + ocorrencia;
      const anoAlvo = ano + Math.floor(mesAlvo / 12);
      const mesNormalizado = ((mesAlvo % 12) + 12) % 12;
      const ultimoDia = new Date(anoAlvo, mesNormalizado + 1, 0).getDate();
      atual = new Date(anoAlvo, mesNormalizado, Math.min(dia, ultimoDia));
    } else {
      atual = new Date(primeiro);
      if (frequencia === "DIARIA")
        atual.setDate(primeiro.getDate() + ocorrencia);
      else if (frequencia === "SEMANAL")
        atual.setDate(primeiro.getDate() + ocorrencia * 7);
      else atual.setFullYear(primeiro.getFullYear() + ocorrencia);
    }
    datas.push(atual);
  }
  return datas.map((atual, indice) => ({
    numero: indice + 1,
    valor,
    dataVencimento: `${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, "0")}-${String(atual.getDate()).padStart(2, "0")}`,
  }));
}
function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function moedaParaCentavos(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  return digitos ? Number(digitos) : 0;
}
function moedaParaNumero(valor: string) {
  return moedaParaCentavos(valor) / 100;
}
function somarParcelasCentavos(parcelas: ParcelaConta[]) {
  return parcelas.reduce(
    (total, parcela) => total + Math.round(Number(parcela.valor) * 100),
    0,
  );
}
function mascararMoeda(valor: string) {
  return formatarMoeda(moedaParaNumero(valor));
}
function proximoPrimeiroVencimento() {
  const hoje = new Date();
  const vencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10);
  return `${vencimento.getFullYear()}-${String(vencimento.getMonth() + 1).padStart(2, "0")}-10`;
}
function formatarTamanho(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function baixarArquivoLocal(arquivo: File) {
  const url = URL.createObjectURL(arquivo),
    link = document.createElement("a");
  link.href = url;
  link.download = arquivo.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function IconeBaixar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 20h14" />
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
function IconeTipoConta({ tipo }: { tipo: TipoContaEnum }) {
  return (
    <span className="icone-tipo-conta" aria-hidden="true">
      <svg viewBox="0 0 32 24">
        <circle cx="11" cy="12" r="8.5" />
        <text x="11" y="14.6" textAnchor="middle">
          R$
        </text>
        <path
          d={
            tipo === "RECEBER"
              ? "M29 12H20M23.5 8.5 20 12l3.5 3.5"
              : "M20 12h9M25.5 8.5 29 12l-3.5 3.5"
          }
        />
      </svg>
    </span>
  );
}
