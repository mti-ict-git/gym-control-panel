-- Create gym_sessions table for session slots
CREATE TABLE public.gym_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_name TEXT NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    quota INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.gym_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all sessions" 
ON public.gym_sessions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sessions" 
ON public.gym_sessions 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sessions" 
ON public.gym_sessions 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sessions" 
ON public.gym_sessions 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_gym_sessions_updated_at
BEFORE UPDATE ON public.gym_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();