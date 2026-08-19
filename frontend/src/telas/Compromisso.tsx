import { FormEvent, useEffect, useState } from "react";
import {
  alterarCompromisso,
  cadastrarCompromisso,
  listarPessoas,
} from "../api";
import type {
  CompromissoResumo,
  NovoCompromisso,
  PessoaResumo,
  SituacaoCompromisso,
} from "../api";
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
    [dataHora, setDataHora] = useState(
      registro ? registro.dataHora.slice(0, 16) : "",
    ),
    [descricao, setDescricao] = useState(registro?.descricao ?? ""),
    [pessoaId, setPessoaId] = useState(
      registro ? String(registro.pessoaId) : "",
    ),
    [hora, setHora] = useState(
      registro?.horaNotificacao.slice(0, 5) ?? "08:00",
    ),
    [situacao, setSituacao] = useState<SituacaoCompromisso>(
      registro?.situacao ?? "PENDENTE",
    ),
    [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  useEffect(() => {
    listarPessoas()
      .then(setPessoas)
      .catch((e) => setErro(e.message));
  }, []);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const c: NovoCompromisso = {
        dataHora: new Date(dataHora).toISOString(),
        descricao,
        pessoaId: Number(pessoaId),
        horaNotificacao: hora + ":00",
        situacao,
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
      <label className="rotulo-campo">
        Pessoa *
        <select
          className="campo-formulario"
          value={pessoaId}
          onChange={(e) => setPessoaId(e.target.value)}
          required
        >
          <option value="">Selecione</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.canalPreferencial === "NTFY" ? "ntfy" : "WhatsApp"})
            </option>
          ))}
        </select>
      </label>
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
