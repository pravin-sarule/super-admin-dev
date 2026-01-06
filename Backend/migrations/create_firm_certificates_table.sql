-- Create firm_certificates table
CREATE TABLE IF NOT EXISTS firm_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    firm_id UUID NOT NULL,

    certificate_path TEXT NOT NULL,
    -- Example: gs://bucket-name/firms/{firm_id}/certificates/bar_certificate.pdf

    issue_date DATE,
    expiry_date DATE,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_firm_certificate
        FOREIGN KEY (firm_id)
        REFERENCES firms(id)
        ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_firm_certificates_firm_id ON firm_certificates(firm_id);
CREATE INDEX IF NOT EXISTS idx_firm_certificates_is_active ON firm_certificates(is_active);

