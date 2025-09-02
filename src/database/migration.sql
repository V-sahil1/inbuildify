ALTER TABLE contractor
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE customer
ADD COLUMN is_deleted boolean DEFAULT false NOT NULL;

ALTER TABLE leads
ADD COLUMN message TEXT;

ALTER TABLE builder
ADD COLUMN license_number VARCHAR(100),
ADD COLUMN abn_number VARCHAR(100),
ADD COLUMN phone_number VARCHAR(20);

ALTER TABLE builder
ALTER COLUMN logo SET DEFAULT 'https://cdn.dribbble.com/userupload/5245642/file/original-430a2e28de5df4e1932405b3a9f783e7.png?resize=752x&vertical=center';

ALTER TABLE leads
ADD COLUMN builder_id UUID,
ADD CONSTRAINT fk_leads_builder
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE;
