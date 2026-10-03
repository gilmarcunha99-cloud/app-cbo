const CHAVES = ['pix_chave', 'pix_beneficiario', 'pix_cidade', 'escola_nome'];

function configuracoesService(db) {
  return {
    async obter() {
      const linhas = await db.all('SELECT chave, valor FROM configuracoes');
      return Object.fromEntries(linhas.map((l) => [l.chave, l.valor ?? '']));
    },
    async salvar(dados) {
      await db.transaction(async (tx) => {
        for (const k of CHAVES) {
          if (!(k in dados)) continue;
          await tx.run(`INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
            ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor`, [k, String(dados[k] ?? '').trim()]);
        }
      });
      return this.obter();
    },
  };
}

module.exports = { configuracoesService };
