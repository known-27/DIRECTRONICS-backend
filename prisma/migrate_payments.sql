UPDATE payments SET "totalAmount" = amount, "paidAmount" = amount, "balanceAmount" = 0 WHERE status = 'PROCESSED';
UPDATE payments SET "totalAmount" = amount, "paidAmount" = 0, "balanceAmount" = amount WHERE status = 'PENDING';
