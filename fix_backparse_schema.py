with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# In backparse_bog_gel function, update the temp table creation (around line 1870)
old_temp_table = """        local_cursor.execute(\"\"\"
            CREATE TEMP TABLE temp_flag_updates (
                uuid UUID,
                case1 BOOLEAN,
                case2 BOOLEAN,
                case3 BOOLEAN,
                case4 BOOLEAN,
                case5 BOOLEAN,
                case6 BOOLEAN,
                case7 BOOLEAN,
                case8 BOOLEAN
            )
        \"\"\")"""

new_temp_table = """        local_cursor.execute(\"\"\"
            CREATE TEMP TABLE temp_flag_updates (
                uuid UUID,
                counteragent_processed BOOLEAN,
                counteragent_found BOOLEAN,
                counteragent_missing BOOLEAN,
                payment_id_matched BOOLEAN,
                payment_id_conflict BOOLEAN,
                parsing_rule_applied BOOLEAN,
                parsing_rule_conflict BOOLEAN,
                counteragent_inn TEXT,
                processing_case TEXT
            )
        \"\"\")"""

content = content.replace(old_temp_table, new_temp_table)

# Fix the buffer.write line in backparse (line ~1893)
old_buffer_write = "buffer.write(f\"{update['uuid']}\\t{update['case1_counteragent_processed']}\\t{update['case2_counteragent_inn_blank']}\\t{update['case3_counteragent_inn_nonblank_no_match']}\\t{update['case4_payment_id_match']}\\t{update['case5_payment_id_counteragent_mismatch']}\\t{update['case6_parsing_rule_match']}\\t{update['case7_parsing_rule_counteragent_mismatch']}\\t{update['case8_parsing_rule_dominance']}\\n\")"

new_buffer_write = """inn = update.get('counteragent_inn', '')
            if inn is None:
                inn = ''
            processing_case = update.get('processing_case', '').replace('\\n', ' ')
            buffer.write(f\"{update['uuid']}\\t{update['case1_counteragent_processed']}\\t{update['case1_counteragent_found']}\\t{update['case3_counteragent_missing']}\\t{update['case4_payment_id_matched']}\\t{update['case5_payment_id_conflict']}\\t{update['case6_parsing_rule_applied']}\\t{update['case7_parsing_rule_conflict']}\\t{inn}\\t{processing_case}\\n\")"""

content = content.replace(old_buffer_write, new_buffer_write)

# Fix the copy_from columns in backparse
old_copy_from = "local_cursor.copy_from(buffer, 'temp_flag_updates', columns=('uuid', 'case1', 'case2', 'case3', 'case4', 'case5', 'case6', 'case7', 'case8'))"

new_copy_from = "local_cursor.copy_from(buffer, 'temp_flag_updates', columns=('uuid', 'counteragent_processed', 'counteragent_found', 'counteragent_missing', 'payment_id_matched', 'payment_id_conflict', 'parsing_rule_applied', 'parsing_rule_conflict', 'counteragent_inn', 'processing_case'))"

content = content.replace(old_copy_from, new_copy_from)

# Fix the bulk UPDATE statement in backparse
old_bulk_update = """        local_cursor.execute(f\"\"\"
            UPDATE {raw_table_name} AS raw SET
                counteragent_processed = tmp.case1,
                counteragent_inn_blank = tmp.case2,
                counteragent_inn_nonblank_no_match = tmp.case3,
                payment_id_match = tmp.case4,
                payment_id_counteragent_mismatch = tmp.case5,
                parsing_rule_match = tmp.case6,
                parsing_rule_counteragent_mismatch = tmp.case7,
                parsing_rule_dominance = tmp.case8,
                is_processed = TRUE,
                updated_at = NOW()
            FROM temp_flag_updates AS tmp
            WHERE raw.uuid = tmp.uuid
        \"\"\")"""

new_bulk_update = """        local_cursor.execute(f\"\"\"
            UPDATE {raw_table_name} AS raw SET
                counteragent_processed = tmp.counteragent_processed,
                counteragent_found = tmp.counteragent_found,
                counteragent_missing = tmp.counteragent_missing,
                payment_id_matched = tmp.payment_id_matched,
                payment_id_conflict = tmp.payment_id_conflict,
                parsing_rule_applied = tmp.parsing_rule_applied,
                parsing_rule_conflict = tmp.parsing_rule_conflict,
                parsing_rule_processed = TRUE,
                payment_id_processed = TRUE,
                counteragent_inn = tmp.counteragent_inn,
                processing_case = tmp.processing_case,
                is_processed = TRUE,
                updated_at = NOW()
            FROM temp_flag_updates AS tmp
            WHERE raw.uuid = tmp.uuid
        \"\"\")"""

content = content.replace(old_bulk_update, new_bulk_update)

with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed backparse_bog_gel to use new 8-case schema")
