import { Button } from "@/components/ui/button";
import { Building2, Users, BarChart3 } from "lucide-react";

// 👇 Import background image
import propertyBg from "@/assets/ChatGPT Image Nov 24, 2025, 05_56_20 PM.png";

export default function Landing() {
  return (
    <div
      className="min-h-screen bg-cover bg-center relative flex items-center justify-center p-6"
      style={{ backgroundImage: `url(${propertyBg})` }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Main content */}
      <div className="relative z-10 max-w-4xl w-full text-center space-y-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-md">
            <Building2 className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
            Sangli Properties LLP
          </h1>
          <p className="text-xl text-gray-200 max-w-2xl mx-auto drop-shadow">
            Comprehensive Real Estate CRM for managing leads, properties, and sales analytics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
          <div className="p-6 rounded-lg bg-white/90 backdrop-blur-lg border border-white/40 shadow-xl">
            <Users className="w-8 h-8 text-primary mb-3 mx-auto" />
            <h3 className="font-semibold mb-2 text-foreground">Lead Management</h3>
            <p className="text-sm text-muted-foreground">
              Track and manage all your leads with detailed follow-ups
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white/90 backdrop-blur-lg border border-white/40 shadow-xl">
            <Building2 className="w-8 h-8 text-yellow-500 mb-3 mx-auto" />
            <h3 className="font-semibold mb-2 text-foreground">Property Management</h3>
            <p className="text-sm text-muted-foreground">
              Organize properties with images, pricing, and status tracking
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white/90 backdrop-blur-lg border border-white/40 shadow-xl">
            <BarChart3 className="w-8 h-8 text-primary mb-3 mx-auto" />
            <h3 className="font-semibold mb-2 text-foreground">Analytics & Reports</h3>
            <p className="text-sm text-muted-foreground">
              Visualize sales data and track performance metrics
            </p>
          </div>
        </div>

        <div>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 shadow-lg"
            onClick={() => {
              if (import.meta.env.DEV) {
                window.location.href = "/login";
              } else {
                window.location.href = "/api/login";
              }
            }}
            data-testid="button-login"
          >
            Login to Dashboard
          </Button>
        </div>

       
      </div>
    </div>
  );
}
