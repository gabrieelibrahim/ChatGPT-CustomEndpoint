import services from '../../shared/googleWorkspace.json';
export const googleWorkspace = services;
export type GoogleWorkspaceService = typeof services[number];
export const googleIdentityScope = 'https://www.googleapis.com/auth/userinfo.email';
export function googleService(value: string): GoogleWorkspaceService | undefined {
  return services.find(service => service.id === value || service.url === value.replace(/\/+$/, ''));
}
export function googleScopes(service: GoogleWorkspaceService, write = false) {
  return [...new Set([...service.readScopes, ...(write ? service.writeScopes : []), googleIdentityScope])];
}
export function googleScopeGranted(scope: string, granted: string[]) {
  // Google normalizes the legacy Classroom coursework read scope in consent results.
  const classroomRead = 'https://www.googleapis.com/auth/classroom.coursework.students.readonly';
  const classroomCanonical = 'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly';
  if (scope === classroomRead && granted.includes(classroomCanonical)) return true;
  if (scope === googleIdentityScope && granted.includes('email')) return true;
  if (scope === 'https://www.googleapis.com/auth/userinfo.profile' && granted.includes('profile')) return true;
  if (granted.includes(scope)) return true;
  // Google can return an already-granted write scope instead of the narrower read variant.
  if (scope.endsWith('.readonly') && granted.includes(scope.slice(0, -'.readonly'.length))) return true;
  if (scope.startsWith('https://www.googleapis.com/auth/drive.') && granted.includes('https://www.googleapis.com/auth/drive')) return true;
  if (scope.startsWith('https://www.googleapis.com/auth/calendar.') && granted.includes('https://www.googleapis.com/auth/calendar')) return true;
  if (scope === 'https://www.googleapis.com/auth/calendar.events.freebusy' && granted.includes('https://www.googleapis.com/auth/calendar.events')) return true;
  if (scope === 'https://www.googleapis.com/auth/gmail.readonly' && (granted.includes('https://www.googleapis.com/auth/gmail.modify') || granted.includes('https://mail.google.com/'))) return true;
  return false;
}
