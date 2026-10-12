import { useState } from "react";
import type { Funcionalidade } from "../../api";
import MovimentacaoFinanceira from "../movimentacao-financeira/MovimentacaoFinanceira";
import ViewMovimentacaoFinanceira from "../movimentacao-financeira/ViewMovimentacaoFinanceira";
import ViewPermissoes from "../permissao/ViewPermissoes";
import ViewUsuario from "../usuario/ViewUsuario";
import ViewResumoFinanceiro from "./ViewResumoFinanceiro";
import ViewGraficosComparativos from "./ViewGraficosComparativos";
import ViewPessoa from "../pessoa/ViewPessoa";
import ViewCompromissos from "../compromisso/ViewCompromissos";
import ViewCalendarioCompromissos from "../compromisso/ViewCalendarioCompromissos";
import ViewRelatorioContas from "../movimentacao-financeira/ViewRelatorioContas";
import ViewRelatorioCompromissos from "../compromisso/ViewRelatorioCompromissos";
import ViewContasBancarias from "../conta-bancaria/ViewContasBancarias";
import ViewCategorias from "../categoria/ViewCategorias";
import ViewSubCategorias from "../subcategoria/ViewSubCategorias";

type Tela =
  | "inicio"
  | "resumoFinanceiro"
  | "graficoComparativo"
  | "consultar"
  | "entrada"
  | "saida"
  | "usuario"
  | "permissao"
  | "pessoa"
  | "compromisso"
  | "calendarioCompromisso"
  | "relatorioContas"
  | "relatorioCompromissos"
  | "contaBancaria"
  | "categoria"
  | "subcategoria";

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
    tem("CONSULTAR_PESSOAS") ||
    tem("CONSULTAR_CONTAS_BANCARIAS") ||
    tem("CONSULTAR_CATEGORIAS") ||
    tem("CONSULTAR_SUBCATEGORIAS");
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
                      <button onClick={() => abrir("graficoComparativo")}>
                        Gráfico comparativo
                      </button>
                    </>
                  )}
                  {tem("CONSULTAR_CONTAS") && (
                    <>
                      <span className="titulo-submenu titulo-grupo-menu">
                        Relatórios
                      </span>
                      <button onClick={() => abrir("relatorioContas")}>
                        Relatório de contas mensal
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
                  {tem("CONSULTAR_CONTAS_BANCARIAS") && (
                    <button onClick={() => abrir("contaBancaria")}>
                      Contas bancárias
                    </button>
                  )}
                  {tem("CONSULTAR_CATEGORIAS") && (
                    <button onClick={() => abrir("categoria")}>
                      Categorias
                    </button>
                  )}
                  {tem("CONSULTAR_SUBCATEGORIAS") && (
                    <button onClick={() => abrir("subcategoria")}>
                      Subcategorias
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
                  <button onClick={() => abrir("relatorioCompromissos")}>
                    Relatório de compromissos por período
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
        {tela === "graficoComparativo" && tem("VISUALIZAR_DASHBOARD") && (
          <ViewGraficosComparativos />
        )}
        {tela === "consultar" && tem("CONSULTAR_CONTAS") && (
          <ViewMovimentacaoFinanceira
            aoNovo={novaConta}
            aoEditar={editar}
            aoDuplicar={duplicar}
            funcionalidades={funcionalidades}
          />
        )}
        {(tela === "entrada" || tela === "saida") && (
          <MovimentacaoFinanceira
            tipo={tela === "entrada" ? "RECEBER" : "PAGAR"}
            contaId={edicao}
            origemId={origemCopia}
            podeAlterar={tem("ALTERAR_CONTAS")}
            podeBaixar={tem("BAIXAR_RECEBER_CONTAS")}
            podeEstornar={tem("ESTORNAR_BAIXAS")}
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
        {tela === "contaBancaria" && tem("CONSULTAR_CONTAS_BANCARIAS") && (
          <ViewContasBancarias funcionalidades={funcionalidades} />
        )}
        {tela === "categoria" && tem("CONSULTAR_CATEGORIAS") && (
          <ViewCategorias funcionalidades={funcionalidades} />
        )}
        {tela === "subcategoria" && tem("CONSULTAR_SUBCATEGORIAS") && (
          <ViewSubCategorias funcionalidades={funcionalidades} />
        )}
        {tela === "compromisso" && tem("CONSULTAR_COMPROMISSOS") && (
          <ViewCompromissos />
        )}
        {tela === "calendarioCompromisso" && tem("CONSULTAR_COMPROMISSOS") && (
          <ViewCalendarioCompromissos />
        )}
        {tela === "relatorioContas" && tem("CONSULTAR_CONTAS") && (
          <ViewRelatorioContas />
        )}
        {tela === "relatorioCompromissos" && tem("CONSULTAR_COMPROMISSOS") && (
          <ViewRelatorioCompromissos />
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
