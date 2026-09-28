import { FormEvent, useEffect, useState } from "react";
import {
  alterarContaBancaria,
  cadastrarContaBancaria,
  excluirContaBancaria,
  listarContasBancarias,
  listarTitularesContaBancaria,
} from "../../api";
import type {
  BancoEnum,
  ContaBancaria,
  Funcionalidade,
  TitularContaBancaria,
} from "../../api";

const bancos: Record<BancoEnum, string> = {
  NUBANK: "Nubank",
  SICREDI: "Sicredi",
  SICOOB: "Sicoob",
  BANCO_DO_BRASIL: "Banco do Brasil",
  CAIXA: "Caixa",
  PLUXE: "Pluxe",
};

interface PropriedadesView {
  funcionalidades: Funcionalidade[];
}

interface MenuContexto {
  conta: ContaBancaria;
  x: number;
  y: number;
}

export default function ViewContasBancarias({
  funcionalidades,
}: PropriedadesView) {
  const [lista, setLista] = useState<ContaBancaria[]>([]);
  const [edicao, setEdicao] = useState<ContaBancaria | null>(null);
  const [novo, setNovo] = useState(false);
  const [erro, setErro] = useState("");
  const [menu, setMenu] = useState<MenuContexto | null>(null);
  const tem = (funcionalidade: Funcionalidade) =>
    funcionalidades.includes(funcionalidade);

  async function carregar() {
    try {
      setLista(await listarContasBancarias());
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar contas bancárias.");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  if (novo || edicao) {
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
  }

  async function excluir() {
    if (!menu || !confirm(`Excluir a conta ${bancos[menu.conta.banco]}?`))
      return;
    try {
      await excluirContaBancaria(menu.conta.id);
      setMenu(null);
      await carregar();
    } catch (e) {
      setMenu(null);
      setErro(e instanceof Error ? e.message : "Erro ao excluir a conta bancária.");
    }
  }

  return (
    <section className="painel">
      <div className="cabecalho-listagem">
        <div>
          <h1>Contas bancárias</h1>
          <p className="subtitulo">
            {tem("ALTERAR_CONTAS_BANCARIAS")
              ? "Dê dois cliques para alterar. Clique com o botão direito para mais opções."
              : "Contas bancárias que podem ser vinculadas aos lançamentos."}
          </p>
        </div>
        {tem("CADASTRAR_CONTAS_BANCARIAS") && (
          <button className="botao-adicionar" onClick={() => setNovo(true)}>
            + Nova conta bancária
          </button>
        )}
      </div>
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="tabela-responsiva">
        <table className="tabela-usuarios tabela-contas">
          <thead>
            <tr>
              <th>Banco</th>
              <th>Agência</th>
              <th>Conta</th>
              <th>Titular</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((conta) => (
              <tr
                key={conta.id}
                onDoubleClick={() =>
                  tem("ALTERAR_CONTAS_BANCARIAS") && setEdicao(conta)
                }
                onContextMenu={(evento) => {
                  evento.preventDefault();
                  setMenu({ conta, x: evento.clientX, y: evento.clientY });
                }}
              >
                <td>{bancos[conta.banco]}</td>
                <td>{conta.agencia}</td>
                <td>{conta.numeroConta}</td>
                <td>{conta.titular ?? "Não informado"}</td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={4} className="lista-vazia">
                  Nenhuma conta bancária cadastrada.
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
            aria-label="Fechar"
            onClick={() => setMenu(null)}
          />
          {tem("EXCLUIR_CONTAS_BANCARIAS") && (
            <div
              className="menu-contexto"
              style={{ left: menu.x, top: menu.y }}
            >
              <button className="acao-perigosa" onClick={excluir}>
                Excluir conta bancária
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface PropriedadesFormulario {
  registro?: ContaBancaria;
  aoSalvar: () => void;
  aoCancelar: () => void;
}

function Formulario({
  registro,
  aoSalvar,
  aoCancelar,
}: PropriedadesFormulario) {
  const [banco, setBanco] = useState<BancoEnum>(registro?.banco ?? "NUBANK");
  const [agencia, setAgencia] = useState(registro?.agencia ?? "");
  const [numero, setNumero] = useState(registro?.numeroConta ?? "");
  const [pessoaId, setPessoaId] = useState(
    registro?.pessoaId ? String(registro.pessoaId) : "",
  );
  const [titulares, setTitulares] = useState<TitularContaBancaria[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarTitularesContaBancaria()
      .then(setTitulares)
      .catch((e) =>
        setErro(e instanceof Error ? e.message : "Erro ao carregar titulares."),
      );
  }, []);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (registro) {
        await alterarContaBancaria(
          registro.id,
          banco,
          agencia,
          numero,
          Number(pessoaId),
        );
      } else {
        await cadastrarContaBancaria(
          banco,
          agencia,
          numero,
          Number(pessoaId),
        );
      }
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar a conta bancária.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="painel formulario-movimentacao" onSubmit={salvar}>
      <h1>{registro ? "Alterar" : "Nova"} conta bancária</h1>
      <div className="grade-conta-bancaria">
        <label className="rotulo-campo campo-titular-conta">
          Titular *
          <select
            className="campo-formulario"
            value={pessoaId}
            onChange={(e) => setPessoaId(e.target.value)}
            required
          >
            <option value="">Selecione uma pessoa</option>
            {titulares.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
                {pessoa.cpf ? ` · CPF ${pessoa.cpf}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="rotulo-campo">
          Banco *
          <select
            className="campo-formulario"
            value={banco}
            onChange={(e) => setBanco(e.target.value as BancoEnum)}
          >
            {Object.entries(bancos).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="rotulo-campo">
          Agência *
          <input
            className="campo-formulario"
            value={agencia}
            maxLength={20}
            onChange={(e) => setAgencia(e.target.value)}
            required
          />
        </label>
        <label className="rotulo-campo">
          Número da conta *
          <input
            className="campo-formulario"
            value={numero}
            maxLength={30}
            onChange={(e) => setNumero(e.target.value)}
            required
          />
        </label>
      </div>
      {!titulares.length && (
        <small className="ajuda-campo">
          Cadastre uma pessoa antes de criar a conta bancária.
        </small>
      )}
      {erro && <p className="mensagem-erro">{erro}</p>}
      <div className="acoes-formulario">
        <button
          className="botao-primario"
          disabled={salvando || !titulares.length}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          className="botao-secundario"
          onClick={aoCancelar}
        >
          Voltar
        </button>
      </div>
    </form>
  );
}
