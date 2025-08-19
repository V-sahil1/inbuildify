ALTER TABLE contractor
ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

DROP TABLE IF EXISTS public.customer CASCADE;

ALTER TABLE public.customer ADD COLUMN is_deleted boolean DEFAULT false NOT NULL;