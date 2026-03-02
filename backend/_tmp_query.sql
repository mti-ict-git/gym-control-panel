SET NOCOUNT ON;
DECLARE @emp varchar(50) = 'MTI230361';
DECLARE @card varchar(50) = '3925495309';
UPDATE dbo.gym_booking
SET CardNo = @card
WHERE EmployeeID = @emp
  AND BookingDate >= CONVERT(date, GETDATE());
SELECT TOP 5 BookingID, EmployeeID, BookingDate, Status, ApprovalStatus, SessionName, ScheduleID, CardNo, CreatedAt
FROM dbo.gym_booking
WHERE EmployeeID = @emp
ORDER BY BookingDate DESC, CreatedAt DESC;
