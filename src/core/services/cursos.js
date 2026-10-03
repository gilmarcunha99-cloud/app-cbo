const { exigir, round2 } = require('../utils');

function validar(c) {
  exigir(c.nome && c.nome.trim(), 'Informe o nome do curso.');
  exigir(Number(c.carga_horaria) > 0, 'A carga horária deve ser maior que zero.');
  exigir(Number(c.valor) >= 0, 'Informe um valor válido.');
  exigir(c.instrutor && c.instrutor.trim(), 'Informe o nome do instrutor.');
  exigir(['ATIVO', 'INATIVO'].includes(c.status || 'ATIVO'), 'Status inválido.');
  return [
    c.nome.trim(),
    Math.round(Number(c.carga_horaria)),
    (c.descricao || '').trim(),
    round2(c.valor),
    c.instrutor.trim(),
    c.status || 'ATIVO',
  ];
}

function cursosService(db) {
  return {
    async listar({ busca = '', status } = {}) {
      const params = [`%${busca.toLowerCase()}%`];
      let filtroStatus = '';
      if (status) { filtroStatus = 'AND c.status = ?'; params.push(status); }
      return db.all(`
        SELECT c.*,
          (SELECT COUNT(*) FROM matriculas m WHERE m.curso_id = c.id AND m.status = 'ATIVA') AS alunos_ativos
        FROM cursos c
        WHERE LOWER(c.nome) LIKE ? ${filtroStatus}
        ORDER BY c.nome`, params);
    },

    async obter(id) {
      const c = await db.get('SELECT * FROM cursos WHERE id = ?', [id]);
      exigir(c, 'Curso não encontrado.');
      return c;
    },

    async criar(dados) {
      const id = await db.insert(`INSERT INTO cursos (nome, carga_horaria, descricao, valor, instrutor, status)
        VALUES (?, ?, ?, ?, ?, ?)`, validar(dados));
      return this.obter(id);
    },

    async atualizar(id, dados) {
      await db.run(`UPDATE cursos SET nome=?, carga_horaria=?, descricao=?, valor=?, instrutor=?, status=?
        WHERE id=?`, [...validar(dados), id]);
      return this.obter(id);
    },

    async excluir(id) {
      const { n } = await db.get('SELECT COUNT(*) AS n FROM matriculas WHERE curso_id = ?', [id]);
      exigir(n === 0, 'Este curso tem alunos matriculados. Marque-o como Inativo em vez de excluir.');
      await db.run('DELETE FROM cursos WHERE id = ?', [id]);
      return true;
    },
  };
}

module.exports = { cursosService };
