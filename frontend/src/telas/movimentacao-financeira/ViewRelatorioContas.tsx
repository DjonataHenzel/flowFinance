import { FormEvent, useEffect, useState } from "react";
import { buscarRelatorioContas } from "../../api";
import type { ContaRelatorio } from "../../api";

const iso=(d:Date)=>d.toLocaleDateString("sv-SE");
const inicioMes=()=>{const d=new Date();return iso(new Date(d.getFullYear(),d.getMonth(),1))};
const fimMes=()=>{const d=new Date();return iso(new Date(d.getFullYear(),d.getMonth()+1,0))};
const moeda=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const rotuloBanco:Record<string,string>={NUBANK:"Nubank",SICREDI:"Sicredi",SICOOB:"Sicoob",BANCO_DO_BRASIL:"Banco do Brasil",CAIXA:"Caixa",PLUXE:"Pluxe"};

export default function ViewRelatorioContas(){
  const[inicio,setInicio]=useState(inicioMes),[fim,setFim]=useState(fimMes),[dados,setDados]=useState<ContaRelatorio[]>([]),[erro,setErro]=useState(""),[carregando,setCarregando]=useState(false);
  async function gerar(){if(fim<inicio){setErro("A data final não pode ser anterior à data inicial.");return}setCarregando(true);setErro("");try{setDados(await buscarRelatorioContas(inicio,fim))}catch(e){setErro(e instanceof Error?e.message:"Erro ao gerar relatório.")}finally{setCarregando(false)}}
  useEffect(()=>{gerar()},[]);
  function enviar(e:FormEvent){e.preventDefault();gerar()}
  const pagas=dados.filter(x=>x.tipo==="PAGAR"&&x.situacao==="PAGA"),
    aPagar=dados.filter(x=>x.tipo==="PAGAR"&&x.situacao==="PENDENTE"),
    recebidas=dados.filter(x=>x.tipo==="RECEBER"&&x.situacao==="RECEBIDA"),
    aReceber=dados.filter(x=>x.tipo==="RECEBER"&&x.situacao==="PENDENTE");
  const total=(itens:ContaRelatorio[])=>itens.reduce((s,x)=>s+x.valor,0);
  const debitosPorBanco=Object.values(dados.filter(x=>x.tipo==="PAGAR"&&x.debitoAutomatico&&x.banco).reduce<Record<string,{banco:string;pago:number;aPagar:number;contasPagas:ContaRelatorio[];contasAPagar:ContaRelatorio[]}>>((grupos,x)=>{const banco=x.banco!;grupos[banco]??={banco,pago:0,aPagar:0,contasPagas:[],contasAPagar:[]};if(x.situacao==="PAGA"){grupos[banco].pago+=x.valor;grupos[banco].contasPagas.push(x)}else{grupos[banco].aPagar+=x.valor;grupos[banco].contasAPagar.push(x)}return grupos},{})).sort((a,b)=>rotuloBanco[a.banco].localeCompare(rotuloBanco[b.banco],"pt-BR"));
  return <section className="resumo-financeiro relatorio">
    <h1>Relatório de contas mensal</h1><p className="subtitulo">Contas agrupadas pela situação das parcelas com vencimento no período.</p>
    <form className="filtros-resumo filtros-periodo" onSubmit={enviar}>
      <label className="rotulo-campo">Período inicial<input className="campo-formulario" type="date" value={inicio} onChange={e=>setInicio(e.target.value)} required/></label>
      <label className="rotulo-campo">Período final<input className="campo-formulario" type="date" value={fim} onChange={e=>setFim(e.target.value)} required/></label>
      <button className="botao-adicionar" disabled={carregando}>{carregando?"Gerando...":"Gerar relatório"}</button>
    </form>
    {erro&&<p className="mensagem-erro">{erro}</p>}
    <div className="grade-grupos-relatorio">
      <GrupoContas titulo="Contas pagas" itens={pagas} variante="pago"/>
      <GrupoContas titulo="Contas a pagar" itens={aPagar} variante="pagar"/>
      <GrupoContas titulo="Contas recebidas" itens={recebidas} variante="recebido"/>
      <GrupoContas titulo="Contas a receber" itens={aReceber} variante="receber"/>
    </div>
    <section className="resumo-debitos-automaticos">
      <div className="cabecalho-resumo-debitos"><div><h2>Débitos automáticos por banco</h2><p>Somatória das contas pagas e a pagar vinculadas a cada banco.</p></div><strong>{moeda(debitosPorBanco.reduce((s,x)=>s+x.pago+x.aPagar,0))}</strong></div>
      <div className="grade-debitos-banco">{debitosPorBanco.map(x=><article key={x.banco}><h3>{rotuloBanco[x.banco]}</h3><div><DetalhesDebitos rotulo="Pago" total={x.pago} itens={x.contasPagas} classe="texto-verde"/><DetalhesDebitos rotulo="A pagar" total={x.aPagar} itens={x.contasAPagar} classe="texto-vermelho"/></div><footer><span>Total</span><strong>{moeda(x.pago+x.aPagar)}</strong></footer></article>)}{!debitosPorBanco.length&&<p className="lista-vazia">Nenhuma conta com débito automático no período.</p>}</div>
    </section>
    <div className="totalizador-relatorio totalizador-contas">
      <span className="total-pago">Total pago<strong>{moeda(total(pagas))}</strong></span>
      <span className="total-pagar">A pagar<strong>{moeda(total(aPagar))}</strong></span>
      <span className="total-recebido">Total recebido<strong>{moeda(total(recebidas))}</strong></span>
      <span className="total-receber">A receber<strong>{moeda(total(aReceber))}</strong></span>
      <span className="total-geral">Total do período<strong>{moeda(total(dados))}</strong></span>
    </div>
  </section>
}

