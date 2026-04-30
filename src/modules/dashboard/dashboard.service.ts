import prisma from '../../config/db';

export const getAdminDashboardService = async () => {
  const [
    totalProjects,
    totalEmployees,
    pendingPayments,
    partialPayments,
    totalPaidAmount,
    totalPendingAmount,
    projectsByStatus,
    recentProjects,
    topEmployees,
    monthlyTrend,
    pendingReviewCount,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.user.count({ where: { role: 'EMPLOYEE', isActive: true } }),

    // Count of payments waiting for any payment (fully unpaid)
    prisma.payment.count({ where: { status: 'PENDING' } }),

    // Count of partial payments
    prisma.payment.count({ where: { status: 'PARTIAL' } }),

    // Total amount actually disbursed (sum of totalPaid across all payments)
    prisma.payment.aggregate({
      _sum: { totalPaid: true },
    }),

    // Total outstanding across PENDING + PARTIAL payments
    prisma.payment.aggregate({
      where: { status: { in: ['PENDING', 'PARTIAL'] } },
      _sum:  { pendingAmount: true },
    }),

    prisma.project.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.project.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true } },
        service:  { select: { id: true, name: true } },
        payments: { select: { status: true, totalPaid: true, calculatedAmount: true, pendingAmount: true } },
      },
    }),

    // Top employees by totalPaid received
    prisma.payment.groupBy({
      by: ['employeeId'],
      _sum:   { totalPaid: true },
      _count: { id: true },
      orderBy: { _sum: { totalPaid: 'desc' } },
      take: 5,
    }),

    // Monthly trend (last 6 months)
    prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*) as count
      FROM projects
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `,

    prisma.project.count({ where: { status: 'SUBMITTED' } }),
  ]);

  const employeeIds = topEmployees.map((e) => e.employeeId);
  const employees = await prisma.user.findMany({
    where:  { id: { in: employeeIds } },
    select: { id: true, name: true, email: true },
  });
  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  return {
    kpis: {
      totalProjects,
      totalEmployees,
      pendingPaymentsCount:  pendingPayments,
      partialPaymentsCount:  partialPayments,
      totalPaidAmount:       totalPaidAmount._sum.totalPaid        ?? 0,
      totalPendingAmount:    totalPendingAmount._sum.pendingAmount  ?? 0,
      totalPendingToPay:     totalPendingAmount._sum.pendingAmount  ?? 0,
    },
    pendingReviewCount,
    projectsByStatus: Object.fromEntries(projectsByStatus.map((p) => [p.status, p._count.id])),
    recentProjects,
    topEmployees: topEmployees.map((e) => ({
      employee:     employeeMap.get(e.employeeId),
      totalEarned:  e._sum.totalPaid,
      projectCount: e._count.id,
    })),
    monthlyTrend: monthlyTrend.map((m) => ({
      month: m.month,
      count: Number(m.count),
    })),
  };
};

export const getEmployeeDashboardService = async (employeeId: string) => {
  const [
    projectCounts,
    paymentAggregates,
    pendingToReceiveResult,
    recentProjects,
  ] = await Promise.all([
    prisma.project.groupBy({
      by:    ['status'],
      where: { employeeId },
      _count: { id: true },
    }),

    // Aggregate for all monetary KPIs (across all payment statuses)
    prisma.payment.aggregate({
      where: { employeeId },
      _sum:  {
        calculatedAmount: true,
        totalPaid:        true,
        pendingAmount:    true,
      },
    }),

    // Scoped pending: only PENDING + PARTIAL payments (excludes PAID and CANCELLED)
    prisma.payment.aggregate({
      where: {
        employeeId,
        status: { in: ['PENDING', 'PARTIAL'] },
      },
      _sum: { pendingAmount: true },
    }),

    prisma.project.findMany({
      where:    { employeeId },
      take:     10,
      orderBy:  { createdAt: 'desc' },
      include: {
        service:  { select: { id: true, name: true } },
        payments: { select: { status: true, calculatedAmount: true, totalPaid: true, pendingAmount: true } },
      },
    }),
  ]);

  const statusMap = Object.fromEntries(projectCounts.map((p) => [p.status, p._count.id]));

  return {
    kpis: {
      totalProjects:          Object.values(statusMap).reduce((a, b) => a + b, 0),
      approvedProjects:       statusMap['APPROVED'] ?? 0,
      totalEarned:            paymentAggregates._sum.calculatedAmount ?? 0,
      totalReceived:          paymentAggregates._sum.totalPaid        ?? 0,
      totalPending:           paymentAggregates._sum.pendingAmount    ?? 0,
      totalPendingToReceive:  pendingToReceiveResult._sum.pendingAmount ?? 0,
    },
    projectsByStatus: statusMap,
    recentProjects,
  };
};
