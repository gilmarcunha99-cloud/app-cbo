class ErroValidacao extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ErroValidacao';
  }
}

const exigir = (cond, msg) => {
  if (!cond) throw new ErroValidacao(msg);
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

function cpfValido(cpf) {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

// Datas no formato AAAA-MM-DD.
const formatarISO = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// "Hoje" sempre no horário de Brasília, mesmo em servidor com relógio em UTC (Vercel).
const FUSO = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
function hojeISO(ref = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ref);
}

function addMeses(iso, meses) {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  return formatarISO(alvo);
}

function diasEntre(isoInicio, isoFim) {
  const [a1, m1, d1] = isoInicio.split('-').map(Number);
  const [a2, m2, d2] = isoFim.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

module.exports = { ErroValidacao, exigir, round2, soDigitos, cpfValido, hojeISO, addMeses, diasEntre };