function DetalhesDebitos({rotulo,total,itens,classe}:{rotulo:string;total:number;itens:ContaRelatorio[];classe:string}){
  return <div className="total-debito-com-detalhes" tabIndex={0}>{rotulo}<strong className={classe}>{moeda(total)}</strong><div className="popup-detalhes-debitos" role="tooltip"><b>{rotulo}</b>{itens.length?itens.map(x=><span key={`${x.id}-${x.parcela}`}><span>{x.descricao}{x.totalParcelas>1?` · ${x.parcela}/${x.totalParcelas}`:""}</span><strong>{moeda(x.valor)}</strong></span>):<em>Nenhuma conta neste período.</em>}<footer><span>Total</span><strong>{moeda(total)}</strong></footer></div></div>
}

function GrupoContas({titulo,itens,variante}:{titulo:string;itens:ContaRelatorio[];variante:"pago"|"pagar"|"recebido"|"receber"}){
  return <section className={`grupo-relatorio grupo-${variante}`}><h2><span>{titulo}</span><small>{itens.length} {itens.length===1?"parcela":"parcelas"}</small></h2><div className="tabela-responsiva"><table className="tabela-usuarios tabela-relatorio"><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Subcategoria</th><th>Parcela</th><th>Situação</th><th>Valor</th></tr></thead><tbody>{itens.map(x=><tr key={`${x.id}-${x.parcela}`}><td>{new Date(`${x.dataVencimento}T12:00:00`).toLocaleDateString("pt-BR")}</td><td>{x.descricao}</td><td>{x.categoria??"Sem categoria"}</td><td>{x.subcategoria??"Sem subcategoria"}</td><td>{x.parcela}/{x.totalParcelas}</td><td>{x.situacao==="PENDENTE"?"Pendente":x.situacao==="PAGA"?"Paga":"Recebida"}</td><td>{moeda(x.valor)}</td></tr>)}{!itens.length&&<tr><td className="lista-vazia" colSpan={7}>Nenhuma conta nesta categoria.</td></tr>}</tbody><tfoot><tr><th colSpan={6}>Subtotal</th><th>{moeda(itens.reduce((s,x)=>s+x.valor,0))}</th></tr></tfoot></table></div></section>
}
