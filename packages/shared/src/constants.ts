export const API_PREFIX = '/api/v1';
export const PASSWORD_MIN_LENGTH = 8;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Launch categories recommended by the Market Intelligence Report.
 * Administrators can add more; these are seeded for the pilot.
 */
export const DEFAULT_CATEGORIES = [
  {
    name: 'Catering',
    slug: 'catering',
    description: 'Food and beverage for events of any size.',
  },
  {
    name: 'Decoration',
    slug: 'decoration',
    description: 'Stage, venue and table decoration.',
  },
  {
    name: 'Sound, Lighting & AV',
    slug: 'sound-lighting-av',
    description: 'Sound systems, stage lighting, screens and audiovisual support.',
  },
  {
    name: 'Photography',
    slug: 'photography',
    description: 'Event photography and videography.',
  },
] as const;
