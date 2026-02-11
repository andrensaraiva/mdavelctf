import { EventDoc, EventStatus } from '@mdavelctf/shared';

export function getEventStatus(event: EventDoc): EventStatus {
  const now = Date.now();
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  if (now < start) return 'UPCOMING';
  if (now > end) return 'ENDED';
  return 'LIVE';
}
