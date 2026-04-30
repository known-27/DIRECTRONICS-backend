import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseSize() {
  console.log('📊 Analyzing PostgreSQL Database Storage...\n');

  try {
    // This query gets the size of the entire database
    const dbSize: any[] = await prisma.$queryRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) as "Total Database Size";
    `;
    console.log(`Overall Database Size: ${dbSize[0]['Total Database Size']}\n`);

    // This query gets the size of each individual table, ordered by largest first
    const tableSizes: any[] = await prisma.$queryRaw`
      SELECT
        relname as "Table Name",
        pg_size_pretty(pg_total_relation_size(relid)) As "Total Size (Data + Indexes)",
        pg_size_pretty(pg_relation_size(relid)) as "Data Size",
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as "Index Size"
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC;
    `;

    console.table(tableSizes);

  } catch (error) {
    console.error('❌ Error fetching database stats:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseSize();
