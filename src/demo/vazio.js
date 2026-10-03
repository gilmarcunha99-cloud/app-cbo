// Substitui módulos que só existem no servidor (pg, better-sqlite3) na versão de demonstração.
module.exports = { Pool: class {}, types: { setTypeParser() {} } };
