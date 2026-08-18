import type { RespostaLogin, ResumoFinanceiro } from './types';
const API_URL=import.meta.env.VITE_API_URL??'http://localhost:8080/api';
async function requisicao(url:string, opcoes?:RequestInit){try{return await fetch(url,opcoes)}catch{throw new Error('Não foi possível conectar ao backend. Verifique se ele está em execução na porta 8080.')}}
async function json<T>(r:Response,mensagem:string):Promise<T>{const b=await r.json().catch(()=>null);if(!r.ok)throw new Error(b?.message??mensagem);return b;}
export async function entrar(usuario:string,senha:string):Promise<RespostaLogin>{return json(await fetch(`${API_URL}/autenticacao/entrar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario,senha})}),'Não foi possível entrar.');}
export async function buscarResumoFinanceiro(dataInicio?:string,dataFim?:string,situacao?:SituacaoContaEnum):Promise<ResumoFinanceiro>{const parametros=new URLSearchParams();if(dataInicio)parametros.set('dataInicio',dataInicio);if(dataFim)parametros.set('dataFim',dataFim);if(situacao)parametros.set('situacao',situacao);const consulta=parametros.size?`?${parametros}`:'';return json(await fetch(`${API_URL}/dashboard${consulta}`),'Erro ao carregar o resumo financeiro');}
export type SituacaoParcelaEnum='PENDENTE'|'PAGA'|'RECEBIDA';
export interface ParcelaConta{numero:number;valor:number;dataVencimento:string;situacao?:SituacaoParcelaEnum;baixadaEm?:string|null;observacaoBaixa?:string|null}
export type TipoContaEnum='RECEBER'|'PAGAR';
export type SituacaoContaEnum='ABERTA'|'PAGA'|'RECEBIDA'|'PARCELADA';
export interface NovaConta{descricao:string;valorTotal:number;tipo:TipoContaEnum;parcelas:ParcelaConta[]}
export interface AnexoConta{id:number;nomeArquivo:string;descricao:string;tamanho:number}
export interface AnexoNovo{arquivo:File;descricao:string}
export interface ContaResumo{id:number;descricao:string;valorTotal:number;tipo:TipoContaEnum;situacao:SituacaoContaEnum;criadoEm:string;baixadaEm:string|null;possuiBaixas:boolean}
export interface ContaDetalhe extends ContaResumo{parcelas:ParcelaConta[];anexos:AnexoConta[]}
function form(c:NovaConta,a:AnexoNovo[],e:AnexoConta[]=[]){const f=new FormData();f.append('conta',JSON.stringify(c));a.forEach(x=>f.append('anexos',x.arquivo));f.append('descricoesAnexos',JSON.stringify(a.map(x=>x.descricao)));f.append('anexosExistentes',JSON.stringify(e.map(({id,descricao})=>({id,descricao}))));return f;}
export async function cadastrarConta(c:NovaConta,a:AnexoNovo[],e:AnexoConta[]=[]){return json<{id:number;message:string}>(await fetch(`${API_URL}/contas`,{method:'POST',body:form(c,a,e)}),'Não foi possível cadastrar a conta.');}
export async function alterarConta(id:number,c:NovaConta,a:AnexoNovo[],e:AnexoConta[]){return json<{id:number;message:string}>(await fetch(`${API_URL}/contas/${id}`,{method:'PUT',body:form(c,a,e)}),'Não foi possível alterar a conta.');}
export async function listarContas(){return json<ContaResumo[]>(await requisicao(`${API_URL}/contas`),'Não foi possível carregar as contas.');}
export async function buscarConta(id:number){return json<ContaDetalhe>(await fetch(`${API_URL}/contas/${id}`),'Conta não encontrada.');}
export async function visualizarAnexo(contaId:number,anexoId:number){const r=await requisicao(`${API_URL}/contas/${contaId}/anexos/${anexoId}`);if(!r.ok)throw new Error('Não foi possível abrir o anexo.');const blob=await r.blob(),url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function duplicarConta(id:number){return json(await fetch(`${API_URL}/contas/${id}/duplicar`,{method:'POST'}),'Não foi possível duplicar.');}
export async function excluirConta(id:number){return json(await requisicao(`${API_URL}/contas/${id}`,{method:'DELETE'}),'Não foi possível excluir a conta.');}
export async function baixarConta(id:number,pagamento:'TOTAL'|'PARCIAL',numeroParcela:number|null,observacao:string){return json(await requisicao(`${API_URL}/contas/${id}/baixar`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pagamento,numeroParcela,observacao})}),'Não foi possível baixar a conta.');}
export async function estornarBaixaConta(id:number){return json(await requisicao(`${API_URL}/contas/${id}/estornar-baixa`,{method:'PATCH'}),'Não foi possível estornar a baixa.');}
async function enviar<T>(caminho:string,dados:object):Promise<T>{return json(await fetch(`${API_URL}${caminho}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)}),'Não foi possível concluir a operação.');}
export function cadastrarUsuario(usuario:string,senha:string,papelId:number):Promise<{message:string}>{return enviar('/usuarios',{usuario,senha,papelId});}
export interface UsuarioResumo{id:number;usuario:string;ativo:boolean;criadoEm:string;papelId:number|null;papel:string|null}
export async function listarUsuarios(){return json<UsuarioResumo[]>(await fetch(`${API_URL}/usuarios`),'Não foi possível carregar os usuários.');}
export async function alterarUsuario(id:number,usuario:string,senha:string,ativo:boolean,papelId:number){return json(await fetch(`${API_URL}/usuarios/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario,senha:senha||null,ativo,papelId})}),'Não foi possível alterar o usuário.');}
export async function excluirUsuario(id:number){return json(await requisicao(`${API_URL}/usuarios/${id}`,{method:'DELETE'}),'Não foi possível excluir o usuário.');}
export type Funcionalidade='VISUALIZAR_DASHBOARD'|'CONSULTAR_CONTAS'|'CADASTRAR_CONTAS'|'ALTERAR_CONTAS'|'BAIXAR_RECEBER_CONTAS'|'ESTORNAR_BAIXAS'|'DUPLICAR_CONTAS'|'EXCLUIR_CONTAS'|'CONSULTAR_USUARIOS'|'CADASTRAR_USUARIOS'|'ALTERAR_USUARIOS'|'EXCLUIR_USUARIOS'|'GERENCIAR_PERMISSOES';
export interface PapelResumo{id:number;nome:string;descricao:string|null;ativo:boolean;criadoEm:string;habilitadas:number;totalFuncionalidades:number}
export interface PapelDetalhe{id:number;nome:string;descricao:string|null;ativo:boolean;criadoEm:string;funcionalidades:Funcionalidade[]}
export async function listarPapeis(){return json<PapelResumo[]>(await requisicao(`${API_URL}/permissoes`),'Não foi possível carregar os papéis.');}
export async function buscarPapel(id:number){return json<PapelDetalhe>(await requisicao(`${API_URL}/permissoes/${id}`),'Papel não encontrado.');}
export async function listarFuncionalidades(){return json<Funcionalidade[]>(await requisicao(`${API_URL}/permissoes/funcionalidades`),'Não foi possível carregar as funcionalidades.');}
export async function cadastrarPapel(nome:string,descricao:string,ativo:boolean,funcionalidades:Funcionalidade[]){return enviar<{id:number;message:string}>('/permissoes',{nome,descricao,ativo,funcionalidades});}
export async function alterarPapel(id:number,nome:string,descricao:string,ativo:boolean,funcionalidades:Funcionalidade[]){return json(await requisicao(`${API_URL}/permissoes/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome,descricao,ativo,funcionalidades})}),'Não foi possível alterar o papel.');}
export async function excluirPapel(id:number){return json(await requisicao(`${API_URL}/permissoes/${id}`,{method:'DELETE'}),'Não foi possível excluir o papel.');}
