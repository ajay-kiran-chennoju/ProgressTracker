import pg from 'pg';
const { Client } = pg;
const connectionString = process.argv[2];
const client = new Client({ connectionString });
async function run() {
  try {
    await client.connect();
    console.log('Connected!');
    const res = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log('Tables:', res.rows.map(r => r.table_name));
    await client.end();
  } catch (err: any) {
    console.error('Error:', err.stack);
    process.exit(1);
  }
}
run();
