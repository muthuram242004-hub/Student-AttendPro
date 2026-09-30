import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Classes from "./pages/Classes";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";

function Protected({ children }: { children: React.ReactNode }) {
  return localStorage.getItem("attendance_token")
    ? <Layout>{children}</Layout>
    : <Navigate to="/login" replace />;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<Protected><Dashboard /></Protected>} />
    <Route path="/classes" element={<Protected><Classes /></Protected>} />
    <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
    <Route path="/reports" element={<Protected><Reports /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
