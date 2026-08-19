import { useEffect, useState } from "react";
import { excluirPessoa, listarPessoas } from "../api";
import type { PessoaResumo } from "../api";
import Pessoa from "./Pessoa";
function formatarCpf(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9)
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}
export default function ViewPessoa() {
  const [lista, setLista] = useState<PessoaResumo[]>([]),
    [edicao, setEdicao] = useState<number | null | undefined>(undefined),
    [erro, setErro] = useState(""),
    [nomeFiltro, setNomeFiltro] = useState(""),
    [cpfFiltro, setCpfFiltro] = useState(""),
    [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(
      null,
    );
  async function carregar() {
    try {
      setLista(await listarPessoas());
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar pessoas.");
    }
  }
  useEffect(() => {
    carregar();
  }, []);
  if (edicao !== undefined)
    return (
      <Pessoa
        id={edicao}
        aoSalvar={() => {
          setEdicao(undefined);
          carregar();
        }}
        aoCancelar={() => setEdicao(undefined)}
      />
    );
  const filtradas = lista.filter(
    (p) =>
      (!nomeFiltro ||
        p.nome
          .toLocaleLowerCase("pt-BR")
          .includes(nomeFiltro.toLocaleLowerCase("pt-BR"))) &&
      (!cpfFiltro || (p.cpf ?? "").includes(cpfFiltro.replace(/\D/g, ""))),
  );
  async function excluir() {
    if (!menu || !confirm("Deseja excluir definitivamente esta pessoa?"))
      return;
    try {
      await excluirPessoa(menu.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir pessoa.");
    }
  }
  return (
    <section className="painel">
      <div className="cabecalho-listagem">
        <div>
          <h1>Pessoas</h1>
          <p className="subtitulo">Cadastros e canais de notificação.</p>
        </div>
        <button className="botao-adicionar" onClick={() => setEdicao(null)}>
          + Nova pessoa
        </button>
      </div>
      <div className="filtros-contas filtros-pessoas">
        <label className="rotulo-campo">
          Nome
          <input
            className="campo-formulario"
            value={nomeFiltro}
            placeholder="Buscar nome"
            onChange={(e) => setNomeFiltro(e.target.value)}
          />
        </label>
        <label className="rotulo-campo">
          CPF
          <input
            className="campo-formulario"
            value={formatarCpf(cpfFiltro)}
            placeholder="Buscar CPF"
            onChange={(e) =>
              setCpfFiltro(e.target.value.replace(/\D/g, "").slice(0, 11))
            }
            inputMode="numeric"
            maxLength={14}
          />
        </label>
        <button
          className="botao-limpar-filtros"
          type="button"
          onClick={() => {
            setNomeFiltro("");
            setCpfFiltro("");
          }}
        >
          Limpar filtros
        </button>
      </div>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="tabela-responsiva">
        <table className="tabela-usuarios">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Cidade</th>
              <th>Canal</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((p) => (
              <tr
                key={p.id}
                onDoubleClick={() => setEdicao(p.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id: p.id, x: e.clientX, y: e.clientY });
                }}
              >
                <td>{p.nome}</td>
                <td>{p.cpf ? formatarCpf(p.cpf) : "Não informado"}</td>
                <td>{p.cidade ? `${p.cidade}/${p.uf}` : "—"}</td>
                <td>{p.canalPreferencial === "NTFY" ? "ntfy" : "WhatsApp"}</td>
              </tr>
            ))}
            {!filtradas.length && (
              <tr>
                <td colSpan={4} className="lista-vazia">
                  Nenhuma pessoa cadastrada.
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
            <button className="acao-perigosa" onClick={excluir}>
              Excluir pessoa
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
