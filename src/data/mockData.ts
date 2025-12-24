export interface GymUser {
  id: string;
  name: string;
  employeeId: string;
  createdAt: string;
}

export interface GymSchedule {
  id: string;
  gymUserId: string;
  scheduleTime: string;
  createdAt: string;
}

export const gymUsers: GymUser[] = [
  { id: '1', name: 'John Smith', employeeId: 'EMP001', createdAt: '2024-01-15' },
  { id: '2', name: 'Sarah Johnson', employeeId: 'EMP002', createdAt: '2024-01-20' },
  { id: '3', name: 'Michael Brown', employeeId: 'EMP003', createdAt: '2024-02-01' },
  { id: '4', name: 'Emily Davis', employeeId: 'EMP004', createdAt: '2024-02-10' },
  { id: '5', name: 'David Wilson', employeeId: 'EMP005', createdAt: '2024-02-15' },
  { id: '6', name: 'Jessica Taylor', employeeId: 'EMP006', createdAt: '2024-03-01' },
];

const today = new Date();
const formatDate = (date: Date) => date.toISOString();

export const gymSchedules: GymSchedule[] = [
  { id: '1', gymUserId: '1', scheduleTime: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0)), createdAt: '2024-01-15' },
  { id: '2', gymUserId: '2', scheduleTime: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30)), createdAt: '2024-01-20' },
  { id: '3', gymUserId: '3', scheduleTime: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0)), createdAt: '2024-02-01' },
  { id: '4', gymUserId: '4', scheduleTime: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 11, 0)), createdAt: '2024-02-10' },
  { id: '5', gymUserId: '5', scheduleTime: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 16, 0)), createdAt: '2024-02-15' },
  { id: '6', gymUserId: '1', scheduleTime: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 9, 0)), createdAt: '2024-03-01' },
  { id: '7', gymUserId: '2', scheduleTime: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 15, 0)), createdAt: '2024-03-05' },
  { id: '8', gymUserId: '6', scheduleTime: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 8, 0)), createdAt: '2024-03-10' },
];

export function getUserById(id: string): GymUser | undefined {
  return gymUsers.find(user => user.id === id);
}

export function getSchedulesByUserId(userId: string): GymSchedule[] {
  return gymSchedules.filter(schedule => schedule.gymUserId === userId);
}

export function getNextScheduleForUser(userId: string): GymSchedule | undefined {
  const now = new Date();
  const userSchedules = getSchedulesByUserId(userId)
    .filter(s => new Date(s.scheduleTime) >= now)
    .sort((a, b) => new Date(a.scheduleTime).getTime() - new Date(b.scheduleTime).getTime());
  return userSchedules[0];
}

export function getTodaySchedules(): GymSchedule[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return gymSchedules.filter(schedule => {
    const scheduleDate = new Date(schedule.scheduleTime);
    return scheduleDate >= today && scheduleDate < tomorrow;
  });
}

export function getThisWeekSchedules(): GymSchedule[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  
  return gymSchedules.filter(schedule => {
    const scheduleDate = new Date(schedule.scheduleTime);
    return scheduleDate >= today && scheduleDate < endOfWeek;
  });
}

export function getUpcomingSchedules(): GymSchedule[] {
  const now = new Date();
  return gymSchedules
    .filter(schedule => new Date(schedule.scheduleTime) >= now)
    .sort((a, b) => new Date(a.scheduleTime).getTime() - new Date(b.scheduleTime).getTime());
}
