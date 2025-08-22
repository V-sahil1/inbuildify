CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE builder (
  builder_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
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

CREATE TABLE statusLogs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requestId UUID NOT NULL,
  statusCode INT NOT NULL,
  error TEXT,
  method VARCHAR(10),
  url VARCHAR(255),
  requestBody TEXT,
  response TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE lead_source_enum AS ENUM ('ADMIN_PANEL', 'WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'LINKEDIN', 'TWITTER', 'TIKTOK', 'WHATSAPP', 'EMAIL_CAMPAIGN', 'GOOGLE_ADS', 'FACEBOOK_ADS', 'INSTAGRAM_ADS', 'YOUTUBE_ADS', 'LINKEDIN_ADS', 'REFERRAL', 'PHONE_CALL', 'TRADE_SHOW', 'PARTNER', 'OTHER');

CREATE TABLE leads (
  lead_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  builder_id UUID,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'new' NOT NULL,
  lead_source lead_source_enum NOT NULL DEFAULT 'OTHER',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (builder_id) REFERENCES builder(builder_id) ON DELETE CASCADE
);
