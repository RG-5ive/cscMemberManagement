import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MembershipPricingManagement } from "@/components/admin/membership-pricing-management";

export default function WorkshopPricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Link href="/workshops">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workshops
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Workshop Pricing Rules</h1>
          <p className="text-muted-foreground">
            Configure the percentage each membership level pays for workshops
          </p>
        </div>

        <MembershipPricingManagement />
      </div>
    </div>
  );
}
