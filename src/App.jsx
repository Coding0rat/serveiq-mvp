import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Home from './pages/Home';
import CustomerPage from './pages/CustomerPage';
import OrderPage from './pages/OrderPage';
import KitchenPage from './pages/KitchenPage';
import AdminPage from './pages/AdminPage';
import StaffLogin from './pages/StaffLogin';

function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/staff-login" replace state={{ from: location }} />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/kitchen'} replace />;
  return children;
}

function AppRoutes() {
  return <Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/t/:tableId" element={<CustomerPage/>}/>
    <Route path="/order/:orderId" element={<OrderPage/>}/>
    <Route path="/staff-login" element={<StaffLogin/>}/>
    <Route path="/kitchen" element={<ProtectedRoute role="kitchen"><KitchenPage/></ProtectedRoute>}/>
    <Route path="/admin" element={<ProtectedRoute role="admin"><AdminPage/></ProtectedRoute>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}

export default function App() {
  return <AuthProvider><AppRoutes/></AuthProvider>;
}
