import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import AdminDashboard from "./AdminDashboard";
import StudentDashboard from "./StudentDashboard";

export default function Home() {
  const { user } = useAuth();
  return (
    <DashboardLayout>
      {user?.role === "admin" ? <AdminDashboard /> : <StudentDashboard />}
    </DashboardLayout>
  );
}
