import DashboardLayout from "@/components/dashboard-layout"
import { Loader2 } from "lucide-react"

export default function DatingLoading() {
  return (
    <DashboardLayout activeTab="dating">
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    </DashboardLayout>
  )
}
