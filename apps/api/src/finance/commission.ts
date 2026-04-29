export type CommissionSettings = {
  platform_commission_bps: number;
  payment_processing_bps: number;
  payment_processing_flat_cents: number;
};

export type CommissionResult = {
  gross_cents: number;
  commission_cents: number;
  processing_fee_cents: number;
  organizer_net_cents: number;
};

export function calculateCommission(
  amountCents: number,
  settings: CommissionSettings,
  options: { perOrderProcessingFlat?: boolean } = {},
): CommissionResult {
  const commission = Math.round(
    (amountCents * settings.platform_commission_bps) / 10000,
  );
  const variableProcessing = Math.round(
    (amountCents * settings.payment_processing_bps) / 10000,
  );
  const flatProcessing =
    options.perOrderProcessingFlat === false
      ? 0
      : settings.payment_processing_flat_cents;
  const processing = variableProcessing + flatProcessing;
  return {
    gross_cents: amountCents,
    commission_cents: commission,
    processing_fee_cents: processing,
    organizer_net_cents: amountCents - commission - processing,
  };
}
