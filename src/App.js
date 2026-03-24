
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import EditorPage from "./pages/EditorPage";
import InvitePage from "./pages/InvitePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import "./App.css";

const AuthRedirect = () => {
  const { isAuthenticated } = useAuth();
  return <Navigate replace to={isAuthenticated ? "/dashboard" : "/login"} />;
};

function App() {
  return (
    <Routes>
      <Route element={<AuthRedirect />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register" />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardPage />} path="/dashboard" />
        <Route element={<EditorPage />} path="/documents/:id" />
        <Route element={<InvitePage />} path="/invite/:token" />
      </Route>

      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}

export default App;
