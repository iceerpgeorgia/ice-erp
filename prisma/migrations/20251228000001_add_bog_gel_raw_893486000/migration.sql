-- Create dedicated raw statements table for account GE78BG0000000893486000
-- Table naming: bog_gel_raw_[account_number_suffix]
CREATE TABLE bog_gel_raw_893486000 (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    
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
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on doc_key + entries_id
CREATE UNIQUE INDEX bog_gel_raw_893486000_doc_key_entries_id_key 
ON bog_gel_raw_893486000(doc_key, entries_id) 
WHERE doc_key IS NOT NULL AND entries_id IS NOT NULL;

-- Create indexes for queries
CREATE INDEX bog_gel_raw_893486000_is_processed_idx ON bog_gel_raw_893486000(is_processed);
CREATE INDEX bog_gel_raw_893486000_import_batch_id_idx ON bog_gel_raw_893486000(import_batch_id);
CREATE INDEX bog_gel_raw_893486000_doc_rec_date_idx ON bog_gel_raw_893486000(doc_rec_date);
