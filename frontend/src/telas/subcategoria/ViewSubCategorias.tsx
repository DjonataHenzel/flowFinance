import { FormEvent, useEffect, useState } from "react";
import {
  alterarSubCategoria,
  cadastrarSubCategoria,
  excluirSubCategoria,
  listarCategoriasSubCategoria,
  listarSubCategorias,
} from "../../api";
import type {
  CategoriaSubCategoria,
  Funcionalidade,
  SubCategoria,
} from "../../api";

export default function ViewSubCategorias({
  funcionalidades,
}: {
  funcionalidades: Funcionalidade[];
}) {
  const [lista, setLista] = useState<SubCategoria[]>([]),
    [edicao, setEdicao] = useState<SubCategoria | null>(null),
    [novo, setNovo] = useState(false),
    [erro, setErro] = useState(""),
    [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(
      null,
    );
  const tem = (f: Funcionalidade) => funcionalidades.includes(f);

  async function carregar() {
    try {
      setLista(await listarSubCategorias());
      setErro("");
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Erro ao carregar subcategorias.",
      );
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  if (novo || edicao)
    return (
      <Formulario
        registro={edicao ?? undefined}
        aoCancelar={() => {
          setNovo(false);
          setEdicao(null);
        }}
        aoSalvar={() => {
          setNovo(false);
          setEdicao(null);
          carregar();
        }}
      />
    );

  async function excluir() {
    const subcategoria = menu && lista.find((item) => item.id === menu.id);
    if (
      !subcategoria ||
      !confirm(`Excluir a subcategoria "${subcategoria.nome}"?`)
    )
      return;
    try {
      await excluirSubCategoria(subcategoria.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir subcategoria.");
    }
  }

  return (
    <section className="painel">
      <div className="cabecalho-listagem">
        <div>
          <h1>Subcategorias</h1>
          <p className="subtitulo">
            Detalhe suas movimentações e compromissos dentro de cada categoria.
          </p>
        </div>
        {tem("CADASTRAR_SUBCATEGORIAS") && (
          <button className="botao-adicionar" onClick={() => setNovo(true)}>
            + Nova subcategoria
          </button>
        )}
      </div>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="tabela-responsiva">
        <table className="tabela-usuarios">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Movimentações</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {lista.map((subcategoria) => (
              <tr
                key={subcategoria.id}
                onDoubleClick={() =>
                  tem("ALTERAR_SUBCATEGORIAS") && setEdicao(subcategoria)
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id: subcategoria.id, x: e.clientX, y: e.clientY });
                }}
              >
                <td>{subcategoria.nome}</td>
                <td>{subcategoria.categoria}</td>
                <td className="celula-texto-longo">
                  {subcategoria.descricao ?? "—"}
                </td>
                <td>{subcategoria.quantidadeMovimentacoes}</td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={4} className="lista-vazia">
                  Nenhuma subcategoria cadastrada.
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
            aria-label="Fechar menu"
            onClick={() => setMenu(null)}
          />
          <div className="menu-contexto" style={{ left: menu.x, top: menu.y }}>
            {tem("EXCLUIR_SUBCATEGORIAS") && (
              <button className="acao-perigosa" onClick={excluir}>
                Excluir subcategoria
              </button>
            )}
          </div>
        </>
      )}
      {tem("ALTERAR_SUBCATEGORIAS") && (
        <small className="ajuda-campo">
          Use dois cliques para alterar ou o botão direito para excluir.
        </small>
      )}
    </section>
  );
}

function Formulario({
  registro,
  aoSalvar,
  aoCancelar,
}: {
  registro?: SubCategoria;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(registro?.nome ?? ""),
    [descricao, setDescricao] = useState(registro?.descricao ?? ""),
    [categoriaId, setCategoriaId] = useState(
      registro ? String(registro.categoriaId) : "",
    ),
    [categorias, setCategorias] = useState<CategoriaSubCategoria[]>([]),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarCategoriasSubCategoria()
      .then(setCategorias)
      .catch((e) =>
        setErro(
          e instanceof Error ? e.message : "Erro ao carregar categorias.",
        ),
      );
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      registro
        ? await alterarSubCategoria(
            registro.id,
            nome,
            descricao,
            Number(categoriaId),
          )
        : await cadastrarSubCategoria(nome, descricao, Number(categoriaId));
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar subcategoria.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="painel formulario-movimentacao" onSubmit={salvar}>
      <h1>{registro ? "Alterar subcategoria" : "Nova subcategoria"}</h1>
      <label className="rotulo-campo">
        Nome *
        <input
          className="campo-formulario"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={100}
          required
        />
      </label>
      <label className="rotulo-campo">
        Categoria *
        <select
          className="campo-formulario"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          required
        >
          <option value="">Selecione uma categoria</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      </label>
      {!categorias.length && (
        <small className="ajuda-campo">
          Cadastre uma categoria em Ferramentas → Categorias antes de criar a
          subcategoria.
        </small>
      )}
      <label className="rotulo-campo">
        Descrição
        <textarea
          className="campo-formulario"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={255}
          rows={4}
        />
      </label>
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
