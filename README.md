# FlowFinance

Sistema pessoal de controle de contas a pagar e receber, com parcelas, baixas, anexos, resumo financeiro, usuários, permissões e notificações ntfy.

## Requisitos

- Java 25
- PostgreSQL
- Node.js e npm
- Maven 3.9+

## Banco de dados

Crie um banco PostgreSQL chamado `sistemaFinanceiro`. O Flyway executa automaticamente as migrations de `backend/src/main/resources/db/migration`.

Variáveis opcionais:

```text
DB_URL=jdbc:postgresql://localhost:5432/sistemaFinanceiro
DB_USERNAME=postgres
DB_PASSWORD=sua_senha
NTFY_BASE_URL=https://ntfy.sh
```

Em uma instalação nova, o usuário e a senha iniciais são `admin`. Altere a senha após o primeiro acesso.

## Execução

```powershell
cd backend
mvn spring-boot:run

cd ../frontend
npm install
npm run dev
```

Backend: `http://localhost:8080`. Frontend: `http://localhost:5173`.

## Notificações ntfy

1. Instale o aplicativo ntfy no celular.
2. Habilite ntfy no cadastro do usuário.
3. Copie o tópico secreto e assine-o no aplicativo.
4. Configure horário e dias de antecedência.

O backend verifica os agendamentos a cada minuto. A tabela `historico_notificacoes` impede duplicidade diária. O envio manual continua disponível no botão **Notificar vencimentos**.

## Validação

```powershell
cd backend
mvn test

cd ../frontend
npm run build
```

## Segurança

- Não compartilhe tópicos ntfy.
- Não exponha o PostgreSQL na internet.
- Use HTTPS e revise o CORS antes de publicar o sistema.
- A opção de lembrar senha existe apenas durante os testes e deve ser removida antes da publicação.
