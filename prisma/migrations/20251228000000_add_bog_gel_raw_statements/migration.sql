-- Create parent table for BOG_GEL raw statements (partitioned by bank_account_uuid)
CREATE TABLE bog_gel_raw_statements (
    id BIGSERIAL NOT NULL,
    uuid UUID NOT NULL,
    bank_account_uuid UUID NOT NULL,
    
    -- Document identifiers
    doc_key TEXT,
    entries_id TEXT,
    
    -- Transaction details
    doc_rec_date TEXT,
    doc_value_date TEXT,
    doc_actual_date TEXT,
    doc_branch TEXT,
    doc_department TEXT,
    doc_prod_group TEXT,
    doc_no TEXT,
    
    -- Description
    doc_nomination TEXT,
    doc_information TEXT,
    doc_comment TEXT,
    entry_comment TEXT,
    
    -- Sender details
    doc_sender_name TEXT,
    doc_sender_inn TEXT,
    doc_sender_acct_no TEXT,
    doc_sender_bic TEXT,
    doc_sender_bic_name TEXT,
    
    -- Beneficiary details
    doc_benef_name TEXT,
    doc_benef_inn TEXT,
    doc_benef_acct_no TEXT,
    doc_benef_bic TEXT,
    doc_benef_bic_name TEXT,
    
    -- Payer details
    doc_payer_name TEXT,
    doc_payer_inn TEXT,
    
    -- Correspondent account
    doc_cor_acct TEXT,
    doc_cor_bic TEXT,
    doc_cor_bank_name TEXT,
    
    -- Amounts and currency
    doc_src_amt TEXT,
    doc_src_ccy TEXT,
    doc_dst_amt TEXT,
    doc_dst_ccy TEXT,
    entry_db_amt TEXT,
    entry_db_amt_base TEXT,
    entry_cr_amt TEXT,
    entry_cr_amt_base TEXT,
    entry_amt_base TEXT,
    out_balance TEXT,
    
    -- Entry details
    entry_p_date TEXT,
    entry_doc_no TEXT,
    entry_l_acct TEXT,
    entry_l_acct_old TEXT,
    entry_department TEXT,
    entry_acct_point TEXT,
    ccy_rate TEXT,
    
    -- Metadata
    can_copy_document TEXT,
    can_view_document TEXT,
    can_print_document TEXT,
    is_reval TEXT,
    
    -- Import metadata
    import_batch_id TEXT,
    import_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_processed BOOLEAN NOT NULL DEFAULT false,
    processing_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT bog_gel_raw_statements_pkey PRIMARY KEY (id, bank_account_uuid)
) PARTITION BY LIST (bank_account_uuid);

-- Create unique index including partition key
CREATE UNIQUE INDEX bog_gel_raw_statements_uuid_bank_account_uuid_key 
ON bog_gel_raw_statements(uuid, bank_account_uuid);

-- Create unique index on doc_key + entries_id + bank_account_uuid
CREATE UNIQUE INDEX bog_gel_raw_statements_doc_key_entries_id_bank_account_uuid_key 
ON bog_gel_raw_statements(doc_key, entries_id, bank_account_uuid) 
WHERE doc_key IS NOT NULL AND entries_id IS NOT NULL;

-- Create indexes for queries
CREATE INDEX bog_gel_raw_statements_is_processed_idx ON bog_gel_raw_statements(is_processed);
CREATE INDEX bog_gel_raw_statements_import_batch_id_idx ON bog_gel_raw_statements(import_batch_id);
CREATE INDEX bog_gel_raw_statements_doc_rec_date_idx ON bog_gel_raw_statements(doc_rec_date);

-- Add foreign key
ALTER TABLE bog_gel_raw_statements 
ADD CONSTRAINT bog_gel_raw_statements_bank_account_uuid_fkey 
FOREIGN KEY (bank_account_uuid) REFERENCES bank_accounts(uuid) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create partition for specific account: GE78BG0000000893486000 (60582948-8c5b-4715-b75c-ca03e3d36a4e)
CREATE TABLE bog_gel_raw_statements_60582948_8c5b_4715_b75c_ca03e3d36a4e 
PARTITION OF bog_gel_raw_statements 
FOR VALUES IN ('60582948-8c5b-4715-b75c-ca03e3d36a4e');

