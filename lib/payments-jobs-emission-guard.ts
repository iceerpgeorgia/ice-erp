import { prisma } from '@/lib/prisma';

export function buildPaymentsJobsScopeWhere(
  paymentUuid: string,
  batchPartitionUuid?: string | null,
  rawRecordUuid?: string | null,
) {
  if (batchPartitionUuid) {
    return {
      payment_uuid: paymentUuid,
      batch_partition_uuid: batchPartitionUuid,
    };
  }

  if (rawRecordUuid) {
    return {
      payment_uuid: paymentUuid,
      raw_record_uuid: rawRecordUuid,
    };
  }

  return { payment_uuid: paymentUuid };
}

export function buildLivePaymentsJobsScopeWhere(
  paymentUuid: string,
  batchPartitionUuid?: string | null,
  rawRecordUuid?: string | null,
) {
  return {
    ...buildPaymentsJobsScopeWhere(paymentUuid, batchPartitionUuid, rawRecordUuid),
    emission_uuid: null,
  };
}

export async function findPaymentsJobEmissionState(uuid: string) {
  return prisma.payments_jobs.findUnique({
    where: { uuid },
    select: { emission_uuid: true },
  });
}