-- Create database_connections table for storing multiple database configurations
CREATE TABLE public.database_connections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    display_name TEXT NOT NULL,
    database_type TEXT NOT NULL DEFAULT 'sqlserver',
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 1433,
    database_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    connection_status TEXT NOT NULL DEFAULT 'disconnected',
    last_tested_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.database_connections ENABLE ROW LEVEL SECURITY;

-- Only superadmin can access database connections
CREATE POLICY "SuperAdmins can view all database connections"
ON public.database_connections
FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "SuperAdmins can insert database connections"
ON public.database_connections
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "SuperAdmins can update database connections"
ON public.database_connections
FOR UPDATE
USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "SuperAdmins can delete database connections"
ON public.database_connections
FOR DELETE
USING (public.has_role(auth.uid(), 'superadmin'));

-- Add trigger for updated_at
CREATE TRIGGER update_database_connections_updated_at
BEFORE UPDATE ON public.database_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();