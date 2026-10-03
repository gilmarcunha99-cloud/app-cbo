const bcrypt = require('bcryptjs');
const { exigir, ErroValidacao } = require('../utils');

const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, trocarSenha: !!u.trocar_senha });

function authService(db) {
  return {
    async login(email, senha) {
      exigir(email && senha, 'Informe e-mail e senha.');
      const u = await db.get('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?) AND ativo = 1', [String(email).trim()]);
      exigir(u && bcrypt.compareSync(String(senha), u.senha_hash), 'E-mail ou senha inválidos.');
      return publico(u);
    },

    // Usado para restaurar a sessão (cookie na web, memória no desktop).
    async usuario(id) {
      const u = await db.get('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [id]);
      if (!u) throw new ErroValidacao('Sessão expirada. Entre novamente.');
      return publico(u);
    },

    async alterarSenha(usuarioId, senhaAtual, novaSenha) {
      const u = await db.get('SELECT * FROM usuarios WHERE id = ?', [usuarioId]);
      exigir(u && bcrypt.compareSync(String(senhaAtual), u.senha_hash), 'Senha atual incorreta.');
      exigir(String(novaSenha || '').length >= 8, 'A nova senha precisa ter ao menos 8 caracteres.');
      exigir(novaSenha !== senhaAtual, 'A nova senha precisa ser diferente da atual.');
      await db.run('UPDATE usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?', [bcrypt.hashSync(novaSenha, 10), usuarioId]);
      return this.usuario(usuarioId);
    },
  };
}

module.exports = { authService };
