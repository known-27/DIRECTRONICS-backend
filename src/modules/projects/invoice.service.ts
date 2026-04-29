import { Prisma } from '@prisma/client';

type PrismaTransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Generates an atomic, unique invoice number inside a Prisma transaction.
 *
 * Format: SF-{YEAR}-{6-digit zero-padded sequential number}
 * Example: SF-2025-000001
 *
 * Uses a per-year counter row with an upsert + increment approach.
 * This is safe inside a serialized transaction to prevent duplicates.
 */
export const generateInvoiceNumber = async (
  year: number,
  tx: PrismaTransactionClient
): Promise<string> => {
  // Upsert the counter for this year, atomically incrementing by 1
  // We use a raw query for atomic increment to avoid read-then-write races
  const result = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO invoice_counters (year, value)
    VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE
      SET value = invoice_counters.value + 1
    RETURNING value
  `;

  const counterValue = result[0]?.value;
  if (!counterValue || typeof counterValue !== 'number') {
    throw new Error('Failed to generate invoice number: counter update failed');
  }

  const padded = String(counterValue).padStart(6, '0');
  return `SF-${year}-${padded}`;
};
