CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE builder (
  builder_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  logo VARCHAR(500) DEFAULT 'https://cdn.dribbble.com/userupload/5245642/file/original-430a2e28de5df4e1932405b3a9f783e7.png?resize=752x&vertical=center',
  slogan VARCHAR(500),
  license_number VARCHAR(100),
  abn_number VARCHAR(100),
  phone_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE users_role_enum AS ENUM ('super_admin', 'admin', 'project_owner', 'service_provider', 'client');

CREATE TABLE users (
  users_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  role users_role_enum[] NOT NULL,
  root_user BOOLEAN DEFAULT FALSE,
  otp VARCHAR(10),
  expires_at TIMESTAMP,
  reset_password_token VARCHAR(255),
  reset_token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE
);

CREATE TABLE users_token (
  users_token_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(users_id) ON DELETE CASCADE
);

CREATE TABLE contractor (
  contractor_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  builder_id UUID NOT NULL,
  phone VARCHAR(15),
  address TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE
);

CREATE TABLE customer (
	customer_id uuid DEFAULT uuid_generate_v4() NOT NULL,
	name varchar(100) NOT NULL,
	email varchar(100) NOT NULL,
	builder_id uuid NOT NULL,
	phone varchar(15) NULL,
	address text NULL,
	is_deleted boolean DEFAULT false NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT customer_email_key UNIQUE (email),
	CONSTRAINT customer_pkey PRIMARY KEY (customer_id),
	CONSTRAINT customer_builder_id_fkey FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE
);

CREATE TABLE invites (
  invite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  builder_id UUID NOT NULL,
  role users_role_enum NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE
);

CREATE TABLE status_logs (
  status_log_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id UUID NOT NULL,
  status_code INT NOT NULL,
  error TEXT,
  method VARCHAR(10),
  url VARCHAR(255),
  request_body TEXT,
  response TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE lead_source_enum AS ENUM ('ADMIN_PANEL', 'WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'LINKEDIN', 'TWITTER', 'TIKTOK', 'WHATSAPP', 'EMAIL_CAMPAIGN', 'GOOGLE_ADS', 'FACEBOOK_ADS', 'INSTAGRAM_ADS', 'YOUTUBE_ADS', 'LINKEDIN_ADS', 'REFERRAL', 'PHONE_CALL', 'TRADE_SHOW', 'PARTNER', 'OTHER');
CREATE TYPE lead_status_enum AS ENUM ('NEW', 'IN_PROGRESS', 'JOB', 'CONSTRUCTION', 'COMPLETED', 'CANCELLED');

CREATE TABLE leads (
  lead_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  status lead_status_enum DEFAULT 'NEW' NOT NULL,
  lead_source lead_source_enum NOT NULL DEFAULT 'OTHER',
  notes TEXT,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE range (
  range_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dwelling_type (
  dwelling_type_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE floor_plan (
  floor_plan_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  image VARCHAR(500),
  range_id UUID NOT NULL,
  dwelling_type_id UUID NOT NULL,
  beds INTEGER DEFAULT 0,
  bath INTEGER DEFAULT 0,
  car_park INTEGER DEFAULT 0,
  width_meter DECIMAL(8,2) DEFAULT 0,
  depth_meter DECIMAL(8,2) DEFAULT 0,
  dwelling INTEGER DEFAULT 0,
  garage INTEGER DEFAULT 0,
  porch INTEGER DEFAULT 0,
  alfresco INTEGER DEFAULT 0,
  total_sqft DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  
  CONSTRAINT fk_floor_plan_builder FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  CONSTRAINT fk_floor_plan_range FOREIGN KEY (range_id) REFERENCES range(range_id) ON DELETE CASCADE,
  CONSTRAINT fk_floor_plan_dwelling_type FOREIGN KEY (dwelling_type_id) REFERENCES dwelling_type(dwelling_type_id) ON DELETE CASCADE
);

CREATE TABLE facade (
  facade_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  image VARCHAR(500),
  dwelling_type_id UUID NOT NULL,
  standard BOOLEAN DEFAULT FALSE,
  upgrade BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_facade_builder FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  CONSTRAINT fk_facade_dwelling_type FOREIGN KEY (dwelling_type_id) REFERENCES dwelling_type(dwelling_type_id) ON DELETE CASCADE
);

CREATE TYPE cost_type AS ENUM ('INCLUDED', 'FIXED', 'VARIABLE');
CREATE TYPE cost_option AS ENUM ('NONE', 'TBA', 'TBC');
CREATE TYPE item_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE conditions (
  condition_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE category_items (
  category_item_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  category_id UUID NOT NULL,
  description TEXT NOT NULL,
  short_description VARCHAR(500),
  cost_type cost_type NOT NULL,
  cost NUMERIC(12,2),
  cost_type_text VARCHAR(255),
  cost_option cost_option DEFAULT 'NONE',
  include_by_default BOOLEAN DEFAULT FALSE,
  show_in_hl_package BOOLEAN DEFAULT TRUE,
  package_only BOOLEAN DEFAULT FALSE,
  uom VARCHAR(50),
  sort_order INT DEFAULT 0,
  range_id UUID,
  dwelling_type_id UUID,
  status item_status DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE,
  FOREIGN KEY (range_id) REFERENCES range(range_id) ON DELETE SET NULL,
  FOREIGN KEY (dwelling_type_id) REFERENCES dwelling_type(dwelling_type_id) ON DELETE SET NULL
);

CREATE TABLE category_items_condition (
  category_items_condition_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  category_item_id UUID NOT NULL,
  condition_id UUID NOT NULL,
  range_start NUMERIC(12,2),
  range_end NUMERIC(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (category_item_id) REFERENCES category_items(category_item_id) ON DELETE CASCADE,
  FOREIGN KEY (condition_id) REFERENCES conditions(condition_id) ON DELETE CASCADE
);

CREATE TABLE packages (
  package_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  builder_id UUID NOT NULL,
  category_items_id UUID[] NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
);

CREATE TYPE property_title_status AS ENUM ('ESTIMATED', 'ACTUAL');
CREATE TYPE property_compaction_report AS ENUM ('AVAILABLE', 'NOT_AVAILABLE');
CREATE TYPE property_land_type AS ENUM ('REGULAR', 'IRREGULAR');

CREATE TABLE property (
  property_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  country VARCHAR(100) NOT NULL,
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255),
  city_suburb VARCHAR(100) NOT NULL,
  state_region VARCHAR(100) NOT NULL,
  zip_postal_code VARCHAR(20) NOT NULL,
  estate_name VARCHAR(150),
  title_status property_title_status NOT NULL,
  title_date DATE,
  compaction_report property_compaction_report NOT NULL,
  land_type property_land_type NOT NULL,
  width_m NUMERIC(8,2),
  depth_m NUMERIC(8,2),
  total_size_m2 NUMERIC(12,2),
  site_fall_mm NUMERIC(12,2),
  land_fill_mm NUMERIC(12,2),
  bush_fire BOOLEAN DEFAULT FALSE,
  corner_block BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
);

CREATE TABLE quotation (
  quotation_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  property_id UUID NOT NULL,
  floor_plan_id UUID NOT NULL,
  facade_id UUID NOT NULL,
  package_id UUID NOT NULL,
  range_id UUID NOT NULL,
  dwelling_type_id UUID NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES property(property_id) ON DELETE CASCADE,
  FOREIGN KEY (floor_plan_id) REFERENCES floor_plan(floor_plan_id) ON DELETE CASCADE,
  FOREIGN KEY (facade_id) REFERENCES facade(facade_id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
  FOREIGN KEY (range_id) REFERENCES range(range_id) ON DELETE CASCADE,
  FOREIGN KEY (dwelling_type_id) REFERENCES dwelling_type(dwelling_type_id) ON DELETE CASCADE
);

CREATE TABLE job (
  job_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  quotation_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (quotation_id) REFERENCES quotation(quotation_id) ON DELETE CASCADE
);
  