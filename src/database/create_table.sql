CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE country (
  country_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE state (
  state_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_country FOREIGN KEY (country_id) REFERENCES country(country_id) ON DELETE CASCADE,
  CONSTRAINT unique_state_per_country UNIQUE (country_id, name)
);

CREATE TABLE builder (
  builder_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  logo VARCHAR(500) DEFAULT 'https://cdn.dribbble.com/userupload/5245642/file/original-430a2e28de5df4e1932405b3a9f783e7.png?resize=752x&vertical=center',
  slogan VARCHAR(500),
  firm_name VARCHAR(250),
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

CREATE TABLE service (
  service_id UUID DEFAULT uuid_generate_v4() NOT NULL,
  service VARCHAR(100) NOT NULL,
  builder_id UUID DEFAULT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_pkey PRIMARY KEY (service_id),
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE SET NULL
);

CREATE TABLE contractor (
  contractor_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  builder_id UUID NOT NULL,
  phone VARCHAR(15),
  address TEXT,
  service_id UUID NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES service(service_id) ON DELETE CASCADE
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

CREATE TYPE lead_status_enum AS ENUM ('NEW', 'IN_PROGRESS', 'JOB', 'CONSTRUCTION', 'COMPLETED', 'CANCELLED');
CREATE TYPE lead_decision_enum AS ENUM ('WON', 'LOST');

CREATE TABLE lead_source (
  lead_source_id UUID DEFAULT uuid_generate_v4() NOT NULL,
  name VARCHAR(100) NOT NULL,
  builder_id UUID DEFAULT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lead_source_pkey PRIMARY KEY (lead_source_id),
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE SET NULL
);

CREATE TABLE leads (
  lead_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug_id VARCHAR(255) NOT NULL DEFAULT 'DDL0000',
  builder_id UUID NOT NULL,
  lead_contact_id UUID DEFAULT NULL,
  status lead_status_enum DEFAULT 'NEW' NOT NULL,
  lead_source_id UUID NOT NULL,
  notes TEXT,
  message TEXT,
  decision lead_decision_enum DEFAULT NULL,
  quotation_version_id UUID DEFAULT NULL,
  assignee_id UUID NOT NULL,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (lead_source_id) REFERENCES lead_source(lead_source_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);

CREATE TABLE leads_contact (
  leads_contact_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID NOT NULL,
  country_id UUID DEFAULT NULL,
  state_id UUID DEFAULT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  secondary_phone VARCHAR(20),
  address1 TEXT,
  address2 TEXT,
  city VARCHAR(100),
  zip VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES country(country_id) ON DELETE CASCADE,
  FOREIGN KEY (state_id) REFERENCES state(state_id) ON DELETE CASCADE
);

ALTER TABLE leads
  ADD CONSTRAINT fk_lead_contact FOREIGN KEY (lead_contact_id)
  REFERENCES leads_contact(leads_contact_id) ON DELETE SET NULL;

CREATE TABLE range (
  range_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL UNIQUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE
);

CREATE TABLE dwelling_type (
  dwelling_type_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL UNIQUE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE
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
  is_deleted BOOLEAN DEFAULT FALSE,
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
  cost NUMERIC(12,2) DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
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

CREATE TABLE IF NOT EXISTS admin_category (
  admin_category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE categories (
  category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id UUID NOT NULL,
  admin_category_id UUID DEFAULT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (admin_category_id) REFERENCES admin_category(admin_category_id) ON DELETE CASCADE
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
  category_item_ids UUID[] NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  range_id UUID,
  dwelling_type_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (range_id) REFERENCES range(range_id) ON DELETE SET NULL,
  FOREIGN KEY (dwelling_type_id) REFERENCES dwelling_type(dwelling_type_id) ON DELETE SET NULL
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
  slug_id VARCHAR(255) NOT NULL DEFAULT 'DDQ0000',
  builder_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  property_id UUID NOT NULL,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES property(property_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);

CREATE TABLE quotation_versions (
  quotation_version_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quotation_id UUID NOT NULL,
  floor_plan_id UUID NOT NULL,
  facade_id UUID NOT NULL,
  package_id UUID NOT NULL,
  range_id UUID NOT NULL,
  dwelling_type_id UUID NOT NULL,
  version_number INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotation(quotation_id) ON DELETE CASCADE,
  FOREIGN KEY (floor_plan_id) REFERENCES floor_plan(floor_plan_id) ON DELETE CASCADE,
  FOREIGN KEY (facade_id) REFERENCES facade(facade_id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES packages(package_id) ON DELETE CASCADE,
  FOREIGN KEY (range_id) REFERENCES range(range_id) ON DELETE CASCADE,
  FOREIGN KEY (dwelling_type_id) REFERENCES dwelling_type(dwelling_type_id) ON DELETE CASCADE,
  UNIQUE (quotation_id, version_number)
);

CREATE TABLE quotation_version_items (
  quotation_version_item_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quotation_version_id UUID NOT NULL,
  notes TEXT,
  category_id UUID NOT NULL,
  caterogy_name VARCHAR(100) NOT NULL,
  category_description TEXT NOT NULL,
  category_item_id UUID DEFAULT NULL,
  category_item_description TEXT DEFAULT NULL,
  category_item_short_description VARCHAR(500) DEFAULT NULL,
  category_item_cost_type cost_type DEFAULT NULL,
  category_item_cost NUMERIC(12,2) DEFAULT NULL,
  category_item_quantity INT DEFAULT NULL,
  category_item_cost_type_text VARCHAR(255) DEFAULT NULL,
  category_item_cost_option cost_option DEFAULT NULL,
  category_item_include_by_default BOOLEAN DEFAULT NULL,
  category_item_show_in_hl_package BOOLEAN DEFAULT NULL,
  category_item_package_only BOOLEAN DEFAULT NULL,
  category_item_uom VARCHAR(50) DEFAULT NULL,
  category_item_sort_order INT DEFAULT NULL,
  category_item_range_id UUID DEFAULT NULL,
  category_item_dwelling_type_id UUID DEFAULT NULL,
  category_item_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  category_item_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_version_id) REFERENCES quotation_versions(quotation_version_id) ON DELETE CASCADE
);

ALTER TABLE leads
ADD CONSTRAINT fk_leads_quotation_version FOREIGN KEY (quotation_version_id) REFERENCES quotation_versions(quotation_version_id) ON DELETE SET NULL;

CREATE TYPE action_type_enum AS ENUM ('NOTES', 'SMS', 'APPOINTMENT', 'TASK');
CREATE TYPE task_priority_enum AS ENUM ('HIGH', 'LOW', 'MEDIUM');

CREATE TABLE actions (
  action_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type action_type_enum NOT NULL,
  builder_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);

CREATE TABLE tags (
  tag_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_builder_tag UNIQUE (builder_id, name),
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE
);

CREATE TABLE task (
  task_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  due_date DATE NOT NULL,
  time TIME DEFAULT CURRENT_TIME(6),
  priority task_priority_enum NOT NULL DEFAULT 'MEDIUM',
  description VARCHAR(500),
  attachment TEXT,
  assignee UUID DEFAULT NULL,
  is_workflow_process_task BOOLEAN NOT NULL DEFAULT FALSE,
  workflow_process_id UUID DEFAULT NULL,
  workflow_process_task_id UUID DEFAULT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignee) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (action_id) REFERENCES actions(action_id) ON DELETE CASCADE
);

CREATE TABLE notes (
  notes_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action_id UUID NOT NULL,
  message VARCHAR(500) NOT NULL,
  tags UUID[] DEFAULT '{}',
  attachment TEXT,
  task_id UUID DEFAULT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (action_id) REFERENCES actions(action_id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE SET NULL
);

CREATE TABLE sms (
  sms_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action_id UUID NOT NULL,
  recipient UUID[] NOT NULL,
  message VARCHAR(500) NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (action_id) REFERENCES actions(action_id) ON DELETE CASCADE
);

CREATE TABLE appointment (
  appointment_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(200),
  select_users UUID[] DEFAULT '{}',
  notes VARCHAR(500),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (action_id) REFERENCES actions(action_id) ON DELETE CASCADE
);

CREATE TABLE workflow_process (
  workflow_process_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  display_order INT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);

CREATE TABLE workflow_process_task (
  workflow_process_task_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workflow_process_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  attachment TEXT,
  timespent INT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_process_id) REFERENCES workflow_process(workflow_process_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);

ALTER TABLE task ADD CONSTRAINT task_workflow_process_id_fkey 
  FOREIGN KEY (workflow_process_id) REFERENCES workflow_process(workflow_process_id) ON DELETE SET NULL;
ALTER TABLE task ADD CONSTRAINT task_workflow_process_task_id_fkey 
  FOREIGN KEY (workflow_process_task_id) REFERENCES workflow_process_task(workflow_process_task_id) ON DELETE SET NULL;

CREATE TABLE color_category (
  color_category_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);

CREATE TABLE color_sub_category (
  color_sub_category_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  color_category_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (color_category_id) REFERENCES color_category(color_category_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);

CREATE TABLE color_items (
  color_item_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  color_sub_category_id UUID NOT NULL,
  builder_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(100) NOT NULL,
  standard BOOLEAN DEFAULT FALSE,
  upgrade BOOLEAN DEFAULT FALSE,
  units INT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  highlight_notes_on_pdf BOOLEAN DEFAULT FALSE,
  supplier_id UUID DEFAULT NULL,
  image TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (color_sub_category_id) REFERENCES color_sub_category(color_sub_category_id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);

CREATE TYPE invoice_status_enum AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

CREATE TABLE invoice (
  invoice_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_invoice_id VARCHAR(50) UNIQUE NOT NULL,
  builder_id UUID NOT NULL,
  lead_id UUID DEFAULT NULL,
  description VARCHAR(100) NOT NULL,
  notes VARCHAR(500) NOT NULL,
  invoice_amount NUMERIC(12,2) DEFAULT 0,
  due_date DATE NOT NULL,
  status invoice_status_enum DEFAULT 'draft' NOT NULL,
  version_number INT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id UUID NOT NULL,
  updated_by_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(users_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_id) REFERENCES users(users_id) ON DELETE SET NULL
);
