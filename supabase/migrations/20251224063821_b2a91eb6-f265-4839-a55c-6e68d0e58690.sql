-- Add status and time tracking columns to gym_schedules
ALTER TABLE public.gym_schedules 
ADD COLUMN status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'IN_GYM', 'OUT')),
ADD COLUMN check_in_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN check_out_time TIMESTAMP WITH TIME ZONE;

-- Create index for efficient status queries
CREATE INDEX idx_gym_schedules_status ON public.gym_schedules(status);

-- Create a function to get current gym occupancy
CREATE OR REPLACE FUNCTION public.get_gym_occupancy()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::INTEGER
    FROM public.gym_schedules
    WHERE status = 'IN_GYM'
$$;

-- Create a function for safe check-in with capacity validation
CREATE OR REPLACE FUNCTION public.check_in_user(schedule_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_count INTEGER;
    max_capacity INTEGER := 15;
    result JSONB;
BEGIN
    -- Get current occupancy
    SELECT COUNT(*) INTO current_count
    FROM public.gym_schedules
    WHERE status = 'IN_GYM';
    
    -- Check capacity
    IF current_count >= max_capacity THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Gym is full (15/15)',
            'current_count', current_count
        );
    END IF;
    
    -- Perform check-in
    UPDATE public.gym_schedules
    SET status = 'IN_GYM',
        check_in_time = NOW()
    WHERE id = schedule_id
      AND status = 'BOOKED';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Schedule not found or already checked in',
            'current_count', current_count
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'current_count', current_count + 1
    );
END;
$$;