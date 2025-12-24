export interface GymSession {
  id: string;
  name: string;
  nameId: string; // Indonesian name
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

export const GYM_SESSIONS: GymSession[] = [
  {
    id: 'morning',
    name: 'Morning',
    nameId: 'Pagi',
    startTime: '05:00',
    endTime: '06:30',
  },
  {
    id: 'evening',
    name: 'Evening',
    nameId: 'Sore',
    startTime: '18:00',
    endTime: '20:00',
  },
  {
    id: 'night',
    name: 'Night',
    nameId: 'Malam',
    startTime: '20:00',
    endTime: '22:00',
  },
];

export const getSessionById = (id: string): GymSession | undefined => {
  return GYM_SESSIONS.find((session) => session.id === id);
};

export const getSessionByTime = (date: Date): GymSession | undefined => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  return GYM_SESSIONS.find((session) => {
    const [startH, startM] = session.startTime.split(':').map(Number);
    const [endH, endM] = session.endTime.split(':').map(Number);
    const startInMinutes = startH * 60 + startM;
    const endInMinutes = endH * 60 + endM;
    return timeInMinutes >= startInMinutes && timeInMinutes < endInMinutes;
  });
};

export const formatSessionTime = (session: GymSession): string => {
  return `${session.startTime} - ${session.endTime}`;
};

export const formatSessionDisplay = (session: GymSession): string => {
  return `${session.nameId} (${formatSessionTime(session)})`;
};
