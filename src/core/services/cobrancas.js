const { exigir, round2, hojeISO, diasEntre } = require('../utils');

// Situação exibida: ATRASADO é calculado a partir do vencimento.
// "Hoje" vem do código (fuso de Brasília), não do relógio do banco. O valor é
// sempre AAAA-MM-DD gerado internamente, por isso pode entrar direto no SQL.
const SITUACAO_SQL = (a) => `(CASE WHEN ${a}.status = 'PENDENTE' AND ${a}.vencimento < '${hojeISO()}'
  THEN 'ATRASADO' ELSE ${a}.status END)`;

// Multa única + juros simples pró-rata dia sobre a parcela em atraso.
function calcularEncargos({ valor, vencimento, multa_percentual = 0, juros_mes_percentual = 0 }, hoje = hojeISO()) {
  const dias = Math.max(0, diasEntre(vencimento, hoje));
  if (dias === 0) return { dias_atraso: 0, multa: 0, juros: 0, valor_atualizado: round2(valor) };
  const multa = round2(valor * (multa_percentual / 100));
  const juros = round2(valor * (juros_mes_percentual / 100 / 30) * dias);
  return { dias_atraso: dias, multa, juros, valor_atualizado: round2(valor + multa + juros) };
}

function comEncargos(c, hoje) {
  if (c.situacao !== 'ATRASADO') return { ...c, dias_atraso: 0, multa: 0, juros: 0, valor_atualizado: c.valor };
  return { ...c, ...calcularEncargos(c, hoje) };
}

const baseSelect = () => `
  SELECT cb.*, ${SITUACAO_SQL('cb')} AS situacao,
         a.id AS aluno_id, a.nome AS aluno_nome, a.cpf AS aluno_cpf,
         c.nome AS curso_nome, f.nome AS forma_nome,
         f.multa_percentual, f.juros_mes_percentual, m.num_parcelas
  FROM cobrancas cb
  JOIN matriculas m        ON m.id = cb.matricula_id
  JOIN alunos a            ON a.id = m.aluno_id
  JOIN cursos c            ON c.id = m.curso_id
  JOIN formas_pagamento f  ON f.id = m.forma_pagamento_id`;

function cobrancasService(db) {
  return {
    // filtros: { situacao: 'PAGO'|'PENDENTE'|'ATRASADO', dataInicial, dataFinal, alunoId }
    async listar(filtros = {}) {
      const cond = [];
      const params = [];
      if (filtros.situacao) { cond.push('x.situacao = ?'); params.push(filtros.situacao); }
      if (filtros.dataInicial) { cond.push('x.vencimento >= ?'); params.push(filtros.dataInicial); }
      if (filtros.dataFinal) { cond.push('x.vencimento <= ?'); params.push(filtros.dataFinal); }
      if (filtros.alunoId) { cond.push('x.aluno_id = ?'); params.push(Number(filtros.alunoId)); }

      const linhas = (await db.all(`
        SELECT * FROM (${baseSelect()}) x
        ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
        ORDER BY x.vencimento, x.aluno_nome`, params)).map((c) => comEncargos(c));

      const soma = (fn) => round2(linhas.filter(fn).reduce((s, c) => s + c.valor_atualizado, 0));
      return {
        linhas,
        totais: {
          quantidade: linhas.length,
          pago: round2(linhas.filter((c) => c.situacao === 'PAGO').reduce((s, c) => s + (c.valor_pago ?? c.valor), 0)),
          pendente: soma((c) => c.situacao === 'PENDENTE'),
          atrasado: soma((c) => c.situacao === 'ATRASADO'),
        },
      };
    },

    async obter(id) {
      const c = await db.get(`${baseSelect()} WHERE cb.id = ?`, [id]);
      exigir(c, 'Cobrança não encontrada.');
      return comEncargos(c);
    },

    async obterVarias(ids) {
      exigir(Array.isArray(ids) && ids.length > 0, 'Selecione ao menos uma cobrança.');
      const lista = [];
      for (const id of ids) lista.push(await this.obter(id));
      return lista;
    },

    // Baixa manual de uma parcela. Se o valor não for informado, usa o valor atualizado.
    async marcarComoPaga(id, { dataPagamento, valorPago, observacao } = {}) {
      const c = await this.obter(id);
      exigir(c.status === 'PENDENTE', 'Só é possível dar baixa em parcelas pendentes ou atrasadas.');
      const valor = valorPago != null && valorPago !== '' ? round2(valorPago) : c.valor_atualizado;
      exigir(valor > 0, 'Informe o valor pago.');
      await db.run(`UPDATE cobrancas SET status='PAGO', data_pagamento=?, valor_pago=?, observacao=?
        WHERE id=?`, [dataPagamento || hojeISO(), valor, observacao || null, id]);
      return this.obter(id);
    },

    async estornar(id) {
      const c = await this.obter(id);
      exigir(c.status === 'PAGO', 'Esta parcela não está paga.');
      await db.run(`UPDATE cobrancas SET status='PENDENTE', data_pagamento=NULL, valor_pago=NULL WHERE id=?`, [id]);
      return this.obter(id);
    },
  };
}

module.exports = { cobrancasService, calcularEncargos, comEncargos, SITUACAO_SQL };
