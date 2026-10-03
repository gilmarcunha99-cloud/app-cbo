const { exigir, soDigitos, cpfValido, round2, hojeISO, addMeses } = require('../utils');
const { SITUACAO_SQL, comEncargos } = require('./cobrancas');

function validar(a) {
  exigir(a.nome && a.nome.trim().length >= 3, 'Informe o nome completo.');
  exigir(cpfValido(a.cpf), 'CPF inválido.');
  if (a.email) exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim()), 'E-mail inválido.');
  return {
    nome: a.nome.trim(),
    cpf: soDigitos(a.cpf),
    telefone: soDigitos(a.telefone),
    email: (a.email || '').trim(),
    endereco: (a.endereco || '').trim(),
  };
}

// Divide o valor em parcelas iguais; a diferença de centavos vai na 1ª parcela.
function dividirParcelas(total, n) {
  const base = Math.floor((total / n) * 100) / 100;
  const primeira = round2(total - base * (n - 1));
  return Array.from({ length: n }, (_, i) => (i === 0 ? primeira : base));
}

function alunosService(db) {
  const matricular = async (tx, alunoId, m) => {
    const curso = await tx.get("SELECT * FROM cursos WHERE id = ? AND status = 'ATIVO'", [Number(m.curso_id)]);
    exigir(curso, 'Escolha um curso ativo.');
    const forma = await tx.get("SELECT * FROM formas_pagamento WHERE id = ? AND status = 'ATIVO'", [Number(m.forma_pagamento_id) || 0]);
    exigir(forma, 'Escolha uma forma de pagamento ativa.');
    const parcelas = Number(m.num_parcelas || 1);
    exigir(parcelas >= 1 && parcelas <= forma.max_parcelas,
      `${forma.nome} permite no máximo ${forma.max_parcelas} parcela(s).`);
    const dataMatricula = m.data_matricula || hojeISO();
    const primeiroVenc = m.primeiro_vencimento || dataMatricula;

    const matriculaId = await tx.insert(`INSERT INTO matriculas
      (aluno_id, curso_id, forma_pagamento_id, data_matricula, valor_total, num_parcelas)
      VALUES (?, ?, ?, ?, ?, ?)`, [alunoId, curso.id, forma.id, dataMatricula, curso.valor, parcelas]);

    const valores = dividirParcelas(curso.valor, parcelas);
    for (const [i, valor] of valores.entries()) {
      await tx.run('INSERT INTO cobrancas (matricula_id, numero_parcela, valor, vencimento) VALUES (?, ?, ?, ?)',
        [matriculaId, i + 1, valor, addMeses(primeiroVenc, i)]);
    }
    return matriculaId;
  };

  return {
    async listar({ busca = '' } = {}) {
      const b = `%${busca.toLowerCase()}%`;
      return db.all(`
        SELECT a.*,
          (SELECT c.nome FROM matriculas m JOIN cursos c ON c.id = m.curso_id
             WHERE m.aluno_id = a.id AND m.status = 'ATIVA' ORDER BY m.id DESC LIMIT 1) AS curso_atual,
          (SELECT COUNT(*) FROM cobrancas cb JOIN matriculas m ON m.id = cb.matricula_id
             WHERE m.aluno_id = a.id AND ${SITUACAO_SQL('cb')} = 'ATRASADO') AS parcelas_atrasadas
        FROM alunos a
        WHERE LOWER(a.nome) LIKE ? OR a.cpf LIKE ?
        ORDER BY a.nome`, [b, b]);
    },

    async obter(id) {
      const a = await db.get('SELECT * FROM alunos WHERE id = ?', [id]);
      exigir(a, 'Aluno não encontrado.');
      return a;
    },

    // Ficha completa: dados, matrículas e histórico financeiro.
    async ficha(id) {
      const aluno = await this.obter(id);
      const matriculas = await db.all(`
        SELECT m.*, c.nome AS curso_nome, f.nome AS forma_nome
        FROM matriculas m
        JOIN cursos c ON c.id = m.curso_id
        JOIN formas_pagamento f ON f.id = m.forma_pagamento_id
        WHERE m.aluno_id = ? ORDER BY m.id DESC`, [id]);
      const cobrancas = (await db.all(`
        SELECT cb.*, ${SITUACAO_SQL('cb')} AS situacao, c.nome AS curso_nome,
               f.multa_percentual, f.juros_mes_percentual
        FROM cobrancas cb
        JOIN matriculas m ON m.id = cb.matricula_id
        JOIN cursos c ON c.id = m.curso_id
        JOIN formas_pagamento f ON f.id = m.forma_pagamento_id
        WHERE m.aluno_id = ? ORDER BY cb.vencimento`, [id])).map((c) => comEncargos(c));
      const aberto = cobrancas.filter((c) => c.situacao !== 'PAGO' && c.situacao !== 'CANCELADO');
      return {
        aluno,
        matriculas,
        pagamentos: cobrancas.filter((c) => c.situacao === 'PAGO'),
        emAberto: aberto,
        totalEmAberto: round2(aberto.reduce((s, c) => s + c.valor_atualizado, 0)),
      };
    },

    // dados.matricula (opcional): { curso_id, forma_pagamento_id, num_parcelas, primeiro_vencimento }
    async criar(dados) {
      const a = validar(dados);
      const existe = await db.get('SELECT id FROM alunos WHERE cpf = ?', [a.cpf]);
      exigir(!existe, 'Já existe um aluno com este CPF.');
      const id = await db.transaction(async (tx) => {
        const novoId = await tx.insert('INSERT INTO alunos (nome, cpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
          [a.nome, a.cpf, a.telefone, a.email, a.endereco]);
        if (dados.matricula && dados.matricula.curso_id) await matricular(tx, novoId, dados.matricula);
        return novoId;
      });
      return this.obter(id);
    },

    async atualizar(id, dados) {
      const a = validar(dados);
      const outro = await db.get('SELECT id FROM alunos WHERE cpf = ? AND id <> ?', [a.cpf, id]);
      exigir(!outro, 'Já existe outro aluno com este CPF.');
      await db.run('UPDATE alunos SET nome=?, cpf=?, telefone=?, email=?, endereco=? WHERE id=?',
        [a.nome, a.cpf, a.telefone, a.email, a.endereco, id]);
      return this.obter(id);
    },

    async matricular(alunoId, dadosMatricula) {
      await this.obter(alunoId);
      return db.transaction((tx) => matricular(tx, alunoId, dadosMatricula));
    },

    async cancelarMatricula(matriculaId) {
      await db.transaction(async (tx) => {
        await tx.run("UPDATE matriculas SET status = 'CANCELADA' WHERE id = ?", [matriculaId]);
        await tx.run("UPDATE cobrancas SET status = 'CANCELADO' WHERE matricula_id = ? AND status = 'PENDENTE'", [matriculaId]);
      });
      return true;
    },

    async excluir(id) {
      const { n } = await db.get(`SELECT COUNT(*) AS n FROM cobrancas cb JOIN matriculas m ON m.id = cb.matricula_id
        WHERE m.aluno_id = ? AND cb.status = 'PAGO'`, [id]);
      exigir(n === 0, 'Este aluno já tem pagamentos registrados e não pode ser excluído.');
      await db.run('DELETE FROM alunos WHERE id = ?', [id]);
      return true;
    },
  };
}

module.exports = { alunosService, dividirParcelas };
