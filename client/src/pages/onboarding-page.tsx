import { useEffect } from "react";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function OnboardingPage() {
  const { user, isLoading } = useAuth();
  
  useEffect(() => {
    // Check authentication on page load
    if (!isLoading && !user) {
      console.log("User not authenticated, redirecting to auth page");
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If not authenticated, redirect to auth page
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="container max-w-4xl py-10 mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">Complete Your Profile</h1>
      <OnboardingFlow />
    </div>
  );
}