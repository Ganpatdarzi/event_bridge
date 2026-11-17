import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../app/shell.js';
import { LandingPage } from '../pages/landing.js';
import { VendorsPage } from '../pages/vendors.js';
import { LoginPage } from '../pages/login.js';
import { RegisterPage } from '../pages/register.js';
import { SocietyPage } from '../pages/society.js';
import { VendorPage } from '../pages/vendor.js';
import { AdminPage } from '../pages/admin.js';
import { NotFoundPage } from '../pages/not-found.js';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/society" element={<SocietyPage />} />
        <Route path="/vendor" element={<VendorPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
