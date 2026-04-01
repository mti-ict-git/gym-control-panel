IF OBJECT_ID('dbo.gym_controller_settings','U') IS NULL
BEGIN
  CREATE TABLE dbo.gym_controller_settings (
    Id INT NOT NULL CONSTRAINT PK_gym_controller_settings PRIMARY KEY,
    EnableAutoOrganize BIT NOT NULL CONSTRAINT DF_gym_controller_settings_EnableAutoOrganize DEFAULT 0,
    EnableManagerAllSessionAccess BIT NOT NULL CONSTRAINT DF_gym_controller_settings_EnableManagerAllSessionAccess DEFAULT 0,
    AllowVendorUseGym BIT NOT NULL CONSTRAINT DF_gym_controller_settings_AllowVendorUseGym DEFAULT 0,
    GraceBeforeMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceBeforeMin DEFAULT 0,
    GraceAfterMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceAfterMin DEFAULT 0,
    WorkerIntervalMs INT NOT NULL CONSTRAINT DF_gym_controller_settings_WorkerIntervalMs DEFAULT 60000,
    BookingMinDaysAhead INT NOT NULL CONSTRAINT DF_gym_controller_settings_BookingMinDaysAhead DEFAULT 1,
    BookingMaxDaysAhead INT NOT NULL CONSTRAINT DF_gym_controller_settings_BookingMaxDaysAhead DEFAULT 2,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_gym_controller_settings_CreatedAt DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL
  );
END;

IF COL_LENGTH('dbo.gym_controller_settings', 'EnableManagerAllSessionAccess') IS NULL
BEGIN
  ALTER TABLE dbo.gym_controller_settings ADD EnableManagerAllSessionAccess BIT NOT NULL CONSTRAINT DF_gym_controller_settings_EnableManagerAllSessionAccess2 DEFAULT 0;
END;

IF COL_LENGTH('dbo.gym_controller_settings', 'AllowVendorUseGym') IS NULL
BEGIN
  ALTER TABLE dbo.gym_controller_settings ADD AllowVendorUseGym BIT NOT NULL CONSTRAINT DF_gym_controller_settings_AllowVendorUseGym2 DEFAULT 0;
END;

IF COL_LENGTH('dbo.gym_controller_settings', 'GraceBeforeMin') IS NULL
BEGIN
  ALTER TABLE dbo.gym_controller_settings ADD GraceBeforeMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceBeforeMin2 DEFAULT 0;
END;

IF COL_LENGTH('dbo.gym_controller_settings', 'GraceAfterMin') IS NULL
BEGIN
  ALTER TABLE dbo.gym_controller_settings ADD GraceAfterMin INT NOT NULL CONSTRAINT DF_gym_controller_settings_GraceAfterMin2 DEFAULT 0;
END;

IF COL_LENGTH('dbo.gym_controller_settings', 'WorkerIntervalMs') IS NULL
BEGIN
  ALTER TABLE dbo.gym_controller_settings ADD WorkerIntervalMs INT NOT NULL CONSTRAINT DF_gym_controller_settings_WorkerIntervalMs2 DEFAULT 60000;
END;

IF COL_LENGTH('dbo.gym_controller_settings', 'BookingMinDaysAhead') IS NULL
BEGIN
  ALTER TABLE dbo.gym_controller_settings ADD BookingMinDaysAhead INT NOT NULL CONSTRAINT DF_gym_controller_settings_BookingMinDaysAhead2 DEFAULT 1;
END;

IF COL_LENGTH('dbo.gym_controller_settings', 'BookingMaxDaysAhead') IS NULL
BEGIN
  ALTER TABLE dbo.gym_controller_settings ADD BookingMaxDaysAhead INT NOT NULL CONSTRAINT DF_gym_controller_settings_BookingMaxDaysAhead2 DEFAULT 2;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.gym_controller_settings WHERE Id = 1)
BEGIN
  INSERT INTO dbo.gym_controller_settings (Id, EnableAutoOrganize, BookingMinDaysAhead, BookingMaxDaysAhead)
  VALUES (1, 0, 1, 2);
END;
