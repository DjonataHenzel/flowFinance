import{useEffect,useState}from'react';
import{excluirUsuario,listarUsuarios}from'../../api';
import type{Funcionalidade,UsuarioResumo}from'../../api';
import Usuario from'./Usuario';

export default function ViewUsuario({funcionalidades}:{funcionalidades:Funcionalidade[]}){
  const[usuarios,setUsuarios]=useState<UsuarioResumo[]>([]),[edicao,setEdicao]=useState<UsuarioResumo|null|undefined>(undefined),[erro,setErro]=useState(''),[menu,setMenu]=useState<{id:number;x:number;y:number}|null>(null);
  const[usuarioFiltro,setUsuarioFiltro]=useState(''),[situacaoFiltro,setSituacaoFiltro]=useState('');
  async function carregar(){try{setUsuarios(await listarUsuarios());setErro('')}catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar usuários.')}}
  useEffect(()=>{carregar()},[]);
  if(edicao!==undefined)return <Usuario registro={edicao??undefined} aoCancelar={()=>setEdicao(undefined)} aoSalvar={()=>{setEdicao(undefined);carregar()}}/>;
  async function excluir(){if(!menu||!confirm('Deseja excluir definitivamente este usuário?'))return;try{await excluirUsuario(menu.id);setMenu(null);await carregar()}catch(e){setErro(e instanceof Error?e.message:'Erro ao excluir usuário.')}}
  const usuariosFiltrados=usuarios.filter(u=>(!usuarioFiltro||u.usuario.toLocaleLowerCase('pt-BR').includes(usuarioFiltro.toLocaleLowerCase('pt-BR')))&&(!situacaoFiltro||String(u.ativo)===(situacaoFiltro==='ATIVO'?'true':'false')));
  const tem=(f:Funcionalidade)=>funcionalidades.includes(f);
  return <section className="painel">
    <div className="cabecalho-listagem"><div><h1>Usuários</h1><p className="subtitulo">{tem('ALTERAR_USUARIOS')?'Dê dois cliques para alterar.':'Usuários cadastrados.'}</p></div>{tem('CADASTRAR_USUARIOS')&&<button className="botao-adicionar" onClick={()=>setEdicao(null)}>+ Adicionar usuário</button>}</div>
    {erro&&<p className="mensagem-erro">{erro}</p>}
    <div className="filtros-contas filtros-usuarios">
      <label className="rotulo-campo">Usuário<input className="campo-formulario" value={usuarioFiltro} placeholder="Buscar usuário" onChange={e=>setUsuarioFiltro(e.target.value)}/></label>
      <label className="rotulo-campo">Situação<select className="campo-formulario" value={situacaoFiltro} onChange={e=>setSituacaoFiltro(e.target.value)}><option value="">Todas</option><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label>
      <button className="botao-limpar-filtros" type="button" onClick={()=>{setUsuarioFiltro('');setSituacaoFiltro('')}}>Limpar filtros</button>
    </div>
    <div className="tabela-responsiva"><table className="tabela-usuarios tabela-contas"><thead><tr><th>Usuário</th><th>Papel</th><th>Situação</th><th>Data do cadastro</th></tr></thead><tbody>{usuariosFiltrados.map(u=><tr key={u.id} onDoubleClick={()=>tem('ALTERAR_USUARIOS')&&setEdicao(u)} onContextMenu={e=>{e.preventDefault();setMenu({id:u.id,x:e.clientX,y:e.clientY})}}><td>{u.usuario}</td><td>{u.papel||'Administrador legado'}</td><td><span className={u.ativo?'situacao-ativa':'situacao-inativa'}>{u.ativo?'Ativo':'Inativo'}</span></td><td>{new Date(u.criadoEm).toLocaleString('pt-BR')}</td></tr>)}{!usuariosFiltrados.length&&<tr><td colSpan={4} className="lista-vazia">Nenhum usuário encontrado.</td></tr>}</tbody></table></div>
    {menu&&<><button className="fechar-menu-contexto" aria-label="Fechar" onClick={()=>setMenu(null)}/>{tem('EXCLUIR_USUARIOS')&&<div className="menu-contexto" style={{left:menu.x,top:menu.y}}><button className="acao-perigosa" onClick={excluir}>Excluir</button></div>}</>}
  </section>;
}
