# FlowFinance

Aplicação web para controle de contas a pagar e receber. O sistema oferece parcelamento, baixas, anexos, recorrências, contas bancárias, relatórios, compromissos, usuários, papéis e notificações via ntfy.

## Acesso público

O FlowFinance está disponível publicamente em [http://flowfinance.ddns.net/](http://flowfinance.ddns.net/).

## Tecnologias

- Backend: Java 25, Spring Boot, Spring JDBC, Flyway e PostgreSQL.
- Frontend: React 19, TypeScript e Vite.
- Autenticação: sessão HTTP com senhas armazenadas usando BCrypt.

## Requisitos

- Java 25
- Maven 3.9+
- PostgreSQL 14 ou superior
- Node.js 22 ou superior e npm

## Configuração

Crie um banco PostgreSQL e configure as variáveis antes de iniciar o backend:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/sistemaFinanceiro"
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "sua_senha"
$env:NTFY_BASE_URL = "https://ntfy.sh" # opcional
```

Para preservar a execução local existente, a senha padrão de desenvolvimento é `djonata`. Defina `DB_PASSWORD` obrigatoriamente em outros ambientes. O Flyway aplica automaticamente as migrations de `backend/src/main/resources/db/migration`.

Em uma instalação nova, o acesso inicial é `admin` / `admin`. Troque essa senha antes de disponibilizar o sistema para outros usuários.

## Execução

Backend:

```powershell
cd backend
mvn spring-boot:run
```

Frontend, em outro terminal:

```powershell
cd frontend
npm install
npm run dev
```

- Backend: `http://localhost:8080`
- Frontend: `http://localhost:5173`

Para apontar o frontend para outro backend, defina `VITE_API_URL`, incluindo o caminho `/api`.

No Windows, caso o PowerShell bloqueie `npm.ps1`, execute os comandos como `npm.cmd install` e `npm.cmd run dev`.

## Estrutura do projeto

```text
FlowFinance/
├── backend/
│   ├── database/                         # script legado de referência
│   └── src/
│       ├── main/java/.../                # controllers, services, config e models
│       ├── main/resources/db/migration/  # migrations Flyway
│       └── test/java/.../                # testes automatizados
├── frontend/
│   ├── public/                           # arquivos estáticos
│   └── src/
│       ├── telas/                        # telas agrupadas por domínio
│       ├── api.ts                        # cliente da API
│       └── types.ts                      # contratos compartilhados no frontend
└── .editorconfig                         # codificação e indentação do projeto
```

O backend segue a separação `controller` → `service` → PostgreSQL via `JdbcTemplate`. No frontend, cada domínio possui sua própria pasta dentro de `src/telas`.

## Funcionalidades principais

- Contas a pagar e receber, com parcelas, anexos, baixas e estornos.
- Lançamentos recorrentes diários, semanais, mensais ou anuais.
- Contas bancárias vinculadas a um titular e débito automático.
- Relatório mensal por vencimento, situação e banco de débito automático.
- Categorias e subcategorias com CRUD completo e vínculo de cada subcategoria à sua categoria.
- Contas, compromissos, relatórios e demais visualizações com informações de categoria e subcategoria.
- Agenda e relatório de compromissos por período, incluindo data e horário, hora da notificação e situação.
- Pessoas e canais de notificação WhatsApp/ntfy, com geração automática de tópico ntfy.
- Sugestão automática da pessoa vinculada ao usuário autenticado ao cadastrar contas e compromissos; a seleção continua editável.
- Mensagens de notificação de contas e compromissos geradas em um componente centralizado.
- Usuários, papéis e permissões por funcionalidade, incluindo quatro permissões CRUD para subcategorias; o vínculo entre usuário e pessoa usa as permissões já existentes de usuários.
- Resumo financeiro e notificações de vencimento.

### Categorias e subcategorias

O cadastro de subcategorias permite incluir, consultar, editar e excluir registros. Cada subcategoria deve ser relacionada a uma categoria por meio da caixa de seleção exibida no formulário. Contas e compromissos podem usar esse detalhamento, que também aparece nas respectivas listagens, calendários e relatórios.

### Pessoas e notificações

Um usuário pode ser vinculado a uma pessoa. Ao abrir o cadastro de uma conta ou compromisso, essa pessoa é sugerida na lista de destinatários de notificação, sem impedir que seja removida ou que outras pessoas sejam selecionadas. No cadastro da pessoa, o botão **Gerar tópico** preenche um identificador ntfy aleatório. A composição das mensagens de contas e compromissos fica centralizada para manter o conteúdo consistente entre os envios.

O acesso aos novos cadastros e vínculos segue o modelo de papéis e permissões do sistema. Conceda as funcionalidades de subcategoria aos papéis que devem utilizá-las; a configuração da pessoa vinculada é protegida pelas permissões de cadastro e alteração de usuários.

### Recorrências

Ao cadastrar uma conta recorrente, o sistema cria lançamentos independentes até 31 de dezembro do ano do primeiro vencimento. A edição de um lançamento existente não gera novamente a série. Em recorrências mensais, cada data é calculada a partir do vencimento original; por exemplo, uma série iniciada em 31 de janeiro usa o último dia de fevereiro e volta ao dia 31 em março.

## Banco de dados

As migrations Flyway são a fonte oficial do esquema. Não altere migrations já aplicadas; crie uma nova migration versionada.

O arquivo `backend/database/setup.sql` é legado e não deve ser usado em instalações novas.

## Validação

Backend:

```powershell
cd backend
mvn clean verify
```

Frontend:

```powershell
cd frontend
npm run build
```

O backend possui testes de autenticação, autorização, dashboard, recorrência, notificações e estorno de contas. O build do frontend executa o TypeScript em modo estrito antes de gerar o pacote de produção.

## Segurança e produção

- O navegador pode lembrar apenas o nome do usuário; a senha não é persistida pelo frontend.
- Use HTTPS em produção e cookies de sessão seguros no proxy ou servidor de aplicação.
- Restrinja o CORS às origens reais da implantação.
- Não exponha o PostgreSQL à internet.
- Não compartilhe tópicos ntfy.
- Substitua imediatamente as credenciais administrativas iniciais.
- Faça backup do banco e dos anexos antes de aplicar novas versões.

Para produção, defina ao menos `DB_PASSWORD` e `SESSION_COOKIE_SECURE=true`. A configuração padrão de CORS aceita somente endereços locais; ajuste `ConfiguracaoCors` para os domínios reais antes da publicação.
