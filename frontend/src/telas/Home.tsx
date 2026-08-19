import { useState } from "react";
import type { Funcionalidade } from "../api";
import Movimentacao from "./Movimentacao";
import ViewContas from "./ViewContas";
import ViewPermissoes from "./ViewPermissoes";
import ViewUsuario from "./ViewUsuario";
import ViewResumoFinanceiro from "./ViewResumoFinanceiro";
import ViewPessoa from "./ViewPessoa";
import ViewCompromissos from "./ViewCompromissos";
import ViewCalendarioCompromissos from "./ViewCalendarioCompromissos";

type Tela =
  | "inicio"
  | "resumoFinanceiro"
  | "consultar"
  | "entrada"
  | "saida"
  | "usuario"
  | "permissao"
  | "pessoa"
  | "compromisso"
  | "calendarioCompromisso";

export default function Home({
  usuario,
  funcionalidades,
  aoSair,
}: {
  usuario: string;
  funcionalidades: Funcionalidade[];
  aoSair: () => void;
}) {
  const [menu, setMenu] = useState<
      "financeiro" | "ferramentas" | "agenda" | null
    >(null),
    [tela, setTela] = useState<Tela>("inicio"),
    [edicao, setEdicao] = useState<number | null>(null),
    [origemCopia, setOrigemCopia] = useState<number | null>(null);
  const tem = (f: Funcionalidade) => funcionalidades.includes(f);
  const temFinanceiro =
    tem("CONSULTAR_CONTAS") ||
    tem("CADASTRAR_CONTAS") ||
    tem("VISUALIZAR_DASHBOARD");
  const temFerramentas =
    tem("CONSULTAR_USUARIOS") ||
    tem("GERENCIAR_PERMISSOES") ||
    tem("CONSULTAR_PESSOAS");
  function abrir(t: Tela) {
    setTela(t);
    setMenu(null);
  }
  function novaConta() {
    setEdicao(null);
    setOrigemCopia(null);
    abrir("entrada");
  }
  function editar(id: number) {
    setEdicao(id);
    setOrigemCopia(null);
    abrir("entrada");
  }
  function duplicar(id: number) {
    setEdicao(null);
    setOrigemCopia(id);
    abrir("entrada");
  }

  return (
    <div className="pagina-home">
      <header className="cabecalho-principal">
        <button className="marca" onClick={() => abrir("inicio")}>
          <img src="/flowfinance-icon.png" alt="" />
          <span>FlowFinance</span>
        </button>
        <nav className="menu-principal">
          {temFinanceiro && (
            <div className="item-menu">
              <button
                className="botao-menu"
                onClick={() =>
                  setMenu(menu === "financeiro" ? null : "financeiro")
                }
              >
                Financeiro ▾
              </button>
              {menu === "financeiro" && (
                <div className="submenu">
                  <span className="titulo-submenu">Movimentações</span>
                  {tem("CONSULTAR_CONTAS") && (
                    <button onClick={() => abrir("consultar")}>Contas</button>
                  )}
                  {tem("VISUALIZAR_DASHBOARD") && (
                    <>
                      <span className="titulo-submenu titulo-grupo-menu">
                        DashBoard
                      </span>
                      <button onClick={() => abrir("resumoFinanceiro")}>
                        Resumo financeiro
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {temFerramentas && (
            <div className="item-menu">
              <button
                className="botao-menu"
                onClick={() =>
                  setMenu(menu === "ferramentas" ? null : "ferramentas")
                }
              >
                Ferramentas ▾
              </button>
              {menu === "ferramentas" && (
                <div className="submenu">
                  {tem("CONSULTAR_USUARIOS") && (
                    <button onClick={() => abrir("usuario")}>Usuário</button>
                  )}
                  {tem("CONSULTAR_PESSOAS") && (
                    <button onClick={() => abrir("pessoa")}>Pessoas</button>
                  )}
                  {tem("GERENCIAR_PERMISSOES") && (
                    <button onClick={() => abrir("permissao")}>
                      Permissão
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {tem("CONSULTAR_COMPROMISSOS") && (
            <div className="item-menu">
              <button
                className="botao-menu"
                onClick={() => setMenu(menu === "agenda" ? null : "agenda")}
              >
                Agenda ▾
              </button>
              {menu === "agenda" && (
                <div className="submenu">
                  <span className="titulo-submenu">Agenda</span>
                  <button onClick={() => abrir("compromisso")}>
                    Compromissos
                  </button>
                  <button onClick={() => abrir("calendarioCompromisso")}>
                    Calendário compromissos
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="area-usuario">
          <span>Olá, {usuario}</span>
          <button className="botao-sair" onClick={aoSair}>
            Sair
          </button>
        </div>
      </header>
      <main
        className={`conteudo-principal ${tela === "inicio" ? "conteudo-inicial" : ""}`}
      >
        {tela === "inicio" && <TelaInicial />}
        {tela === "resumoFinanceiro" && tem("VISUALIZAR_DASHBOARD") && (
          <ViewResumoFinanceiro />
        )}
        {tela === "consultar" && tem("CONSULTAR_CONTAS") && (
          <ViewContas
            aoNovo={novaConta}
            aoEditar={editar}
            aoDuplicar={duplicar}
            funcionalidades={funcionalidades}
          />
        )}
        {(tela === "entrada" || tela === "saida") && (
          <Movimentacao
            tipo={tela === "entrada" ? "RECEBER" : "PAGAR"}
            contaId={edicao}
            origemId={origemCopia}
            aoConcluir={() => abrir("consultar")}
          />
        )}
        {tela === "usuario" && tem("CONSULTAR_USUARIOS") && (
          <ViewUsuario funcionalidades={funcionalidades} />
        )}
        {tela === "permissao" && tem("GERENCIAR_PERMISSOES") && (
          <ViewPermissoes />
        )}
        {tela === "pessoa" && tem("CONSULTAR_PESSOAS") && <ViewPessoa />}
        {tela === "compromisso" && tem("CONSULTAR_COMPROMISSOS") && (
          <ViewCompromissos />
        )}
        {tela === "calendarioCompromisso" && tem("CONSULTAR_COMPROMISSOS") && (
          <ViewCalendarioCompromissos />
        )}
      </main>
    </div>
  );
}

function TelaInicial() {
  return (
    <section
      className="marca-dagua-home"
      aria-label="Página inicial do FlowFinance"
    >
      <div className="orbita-marca orbita-externa" />
      <div className="orbita-marca orbita-interna" />
      <img src="/flowfinance-icon.png" alt="" />
      <h1>FlowFinance</h1>
      <p>Seu fluxo financeiro, simples e sob controle.</p>
    </section>
  );
}
