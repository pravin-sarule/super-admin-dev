-- Fix typo in firm_certificates table: cerificate_path -> certificate_path
-- This migration fixes the column name typo

DO $$
BEGIN
    -- Check if the typo column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'firm_certificates' 
        AND column_name = 'cerificate_path'
    ) THEN
        -- Check if correct column already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'firm_certificates' 
            AND column_name = 'certificate_path'
        ) THEN
            -- Add the correct column
            ALTER TABLE firm_certificates ADD COLUMN certificate_path TEXT;
            
            -- Copy data from typo column to correct column
            UPDATE firm_certificates 
            SET certificate_path = cerificate_path 
            WHERE cerificate_path IS NOT NULL;
            
            -- Make it NOT NULL after copying data
            ALTER TABLE firm_certificates ALTER COLUMN certificate_path SET NOT NULL;
            
            -- Drop the typo column
            ALTER TABLE firm_certificates DROP COLUMN cerificate_path;
            
            RAISE NOTICE 'Fixed typo: renamed cerificate_path to certificate_path';
        ELSE
            -- If both columns exist, copy data and drop typo column
            UPDATE firm_certificates 
            SET certificate_path = cerificate_path 
            WHERE certificate_path IS NULL AND cerificate_path IS NOT NULL;
            
            ALTER TABLE firm_certificates DROP COLUMN cerificate_path;
            
            RAISE NOTICE 'Removed duplicate typo column cerificate_path';
        END IF;
    END IF;
END $$;

