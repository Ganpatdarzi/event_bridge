import type { UserRole } from '@event-bridge/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        status: 'active' | 'suspended' | 'deactivated';
      };
    }
  }
}

export {};
