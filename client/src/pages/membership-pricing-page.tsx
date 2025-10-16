import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { CheckCircle2, DollarSign, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MembershipPricingRule {
  id: number;
  membershipLevel: string;
  percentagePaid: number;
}

interface Member {
  memberLevel: string;
  firstName: string;
  lastName: string;
}

export default function MembershipPricingPage() {
  const { user } = useAuth();

  // Fetch pricing rules
  const { data: pricingRules, isLoading: loadingRules } = useQuery<MembershipPricingRule[]>({
    queryKey: ['/api/membership-pricing-rules'],
  });

  // Fetch member profile to get membership level
  const { data: memberData, isLoading: loadingMember } = useQuery<{ member: Member }>({
    queryKey: ['/api/user/member-profile'],
    enabled: !!user && user.role !== 'admin',
  });

  const member = memberData?.member;

  // Calculate discount percentage
  const getDiscountPercentage = (percentagePaid: number) => {
    return 100 - percentagePaid;
  };

  // Find user's pricing rule
  const userPricingRule = pricingRules?.find(
    rule => rule.membershipLevel === member?.memberLevel
  );

  // Sort pricing rules by discount (best to worst)
  const sortedRules = [...(pricingRules || [])].sort(
    (a, b) => a.percentagePaid - b.percentagePaid
  );

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Example workshop pricing calculation
  const exampleBaseCost = 50000; // $500 CAD in cents
  const calculateExamplePrice = (percentagePaid: number) => {
    return Math.round((exampleBaseCost * percentagePaid) / 100);
  };

  if (loadingRules || loadingMember) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">Membership Pricing Benefits</h1>
          <p className="text-lg text-muted-foreground">
            Discover the exclusive workshop pricing advantages of your CSC membership
          </p>
        </div>

        {/* Current Member Benefits */}
        {member && userPricingRule && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    Your Membership Benefits
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {member.firstName} {member.lastName} - {member.memberLevel}
                  </CardDescription>
                </div>
                <Badge variant="default" className="text-lg px-4 py-1">
                  {getDiscountPercentage(userPricingRule.percentagePaid)}% Discount
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Your Workshop Pricing</h3>
                  <p className="text-sm text-muted-foreground">
                    You pay <span className="font-bold text-foreground">{userPricingRule.percentagePaid}%</span> of the base workshop cost
                  </p>
                  <div className="pt-2">
                    <p className="text-sm font-medium text-muted-foreground">Example:</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-sm line-through text-muted-foreground">
                        {formatCurrency(exampleBaseCost)} CAD
                      </span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(calculateExamplePrice(userPricingRule.percentagePaid))} CAD
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Base workshop cost of $500 CAD (before tax)
                    </p>
                  </div>
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Your personalized pricing is automatically applied at checkout when you register for paid workshops. Additional provincial taxes (GST/HST/PST) will be calculated based on your location.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Membership Tiers Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              All Membership Tiers
            </CardTitle>
            <CardDescription>
              Compare workshop pricing across all CSC membership levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedRules.map((rule) => {
                const isUserLevel = rule.membershipLevel === member?.memberLevel;
                const discount = getDiscountPercentage(rule.percentagePaid);

                return (
                  <div
                    key={rule.id}
                    className={`p-6 rounded-lg border-2 transition-all ${
                      isUserLevel 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/30'
                    }`}
                    data-testid={`pricing-tier-${rule.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{rule.membershipLevel}</h3>
                          {isUserLevel && (
                            <Badge variant="default">Your Level</Badge>
                          )}
                          {discount > 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {discount}% Off
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          Pays {rule.percentagePaid}% of base workshop cost
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-sm text-muted-foreground mb-1">$500 Workshop Example</p>
                        <div className="flex items-baseline gap-2 md:justify-end">
                          {discount > 0 && (
                            <span className="text-sm line-through text-muted-foreground">
                              {formatCurrency(exampleBaseCost)}
                            </span>
                          )}
                          <span className={`text-2xl font-bold ${isUserLevel ? 'text-primary' : ''}`}>
                            {formatCurrency(calculateExamplePrice(rule.percentagePaid))}
                          </span>
                          <span className="text-sm text-muted-foreground">CAD</span>
                        </div>
                        {discount > 0 && (
                          <p className="text-sm text-green-600 font-medium mt-1">
                            Save {formatCurrency(exampleBaseCost - calculateExamplePrice(rule.percentagePaid))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-xs">1</span>
                </div>
                <p className="text-muted-foreground">
                  Browse available workshops and select the one you want to attend
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-xs">2</span>
                </div>
                <p className="text-muted-foreground">
                  Your membership discount is automatically calculated based on your level
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-xs">3</span>
                </div>
                <p className="text-muted-foreground">
                  Provincial taxes are added based on your location (GST, HST, or PST)
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-xs">4</span>
                </div>
                <p className="text-muted-foreground">
                  Complete payment and receive instant confirmation
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Important Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Pricing shown is before applicable taxes</p>
              <p>• Some workshops may have additional global discounts</p>
              <p>• Free workshops are available to all members</p>
              <p>• Tax rates vary by province/territory</p>
              <p>• Multiple payment methods accepted (card, e-Transfer, bank transfer)</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
