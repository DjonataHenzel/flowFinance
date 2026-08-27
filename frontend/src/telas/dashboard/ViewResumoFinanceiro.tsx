import {FormEvent,useEffect,useState} from 'react';
import {buscarResumoFinanceiro} from '../../api';
import type {SituacaoContaEnum} from '../../api';
import type {ResumoFinanceiro as DadosResumo} from '../../types';

function dataIso(data:Date){return data.toLocaleDateString('sv-SE')}
function periodoInicial(){const hoje=new Date();return dataIso(new Date(hoje.getFullYear(),hoje.getMonth(),1))}
function periodoFinal(){const hoje=new Date();return dataIso(new Date(hoje.getFullYear(),hoje.getMonth()+1,0))}

export default function ViewResumoFinanceiro(){
  const[dataInicio,setDataInicio]=useState(periodoInicial),[dataFim,setDataFim]=useState(periodoFinal),[situacao,setSituacao]=useState<SituacaoContaEnum|''>(''),[resumo,setResumo]=useState<DadosResumo|null>(null),[erro,setErro]=useState(''),[carregando,setCarregando]=useState(false);
  async function consultar(){setErro('');setCarregando(true);try{setResumo(await buscarResumoFinanceiro(dataInicio,dataFim,situacao||undefined))}catch(e){setErro(e instanceof Error?e.message:'Não foi possível consultar o resumo.')}finally{setCarregando(false)}}
  useEffect(()=>{consultar()},[]);
  function enviar(evento:FormEvent){evento.preventDefault();if(dataFim<dataInicio){setErro('A data final não pode ser anterior à data inicial.');return}consultar()}
  return <section className="resumo-financeiro">
    <div className="cabecalho-painel"><div><h1>Resumo financeiro</h1><p className="subtitulo">Totais calculados pela data de pagamento das parcelas baixadas e pelo vencimento das pendentes.</p></div></div>
    <form className="filtros-resumo" onSubmit={enviar}>
      <label className="rotulo-campo">Data inicial<input className="campo-formulario" type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)} required/></label>
      <label className="rotulo-campo">Data final<input className="campo-formulario" type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} required/></label>
      <label className="rotulo-campo">Situação<select className="campo-formulario" value={situacao} onChange={e=>setSituacao(e.target.value as SituacaoContaEnum|'')}><option value="">Todas</option><option value="ABERTA">Aberta</option><option value="PARCELADA">Parcelada</option><option value="PAGA">Paga</option><option value="RECEBIDA">Recebida</option></select></label>
      <button className="botao-adicionar" type="submit" disabled={carregando}>{carregando?'Consultando...':'Consultar'}</button>
    </form>
    {erro&&<p className="mensagem-erro">{erro}</p>}
    {resumo&&<><p className="periodo-resumo">Período: <strong>{resumo.month}</strong></p><div className="grade-resumo">
      <Cartao titulo="Receitas" valor={resumo.totalIncome} cor="verde"/>
      <Cartao titulo="Despesas" valor={resumo.totalExpenses} cor="vermelho"/>
      <Cartao titulo="Saldo" valor={resumo.balance} cor={resumo.balance>=0?'verde':'vermelho'}/>
    </div><div className="grade-graficos"><GraficoComparativo receitas={resumo.totalIncome} despesas={resumo.totalExpenses}/><GraficoDistribuicao receitas={resumo.totalIncome} despesas={resumo.totalExpenses}/></div></>}
  </section>
}

function Cartao({titulo,valor,cor}:{titulo:string;valor:number;cor:'verde'|'vermelho'}){return <article className={`cartao-resumo cartao-${cor}`}><p>{titulo}</p><strong className={`texto-${cor}`}>{valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></article>}

function GraficoComparativo({receitas,despesas}:{receitas:number;despesas:number}){
  const maior=Math.max(receitas,despesas),altura=(valor:number)=>maior===0?0:Math.max(4,(valor/maior)*100),moeda=(valor:number)=>valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return <section className="grafico-resumo" aria-label={`Comparação: receitas ${moeda(receitas)} e despesas ${moeda(despesas)}`}>
    <div className="cabecalho-grafico"><div><h2>Receitas x despesas</h2><p>Comparativo do período selecionado</p></div><div className="legenda-grafico"><span className="legenda-receita">Receitas</span><span className="legenda-despesa">Despesas</span></div></div>
    <div className="area-grafico">
      <div className="linhas-grafico"><i/><i/><i/><i/></div>
      <div className="coluna-grafico"><strong className="texto-verde">{moeda(receitas)}</strong><div className="trilho-barra"><div className="barra-grafico barra-receita" style={{height:`${altura(receitas)}%`}}/></div><span>Receitas</span></div>
      <div className="coluna-grafico"><strong className="texto-vermelho">{moeda(despesas)}</strong><div className="trilho-barra"><div className="barra-grafico barra-despesa" style={{height:`${altura(despesas)}%`}}/></div><span>Despesas</span></div>
      {maior===0&&<p className="grafico-sem-dados">Nenhum valor encontrado neste período.</p>}
    </div>
  </section>
}

function GraficoDistribuicao({receitas,despesas}:{receitas:number;despesas:number}){
  const total=receitas+despesas,percentualReceitas=total===0?0:(receitas/total)*100,moeda=(valor:number)=>valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const fundo=total===0?'conic-gradient(#27415f 0 100%)':`conic-gradient(#4ade80 0 ${percentualReceitas}%,#fb7185 ${percentualReceitas}% 100%)`;
  return <section className="grafico-resumo grafico-distribuicao" aria-label={`Distribuição financeira: ${percentualReceitas.toFixed(1)}% receitas e ${(100-percentualReceitas).toFixed(1)}% despesas`}>
    <div className="cabecalho-grafico"><div><h2>Distribuição financeira</h2><p>Participação no total movimentado</p></div></div>
    <div className="conteudo-rosca">
      <div className="grafico-rosca" style={{background:fundo}}><div className="centro-rosca"><strong>{total===0?'0%':`${percentualReceitas.toFixed(0)}%`}</strong><span>receitas</span></div></div>
      <div className="detalhes-rosca">
        <div className="detalhe-receita"><span>Receitas</span><strong>{moeda(receitas)}</strong><small>{total===0?'0,0':percentualReceitas.toFixed(1).replace('.',',')}%</small></div>
        <div className="detalhe-despesa"><span>Despesas</span><strong>{moeda(despesas)}</strong><small>{total===0?'0,0':(100-percentualReceitas).toFixed(1).replace('.',',')}%</small></div>
      </div>
    </div>
  </section>
}
