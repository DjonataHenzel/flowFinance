import { FormEvent, useEffect, useRef, useState } from "react";
import {
  alterarCompromisso,
  cadastrarCompromisso,
  baixarAnexoCompromisso,
  listarPessoas,
  buscarPessoaSugerida,
  listarCategorias,
  listarSubCategorias,
} from "../../api";
import type {
  CompromissoResumo,
  NovoCompromisso,
  PessoaResumo,
  SituacaoCompromisso,
  Categoria,
  SubCategoria,
  AnexoConta,
  AnexoNovo,
  ContatoWhatsappCompromisso,
} from "../../api";
export default function Compromisso({
  registro,
  duplicando = false,
  aoSalvar,
  aoCancelar,
}: {
  registro?: CompromissoResumo;
  duplicando?: boolean;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const seletorAnexosRef = useRef<HTMLInputElement>(null);
  const [pessoas, setPessoas] = useState<PessoaResumo[]>([]),
    [categorias, setCategorias] = useState<Categoria[]>([]),
    [subcategorias, setSubcategorias] = useState<SubCategoria[]>([]),
    [dataHora, setDataHora] = useState(
      registro ? registro.dataHora.slice(0, 16) : "",
    ),
    [descricao, setDescricao] = useState(registro?.descricao ?? ""),
    [pessoaIds, setPessoaIds] = useState<number[]>(registro?.pessoaIds ?? []),
    [hora, setHora] = useState(
      registro?.horaNotificacao.slice(0, 5) ?? "09:00",
    ),
    [situacao, setSituacao] = useState<SituacaoCompromisso>(
      duplicando ? "PENDENTE" : (registro?.situacao ?? "PENDENTE"),
    ),
    [categoriaId, setCategoriaId] = useState(
      registro?.categoriaId ? String(registro.categoriaId) : "",
    ),
    [subcategoriaId, setSubcategoriaId] = useState(
      registro?.subcategoriaId ? String(registro.subcategoriaId) : "",
    ),
    [cep, setCep] = useState(registro?.cep ?? ""),
    [logradouro, setLogradouro] = useState(registro?.logradouro ?? ""),
    [numero, setNumero] = useState(registro?.numero ?? ""),
    [complemento, setComplemento] = useState(registro?.complemento ?? ""),
    [bairro, setBairro] = useState(registro?.bairro ?? ""),
    [cidade, setCidade] = useState(registro?.cidade ?? ""),
    [uf, setUf] = useState(registro?.uf ?? ""),
    [whatsapp, setWhatsapp] = useState<ContatoWhatsappCompromisso[]>(
      registro?.whatsapp ?? [],
    ),
    [novoWhatsapp, setNovoWhatsapp] = useState(""),
    [descricaoWhatsapp, setDescricaoWhatsapp] = useState(""),
    [anexos, setAnexos] = useState<AnexoNovo[]>([]),
    [anexosExistentes, setAnexosExistentes] = useState<AnexoConta[]>(
      registro && !duplicando ? (registro.anexos ?? []) : [],
    ),
    [buscandoCep, setBuscandoCep] = useState(false),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  const subcategoriasDisponiveis = subcategorias.filter(
    (s) => s.categoriaId === Number(categoriaId),
  );
  useEffect(() => {
    Promise.all([
      listarPessoas(),
      registro
        ? Promise.resolve(null)
        : buscarPessoaSugerida().catch(() => null),
    ])
      .then(([lista, sugestao]) => {
        setPessoas(lista);
        const idsNtfy = new Set(
          lista.filter((p) => p.canalPreferencial === "NTFY").map((p) => p.id),
        );
        setPessoaIds((atuais) => {
          if (!registro && sugestao && idsNtfy.has(sugestao.id))
            return [sugestao.id];
          return atuais.filter((id) => idsNtfy.has(id));
        });
      })
      .catch((e) => setErro(e.message));
    listarCategorias()
      .then(setCategorias)
      .catch((e) => setErro(e.message));
    listarSubCategorias()
      .then(setSubcategorias)
      .catch((e) => setErro(e.message));
  }, []);
  async function buscarCep() {
    const digitos = cep.replace(/\D/g, "");
    if (!digitos) return;
    if (digitos.length !== 8) {
      setErro("Informe um CEP válido com 8 dígitos.");
      return;
    }
    setBuscandoCep(true);
    setErro("");
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`),
        dados = await resposta.json();
      if (!resposta.ok || dados.erro) throw new Error("CEP não encontrado.");
      setLogradouro(dados.logradouro ?? "");
      setBairro(dados.bairro ?? "");
      setCidade(dados.localidade ?? "");
      setUf(dados.uf ?? "");
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível consultar o CEP.",
      );
    } finally {
      setBuscandoCep(false);
    }
  }
  function selecionarSubcategoria(valor: string) {
    setSubcategoriaId(valor);
    const subcategoria = subcategorias.find(
      (item) => item.id === Number(valor),
    );
    if (subcategoria) setCategoriaId(String(subcategoria.categoriaId));
  }
  function sugerirHoraNotificacao() {
    const horario = dataHora.match(/T(\d{2}):(\d{2})/);
    if (!horario) return;
    const minutosDoDia =
      (Number(horario[1]) * 60 + Number(horario[2]) - 60 + 24 * 60) % (24 * 60);
    setHora(
      `${String(Math.floor(minutosDoDia / 60)).padStart(2, "0")}:${String(
        minutosDoDia % 60,
      ).padStart(2, "0")}`,
    );
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!pessoaIds.length) {
      setErro("Selecione ao menos uma pessoa para notificar.");
      return;
    }
    if ([...anexosExistentes, ...anexos].some((a) => !a.descricao.trim())) {
      setErro("Informe a descrição de todos os anexos.");
      return;
    }
    if (duplicando) {
      const dataNotificacao = new Date(`${dataHora.slice(0, 10)}T${hora}:00`);
      if (
        !dataHora ||
        !hora ||
        Number.isNaN(dataNotificacao.getTime()) ||
        dataNotificacao <= new Date()
      ) {
        setErro(
          "A data e hora da notificação do compromisso duplicado deve ser posterior à data e hora atual.",
        );
        return;
      }
    }
    setSalvando(true);
    try {
      const c: NovoCompromisso = {
        dataHora: new Date(dataHora).toISOString(),
        descricao,
        pessoaIds,
        categoriaId: Number(categoriaId),
        subcategoriaId: subcategoriaId ? Number(subcategoriaId) : null,
        horaNotificacao: hora + ":00",
        situacao,
        cep: cep.replace(/\D/g, ""),
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        whatsapp,
      };
      registro && !duplicando
        ? await alterarCompromisso(registro.id, c, anexos, anexosExistentes)
        : await cadastrarCompromisso(c, anexos);
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }
  function selecionarArquivos(lista: FileList | null) {
    if (!lista) return;
    const selecionados = Array.from(lista).map((arquivo) => ({
      arquivo,
      descricao: "",
    }));
    setAnexos((atuais) => [...atuais, ...selecionados]);
  }
  function adicionarWhatsapp() {
    const digitos = novoWhatsapp.replace(/\D/g, "");
    if (digitos.length !== 10 && digitos.length !== 11) {
      setErro("Informe um WhatsApp válido com DDD.");
      return;
    }
    if (!descricaoWhatsapp.trim()) {
      setErro("Informe de quem é o contato.");
      return;
    }
    const normalizado = normalizarWhatsappLink(novoWhatsapp);
    if (
      whatsapp.some(
        (item) => normalizarWhatsappLink(item.numero) === normalizado,
      )
    ) {
      setErro("Este WhatsApp já foi adicionado.");
      return;
    }
    setWhatsapp((atuais) => [
      ...atuais,
      { numero: normalizado, descricao: descricaoWhatsapp.trim() },
    ]);
    setNovoWhatsapp("");
    setDescricaoWhatsapp("");
    setErro("");
  }
  return (
    <form
      className="painel formulario-movimentacao formulario-compromisso"
      onSubmit={salvar}
    >
      <h1>
        {registro && !duplicando
          ? "Alterar compromisso"
          : registro
            ? "Duplicar compromisso"
            : "Novo compromisso"}
      </h1>
      <div className="grade-compromisso-principal">
        <label className="rotulo-campo">
          Data e horário *
          <input
            className="campo-formulario"
            type="datetime-local"
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
            onBlur={sugerirHoraNotificacao}
            required
          />
        </label>
        <label className="rotulo-campo">
          Hora da notificação
          <input
            className="campo-formulario"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            required
          />
        </label>
        <label className="rotulo-campo">
          Situação
          <select
            className="campo-formulario"
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as SituacaoCompromisso)}
          >
            <option value="PENDENTE">Pendente</option>
            <option value="RESOLVIDO">Resolvido</option>
            <option value="REAGENDADO">Reagendado</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="NOTIFICADO">Notificado</option>
          </select>
        </label>
      </div>
      <label className="rotulo-campo">
        Descrição *
        <textarea
          className="campo-formulario campo-observacoes"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={1000}
          required
        />
      </label>
      <div className="grade-notificacao-compromisso">
        <div className="rotulo-campo">
          Pessoas a notificar *
          <span className="lista-selecao-pessoas">
            {pessoas
              .filter((p) => p.canalPreferencial === "NTFY")
              .map((p) => (
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
                  <span>
                    {p.nome} <small>(ntfy)</small>
                  </span>
                </span>
              ))}
            {!pessoas.some((p) => p.canalPreferencial === "NTFY") && (
              <span className="lista-pessoas-vazia">
                Nenhuma pessoa com canal ntfy cadastrada.
              </span>
            )}
          </span>
        </div>
        <div className="grade-classificacao-compromisso">
          <label className="rotulo-campo">
            Categoria *
            <select
              className="campo-formulario"
              value={categoriaId}
              onChange={(e) => {
                setCategoriaId(e.target.value);
                setSubcategoriaId("");
              }}
              required
            >
              <option value="">Selecione</option>
              {categorias
                .filter((c) => c.tipoUtilizacao === "COMPROMISSOS")
                .map((c) => (
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
              value={subcategoriaId}
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
      {!categorias.some((c) => c.tipoUtilizacao === "COMPROMISSOS") && (
        <small className="ajuda-campo">
          Cadastre uma categoria em Ferramentas → Categorias.
        </small>
      )}
      <details className="secao-endereco-compromisso">
        <summary>
          Contato <small>(opcional)</small>
        </summary>
        <div className="conteudo-endereco-compromisso">
          <div className="rotulos-contato-compromisso">
            <label htmlFor="whatsapp-compromisso">WhatsApp</label>
            <label htmlFor="descricao-whatsapp-compromisso">
              Descrição do contato
            </label>
            <span />
          </div>
          <div className="linha-contato-compromisso">
            <input
              id="whatsapp-compromisso"
              className="campo-formulario"
              value={novoWhatsapp}
              onChange={(e) =>
                setNovoWhatsapp(formatarWhatsapp(e.target.value))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarWhatsapp();
                }
              }}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              maxLength={15}
              aria-label="WhatsApp"
            />
            <input
              id="descricao-whatsapp-compromisso"
              className="campo-formulario"
              value={descricaoWhatsapp}
              onChange={(e) =>
                setDescricaoWhatsapp(e.target.value.slice(0, 100))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarWhatsapp();
                }
              }}
              placeholder="Ex.: João, escritório"
              maxLength={100}
            />
            <button
              type="button"
              className="botao-icone-contato adicionar"
              aria-label="Adicionar WhatsApp"
              title="Adicionar WhatsApp"
              onClick={adicionarWhatsapp}
            >
              <IconeAdicionar />
            </button>
          </div>
          {!whatsapp.length && (
            <p className="lista-vazia">Nenhum contato adicionado.</p>
          )}
          <ul className="lista-contatos-compromisso">
            {whatsapp.map((contato, indice) => (
              <li key={normalizarWhatsappLink(contato.numero)}>
                <span>
                  <strong>
                    {formatarWhatsapp(contato.numero.replace(/^55/, ""))}
                  </strong>
                  <small>{contato.descricao}</small>
                </span>
                <div className="acoes-contato-compromisso">
                  <a
                    className="botao-icone-contato whatsapp"
                    aria-label={`Enviar mensagem para ${formatarWhatsapp(contato.numero.replace(/^55/, ""))}`}
                    title="Enviar mensagem"
                    href={`https://wa.me/${normalizarWhatsappLink(contato.numero)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IconeWhatsapp />
                  </a>
                  <button
                    type="button"
                    className="botao-icone-contato remover"
                    aria-label={`Remover ${formatarWhatsapp(contato.numero.replace(/^55/, ""))}`}
                    title="Remover contato"
                    onClick={() =>
                      setWhatsapp((atuais) =>
                        atuais.filter((_, i) => i !== indice),
                      )
                    }
                  >
                    <IconeRemover />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <details className="secao-endereco-compromisso">
        <summary>
          Anexos ({anexosExistentes.length + anexos.length}){" "}
          <small>(opcional)</small>
        </summary>
        <div className="conteudo-endereco-compromisso">
          <div className="cabecalho-anexos-compromisso">
            <button
              type="button"
              className="botao-selecionar-anexos"
              onClick={() => seletorAnexosRef.current?.click()}
            >
              <IconeAnexo /> Selecionar arquivos
            </button>
            <input
              ref={seletorAnexosRef}
              className="entrada-anexo-oculta"
              type="file"
              multiple
              onChange={(e) => {
                const arquivosSelecionados = e.target.files;
                selecionarArquivos(arquivosSelecionados);
                e.target.value = "";
              }}
            />
          </div>
          {!anexosExistentes.length && !anexos.length && (
            <p className="lista-vazia">Nenhum anexo selecionado.</p>
          )}
          <ul className="lista-anexos">
            {anexosExistentes.map((anexo, indice) => (
              <li key={anexo.id}>
                <div className="dados-anexo">
                  <div
                    className="identificacao-anexo"
                    title={anexo.nomeArquivo}
                  >
                    <strong>{anexo.nomeArquivo}</strong>
                    <small>{formatarTamanho(anexo.tamanho)} · Registrado</small>
                  </div>
                  <input
                    className="campo-formulario descricao-anexo"
                    placeholder="Descrição do anexo *"
                    value={anexo.descricao}
                    maxLength={255}
                    onChange={(e) =>
                      setAnexosExistentes((atuais) =>
                        atuais.map((item, i) =>
                          i === indice
                            ? { ...item, descricao: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className="acoes-anexo">
                  <button
                    type="button"
                    aria-label={`Baixar ${anexo.nomeArquivo}`}
                    title="Baixar"
                    onClick={() =>
                      registro &&
                      baixarAnexoCompromisso(registro.id, anexo).catch((e) =>
                        setErro(e.message),
                      )
                    }
                  >
                    <IconeBaixar />
                  </button>
                  <button
                    type="button"
                    className="remover-anexo"
                    aria-label={`Remover ${anexo.nomeArquivo}`}
                    title="Remover"
                    onClick={() =>
                      setAnexosExistentes((atuais) =>
                        atuais.filter((_, i) => i !== indice),
                      )
                    }
                  >
                    <IconeRemover />
                  </button>
                </div>
              </li>
            ))}
            {anexos.map((anexo, indice) => (
              <li
                key={`${anexo.arquivo.name}-${anexo.arquivo.lastModified}-${indice}`}
              >
                <div className="dados-anexo">
                  <div
                    className="identificacao-anexo"
                    title={anexo.arquivo.name}
                  >
                    <strong>{anexo.arquivo.name}</strong>
                    <small>{formatarTamanho(anexo.arquivo.size)} · Novo</small>
                  </div>
                  <input
                    className="campo-formulario descricao-anexo"
                    placeholder="Descrição do anexo *"
                    value={anexo.descricao}
                    maxLength={255}
                    onChange={(e) =>
                      setAnexos((atuais) =>
                        atuais.map((item, i) =>
                          i === indice
                            ? { ...item, descricao: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className="acoes-anexo">
                  <button
                    type="button"
                    aria-label={`Baixar ${anexo.arquivo.name}`}
                    title="Baixar"
                    onClick={() => baixarArquivoLocal(anexo.arquivo)}
                  >
                    <IconeBaixar />
                  </button>
                  <button
                    type="button"
                    className="remover-anexo"
                    aria-label={`Remover ${anexo.arquivo.name}`}
                    title="Remover"
                    onClick={() =>
                      setAnexos((atuais) =>
                        atuais.filter((_, i) => i !== indice),
                      )
                    }
                  >
                    <IconeRemover />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <details
        className="secao-endereco-compromisso"
        open={Boolean(registro?.cep || registro?.logradouro)}
      >
        <summary>
          Endereço do compromisso <small>(opcional)</small>
        </summary>
        <div className="conteudo-endereco-compromisso">
          <div className="grade-baixa">
            <label className="rotulo-campo">
              CEP
              <input
                className="campo-formulario"
                value={formatarCep(cep)}
                onChange={(e) =>
                  setCep(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                onBlur={buscarCep}
                inputMode="numeric"
                placeholder="00000-000"
              />
            </label>
            <label className="rotulo-campo">
              Número
              <input
                className="campo-formulario"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                maxLength={20}
              />
            </label>
          </div>
          {buscandoCep && (
            <small className="ajuda-campo">Consultando CEP...</small>
          )}
          <label className="rotulo-campo">
            Logradouro
            <input
              className="campo-formulario"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              maxLength={150}
            />
          </label>
          <div className="grade-baixa">
            <label className="rotulo-campo">
              Bairro
              <input
                className="campo-formulario"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                maxLength={100}
              />
            </label>
            <label className="rotulo-campo">
              Complemento
              <input
                className="campo-formulario"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                maxLength={100}
              />
            </label>
          </div>
          <div className="grade-baixa">
            <label className="rotulo-campo">
              Cidade
              <input
                className="campo-formulario"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                maxLength={100}
              />
            </label>
            <label className="rotulo-campo">
              UF
              <input
                className="campo-formulario"
                value={uf}
                onChange={(e) =>
                  setUf(e.target.value.toUpperCase().slice(0, 2))
                }
                maxLength={2}
              />
            </label>
          </div>
        </div>
      </details>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="acoes-formulario">
        <button className="botao-primario" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" className="botao-secundario" onClick={aoCancelar}>
          Voltar
        </button>
      </div>
    </form>
  );
}

function formatarCep(valor: string) {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function normalizarWhatsappLink(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length === 10 || digitos.length === 11
    ? `55${digitos}`
    : digitos;
}

function formatarWhatsapp(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos.length ? `(${digitos}` : "";
  const ddd = digitos.slice(0, 2),
    numero = digitos.slice(2);
  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  const corte = numero.length === 9 ? 5 : 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function IconeAdicionar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconeWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" />
      <path d="M9 8.5c.5 2.8 2.2 4.5 5 5l1-1.2c.3-.3.7-.4 1-.2l1.5.7" />
    </svg>
  );
}
function IconeRemover() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}
function IconeAnexo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m20 11-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />
    </svg>
  );
}
function IconeBaixar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}
