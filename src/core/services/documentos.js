// Geração de arquivos: cobranças (ficha de cobrança + QR Pix) em PDF,
// e relatório financeiro em PDF ou Excel. Tudo devolve Buffer; quem salva
// o arquivo é a camada de fora (Electron no desktop, API na web).
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const { gerarPixCopiaECola } = require('./pix');

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const cpf = (s) => String(s || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
const SITUACAO = { PAGO: 'Pago', PENDENTE: 'Pendente', ATRASADO: 'Atrasado', CANCELADO: 'Cancelado' };
const LARANJA = '#F59E0B';
const GRAFITE = '#1F2937';

function pdfParaBuffer(montar) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    Promise.resolve(montar(doc)).then(() => doc.end(), reject);
  });
}

function cabecalho(doc, titulo, config) {
  doc.rect(0, 0, doc.page.width, 70).fill(GRAFITE);
  doc.fillColor(LARANJA).fontSize(22).font('Helvetica-Bold').text('App.CBO', 40, 22);
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica').text(config.escola_nome || '', 150, 30);
  doc.fillColor(GRAFITE).fontSize(14).font('Helvetica-Bold').text(titulo, 40, 90);
  doc.moveDown(0.5).font('Helvetica').fontSize(10);
}

// Uma página por cobrança, com QR Code Pix e o Pix Copia e Cola.
// Observação: boleto registrado (com código de barras válido) exige integração
// com o banco da escola. Aqui geramos a ficha de cobrança com Pix.
async function gerarCobrancasPdf(cobrancas, config) {
  return pdfParaBuffer(async (doc) => {
    for (const [i, c] of cobrancas.entries()) {
      if (i > 0) doc.addPage();
      cabecalho(doc, `Cobrança - Parcela ${c.numero_parcela}/${c.num_parcelas}`, config);

      const linha = (rotulo, valor) => {
        doc.font('Helvetica-Bold').text(`${rotulo}: `, { continued: true }).font('Helvetica').text(valor);
      };
      doc.fontSize(11);
      linha('Aluno', c.aluno_nome);
      linha('CPF', cpf(c.aluno_cpf));
      linha('Curso', c.curso_nome);
      linha('Vencimento', data(c.vencimento));
      linha('Valor da parcela', moeda(c.valor));
      if (c.dias_atraso > 0) {
        linha('Dias em atraso', String(c.dias_atraso));
        linha('Multa + juros', moeda(c.multa + c.juros));
      }
      doc.moveDown(0.3).fontSize(16).font('Helvetica-Bold').fillColor(LARANJA)
        .text(`Total a pagar: ${moeda(c.valor_atualizado)}`).fillColor(GRAFITE);

      if (config.pix_chave) {
        const payload = gerarPixCopiaECola({
          chave: config.pix_chave, beneficiario: config.pix_beneficiario, cidade: config.pix_cidade,
          valor: c.valor_atualizado, txid: `CBO${c.id}P${c.numero_parcela}`,
        });
        const qr = await QRCode.toDataURL(payload, { margin: 1, width: 360 });
        const y = doc.y + 20;
        doc.image(qr, 40, y, { width: 180 });
        doc.fontSize(12).font('Helvetica-Bold').text('Pague com Pix', 240, y + 10);
        doc.fontSize(9).font('Helvetica').text('Abra o app do seu banco, escolha Pix > Ler QR Code, ou use o Pix Copia e Cola abaixo:', 240, y + 30, { width: 300 });
        doc.fontSize(8).font('Courier').text(payload, 240, y + 70, { width: 300 });
        doc.font('Helvetica').fontSize(9).text(`Recebedor: ${config.pix_beneficiario}  |  Chave: ${config.pix_chave}`, 40, y + 200);
      } else {
        doc.moveDown().fontSize(10).fillColor('#B91C1C')
          .text('Chave Pix não configurada. Cadastre em Configurações para gerar o QR Code.').fillColor(GRAFITE);
      }
    }
  });
}

