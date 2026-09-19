import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user.role ? user.role.toLowerCase() : '';
  const roles = allowedRoles ? allowedRoles.map((r) => r.toLowerCase()) : [];

  if (roles.length > 0 && !roles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;