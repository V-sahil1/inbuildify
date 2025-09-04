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

ALTER TABLE contractor ADD COLUMN service_id UUID;

UPDATE contractor
SET service_id = (
  SELECT service_id FROM service WHERE service = 'Color Painting' LIMIT 1
);

ALTER TABLE contractor ALTER COLUMN service_id SET NOT NULL;

ALTER TABLE contractor
ADD CONSTRAINT fk_contractor_service
FOREIGN KEY (service_id) REFERENCES service(service_id)
ON DELETE CASCADE;

CREATE TYPE lead_decision_enum AS ENUM ('WON', 'LOST');

ALTER TABLE leads 
ADD COLUMN decision lead_decision_enum DEFAULT NULL;

ALTER TABLE floor_plan
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE facade
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE range
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE dwelling_type
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE range
ADD COLUMN builder_id UUID,
ADD CONSTRAINT fk_range_builder
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE;

ALTER TABLE dwelling_type
ADD COLUMN builder_id UUID,
ADD CONSTRAINT fk_dwelling_type_builder
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE;