const COLUNAS = [
  { header: 'Aluno', key: 'aluno_nome', width: 32 },
  { header: 'CPF', key: 'cpf', width: 16 },
  { header: 'Curso', key: 'curso_nome', width: 26 },
  { header: 'Parcela', key: 'parcela', width: 9 },
  { header: 'Vencimento', key: 'venc', width: 12 },
  { header: 'Valor', key: 'valor', width: 12 },
  { header: 'Valor atualizado', key: 'valor_atualizado', width: 16 },
  { header: 'Situação', key: 'situacao', width: 11 },
  { header: 'Pago em', key: 'pago_em', width: 12 },
  { header: 'Valor pago', key: 'valor_pago', width: 12 },
];

const paraLinha = (c) => ({
  aluno_nome: c.aluno_nome,
  cpf: cpf(c.aluno_cpf),
  curso_nome: c.curso_nome,
  parcela: `${c.numero_parcela}/${c.num_parcelas}`,
  venc: data(c.vencimento),
  valor: c.valor,
  valor_atualizado: c.valor_atualizado,
  situacao: SITUACAO[c.situacao] || c.situacao,
  pago_em: data(c.data_pagamento),
  valor_pago: c.valor_pago ?? '',
});

async function gerarRelatorioXlsx({ linhas, totais }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'App.CBO';
  const ws = wb.addWorksheet('Cobranças');
  ws.columns = COLUNAS;
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  linhas.forEach((c) => ws.addRow(paraLinha(c)));
  ['valor', 'valor_atualizado', 'valor_pago'].forEach((k) => (ws.getColumn(k).numFmt = '"R$" #,##0.00'));
  ws.addRow({});
  ws.addRow({ aluno_nome: 'Total recebido', valor: totais.pago }).font = { bold: true };
  ws.addRow({ aluno_nome: 'Total pendente', valor: totais.pendente }).font = { bold: true };
  ws.addRow({ aluno_nome: 'Total em atraso (atualizado)', valor: totais.atrasado }).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function gerarRelatorioPdf({ linhas, totais }, filtros, config) {
  return pdfParaBuffer((doc) => {
    cabecalho(doc, 'Relatório de Cobranças', config);
    const f = [];
    if (filtros.situacao) f.push(`Situação: ${SITUACAO[filtros.situacao]}`);
    if (filtros.dataInicial || filtros.dataFinal) f.push(`Período: ${data(filtros.dataInicial) || '...'} a ${data(filtros.dataFinal) || '...'}`);
    doc.fontSize(9).text(f.length ? f.join('   |   ') : 'Sem filtros', 40, doc.y);
    doc.moveDown();

    const cols = [['Aluno', 150], ['Curso', 110], ['Parc.', 35], ['Venc.', 60], ['Valor', 70], ['Situação', 55]];
    const desenharCabecalho = () => {
      let x = 40;
      const y = doc.y;
      doc.rect(40, y - 3, 515, 16).fill(GRAFITE).fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      cols.forEach(([t, w]) => { doc.text(t, x + 3, y, { width: w - 6 }); x += w; });
      doc.fillColor(GRAFITE).font('Helvetica').moveDown(0.6);
    };
    desenharCabecalho();
    linhas.forEach((c, i) => {
      if (doc.y > 770) { doc.addPage(); desenharCabecalho(); }
      const y = doc.y;
      if (i % 2) doc.rect(40, y - 2, 515, 14).fill('#F3F4F6').fillColor(GRAFITE);
      const r = paraLinha(c);
      const vals = [r.aluno_nome, r.curso_nome, r.parcela, r.venc, moeda(c.valor_atualizado), r.situacao];
      let x = 40;
      vals.forEach((v, k) => { doc.text(String(v), x + 3, y, { width: cols[k][1] - 6, lineBreak: false, ellipsis: true }); x += cols[k][1]; });
      doc.text('', 40, y + 14);
    });
    doc.moveDown().font('Helvetica-Bold').fontSize(10);
    doc.text(`Recebido: ${moeda(totais.pago)}    Pendente: ${moeda(totais.pendente)}    Em atraso: ${moeda(totais.atrasado)}`, 40);
  });
}

module.exports = { gerarCobrancasPdf, gerarRelatorioXlsx, gerarRelatorioPdf };
