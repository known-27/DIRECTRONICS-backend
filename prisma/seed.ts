import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding DIRECTRONICS database...');

  const SALT_ROUNDS = 12;

  // ─── Admin ────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: 'admin@directronics.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@directronics.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  // ─── Employees ────────────────────────────────────────────────────────────
  // const emp1Password = await bcrypt.hash('Employee@123456', SALT_ROUNDS);
  // const employee1 = await prisma.user.upsert({
  //   where: { email: 'employee1@directronics.com' },
  //   update: {},
  //   create: {
  //     name: 'Alice Johnson',
  //     email: 'employee1@directronics.com',
  //     passwordHash: emp1Password,
  //     role: 'EMPLOYEE',
  //     isActive: true,
  //   },
  // });

  // const emp2Password = await bcrypt.hash('Employee@123456', SALT_ROUNDS);
  // const employee2 = await prisma.user.upsert({
  //   where: { email: 'employee2@directronics.com' },
  //   update: {},
  //   create: {
  //     name: 'Bob Smith',
  //     email: 'employee2@directronics.com',
  //     passwordHash: emp2Password,
  //     role: 'EMPLOYEE',
  //     isActive: true,
  //   },
  // });

  // ─── Services ─────────────────────────────────────────────────────────────
  // const repairService = await prisma.service.upsert({
  //   where: { name: 'Electronics Repair' },
  //   update: {},
  //   create: {
  //     name: 'Electronics Repair',
  //     description: 'Circuit board and component level repair services',
  //     fields: [
  //       { key: 'deviceType', label: 'Device Type', type: 'text', required: true },
  //       { key: 'repairHours', label: 'Repair Hours', type: 'number', required: true },
  //       { key: 'partsCount', label: 'Parts Used (Count)', type: 'number', required: true },
  //       { key: 'complexity', label: 'Complexity (1-5)', type: 'number', required: true },
  //       { key: 'notes', label: 'Work Notes', type: 'textarea', required: false },
  //     ],
  //     isActive: true,
  //   },
  // });

  // const installService = await prisma.service.upsert({
  //   where: { name: 'System Installation' },
  //   update: {},
  //   create: {
  //     name: 'System Installation',
  //     description: 'Complete system setup and installation services',
  //     fields: [
  //       { key: 'systemType', label: 'System Type', type: 'text', required: true },
  //       { key: 'installHours', label: 'Installation Hours', type: 'number', required: true },
  //       { key: 'travelKm', label: 'Travel Distance (km)', type: 'number', required: false },
  //       { key: 'clientSatisfaction', label: 'Client Satisfaction Score (1-10)', type: 'number', required: true },
  //     ],
  //     isActive: true,
  //   },
  // });

  // ─── Formulas ─────────────────────────────────────────────────────────────
  // const repairFormula = await prisma.formula.upsert({
  //   where: { id: 'repair-formula-seed' },
  //   update: {},
  //   create: {
  //     id: 'repair-formula-seed',
  //     name: 'Repair Labor & Complexity Formula',
  //     serviceId: repairService.id,
  //     expression: '(repairHours * 250) + (partsCount * 50) + (complexity * 100)',
  //     variables: [
  //       { key: 'repairHours', label: 'Repair Hours', type: 'number', sourceField: 'repairHours' },
  //       { key: 'partsCount', label: 'Parts Used', type: 'number', sourceField: 'partsCount' },
  //       { key: 'complexity', label: 'Complexity Score', type: 'number', sourceField: 'complexity' },
  //     ],
  //     version: 1,
  //     isActive: true,
  //   },
  // });

  // const installFormula = await prisma.formula.upsert({
  //   where: { id: 'install-formula-seed' },
  //   update: {},
  //   create: {
  //     id: 'install-formula-seed',
  //     name: 'Installation Payout Formula',
  //     serviceId: installService.id,
  //     expression: '(installHours * 300) + (travelKm * 8) + (clientSatisfaction * 50)',
  //     variables: [
  //       { key: 'installHours', label: 'Installation Hours', type: 'number', sourceField: 'installHours' },
  //       { key: 'travelKm', label: 'Travel Distance', type: 'number', sourceField: 'travelKm' },
  //       { key: 'clientSatisfaction', label: 'Satisfaction Score', type: 'number', sourceField: 'clientSatisfaction' },
  //     ],
  //     version: 1,
  //     isActive: true,
  //   },
  // });

  // ─── Mappings ─────────────────────────────────────────────────────────────
  // await prisma.employeeServiceMapping.upsert({
  //   where: { userId_serviceId: { userId: employee1.id, serviceId: repairService.id } },
  //   update: {},
  //   create: {
  //     userId: employee1.id,
  //     serviceId: repairService.id,
  //     formulaId: repairFormula.id,
  //   },
  // });

  // await prisma.employeeServiceMapping.upsert({
  //   where: { userId_serviceId: { userId: employee1.id, serviceId: installService.id } },
  //   update: {},
  //   create: {
  //     userId: employee1.id,
  //     serviceId: installService.id,
  //     formulaId: installFormula.id,
  //   },
  // });

  // await prisma.employeeServiceMapping.upsert({
  //   where: { userId_serviceId: { userId: employee2.id, serviceId: repairService.id } },
  //   update: {},
  //   create: {
  //     userId: employee2.id,
  //     serviceId: repairService.id,
  //     formulaId: repairFormula.id,
  //   },
  // });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('📋 Credentials:');
  console.log('  Admin:      admin@directronics.com     / Admin@123');
  // console.log('  Employee 1: employee1@directronics.com / Employee@123456');
  // console.log('  Employee 2: employee2@directronics.com / Employee@123456');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
