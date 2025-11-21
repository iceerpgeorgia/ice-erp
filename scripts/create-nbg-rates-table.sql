-- Create NBG Exchange Rates table
CREATE TABLE IF NOT EXISTS nbg_exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  usd_rate DECIMAL(18, 6),
  eur_rate DECIMAL(18, 6),
  cny_rate DECIMAL(18, 6),
  gbp_rate DECIMAL(18, 6),
  rub_rate DECIMAL(18, 6),
  try_rate DECIMAL(18, 6),
  aed_rate DECIMAL(18, 6),
  kzt_rate DECIMAL(18, 6),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(date)
);

-- Create index on date for faster lookups
CREATE INDEX IF NOT EXISTS idx_nbg_exchange_rates_date ON nbg_exchange_rates(date);

-- Add comment to table
COMMENT ON TABLE nbg_exchange_rates IS 'National Bank of Georgia exchange rates - how many GEL per 1 unit of foreign currency';
