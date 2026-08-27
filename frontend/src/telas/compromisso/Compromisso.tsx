import { FormEvent, useEffect, useState } from "react";
import {
  alterarCompromisso,
  cadastrarCompromisso,
  listarPessoas,
  listarCategorias,
} from "../../api";
import type {
  CompromissoResumo,
  NovoCompromisso,
  PessoaResumo,
  SituacaoCompromisso,
  Categoria,
} from "../../api";
export default function Compromisso({
  registro,
  duplicando = false,
  aoSalvar,
  aoCancelar,
}: {
  registro?: CompromissoResumo;
  duplicando?: boolean;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [pessoas, setPessoas] = useState<PessoaResumo[]>([]),
    [categorias, setCategorias] = useState<Categoria[]>([]),
    [dataHora, setDataHora] = useState(
      registro ? registro.dataHora.slice(0, 16) : "",
    ),
    [descricao, setDescricao] = useState(registro?.descricao ?? ""),
    [pessoaIds, setPessoaIds] = useState<number[]>(registro?.pessoaIds ?? []),
    [hora, setHora] = useState(
      registro?.horaNotificacao.slice(0, 5) ?? "08:00",
    ),
    [situacao, setSituacao] = useState<SituacaoCompromisso>(
      registro?.situacao ?? "PENDENTE",
    ),
    [categoriaId, setCategoriaId] = useState(registro?.categoriaId ? String(registro.categoriaId) : ""),
    [cep, setCep] = useState(registro?.cep ?? ""),
    [logradouro, setLogradouro] = useState(registro?.logradouro ?? ""),
    [numero, setNumero] = useState(registro?.numero ?? ""),
    [complemento, setComplemento] = useState(registro?.complemento ?? ""),
    [bairro, setBairro] = useState(registro?.bairro ?? ""),
    [cidade, setCidade] = useState(registro?.cidade ?? ""),
    [uf, setUf] = useState(registro?.uf ?? ""),
    [buscandoCep, setBuscandoCep] = useState(false),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  useEffect(() => {
    listarPessoas()
      .then((lista) => {
        setPessoas(lista);
        const idsNtfy = new Set(lista.filter((p) => p.canalPreferencial === "NTFY").map((p) => p.id));
        setPessoaIds((atuais) => atuais.filter((id) => idsNtfy.has(id)));
      })
      .catch((e) => setErro(e.message));
    listarCategorias().then(setCategorias).catch((e) => setErro(e.message));
  }, []);
  async function buscarCep() {
    const digitos = cep.replace(/\D/g, "");
    if (!digitos) return;
    if (digitos.length !== 8) { setErro("Informe um CEP válido com 8 dígitos."); return; }
    setBuscandoCep(true); setErro("");
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`), dados = await resposta.json();
      if (!resposta.ok || dados.erro) throw new Error("CEP não encontrado.");
      setLogradouro(dados.logradouro ?? ""); setBairro(dados.bairro ?? ""); setCidade(dados.localidade ?? ""); setUf(dados.uf ?? "");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível consultar o CEP."); }
    finally { setBuscandoCep(false); }
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!pessoaIds.length) {
      setErro("Selecione ao menos uma pessoa para notificar.");
      return;
    }
    setSalvando(true);
    try {
      const c: NovoCompromisso = {
        dataHora: new Date(dataHora).toISOString(),
        descricao,
        pessoaIds,
        categoriaId: Number(categoriaId),
        horaNotificacao: hora + ":00",
        situacao,
        cep: cep.replace(/\D/g, ""), logradouro, numero, complemento, bairro, cidade, uf,
      };
      registro && !duplicando
        ? await alterarCompromisso(registro.id, c)
        : await cadastrarCompromisso(c);
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form className="painel formulario-movimentacao" onSubmit={salvar}>
      <h1>
        {registro && !duplicando
          ? "Alterar compromisso"
          : registro
            ? "Duplicar compromisso"
            : "Novo compromisso"}
      </h1>
      <label className="rotulo-campo">
        Data e horário *
        <input
          className="campo-formulario"
          type="datetime-local"
          value={dataHora}
          onChange={(e) => setDataHora(e.target.value)}
          required
        />
      </label>
      <label className="rotulo-campo">
        Descrição *
        <textarea
          className="campo-formulario campo-observacoes"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={1000}
          required
        />
      </label>
      <div className="rotulo-campo">
        Pessoas a notificar *
        <span className="lista-selecao-pessoas">
          {pessoas.filter((p) => p.canalPreferencial === "NTFY").map((p) => (
            <span className="item-selecao-pessoa" key={p.id}>
              <input type="checkbox" checked={pessoaIds.includes(p.id)} onChange={(e) => setPessoaIds((atuais) => e.target.checked ? [...atuais, p.id] : atuais.filter((id) => id !== p.id))}/>
              <span>{p.nome} <small>(ntfy)</small></span>
            </span>
          ))}
          {!pessoas.some((p) => p.canalPreferencial === "NTFY") && <span className="lista-pessoas-vazia">Nenhuma pessoa com canal ntfy cadastrada.</span>}
        </span>
      </div>
      <label className="rotulo-campo">Categoria *
        <select className="campo-formulario" value={categoriaId} onChange={e => setCategoriaId(e.target.value)} required>
          <option value="">Selecione</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      {!categorias.length && <small className="ajuda-campo">Cadastre uma categoria em Ferramentas → Categorias.</small>}
      <details className="secao-endereco-compromisso" open={Boolean(registro?.cep || registro?.logradouro)}>
        <summary>Endereço do compromisso <small>(opcional)</small></summary>
        <div className="conteudo-endereco-compromisso">
          <div className="grade-baixa"><label className="rotulo-campo">CEP<input className="campo-formulario" value={formatarCep(cep)} onChange={e=>setCep(e.target.value.replace(/\D/g,"").slice(0,8))} onBlur={buscarCep} inputMode="numeric" placeholder="00000-000"/></label><label className="rotulo-campo">Número<input className="campo-formulario" value={numero} onChange={e=>setNumero(e.target.value)} maxLength={20}/></label></div>
          {buscandoCep && <small className="ajuda-campo">Consultando CEP...</small>}
          <label className="rotulo-campo">Logradouro<input className="campo-formulario" value={logradouro} onChange={e=>setLogradouro(e.target.value)} maxLength={150}/></label>
          <div className="grade-baixa"><label className="rotulo-campo">Bairro<input className="campo-formulario" value={bairro} onChange={e=>setBairro(e.target.value)} maxLength={100}/></label><label className="rotulo-campo">Complemento<input className="campo-formulario" value={complemento} onChange={e=>setComplemento(e.target.value)} maxLength={100}/></label></div>
          <div className="grade-baixa"><label className="rotulo-campo">Cidade<input className="campo-formulario" value={cidade} onChange={e=>setCidade(e.target.value)} maxLength={100}/></label><label className="rotulo-campo">UF<input className="campo-formulario" value={uf} onChange={e=>setUf(e.target.value.toUpperCase().slice(0,2))} maxLength={2}/></label></div>
        </div>
      </details>
      <div className="grade-baixa">
        <label className="rotulo-campo">
          Hora da notificação
          <input
            className="campo-formulario"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            required
          />
        </label>
        <label className="rotulo-campo">
          Situação
          <select
            className="campo-formulario"
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as SituacaoCompromisso)}
          >
            <option value="PENDENTE">Pendente</option>
            <option value="RESOLVIDO">Resolvido</option>
            <option value="REAGENDADO">Reagendado</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="NOTIFICADO">Notificado</option>
          </select>
        </label>
      </div>
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

function formatarCep(valor:string){const d=valor.replace(/\D/g,"").slice(0,8);return d.length>5?`${d.slice(0,5)}-${d.slice(5)}`:d}
