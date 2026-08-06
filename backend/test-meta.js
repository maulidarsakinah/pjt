const { withConnection } = require("./src/services/database");
withConnection(async (conn) => {
  const result = await conn.execute(`SELECT * FROM "tb_flow_lamongan" WHERE ROWNUM = 1`);
  console.log(result.metaData);
}).catch(console.error);
