const sql = require('mssql/msnodesqlv8');

const mssqlConfig = {
  server: 'localhost\\SQLEXPRESS',
  database: 'PathoLabDB',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
};

async function run() {
  try {
    const pool = await sql.connect(mssqlConfig);
    const result = await pool.request().query('SELECT TOP 5 * FROM ab_tests_da');
    const countResult = await pool.request().query('SELECT COUNT(*) as total FROM ab_tests_da');
    const distinctResult = await pool.request().query('SELECT COUNT(DISTINCT [Test Name]) as distinctTests FROM ab_tests_da');
    const deptResult = await pool.request().query('SELECT DISTINCT Department FROM ab_tests_da ORDER BY Department');
    console.log('Total rows:', countResult.recordset[0].total);
    console.log('Distinct tests:', distinctResult.recordset[0].distinctTests);
    console.log('Departments:', deptResult.recordset.map(r => r.Department).join(', '));
    if (result.recordset.length > 0) {
      console.log('Columns:', Object.keys(result.recordset[0]).join(', '));
      console.log('Sample rows:', JSON.stringify(result.recordset, null, 2));
    } else {
      console.log('Table is empty');
      // Try to get column info
      const cols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ab_tests_da' ORDER BY ORDINAL_POSITION");
      console.log('Columns:', JSON.stringify(cols.recordset, null, 2));
    }
    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
