import { FormEvent, useEffect, useState } from "react";
import { alterarPapel, cadastrarPapel, listarFuncionalidades } from "../../api";
import type { Funcionalidade, PapelDetalhe } from "../../api";

const rotulos: Record<Funcionalidade, string> = {
  PERFIL_CONVIDADO: "Perfil Convidado — somente navegação, sem dados",
  VISUALIZAR_DASHBOARD: "Visualizar dashboard",
  CONSULTAR_CONTAS: "Consultar",
  CADASTRAR_CONTAS: "Cadastrar",
  ALTERAR_CONTAS: "Alterar",
  BAIXAR_RECEBER_CONTAS: "Baixar ou receber",
  ESTORNAR_BAIXAS: "Estornar baixa",
  DUPLICAR_CONTAS: "Duplicar",
  EXCLUIR_CONTAS: "Excluir",
  CONSULTAR_CONTAS_BANCARIAS: "Consultar",
  CADASTRAR_CONTAS_BANCARIAS: "Cadastrar",
  ALTERAR_CONTAS_BANCARIAS: "Alterar",
  EXCLUIR_CONTAS_BANCARIAS: "Excluir",
  CONSULTAR_CATEGORIAS: "Consultar",
  CADASTRAR_CATEGORIAS: "Cadastrar",
  ALTERAR_CATEGORIAS: "Alterar",
  EXCLUIR_CATEGORIAS: "Excluir",
  CONSULTAR_SUBCATEGORIAS: "Consultar",
  CADASTRAR_SUBCATEGORIAS: "Cadastrar",
  ALTERAR_SUBCATEGORIAS: "Alterar",
  EXCLUIR_SUBCATEGORIAS: "Excluir",
  CONSULTAR_USUARIOS: "Consultar",
  CADASTRAR_USUARIOS: "Cadastrar",
  ALTERAR_USUARIOS: "Alterar",
  EXCLUIR_USUARIOS: "Excluir",
  GERENCIAR_PERMISSOES: "Gerenciar",
  CONSULTAR_PESSOAS: "Consultar",
  CADASTRAR_PESSOAS: "Cadastrar",
  ALTERAR_PESSOAS: "Alterar",
  EXCLUIR_PESSOAS: "Excluir",
  CONSULTAR_COMPROMISSOS: "Consultar",
  CADASTRAR_COMPROMISSOS: "Cadastrar",
  ALTERAR_COMPROMISSOS: "Alterar",
  EXCLUIR_COMPROMISSOS: "Excluir",
  CONSULTAR_DOCUMENTOS: "Consultar",
  CADASTRAR_DOCUMENTOS: "Cadastrar",
  ALTERAR_DOCUMENTOS: "Alterar",
  EXCLUIR_DOCUMENTOS: "Excluir",
};
const grupos: { titulo: string; funcoes: Funcionalidade[] }[] = [
  {
    titulo: "Contas",
    funcoes: [
      "VISUALIZAR_DASHBOARD",
      "CONSULTAR_CONTAS",
      "CADASTRAR_CONTAS",
      "ALTERAR_CONTAS",
      "BAIXAR_RECEBER_CONTAS",
      "ESTORNAR_BAIXAS",
      "DUPLICAR_CONTAS",
      "EXCLUIR_CONTAS",
    ],
  },
  {
    titulo: "Contas bancárias",
    funcoes: [
      "CONSULTAR_CONTAS_BANCARIAS",
      "CADASTRAR_CONTAS_BANCARIAS",
      "ALTERAR_CONTAS_BANCARIAS",
      "EXCLUIR_CONTAS_BANCARIAS",
    ],
  },
  {
    titulo: "Categorias",
    funcoes: [
      "CONSULTAR_CATEGORIAS",
      "CADASTRAR_CATEGORIAS",
      "ALTERAR_CATEGORIAS",
      "EXCLUIR_CATEGORIAS",
    ],
  },
  {
    titulo: "Subcategorias",
    funcoes: [
      "CONSULTAR_SUBCATEGORIAS",
      "CADASTRAR_SUBCATEGORIAS",
      "ALTERAR_SUBCATEGORIAS",
      "EXCLUIR_SUBCATEGORIAS",
    ],
  },
  {
    titulo: "Usuários",
    funcoes: [
      "CONSULTAR_USUARIOS",
      "CADASTRAR_USUARIOS",
      "ALTERAR_USUARIOS",
      "EXCLUIR_USUARIOS",
    ],
  },
  {
    titulo: "Pessoas",
    funcoes: [
      "CONSULTAR_PESSOAS",
      "CADASTRAR_PESSOAS",
      "ALTERAR_PESSOAS",
      "EXCLUIR_PESSOAS",
    ],
  },
  {
    titulo: "Agenda",
    funcoes: [
      "CONSULTAR_COMPROMISSOS",
      "CADASTRAR_COMPROMISSOS",
      "ALTERAR_COMPROMISSOS",
      "EXCLUIR_COMPROMISSOS",
    ],
  },
  {
    titulo: "Documentos",
    funcoes: [
      "CONSULTAR_DOCUMENTOS",
      "CADASTRAR_DOCUMENTOS",
      "ALTERAR_DOCUMENTOS",
      "EXCLUIR_DOCUMENTOS",
    ],
  },
  { titulo: "Permissões", funcoes: ["GERENCIAR_PERMISSOES"] },
];

