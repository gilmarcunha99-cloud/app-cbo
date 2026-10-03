// Gera o "Pix Copia e Cola" (BR Code estático, padrão EMV do Banco Central).
// O mesmo texto vira o QR Code. Não depende de banco: basta a chave Pix da escola.

const campo = (id, valor) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Remove acentos e limita tamanho, como exige o padrão.
const limpar = (s, max) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max).trim();

function gerarPixCopiaECola({ chave, beneficiario, cidade, valor, txid = '***', descricao = '' }) {
  if (!chave) throw new Error('Configure a chave Pix da escola em Configurações.');
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave) + (descricao ? campo('02', descricao.slice(0, 40)) : '');
  const txidLimpo = String(txid).replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';
  const semCrc =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor ? campo('54', Number(valor).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(beneficiario, 25) || 'RECEBEDOR') +
    campo('60', limpar(cidade, 15) || 'BRASIL') +
    campo('62', campo('05', txidLimpo)) +
    '6304';
  return semCrc + crc16(semCrc);
}

module.exports = { gerarPixCopiaECola, crc16 };
