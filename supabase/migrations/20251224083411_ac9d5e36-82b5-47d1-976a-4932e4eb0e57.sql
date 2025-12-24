-- Add vault_employee_id and department columns to gym_users
ALTER TABLE public.gym_users 
ADD COLUMN IF NOT EXISTS vault_employee_id TEXT,
ADD COLUMN IF NOT EXISTS department TEXT;

-- Create unique constraint on vault_employee_id to prevent duplicates
ALTER TABLE public.gym_users
ADD CONSTRAINT gym_users_vault_employee_id_unique UNIQUE (vault_employee_id);