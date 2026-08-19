import { FormEvent, useEffect, useState } from "react";
import { alterarPapel, cadastrarPapel, listarFuncionalidades } from "../api";
import type { Funcionalidade, PapelDetalhe } from "../api";

const rotulos: Record<Funcionalidade, string> = {
  VISUALIZAR_DASHBOARD: "Visualizar",
  CONSULTAR_CONTAS: "Consultar",
  CADASTRAR_CONTAS: "Cadastrar",
  ALTERAR_CONTAS: "Alterar",
  BAIXAR_RECEBER_CONTAS: "Baixar ou receber",
  ESTORNAR_BAIXAS: "Estornar baixa",
  DUPLICAR_CONTAS: "Duplicar",
  EXCLUIR_CONTAS: "Excluir",
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
};
const grupos: { titulo: string; funcoes: Funcionalidade[] }[] = [
  { titulo: "Geral", funcoes: ["VISUALIZAR_DASHBOARD"] },
  {
    titulo: "Contas",
    funcoes: [
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
        if (!registro) setHabilitadas(new Set(lista));
      })
      .catch((e) => setErro(e.message));
  }, [registro]);
  const todas =
    disponiveis.length > 0 && disponiveis.every((f) => habilitadas.has(f));
  function alternar(f: Funcionalidade) {
    setHabilitadas((atuais) => {
      const novas = new Set(atuais);
      novas.has(f) ? novas.delete(f) : novas.add(f);
      return novas;
    });
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const funcoes = [...habilitadas];
      registro
        ? await alterarPapel(registro.id, nome, descricao, ativo, funcoes)
        : await cadastrarPapel(nome, descricao, ativo, funcoes);
      aoSalvar();
    } catch (f) {
      setErro(f instanceof Error ? f.message : "Erro ao salvar o papel.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form className="painel formulario-permissao" onSubmit={salvar}>
      <h1>{registro ? "Alterar papel" : "Cadastrar papel"}</h1>
      <p className="subtitulo">
        Defina o papel e as funções que ele poderá utilizar no sistema.
      </p>
      <div className="grade-baixa">
        <label className="rotulo-campo">
          Nome do papel *
          <input
            className="campo-formulario"
            value={nome}
            maxLength={100}
            required
            onChange={(e) => setNome(e.target.value)}
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
      <label className="rotulo-campo">
        Descrição
        <textarea
          className="campo-formulario campo-observacoes"
          value={descricao}
          maxLength={255}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </label>
      <section className="secao-funcoes">
        <div className="cabecalho-funcoes">
          <div>
            <h2>Funções do sistema</h2>
            <small>
              {habilitadas.size} de {disponiveis.length} habilitadas
            </small>
          </div>
          <label className="alternar-todas">
            <input
              type="checkbox"
              checked={todas}
              onChange={(e) =>
                setHabilitadas(new Set(e.target.checked ? disponiveis : []))
              }
            />{" "}
            Habilitar todas
          </label>
        </div>
        <div className="grupos-funcoes">
          {grupos.map((grupo) => {
            const funcoes = grupo.funcoes.filter((f) =>
              disponiveis.includes(f),
            );
            return (
              <section className="grupo-funcao" key={grupo.titulo}>
                <h3>{grupo.titulo}</h3>
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
        <button className="botao-primario botao-ajustado" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button className="botao-secundario" type="button" onClick={aoCancelar}>
          Voltar
        </button>
      </div>
    </form>
  );
}
