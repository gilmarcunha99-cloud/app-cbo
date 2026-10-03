const { round2, hojeISO, addMeses } = require('../utils');
const { SITUACAO_SQL } = require('./cobrancas');

const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function dashboardService(db) {
  return {
    async resumo(hoje = hojeISO()) {
      const mes = hoje.slice(0, 7);
      const um = async (sql, p = []) => (await db.get(sql, p))?.n ?? 0;
      const atrasado = `${SITUACAO_SQL('cb')} = 'ATRASADO'`;

      const indicadores = {
        alunosAtivos: await um(`SELECT COUNT(DISTINCT aluno_id) AS n FROM matriculas WHERE status = 'ATIVA'`),
        cursosEmAndamento: await um(`SELECT COUNT(DISTINCT c.id) AS n FROM cursos c
          JOIN matriculas m ON m.curso_id = c.id AND m.status = 'ATIVA' WHERE c.status = 'ATIVO'`),
        receitaMensal: round2(await um(`SELECT COALESCE(SUM(valor_pago),0) AS n FROM cobrancas
          WHERE status = 'PAGO' AND substr(data_pagamento,1,7) = ?`, [mes])),
        inadimplencia: round2(await um(`SELECT COALESCE(SUM(valor),0) AS n FROM cobrancas cb WHERE ${atrasado}`)),
        parcelasAtrasadas: await um(`SELECT COUNT(*) AS n FROM cobrancas cb WHERE ${atrasado}`),
        alunosInadimplentes: await um(`SELECT COUNT(DISTINCT m.aluno_id) AS n FROM cobrancas cb
          JOIN matriculas m ON m.id = cb.matricula_id WHERE ${atrasado}`),
      };

      // Últimos 6 meses: recebido x previsto (vencimentos) e novas matrículas.
      const meses = Array.from({ length: 6 }, (_, i) => addMeses(`${mes}-01`, i - 5).slice(0, 7));
      const recebido = await db.all(`SELECT substr(data_pagamento,1,7) AS mes, SUM(valor_pago) AS total
        FROM cobrancas WHERE status='PAGO' GROUP BY substr(data_pagamento,1,7)`);
      const previsto = await db.all(`SELECT substr(vencimento,1,7) AS mes, SUM(valor) AS total
        FROM cobrancas WHERE status <> 'CANCELADO' GROUP BY substr(vencimento,1,7)`);
      const matriculas = await db.all(`SELECT substr(data_matricula,1,7) AS mes, COUNT(*) AS total
        FROM matriculas GROUP BY substr(data_matricula,1,7)`);
      const achar = (lista, m) => lista.find((r) => r.mes === m)?.total ?? 0;

      const rotulo = (m) => `${NOMES_MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
      return {
        indicadores,
        fluxoCaixa: meses.map((m) => ({ mes: rotulo(m), recebido: round2(achar(recebido, m)), previsto: round2(achar(previsto, m)) })),
        matriculasPorMes: meses.map((m) => ({ mes: rotulo(m), matriculas: achar(matriculas, m) })),
      };
    },
  };
}

module.exports = { dashboardService };
