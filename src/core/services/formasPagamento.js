const { exigir, round2 } = require('../utils');

function validar(f) {
  exigir(f.nome && f.nome.trim(), 'Informe o nome da forma de pagamento.');
  exigir(Number.isInteger(Number(f.max_parcelas)) && Number(f.max_parcelas) >= 1, 'Parcelas permitidas deve ser 1 ou mais.');
  exigir(Number(f.multa_percentual) >= 0 && Number(f.multa_percentual) <= 2,
    'A multa por atraso deve ficar entre 0% e 2% (limite do Código de Defesa do Consumidor).');
  exigir(Number(f.juros_mes_percentual) >= 0, 'Juros inválidos.');
  return [
    f.nome.trim(),
    Number(f.max_parcelas),
    round2(f.multa_percentual || 0),
    round2(f.juros_mes_percentual || 0),
    f.status || 'ATIVO',
  ];
}

function formasPagamentoService(db) {
  return {
    async listar({ status } = {}) {
      if (status) return db.all('SELECT * FROM formas_pagamento WHERE status = ? ORDER BY nome', [status]);
      return db.all('SELECT * FROM formas_pagamento ORDER BY nome');
    },

    async obter(id) {
      const f = await db.get('SELECT * FROM formas_pagamento WHERE id = ?', [id]);
      exigir(f, 'Forma de pagamento não encontrada.');
      return f;
    },

    async criar(dados) {
      const v = validar(dados);
      const existe = await db.get('SELECT id FROM formas_pagamento WHERE LOWER(nome) = LOWER(?)', [v[0]]);
      exigir(!existe, 'Já existe uma forma de pagamento com esse nome.');
      const id = await db.insert(`INSERT INTO formas_pagamento
        (nome, max_parcelas, multa_percentual, juros_mes_percentual, status) VALUES (?, ?, ?, ?, ?)`, v);
      return this.obter(id);
    },

    async atualizar(id, dados) {
      const v = validar(dados);
      const outro = await db.get('SELECT id FROM formas_pagamento WHERE LOWER(nome) = LOWER(?) AND id <> ?', [v[0], id]);
      exigir(!outro, 'Já existe uma forma de pagamento com esse nome.');
      await db.run(`UPDATE formas_pagamento SET nome=?, max_parcelas=?, multa_percentual=?,
        juros_mes_percentual=?, status=? WHERE id=?`, [...v, id]);
      return this.obter(id);
    },

    async excluir(id) {
      const { n } = await db.get('SELECT COUNT(*) AS n FROM matriculas WHERE forma_pagamento_id = ?', [id]);
      exigir(n === 0, 'Esta forma de pagamento já foi usada em matrículas. Marque-a como Inativa.');
      await db.run('DELETE FROM formas_pagamento WHERE id = ?', [id]);
      return true;
    },
  };
}

module.exports = { formasPagamentoService };
