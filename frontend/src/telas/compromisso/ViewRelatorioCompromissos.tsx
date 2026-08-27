import { FormEvent, useState } from "react";
import { buscarRelatorioCompromissos } from "../../api";
import type { CompromissoRelatorio, SituacaoCompromisso } from "../../api";

const iso=(d:Date)=>d.toLocaleDateString("sv-SE");
const hoje=()=>iso(new Date());
const rotulos:Record<SituacaoCompromisso,string>={PENDENTE:"Pendentes",RESOLVIDO:"Resolvidos",REAGENDADO:"Reagendados",CONCLUIDO:"Concluídos",NOTIFICADO:"Notificados"};
const ordem:SituacaoCompromisso[]=["PENDENTE","REAGENDADO","NOTIFICADO","RESOLVIDO","CONCLUIDO"];

export default function ViewRelatorioCompromissos(){
  const[inicio,setInicio]=useState(hoje),[fim,setFim]=useState(hoje),[dados,setDados]=useState<CompromissoRelatorio[]|null>(null),[erro,setErro]=useState(""),[carregando,setCarregando]=useState(false);
  async function gerar(e:FormEvent){e.preventDefault();if(fim<inicio){setErro("A data final não pode ser anterior à data inicial.");return}setCarregando(true);setErro("");try{setDados(await buscarRelatorioCompromissos(inicio,fim))}catch(e){setErro(e instanceof Error?e.message:"Erro ao gerar relatório.")}finally{setCarregando(false)}}
  return <section className="resumo-financeiro relatorio">
    <h1>Relatório de compromissos por período</h1><p className="subtitulo">Compromissos lançados entre as datas informadas, agrupados por situação.</p>
    <form className="filtros-resumo filtros-periodo" onSubmit={gerar}>
      <label className="rotulo-campo">Período inicial<input className="campo-formulario" type="date" value={inicio} onChange={e=>setInicio(e.target.value)} required/></label>
      <label className="rotulo-campo">Período final<input className="campo-formulario" type="date" value={fim} onChange={e=>setFim(e.target.value)} required/></label>
      <button className="botao-adicionar" disabled={carregando}>{carregando?"Gerando...":"Gerar relatório"}</button>
    </form>
    {erro&&<p className="mensagem-erro">{erro}</p>}
    {dados&&<>{ordem.map(s=><Grupo key={s} titulo={rotulos[s]} itens={dados.filter(x=>x.situacao===s)}/>)}<div className="totalizador-relatorio"><span>Total de compromissos <strong>{dados.length}</strong></span></div></>}
  </section>
}

function Grupo({titulo,itens}:{titulo:string;itens:CompromissoRelatorio[]}){
  return <section className="grupo-relatorio"><h2>{titulo} <small>({itens.length})</small></h2><div className="tabela-responsiva"><table className="tabela-usuarios tabela-relatorio"><thead><tr><th>Data e horário</th><th>Descrição</th><th>Categoria</th><th>Pessoa</th></tr></thead><tbody>{itens.map(x=><tr key={x.id}><td>{new Date(x.dataHora).toLocaleString("pt-BR")}</td><td>{x.descricao}</td><td>{x.categoria??"Sem categoria"}</td><td>{x.pessoa}</td></tr>)}{!itens.length&&<tr><td className="lista-vazia" colSpan={4}>Nenhum compromisso encontrado.</td></tr>}</tbody></table></div></section>
}
