# FlowFinance

Aplicação web para controle financeiro pessoal, com contas a pagar e receber, compromissos e acompanhamento de resultados.

## Acesso à demonstração

Acesse [flowfinance.ddns.net](http://flowfinance.ddns.net/) e entre com:

- **Usuário:** `convidado`
- **Senha:** `convidado`

O perfil convidado é apenas para navegar pelas telas e conhecer o projeto e seu layout. Não permite cadastrar nem consultar informações.

## Funcionalidades

- Contas, parcelas, recorrências, anexos, baixas e estornos.
- Categorias, subcategorias, contas bancárias e relatórios.
- Compromissos em calendário, com notificações.
- Resumo financeiro e gráficos comparativos.
- Usuários, papéis e permissões.

As telas de contas, relatórios e calendário receberam melhorias de apresentação e responsividade.

## Tecnologias

- **Backend:** Java 25, Spring Boot, Spring JDBC, Flyway e PostgreSQL.
- **Frontend:** React 19, TypeScript e Vite.

## Executar localmente

Requisitos: Java 25, Maven 3.9+, PostgreSQL 14+ e Node.js 22+.

Configure o acesso ao PostgreSQL no PowerShell:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/sistemaFinanceiro"
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "sua_senha"
```

As migrations do Flyway são aplicadas automaticamente na inicialização. O script `backend/database/setup.sql` é legado e não deve ser usado para novas instalações.

Configurações opcionais do backend:

```powershell
$env:APP_TIME_ZONE = "America/Sao_Paulo"
$env:APP_PUBLIC_URL = "http://localhost:8080"
$env:NTFY_BASE_URL = "https://ntfy.sh"
```

`APP_PUBLIC_URL` deve apontar para o endereço público do backend quando links de anexos forem abertos em outro dispositivo. O frontend usa `/api` por padrão; para uma API em outro endereço, configure `VITE_API_URL` no ambiente do Vite, incluindo `/api`.

Inicie o backend:

```powershell
cd backend
mvn spring-boot:run
```

Em outro terminal, inicie o frontend:

```powershell
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:8080`

## Validação

Backend:

```powershell
cd backend
mvn clean verify
```

Frontend:

```powershell
cd frontend
npm.cmd run build
```

No PowerShell, use `npm.cmd` caso a política de execução bloqueie `npm.ps1`.

## Produção

- Troque a senha inicial `admin` / `admin` e defina `DB_PASSWORD`; a senha padrão do banco configurada pela aplicação é apenas para desenvolvimento local.
- Use HTTPS e defina `SESSION_COOKIE_SECURE=true`.
- Ajuste `APP_PUBLIC_URL` e restrinja as origens CORS aos domínios da implantação em `ConfiguracaoCors`.
- Não exponha o PostgreSQL à internet e mantenha backups do banco e dos anexos.
