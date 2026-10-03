// Lista única das operações que a interface pode chamar, usada pelo Electron
// (IPC) e pela API web. Tudo, exceto o login, exige usuário autenticado.
const { ErroValidacao } = require('./utils');

const CANAIS = new Set([
  'dashboard.resumo',
  'cursos.listar', 'cursos.obter', 'cursos.criar', 'cursos.atualizar', 'cursos.excluir',
  'alunos.listar', 'alunos.ficha', 'alunos.criar', 'alunos.atualizar', 'alunos.excluir',
  'alunos.matricular', 'alunos.cancelarMatricula',
  'formasPagamento.listar', 'formasPagamento.criar', 'formasPagamento.atualizar', 'formasPagamento.excluir',
  'cobrancas.listar', 'cobrancas.marcarComoPaga', 'cobrancas.estornar', 'cobrancas.pixCopiaECola',
  'configuracoes.obter', 'configuracoes.salvar',
]);

// usuario: quem está logado (ou null). Devolve o resultado da operação.
// Login/sessão/senha são tratados à parte porque mexem na sessão.
async function executar(app, canal, args, usuario) {
  if (!Array.isArray(args)) args = [];
  if (canal === 'auth.login') return app.services.auth.login(args[0], args[1]);
  if (!usuario) throw new ErroValidacao('Sessão expirada. Entre novamente.');
  if (canal === 'auth.sessao') return app.services.auth.usuario(usuario.id);
  // O id vem da sessão, nunca da tela: ninguém troca a senha de outra pessoa.
  if (canal === 'auth.alterarSenha') return app.services.auth.alterarSenha(usuario.id, args[0], args[1]);
  if (!CANAIS.has(canal)) throw new ErroValidacao(`Operação não permitida: ${canal}`);
  const atual = await app.services.auth.usuario(usuario.id);
  if (atual.trocarSenha) throw new ErroValidacao('Troque a senha padrão antes de continuar.');
  const [servico, metodo] = canal.split('.');
  return app.services[servico][metodo](...args);
}

async function gerarArquivo(app, tipo, args, usuario) {
  if (!usuario) throw new ErroValidacao('Sessão expirada. Entre novamente.');
  const atual = await app.services.auth.usuario(usuario.id);
  if (atual.trocarSenha) throw new ErroValidacao('Troque a senha padrão antes de continuar.');
  if (!Array.isArray(args)) args = [];
  if (tipo === 'cobrancas') return app.arquivos.cobrancas(args[0]);
  if (tipo === 'relatorio') return app.arquivos.relatorio(args[0], args[1]);
  throw new ErroValidacao('Tipo de arquivo desconhecido.');
}

module.exports = { executar, gerarArquivo, CANAIS };
