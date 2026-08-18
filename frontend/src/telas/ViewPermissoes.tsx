import{useEffect,useState}from'react';
import{buscarPapel,excluirPapel,listarPapeis}from'../api';
import type{PapelDetalhe,PapelResumo}from'../api';
import Permissao from'./Permissao';

export default function ViewPermissoes(){
  const[papeis,setPapeis]=useState<PapelResumo[]>([]),[edicao,setEdicao]=useState<PapelDetalhe|null|undefined>(undefined),[erro,setErro]=useState(''),[menu,setMenu]=useState<{id:number;x:number;y:number}|null>(null);
  const[nomeFiltro,setNomeFiltro]=useState(''),[situacaoFiltro,setSituacaoFiltro]=useState('');
  async function carregar(){try{setPapeis(await listarPapeis());setErro('')}catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar os papéis.')}}
  useEffect(()=>{carregar()},[]);
  if(edicao!==undefined)return <Permissao registro={edicao??undefined} aoCancelar={()=>setEdicao(undefined)} aoSalvar={()=>{setEdicao(undefined);carregar()}}/>;
  async function editar(id:number){try{setEdicao(await buscarPapel(id))}catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar o papel.')}}
  async function excluir(){if(!menu||!confirm('Deseja excluir definitivamente este papel?'))return;try{await excluirPapel(menu.id);setMenu(null);await carregar()}catch(e){setErro(e instanceof Error?e.message:'Erro ao excluir o papel.')}}
  const filtrados=papeis.filter(p=>(!nomeFiltro||p.nome.toLocaleLowerCase('pt-BR').includes(nomeFiltro.toLocaleLowerCase('pt-BR')))&&(!situacaoFiltro||p.ativo===(situacaoFiltro==='ATIVO')));
  return <section className="painel"><div className="cabecalho-listagem"><div><h1>Permissões</h1><p className="subtitulo">Gerencie os papéis e suas funções. Dê dois cliques para alterar.</p></div><button className="botao-adicionar" onClick={()=>setEdicao(null)}>+ Novo papel</button></div>{erro&&<p className="mensagem-erro">{erro}</p>}
    <div className="filtros-contas filtros-usuarios"><label className="rotulo-campo">Papel<input className="campo-formulario" value={nomeFiltro} placeholder="Buscar papel" onChange={e=>setNomeFiltro(e.target.value)}/></label><label className="rotulo-campo">Situação<select className="campo-formulario" value={situacaoFiltro} onChange={e=>setSituacaoFiltro(e.target.value)}><option value="">Todas</option><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label><button className="botao-limpar-filtros" type="button" onClick={()=>{setNomeFiltro('');setSituacaoFiltro('')}}>Limpar filtros</button></div>
    <div className="tabela-responsiva"><table className="tabela-usuarios tabela-contas"><thead><tr><th>Papel</th><th>Descrição</th><th>Funções habilitadas</th><th>Situação</th></tr></thead><tbody>{filtrados.map(p=><tr key={p.id} onDoubleClick={()=>editar(p.id)} onContextMenu={e=>{e.preventDefault();setMenu({id:p.id,x:e.clientX,y:e.clientY})}}><td>{p.nome}</td><td>{p.descricao||'—'}</td><td className="texto-funcoes">{p.habilitadas}/{p.totalFuncionalidades}</td><td><span className={p.ativo?'situacao-ativa':'situacao-inativa'}>{p.ativo?'Ativo':'Inativo'}</span></td></tr>)}{!filtrados.length&&<tr><td colSpan={4} className="lista-vazia">Nenhum papel encontrado.</td></tr>}</tbody></table></div>
    {menu&&<><button className="fechar-menu-contexto" aria-label="Fechar" onClick={()=>setMenu(null)}/><div className="menu-contexto" style={{left:menu.x,top:menu.y}}><button className="acao-perigosa" onClick={excluir}>Excluir</button></div></>}
  </section>;
}
