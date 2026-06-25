import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isFlowerDemoMode } from '../app-mode';
import PublicLayout from '../../modules/public/layouts/PublicLayout';
import Home from '../../modules/public/pages/Home';
import Menu from '../../modules/public/pages/Menu';
import About from '../../modules/public/pages/About';
import Contact from '../../modules/public/pages/Contact';
import Gallery from '../../modules/public/pages/Gallery';
import Order from '../../modules/public/pages/Order';
import DashboardLayout from '../../modules/dashboard/layouts/DashboardLayout';
import DashboardHome from '../../modules/dashboard/pages/DashboardHome';
import DashboardPos from '../../modules/dashboard/pages/DashboardPos';
import DashboardOrders from '../../modules/dashboard/pages/DashboardOrders';
import DashboardProducts from '../../modules/dashboard/pages/DashboardProducts';
import DashboardInventory from '../../modules/dashboard/pages/DashboardInventory';
import FlowersLanding from '../../modules/flowers/public/pages/FlowersLanding';
import FlowersShop from '../../modules/flowers/public/pages/FlowersShop';
import FlowersProductDetails from '../../modules/flowers/public/pages/FlowersProductDetails';
import FlowersCheckout from '../../modules/flowers/public/pages/FlowersCheckout';
import FlowersOrderStatus from '../../modules/flowers/public/pages/FlowersOrderStatus';
import FlowersAdminHome from '../../modules/flowers/dashboard/pages/FlowersAdminHome';
import FlowerOrdersPlaceholder from '../../modules/flowers/dashboard/pages/FlowerOrdersPlaceholder';
import FlowerProductsPlaceholder from '../../modules/flowers/dashboard/pages/FlowerProductsPlaceholder';
import FlowerBranchSettingsPlaceholder from '../../modules/flowers/dashboard/pages/FlowerBranchSettingsPlaceholder';
import FlowerBranchInventoryPlaceholder from '../../modules/flowers/dashboard/pages/FlowerBranchInventoryPlaceholder';
import FlowerPaymentVerificationPlaceholder from '../../modules/flowers/dashboard/pages/FlowerPaymentVerificationPlaceholder';
import FlowerWalkInOrdersPlaceholder from '../../modules/flowers/dashboard/pages/FlowerWalkInOrdersPlaceholder';
import FlowerAttendancePlaceholder from '../../modules/flowers/dashboard/pages/FlowerAttendancePlaceholder';
import FlowerReportsPage from '../../modules/flowers/dashboard/pages/FlowerReportsPage';
import FlowerPosPage from '../../modules/flowers/dashboard/pages/FlowerPosPage';

export default function AppRouter() {
  const flowerDemoMode = isFlowerDemoMode();

  if (flowerDemoMode) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard/flowers" replace />} />
            <Route path="flowers" element={<FlowersAdminHome />} />
            <Route path="flowers/pos" element={<FlowerPosPage />} />
            <Route path="flowers/orders" element={<FlowerOrdersPlaceholder />} />
            <Route path="flowers/products" element={<FlowerProductsPlaceholder />} />
            <Route path="flowers/inventory" element={<FlowerBranchInventoryPlaceholder />} />
            <Route path="flowers/reports" element={<FlowerReportsPage />} />
            <Route path="*" element={<Navigate to="/dashboard/flowers" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard/flowers" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="menu" element={<Menu />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="order" element={<Order />} />
          <Route path="gallery" element={<Gallery />} />
        </Route>

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="pos" element={<DashboardPos />} />
          <Route path="orders" element={<DashboardOrders />} />
          <Route path="products" element={<DashboardProducts />} />
          <Route path="inventory" element={<DashboardInventory />} />
          <Route path="flowers" element={<FlowersAdminHome />} />
          <Route path="flowers/pos" element={<FlowerPosPage />} />
          <Route path="flowers/orders" element={<FlowerOrdersPlaceholder />} />
          <Route path="flowers/products" element={<FlowerProductsPlaceholder />} />
          <Route path="flowers/branches" element={<FlowerBranchSettingsPlaceholder />} />
          <Route path="flowers/inventory" element={<FlowerBranchInventoryPlaceholder />} />
          <Route path="flowers/reports" element={<FlowerReportsPage />} />
          <Route path="flowers/payment-verification" element={<FlowerPaymentVerificationPlaceholder />} />
          <Route path="flowers/walk-in" element={<FlowerWalkInOrdersPlaceholder />} />
          <Route path="flowers/attendance" element={<FlowerAttendancePlaceholder />} />
        </Route>

        <Route path="/flowers" element={<PublicLayout />}>
          <Route index element={<FlowersLanding />} />
          <Route path="shop" element={<FlowersShop />} />
          <Route path="product/:id" element={<FlowersProductDetails />} />
          <Route path="checkout" element={<FlowersCheckout />} />
          <Route path="order-status" element={<FlowersOrderStatus />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
