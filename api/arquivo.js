// Vercel: POST /api/arquivo  { tipo, args } -> PDF ou XLSX para download
module.exports = require('../src/web/handlers').arquivo;
