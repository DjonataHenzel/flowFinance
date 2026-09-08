import { FormEvent, useEffect, useState } from "react";
import {
  alterarCategoria,
  cadastrarCategoria,
  excluirCategoria,
  listarCategorias,
} from "../../api";
import type { Categoria, Funcionalidade } from "../../api";

export default function ViewCategorias({
  funcionalidades,
}: {
  funcionalidades: Funcionalidade[];
}) {
  const [lista, setLista] = useState<Categoria[]>([]),
    [edicao, setEdicao] = useState<Categoria | null>(null),
    [novo, setNovo] = useState(false),
    [erro, setErro] = useState(""),
    [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(
      null,
    );
  const tem = (f: Funcionalidade) => funcionalidades.includes(f);
  async function carregar() {
    try {
      setLista(await listarCategorias());
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar categorias.");
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
    const c = menu && lista.find((item) => item.id === menu.id);
    if (!c) return;
    const mensagem =
      c.quantidadeSubcategorias > 0
        ? `A categoria "${c.nome}" possui ${c.quantidadeSubcategorias} subcategoria(s). Ao excluir, as subcategorias vinculadas também serão removidas. Deseja continuar?`
        : `Excluir a categoria "${c.nome}"?`;
    if (!confirm(mensagem)) return;
    try {
      await excluirCategoria(c.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir categoria.");
    }
  }
  return (
    <section className="painel">
      <div className="cabecalho-listagem">
        <div>
          <h1>Categorias</h1>
          <p className="subtitulo">
            Organize suas movimentações financeiras por categoria.
          </p>
        </div>
        {tem("CADASTRAR_CATEGORIAS") && (
          <button className="botao-adicionar" onClick={() => setNovo(true)}>
            + Nova categoria
          </button>
        )}
      </div>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="tabela-responsiva">
        <table className="tabela-usuarios">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Movimentações</th>
              <th>Subcategorias</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr
                key={c.id}
                onDoubleClick={() => tem("ALTERAR_CATEGORIAS") && setEdicao(c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id: c.id, x: e.clientX, y: e.clientY });
                }}
              >
                <td>{c.nome}</td>
                <td>{c.descricao ?? "—"}</td>
                <td>{c.quantidadeMovimentacoes}</td>
                <td>{c.quantidadeSubcategorias}</td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={4} className="lista-vazia">
                  Nenhuma categoria cadastrada.
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
            {tem("EXCLUIR_CATEGORIAS") && (
              <button className="acao-perigosa" onClick={excluir}>
                Excluir categoria
              </button>
            )}
          </div>
        </>
      )}
      {tem("ALTERAR_CATEGORIAS") && (
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
  registro?: Categoria;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(registro?.nome ?? ""),
    [descricao, setDescricao] = useState(registro?.descricao ?? ""),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      registro
        ? await alterarCategoria(registro.id, nome, descricao)
        : await cadastrarCategoria(nome, descricao);
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar categoria.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form className="painel formulario-movimentacao" onSubmit={salvar}>
      <h1>{registro ? "Alterar categoria" : "Nova categoria"}</h1>
      <label className="rotulo-campo">Nome *</label>
      <input
        className="campo-formulario"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={100}
        required
      />
      <label className="rotulo-campo">Descrição</label>
      <textarea
        className="campo-formulario"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        maxLength={255}
        rows={4}
      />
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
