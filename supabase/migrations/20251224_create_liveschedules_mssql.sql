-- Create LiveSchedules table in GymDB
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LiveSchedules]') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.LiveSchedules ( 
        Session   VARCHAR(20) NOT NULL,      -- Pagi / Sore / Malam 
        StartTime TIME(0)     NOT NULL,       -- 05:00 
        EndTime   TIME(0)     NOT NULL,       -- 06:30 
        Status    VARCHAR(15) NOT NULL 
            CONSTRAINT DF_LiveSchedules_Status DEFAULT 'Sesuai', 
    
        CONSTRAINT CK_LiveSchedules_Status 
            CHECK (Status IN ('Sesuai','Tidak Sesuai')), 
    
        CONSTRAINT CK_LiveSchedules_Time 
            CHECK (StartTime < EndTime) 
    );
END
