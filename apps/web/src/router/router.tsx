import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../app/shell.js';
import { LandingPage } from '../pages/landing.js';
import { AboutPage } from '../pages/about.js';
import { HowItWorksPage } from '../pages/how-it-works.js';
import { CategoriesPage } from '../pages/categories.js';
import { VendorsPage } from '../pages/vendors.js';
import { VendorProfilePage } from '../pages/vendor-profile.js';
import { ContactPage } from '../pages/contact.js';
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
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/vendors/:vendorId" element={<VendorProfilePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/society" element={<SocietyPage />} />
        <Route path="/society/:section" element={<SocietyPage />} />
        <Route path="/vendor" element={<VendorPage />} />
        <Route path="/vendor/:section" element={<VendorPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
