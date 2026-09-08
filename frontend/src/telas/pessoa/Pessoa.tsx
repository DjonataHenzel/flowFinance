import { FormEvent, useEffect, useState } from "react";
import { alterarPessoa, buscarPessoa, cadastrarPessoa } from "../../api";
import type { NovaPessoa } from "../../api";
const vazio: NovaPessoa = {
  nome: "",
  cpf: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  canalPreferencial: "WHATSAPP",
  whatsapp: [],
  ntfy: [],
};
function topico() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return `flowfinance-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function formatarCep(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  return digitos.length > 5
    ? `${digitos.slice(0, 5)}-${digitos.slice(5)}`
    : digitos;
}
function formatarCpf(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9)
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}
export default function Pessoa({
  id,
  aoSalvar,
  aoCancelar,
}: {
  id: number | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [p, setP] = useState<NovaPessoa>(vazio),
    [novo, setNovo] = useState(""),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false),
    [buscando, setBuscando] = useState(false);
  useEffect(() => {
    if (id)
      buscarPessoa(id)
        .then((x) =>
          setP({
            ...x,
            cpf: formatarCpf(x.cpf ?? ""),
            cep: x.cep ?? "",
            logradouro: x.logradouro ?? "",
            numero: x.numero ?? "",
            complemento: x.complemento ?? "",
            bairro: x.bairro ?? "",
            cidade: x.cidade ?? "",
            uf: x.uf ?? "",
          }),
        )
        .catch((e) => setErro(e.message));
  }, [id]);
  function alterar<K extends keyof NovaPessoa>(k: K, v: NovaPessoa[K]) {
    setP((x) => ({ ...x, [k]: v }));
  }
  async function cep() {
    const c = p.cep.replace(/\D/g, "");
    if (c.length !== 8) return;
    setBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`),
        x = await r.json();
      if (x.erro) throw Error("CEP não encontrado.");
      setP((v) => ({
        ...v,
        logradouro: x.logradouro || "",
        bairro: x.bairro || "",
        cidade: x.localidade || "",
        uf: x.uf || "",
      }));
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível buscar o CEP.",
      );
    } finally {
      setBuscando(false);
    }
  }
  function add() {
    const d = novo.trim();
    if (!d) return;
    const canal = p.canalPreferencial === "WHATSAPP" ? "whatsapp" : "ntfy";
    if (canal === "whatsapp" && !/^[\d() +-]{10,20}$/.test(d)) {
      setErro("Informe um WhatsApp válido.");
      return;
    }
    if (canal === "ntfy" && !/^flowfinance-[a-f0-9]{32}$/.test(d)) {
      setErro("Tópico ntfy inválido.");
      return;
    }
    alterar(canal, [
      ...(p[canal] as string[]),
      canal === "whatsapp" ? `55${d.replace(/\D/g, "")}` : d,
    ]);
    setNovo("");
    setErro("");
  }
  function rem(v: string) {
    const canal = p.canalPreferencial === "WHATSAPP" ? "whatsapp" : "ntfy";
    alterar(
      canal,
      (p[canal] as string[]).filter((x) => x !== v),
    );
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!p[p.canalPreferencial === "WHATSAPP" ? "whatsapp" : "ntfy"].length) {
      setErro("Adicione pelo menos um destino do canal escolhido.");
      return;
    }
    setSalvando(true);
    try {
      id ? await alterarPessoa(id, p) : await cadastrarPessoa(p);
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form className="painel formulario-movimentacao" onSubmit={salvar}>
      <h1>{id ? "Alterar pessoa" : "Cadastrar pessoa"}</h1>
      <section className="secao-cadastro-pessoa">
        <h2>Dados pessoais</h2>
        <div className="grade-identificacao-pessoa">
        <label className="rotulo-campo">
          Nome *
          <input
            className="campo-formulario"
            value={p.nome}
            onChange={(e) => alterar("nome", e.target.value)}
            required
            maxLength={150}
          />
        </label>
        <label className="rotulo-campo">
          CPF
          <input
            className="campo-formulario"
            value={p.cpf}
            onChange={(e) => alterar("cpf", formatarCpf(e.target.value))}
            placeholder="Opcional"
            inputMode="numeric"
            maxLength={14}
          />
        </label>
        </div>
      </section>
      <section className="secao-cadastro-pessoa">
        <h2>Endereço</h2>
        <div className="grade-baixa">
        <label className="rotulo-campo">
          CEP
          <input
            className="campo-formulario"
            value={p.cep}
            onChange={(e) => alterar("cep", formatarCep(e.target.value))}
            onBlur={cep}
          />
        </label>
        <label className="rotulo-campo">
          Número
          <input
            className="campo-formulario"
            value={p.numero}
            onChange={(e) => alterar("numero", e.target.value)}
          />
        </label>
        </div>
        <div className="grade-baixa">
        <label className="rotulo-campo">
          Logradouro
          <input
            className="campo-formulario"
            value={p.logradouro}
            onChange={(e) => alterar("logradouro", e.target.value)}
          />
        </label>
        <label className="rotulo-campo">
          Complemento
          <input
            className="campo-formulario"
            value={p.complemento}
            onChange={(e) => alterar("complemento", e.target.value)}
          />
        </label>
        </div>
        <div className="grade-baixa">
        <label className="rotulo-campo">
          Bairro
          <input
            className="campo-formulario"
            value={p.bairro}
            onChange={(e) => alterar("bairro", e.target.value)}
          />
        </label>
        <div className="campo-cidade-uf">
          <label className="rotulo-campo">
            Cidade
            <input
              className="campo-formulario"
              value={p.cidade}
              onChange={(e) => alterar("cidade", e.target.value)}
            />
          </label>
          <label className="rotulo-campo">
            UF
            <input
              className="campo-formulario"
              value={p.uf}
              onChange={(e) => alterar("uf", e.target.value)}
              maxLength={2}
            />
          </label>
        </div>
        </div>
      </section>
      <section className="secao-notificacao">
        <h2>Preferência de notificação</h2>
        <div
          className={`linha-canal-notificacao${
            p.canalPreferencial === "NTFY"
              ? " linha-canal-notificacao-ntfy"
              : ""
          }`}
        >
          <select
            className="campo-formulario"
            aria-label="Tipo da notificação"
            value={p.canalPreferencial}
            onChange={(e) => {
              const canal = e.target.value as "WHATSAPP" | "NTFY";
              setP((atual) => ({
                ...atual,
                canalPreferencial: canal,
                whatsapp: canal === "WHATSAPP" ? atual.whatsapp : [],
                ntfy: canal === "NTFY" ? atual.ntfy : [],
              }));
            }}
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="NTFY">ntfy</option>
          </select>
          <input
            className="campo-formulario"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder={
              p.canalPreferencial === "WHATSAPP" ? "WhatsApp" : "Tópico ntfy"
            }
          />
          {p.canalPreferencial === "NTFY" && (
            <button
              type="button"
              className="botao-secundario botao-gerar-topico"
              onClick={() => {
                setNovo(topico());
                setErro("");
              }}
            >
              Gerar tópico
            </button>
          )}
          <button type="button" className="botao-adicionar" onClick={add}>
            Adicionar
          </button>
        </div>
        <ul className="lista-contatos-whatsapp">
          {(
            p[
              p.canalPreferencial === "WHATSAPP" ? "whatsapp" : "ntfy"
            ] as string[]
          ).map((x) => (
            <li key={x}>
              <span>{x}</span>
              <button
                type="button"
                className="botao-remover-destino"
                aria-label="Remover destino"
                title="Remover"
                onClick={() => rem(x)}
              >
                <IconeRemover />
              </button>
            </li>
          ))}
        </ul>
        <small className="ajuda-campo">
          Escolha um único canal por pessoa; podem existir vários destinos
          dentro dele.
        </small>
      </section>
      {buscando && <p className="ajuda-campo">Buscando CEP...</p>}
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

function IconeRemover() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
    </svg>
  );
}
