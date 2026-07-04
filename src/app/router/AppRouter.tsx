import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from '../../modules/dashboard/layouts/DashboardLayout';
import FlowersAdminHome from '../../modules/flowers/dashboard/pages/FlowersAdminHome';
import FlowerOrdersPage from '../../modules/flowers/dashboard/pages/FlowerOrdersPage';
import FlowerProductsPage from '../../modules/flowers/dashboard/pages/FlowerProductsPage';
import FlowerInventoryPage from '../../modules/flowers/dashboard/pages/FlowerInventoryPage';
import FlowerSuppliesPage from '../../modules/flowers/dashboard/pages/FlowerSuppliesPage';
import FlowerExpensesPage from '../../modules/flowers/dashboard/pages/FlowerExpensesPage';
import FlowerReportsPage from '../../modules/flowers/dashboard/pages/FlowerReportsPage';
import FlowerTeamPage from '../../modules/flowers/dashboard/pages/FlowerTeamPage';
import RequireStaffOnboarding from '../../modules/flowers/dashboard/components/RequireStaffOnboarding';
import FlowerLoginPage from '../../modules/flowers/dashboard/pages/FlowerLoginPage';
import RequireFlowerAuth from '../../modules/flowers/dashboard/components/RequireFlowerAuth';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<FlowerLoginPage />} />

        <Route
          path="/dashboard"
          element={
            <RequireFlowerAuth>
              <RequireStaffOnboarding>
                <DashboardLayout />
              </RequireStaffOnboarding>
            </RequireFlowerAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard/flowers" replace />} />
          <Route path="flowers" element={<FlowersAdminHome />} />
          <Route path="flowers/orders" element={<FlowerOrdersPage />} />
          <Route path="flowers/products" element={<FlowerProductsPage />} />
          <Route path="flowers/inventory" element={<FlowerInventoryPage />} />
          <Route path="flowers/supplies" element={<FlowerSuppliesPage />} />
          <Route path="flowers/expenses" element={<FlowerExpensesPage />} />
          <Route path="flowers/reports" element={<FlowerReportsPage />} />
          <Route path="flowers/team" element={<FlowerTeamPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard/flowers" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
