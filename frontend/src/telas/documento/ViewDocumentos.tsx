import { useEffect, useRef, useState } from "react";
import {
  alterarDocumento,
  baixarAnexoDocumento,
  cadastrarDocumento,
  excluirDocumento,
  listarDocumentos,
  listarPessoasDocumento,
} from "../../api";
import type {
  AnexoDocumento,
  DocumentoResumo,
  Funcionalidade,
  NovoAnexoDocumento,
  PessoaDocumento,
  TipoDocumento,
} from "../../api";

const tiposDocumento: { valor: TipoDocumento; rotulo: string }[] = [
  { valor: "PESSOAIS", rotulo: "Pessoais" },
  { valor: "RECEITAS", rotulo: "Receitas" },
  { valor: "EXAMES", rotulo: "Exames" },
];

function rotuloTipo(tipo: TipoDocumento) {
  return tiposDocumento.find((item) => item.valor === tipo)?.rotulo ?? tipo;
}

function formatarTamanho(tamanho: number) {
  if (tamanho < 1024) return `${tamanho} B`;
  if (tamanho < 1024 * 1024) return `${(tamanho / 1024).toFixed(1)} KB`;
  return `${(tamanho / (1024 * 1024)).toFixed(1)} MB`;
}

function IconeDownload() {
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

export default function ViewDocumentos({
  funcionalidades,
}: {
  funcionalidades: Funcionalidade[];
}) {
  const pode = (funcionalidade: Funcionalidade) =>
    funcionalidades.includes(funcionalidade);
  const [documentos, setDocumentos] = useState<DocumentoResumo[]>([]);
  const [pessoas, setPessoas] = useState<PessoaDocumento[]>([]);
  const [edicao, setEdicao] = useState<number | null | undefined>(undefined);
  const [nome, setNome] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [anexosExistentes, setAnexosExistentes] = useState<AnexoDocumento[]>(
    [],
  );
  const [novosAnexos, setNovosAnexos] = useState<NovoAnexoDocumento[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState<number | null>(null);
  const [menu, setMenu] = useState<{
    documento: DocumentoResumo;
    x: number;
    y: number;
  } | null>(null);
  const seletorAnexosRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    try {
      const [listaDocumentos, listaPessoas] = await Promise.all([
        listarDocumentos(),
        listarPessoasDocumento(),
      ]);
      setDocumentos(listaDocumentos);
      setPessoas(listaPessoas);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar documentos.");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function iniciarCadastro() {
    setNome("");
    setPessoaId("");
    setAnexosExistentes([]);
    setNovosAnexos([]);
    setErro("");
    setEdicao(null);
  }

  function iniciarEdicao(documento: DocumentoResumo) {
    setNome(documento.nome);
    setPessoaId(String(documento.pessoaId));
    setAnexosExistentes(documento.anexos);
    setNovosAnexos([]);
    setErro("");
    setEdicao(documento.id);
  }

  async function salvar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const dados = { nome: nome.trim(), pessoaId: Number(pessoaId) };
      if (edicao === null) await cadastrarDocumento(dados, novosAnexos);
      else if (edicao !== undefined)
        await alterarDocumento(
          edicao,
          dados,
          novosAnexos,
          anexosExistentes,
        );
      setEdicao(undefined);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar documento.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(documento: DocumentoResumo) {
    if (!confirm(`Excluir "${documento.nome}" e todos os seus anexos?`)) return;
    try {
      await excluirDocumento(documento.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir documento.");
    }
  }

  async function baixar(documento: DocumentoResumo, anexo: AnexoDocumento) {
    setBaixando(anexo.id);
    setErro("");
    try {
      await baixarAnexoDocumento(documento.id, anexo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao baixar anexo.");
    } finally {
      setBaixando(null);
    }
  }

  function adicionarArquivos(arquivos: FileList | null) {
    if (!arquivos) return;
    const selecionados = Array.from(arquivos, (arquivo) => ({
      arquivo,
      descricao: arquivo.name.replace(/\.[^.]+$/, ""),
      tipo: "PESSOAIS" as TipoDocumento,
    }));
    setNovosAnexos((atuais) => [...atuais, ...selecionados]);
  }

  if (edicao !== undefined)
    return (
      <form
        className="painel formulario-compromisso formulario-documento"
        onSubmit={salvar}
      >
        <h1>{edicao === null ? "Novo documento" : "Alterar documento"}</h1>
        <p className="subtitulo">
          Vincule o documento a uma pessoa e organize cada arquivo por tipo.
        </p>
        {erro && <p className="mensagem-erro">{erro}</p>}
          <label className="rotulo-campo">
            Nome do documento
            <input
              className="campo-formulario"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              maxLength={150}
              required
            />
          </label>
          <label className="rotulo-campo">
            Pessoa vinculada
            <select
              className="campo-formulario"
              value={pessoaId}
              onChange={(evento) => setPessoaId(evento.target.value)}
              required
            >
              <option value="">Selecione uma pessoa</option>
              {pessoas.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </label>
          <details className="secao-endereco-compromisso" open>
            <summary>
              Anexos ({anexosExistentes.length + novosAnexos.length}){" "}
              <small>(opcional)</small>
            </summary>
            <div className="conteudo-endereco-compromisso">
              <div className="cabecalho-anexos-compromisso">
                <button
                  type="button"
                  className="botao-selecionar-anexos"
                  onClick={() => seletorAnexosRef.current?.click()}
                >
                  Selecionar arquivos
                </button>
                <input
                  ref={seletorAnexosRef}
                  className="entrada-anexo-oculta"
                  type="file"
                  multiple
                  onChange={(evento) => {
                    const arquivos = evento.target.files;
                    adicionarArquivos(arquivos);
                    evento.target.value = "";
                  }}
                />
              </div>
              {!anexosExistentes.length && !novosAnexos.length && (
                <p className="lista-vazia">Nenhum anexo selecionado.</p>
              )}
              <ul className="lista-anexos lista-anexos-documento">
                {anexosExistentes.map((anexo) => (
                  <li key={`existente-${anexo.id}`}>
                    <div className="dados-anexo">
                      <div className="identificacao-anexo">
                        <strong>{anexo.nomeArquivo}</strong>
                        <small>{formatarTamanho(anexo.tamanho)} · Registrado</small>
                      </div>
                      <input
                        className="campo-formulario descricao-anexo"
                        aria-label={`Descrição de ${anexo.nomeArquivo}`}
                        value={anexo.descricao}
                        maxLength={255}
                        onChange={(evento) =>
                          setAnexosExistentes((atuais) =>
                            atuais.map((item) =>
                              item.id === anexo.id
                                ? { ...item, descricao: evento.target.value }
                                : item,
                            ),
                          )
                        }
                        required
                      />
                      <select
                        className="campo-formulario tipo-anexo-documento"
                        aria-label={`Tipo de ${anexo.nomeArquivo}`}
                        value={anexo.tipo}
                        onChange={(evento) =>
                          setAnexosExistentes((atuais) =>
                            atuais.map((item) =>
                              item.id === anexo.id
                                ? {
                                    ...item,
                                    tipo: evento.target.value as TipoDocumento,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {tiposDocumento.map((tipo) => (
                          <option key={tipo.valor} value={tipo.valor}>
                            {tipo.rotulo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="acoes-anexo">
                      <button
                        type="button"
                        className="botao-remover-anexo-documento"
                        aria-label={`Remover ${anexo.nomeArquivo}`}
                        onClick={() =>
                          setAnexosExistentes((atuais) =>
                            atuais.filter((item) => item.id !== anexo.id),
                          )
                        }
                      >
                        <IconeRemover />
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
                {novosAnexos.map((anexo, indice) => (
                  <li key={`novo-${indice}`}>
                    <div className="dados-anexo">
                      <div
                        className="identificacao-anexo"
                        title={anexo.arquivo.name}
                      >
                        <strong>{anexo.arquivo.name}</strong>
                        <small>
                          {formatarTamanho(anexo.arquivo.size)} · Novo
                        </small>
                      </div>
                      <input
                        className="campo-formulario descricao-anexo"
                        aria-label={`Descrição de ${anexo.arquivo.name}`}
                        value={anexo.descricao}
                        maxLength={255}
                        onChange={(evento) =>
                          setNovosAnexos((atuais) =>
                            atuais.map((item, itemIndice) =>
                              itemIndice === indice
                                ? { ...item, descricao: evento.target.value }
                                : item,
                            ),
                          )
                        }
                        required
                      />
                      <select
                        className="campo-formulario tipo-anexo-documento"
                        aria-label={`Tipo de ${anexo.arquivo.name}`}
                        value={anexo.tipo}
                        onChange={(evento) =>
                          setNovosAnexos((atuais) =>
                            atuais.map((item, itemIndice) =>
                              itemIndice === indice
                                ? {
                                    ...item,
                                    tipo: evento.target.value as TipoDocumento,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {tiposDocumento.map((tipo) => (
                          <option key={tipo.valor} value={tipo.valor}>
                            {tipo.rotulo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="acoes-anexo">
                      <button
                        type="button"
                        className="botao-remover-anexo-documento"
                        aria-label={`Remover ${anexo.arquivo.name}`}
                        onClick={() =>
                          setNovosAnexos((atuais) =>
                            atuais.filter(
                              (_, itemIndice) => itemIndice !== indice,
                            ),
                          )
                        }
                      >
                        <IconeRemover />
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </details>
          <div className="acoes-formulario">
            <button className="botao-primario" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar documento"}
            </button>
            <button
              className="botao-secundario"
              type="button"
              onClick={() => setEdicao(undefined)}
            >
              Cancelar
            </button>
          </div>
      </form>
    );

  return (
    <section className="painel">
      <div className="cabecalho-listagem">
        <div>
          <h1>Documentos</h1>
          <p className="subtitulo">
            Acesse documentos pessoais, receitas e exames vinculados a pessoas.
          </p>
        </div>
        {pode("CADASTRAR_DOCUMENTOS") && (
          <button className="botao-adicionar" onClick={iniciarCadastro}>
            + Novo documento
          </button>
        )}
      </div>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="lista-documentos">
        {documentos.map((documento) => (
          <article
            className="cartao-documento"
            key={documento.id}
            onDoubleClick={() => {
              if (pode("ALTERAR_DOCUMENTOS")) iniciarEdicao(documento);
            }}
            onContextMenu={(evento) => {
              if (!pode("EXCLUIR_DOCUMENTOS")) return;
              evento.preventDefault();
              setMenu({
                documento,
                x: Math.max(
                  8,
                  Math.min(evento.clientX, window.innerWidth - 200),
                ),
                y: Math.max(
                  8,
                  Math.min(evento.clientY, window.innerHeight - 90),
                ),
              });
            }}
          >
            <header>
              <div>
                <h2>{documento.nome}</h2>
                <p>
                  {documento.pessoa} ·{" "}
                  {new Date(documento.criadoEm).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </header>
            {documento.anexos.length ? (
              <ul className="lista-arquivos-documento">
                {documento.anexos.map((anexo) => (
                  <li key={anexo.id}>
                    <div>
                      <strong>{anexo.descricao}</strong>
                      <span>
                        {rotuloTipo(anexo.tipo)} · {anexo.nomeArquivo} ·{" "}
                        {formatarTamanho(anexo.tamanho)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="botao-download-documento"
                      disabled={baixando === anexo.id}
                      onClick={() => baixar(documento, anexo)}
                      onDoubleClick={(evento) => evento.stopPropagation()}
                    >
                      <IconeDownload />
                      {baixando === anexo.id ? "Baixando..." : "Baixar"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lista-vazia">Nenhum anexo neste documento.</p>
            )}
          </article>
        ))}
        {!documentos.length && !erro && (
          <p className="lista-vazia">Nenhum documento cadastrado.</p>
        )}
      </div>
      {menu && (
        <>
          <button
            type="button"
            className="fechar-menu-contexto"
            aria-label="Fechar menu do documento"
            onClick={() => setMenu(null)}
          />
          <div
            className="menu-contexto"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              type="button"
              className="acao-perigosa"
              onClick={() => excluir(menu.documento)}
            >
              Excluir documento
            </button>
          </div>
        </>
      )}
      <small className="ajuda-campo">
        Use dois cliques para alterar ou o botão direito para excluir.
      </small>
    </section>
  );
}
