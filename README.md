# App.CBO

Gestão do Curso Básico de Obras e Construção Civil: cursos, alunos, formas de pagamento, cobranças (Pix e boleto) e relatórios.

O mesmo código roda de duas formas:

| | Desktop | Web e celular |
|---|---|---|
| Onde roda | Electron no computador | Vercel, no navegador |
| Banco | SQLite (arquivo local) | PostgreSQL no Neon |
| Login | sessão na memória do app | cookie seguro (12 h) |

As telas (React + Tailwind) e as regras de negócio (`src/core`) são as mesmas nos dois.

## Como rodar

Pré-requisito: [Node.js 22 LTS](https://nodejs.org).

```bash
npm install        # instala tudo e prepara o SQLite para o Electron
npm run dev        # abre o app em modo desenvolvimento (recarrega ao salvar)
npm start          # compila a interface e abre o app
npm run dist       # gera o instalador (.exe no Windows) na pasta release/
```

Login inicial: **admin@appcbo.com** / **admin123**. No primeiro acesso o app obriga a criar uma senha nova (mínimo 8 caracteres).

Na primeira abertura o banco `appcbo.sqlite` é criado sozinho na pasta de dados do usuário
(no Windows: `%APPDATA%\App.CBO`), com as tabelas, o usuário ADMIN, 4 formas de pagamento e 3 cursos de exemplo.

## Publicar na Vercel (web e celular)

1. **Suba o código para o GitHub** (a pasta `app-cbo` inteira, como um repositório).
2. Na Vercel: **Add New… > Project**, escolha o repositório e clique em **Deploy**. As configurações de build já estão no `vercel.json`, não precisa mexer.
3. **Crie o banco:** no projeto da Vercel, abra **Storage > Create Database > Neon (Serverless Postgres)**, aceite o plano grátis e conecte ao projeto. A Vercel cria a variável `DATABASE_URL` sozinha.
4. **(Recomendado)** Em **Settings > Environment Variables**, crie `SESSION_SECRET` com um texto longo e aleatório (é a chave que assina o login).
5. Em **Deployments**, clique nos três pontinhos do último deploy e em **Redeploy**, para ele pegar o banco.
6. Abra o endereço `https://seu-projeto.vercel.app`, entre com admin@appcbo.com / admin123 e crie a senha nova. As tabelas são criadas sozinhas nesse primeiro acesso.

No celular, basta abrir o mesmo endereço. No Chrome/Safari dá para usar "Adicionar à tela inicial".

### Testar a versão web no computador

```bash
cp .env.example .env      # cole a DATABASE_URL do Neon (Vercel > Storage > seu banco > .env.local)
npm run dev:web           # abre em http://localhost:5173
```

Sem `DATABASE_URL`, o `dev:web` usa um SQLite local (`appcbo-web.sqlite`); nesse caso rode antes `npm run rebuild:node`.

## Versão de teste no navegador (sem servidor)

`npm run build:demo` gera em `dist-demo/` uma versão que roda inteira no navegador (SQLite em WebAssembly/JS via sql.js), com os dados guardados só naquele navegador. Serve para testar telas e regras sem publicar nada. Nela, baixar PDF/Excel fica desativado.

## Testes

Os testes rodam a lógica de negócio direto no Node, sem abrir janela:

```bash
npm run rebuild:node && npm test
npm run rebuild:electron   # antes de voltar a abrir o app desktop
```

Para rodar os mesmos testes também no PostgreSQL, use um banco de teste vazio (ele é apagado a cada teste):
`TEST_DATABASE_URL=postgres://usuario:senha@localhost/appcbo_test npm test`

## Estrutura

```
app-cbo/
├── api/                   # funções da Vercel: /api/rpc e /api/arquivo
├── electron/
│   ├── main.js            # desktop: janela, banco SQLite e ponte IPC
│   └── preload.js         # expõe window.appcbo para a interface
├── server/dev-web.js      # servidor local para testar a versão web
├── vercel.json            # build e funções da Vercel
├── src/
│   ├── core/              # lógica de negócio + banco (sem Electron, sem React)
│   │   ├── index.js       # createApp({ databaseUrl } ou { arquivoSqlite })
│   │   ├── rpc.js         # lista das operações liberadas + regras de login (desktop e web)
│   │   ├── database/
│   │   │   ├── schema.js      # tabelas para SQLite e PostgreSQL + dados iniciais + migrações
│   │   │   └── adapters/      # sqlite.js (desktop) e postgres.js (Neon)
│   │   ├── services/
│   │   │   ├── auth.js            # login e troca de senha (bcrypt)
│   │   │   ├── cursos.js
│   │   │   ├── alunos.js          # cadastro, matrícula, parcelas, ficha financeira
│   │   │   ├── formasPagamento.js # parcelas, multa e juros
│   │   │   ├── cobrancas.js       # listagem/filtros, atraso, multa+juros, baixa manual
│   │   │   ├── dashboard.js       # indicadores e gráficos
│   │   │   ├── pix.js             # Pix Copia e Cola (BR Code) com CRC16
│   │   │   ├── documentos.js      # PDF de cobrança com QR Pix, relatório PDF e XLSX
│   │   │   └── configuracoes.js
│   │   └── utils/index.js     # CPF, datas, arredondamento
│   ├── web/               # sessão por cookie e tratamento das requisições HTTP
│   └── renderer/          # interface React + Tailwind (a mesma no desktop e na web)
│       ├── pages/         # Login, Dashboard, Cursos, Alunos, FormasPagamento, Cobrancas, Configuracoes
│       ├── components/    # Layout (menu lateral/gaveta no celular), Modal, ConfirmDialog, Tabela…
│       ├── context/       # login, tema claro/escuro, avisos
│       └── lib/api.js     # fala com o Electron no desktop ou com /api no navegador
├── tests/core.test.js
└── docs/telas/            # capturas de tela
```

## Regras de negócio

- **Matrícula:** ao cadastrar o aluno escolhendo curso, forma de pagamento e nº de parcelas, as parcelas mensais são geradas automaticamente (a diferença de centavos vai na 1ª).
- **Atrasado** não é gravado: é toda parcela pendente com vencimento no passado.
- **Multa e juros:** multa única (limitada a 2%, conforme o CDC) + juros ao mês proporcionais aos dias de atraso, conforme a forma de pagamento da matrícula.
- **Exclusões protegidas:** curso ou forma de pagamento já usados em matrículas não podem ser excluídos (marque como Inativo); aluno com pagamento registrado também não.

## Pix e boleto

- **Pix:** cadastre a chave Pix em Configurações. Cada parcela gera QR Code e Pix Copia e Cola com o valor atualizado, na tela ou em PDF (individual ou em lote). A confirmação do pagamento é manual (botão "Marcar como paga").
- **Boleto:** o PDF emitido é uma ficha de cobrança com Pix. Boleto registrado com código de barras exige contrato com um banco e integração com a API dele (ex.: Banco do Brasil, Inter, Sicoob, Asaas); o ponto de encaixe é `src/core/services/documentos.js`.

## Segurança

- Senhas guardadas com bcrypt; a senha padrão precisa ser trocada no primeiro acesso.
- Na web, o login fica num cookie `HttpOnly`, `Secure` e `SameSite=Strict`, assinado com HMAC; a API só aceita `POST` com JSON.
- Toda operação passa pela lista de `src/core/rpc.js`; nada fora dela é executado.
