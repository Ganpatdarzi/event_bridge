/** The landing page for each role after login or registration. */
export function dashboardPath(role: string | null | undefined): string {
  if (role === 'vendor') return '/vendor';
  if (role === 'admin') return '/admin';
  return '/society';
}
