-- Create currencies table in Supabase
CREATE TABLE IF NOT EXISTS currencies (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create NBG exchange rates table in Supabase
CREATE TABLE IF NOT EXISTS nbg_exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    usd_rate DECIMAL(18, 6),
    eur_rate DECIMAL(18, 6),
    cny_rate DECIMAL(18, 6),
    gbp_rate DECIMAL(18, 6),
    rub_rate DECIMAL(18, 6),
    try_rate DECIMAL(18, 6),
    aed_rate DECIMAL(18, 6),
    kzt_rate DECIMAL(18, 6),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_nbg_exchange_rates_date ON nbg_exchange_rates(date DESC);
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);
CREATE INDEX IF NOT EXISTS idx_currencies_is_active ON currencies(is_active);

COMMENT ON TABLE currencies IS 'Currency dictionary for ICE ERP system';
COMMENT ON TABLE nbg_exchange_rates IS 'Historical and current exchange rates from National Bank of Georgia';