export default function Permissao({
  registro,
  aoSalvar,
  aoCancelar,
}: {
  registro?: PapelDetalhe;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(registro?.nome ?? ""),
    [descricao, setDescricao] = useState(registro?.descricao ?? ""),
    [ativo, setAtivo] = useState(registro?.ativo ?? true);
  const [disponiveis, setDisponiveis] = useState<Funcionalidade[]>([]),
    [habilitadas, setHabilitadas] = useState<Set<Funcionalidade>>(
      new Set(registro?.funcionalidades ?? []),
    ),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  useEffect(() => {
    listarFuncionalidades()
      .then((lista) => {
        setDisponiveis(lista);
        if (!registro)
          setHabilitadas(
            new Set(lista.filter((f) => f !== "PERFIL_CONVIDADO")),
          );
      })
      .catch((e) => setErro(e.message));
  }, [registro]);
  const funcoesNormais = disponiveis.filter((f) => f !== "PERFIL_CONVIDADO");
  const convidado = habilitadas.has("PERFIL_CONVIDADO");
  const todas =
    funcoesNormais.length > 0 &&
    funcoesNormais.every((f) => habilitadas.has(f));
  const habilitadasNormais = funcoesNormais.filter((f) =>
    habilitadas.has(f),
  ).length;
  const configuradas = new Set(grupos.flatMap((grupo) => grupo.funcoes));
  const outras = disponiveis.filter(
    (f) => f !== "PERFIL_CONVIDADO" && !configuradas.has(f),
  );
  const gruposExibidos = outras.length
    ? [...grupos, { titulo: "Outras funções", funcoes: outras }]
    : grupos;
  function alternar(f: Funcionalidade) {
    setHabilitadas((atuais) => {
      const novas = new Set(atuais);
      if (f === "PERFIL_CONVIDADO") {
        if (novas.has(f)) novas.delete(f);
        else {
          novas.clear();
          novas.add(f);
        }
      } else {
        novas.has(f) ? novas.delete(f) : novas.add(f);
        novas.delete("PERFIL_CONVIDADO");
      }
      return novas;
    });
  }
  function alternarGrupo(funcoes: Funcionalidade[], habilitar: boolean) {
    setHabilitadas((atuais) => {
      const novas = new Set(atuais);
      funcoes.forEach((f) => {
        if (habilitar) novas.add(f);
        else novas.delete(f);
      });
      if (habilitar) novas.delete("PERFIL_CONVIDADO");
      return novas;
    });
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const funcoes = convidado
        ? ["PERFIL_CONVIDADO" as const]
        : [...habilitadas];
      registro
        ? await alterarPapel(registro.id, nome, descricao, ativo, funcoes)
        : await cadastrarPapel(nome, descricao, ativo, funcoes);
      aoSalvar();
    } catch (f) {
      setErro(f instanceof Error ? f.message : "Erro ao salvar a permissão.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form className="painel formulario-permissao" onSubmit={salvar}>
      <h1>{registro ? "Alterar permissão" : "Cadastrar permissão"}</h1>
      <p className="subtitulo">
        Defina a permissão e as funções que poderão ser utilizadas no sistema.
      </p>
      <section className="grupo-funcao">
        <h3>Perfil de acesso</h3>
        <label
          className={`item-funcao ${convidado ? "funcao-habilitada" : ""}`}
        >
          <input
            type="checkbox"
            checked={convidado}
            onChange={() => alternar("PERFIL_CONVIDADO")}
          />
          <span>{rotulos.PERFIL_CONVIDADO}</span>
        </label>
        <small>
          Ao ativar este perfil, as demais funções são desmarcadas. Ativar outra
          função desativa o perfil Convidado.
        </small>
      </section>
      <div className="grade-dados-papel">
        <label className="rotulo-campo">
          Nome da permissão *
          <input
            className="campo-formulario"
            value={nome}
            maxLength={100}
            required
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <label className="rotulo-campo">
          Descrição
          <input
            className="campo-formulario"
            value={descricao}
            maxLength={255}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </label>
        <label className="rotulo-campo">
          Situação
          <select
            className="campo-formulario"
            value={ativo ? "ATIVO" : "INATIVO"}
            onChange={(e) => setAtivo(e.target.value === "ATIVO")}
          >
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </label>
      </div>
      <section className="secao-funcoes">
        <div className="cabecalho-funcoes">
          <div>
            <h2>Funções do sistema</h2>
            <small>
              {habilitadasNormais} de {funcoesNormais.length} habilitadas
            </small>
          </div>
          <label className="alternar-todas">
            <input
              type="checkbox"
              checked={todas}
              onChange={(e) =>
                setHabilitadas(new Set(e.target.checked ? funcoesNormais : []))
              }
            />{" "}
            Habilitar todas
          </label>
        </div>
        <div className="grupos-funcoes">
          {gruposExibidos.map((grupo) => {
            const funcoes = grupo.funcoes.filter((f) =>
              disponiveis.includes(f),
            );
            if (!funcoes.length) return null;
            const grupoCompleto = funcoes.every((f) => habilitadas.has(f));
            return (
              <section
                className={`grupo-funcao ${grupo.titulo === "Contas" ? "grupo-funcao-amplo" : ""}`}
                key={grupo.titulo}
              >
                <div className="titulo-grupo-funcao">
                  <h3>{grupo.titulo}</h3>
                  <label
                    title={`Habilitar todas as funções de ${grupo.titulo}`}
                  >
                    <input
                      type="checkbox"
                      checked={grupoCompleto}
                      onChange={(e) => alternarGrupo(funcoes, e.target.checked)}
                    />
                    <span>
                      {funcoes.filter((f) => habilitadas.has(f)).length}/
                      {funcoes.length}
                    </span>
                  </label>
                </div>
                <div className="grade-funcoes">
                  {funcoes.map((f) => (
                    <label
                      className={`item-funcao ${habilitadas.has(f) ? "funcao-habilitada" : ""}`}
                      key={f}
                    >
                      <input
                        type="checkbox"
                        checked={habilitadas.has(f)}
                        onChange={() => alternar(f)}
                      />
                      <span>{rotulos[f]}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="acoes-formulario">
        <button
          type="submit"
          className="botao-primario botao-ajustado"
          disabled={salvando}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button className="botao-secundario" type="button" onClick={aoCancelar}>
          Voltar
        </button>
      </div>
    </form>
  );
}
