import DashboardLayout from "@/components/DashboardLayout";
import AdminDashboard from "./AdminDashboard";

export default function Home() {
  return (
    <DashboardLayout>
      <AdminDashboard />
    </DashboardLayout>
  );
}
