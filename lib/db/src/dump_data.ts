import pg from 'pg';
const { Client } = pg;
const connectionString = 'postgresql://postgres:Thatlevelagain-3@db.ulfvavqjnxfrsxtfuqgp.supabase.co:5432/postgres';
const client = new Client({ connectionString });
async function run() {
  try {
    await client.connect();
    console.log('Connected!');

    const tasksCount = await client.query('SELECT COUNT(*) FROM tasks_v2');
    console.log('Number of tasks in tasks_v2:', tasksCount.rows[0].count);

    const tasks = await client.query('SELECT * FROM tasks_v2 LIMIT 5');
    console.log('Sample tasks_v2 rows:', tasks.rows);

    const catsCount = await client.query('SELECT COUNT(*) FROM categories');
    console.log('Number of categories:', catsCount.rows[0].count);

    const cats = await client.query('SELECT * FROM categories LIMIT 5');
    console.log('Sample categories rows:', cats.rows);

    const itemsCount = await client.query('SELECT COUNT(*) FROM items');
    console.log('Number of items:', itemsCount.rows[0].count);

    await client.end();
  } catch (err: any) {
    console.error('Error:', err.stack);
    process.exit(1);
  }
}
run();
