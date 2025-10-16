import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { DollarSign, Save, RefreshCw } from 'lucide-react';

interface MembershipPricingRule {
  id: number;
  membershipLevel: string;
  percentagePaid: number;
}

export function MembershipPricingManagement() {
  const { toast } = useToast();
  const [editedRules, setEditedRules] = useState<Record<number, number>>({});

  // Fetch pricing rules
  const { data: pricingRules, isLoading, isError, error, refetch } = useQuery<MembershipPricingRule[]>({
    queryKey: ['/api/membership-pricing-rules'],
    refetchOnWindowFocus: false,
  });

  // Mutation to update a pricing rule
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, percentagePaid }: { id: number; percentagePaid: number }) => {
      const response = await apiRequest('PATCH', `/api/membership-pricing-rules/${id}`, {
        percentagePaid,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update pricing rule');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/membership-pricing-rules'] });
      toast({
        title: 'Pricing Rule Updated',
        description: 'The membership pricing percentage has been updated successfully',
      });
      // Only clear the saved rule's entry, preserve other unsaved edits
      setEditedRules((prev) => {
        const { [variables.id]: _, ...rest } = prev;
        return rest;
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation to seed initial data
  const seedRulesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/membership-pricing-rules/seed', {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to seed pricing rules');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/membership-pricing-rules'] });
      toast({
        title: 'Pricing Rules Seeded',
        description: 'Default pricing rules have been created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Seed Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handlePercentageChange = (id: number, value: string) => {
    const percentage = parseInt(value) || 0;
    setEditedRules((prev) => ({ ...prev, [id]: percentage }));
  };

  const handleSaveRule = (id: number) => {
    const newPercentage = editedRules[id];
    if (newPercentage !== undefined && newPercentage >= 0 && newPercentage <= 100) {
      updateRuleMutation.mutate({ id, percentagePaid: newPercentage });
    } else {
      toast({
        title: 'Invalid Percentage',
        description: 'Please enter a percentage between 0 and 100',
        variant: 'destructive',
      });
    }
  };

  const handleSeedRules = () => {
    seedRulesMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Membership Pricing Rules
          </CardTitle>
          <CardDescription>
            Configure the percentage each membership level pays for workshops
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Membership Pricing Rules
          </CardTitle>
          <CardDescription>
            Configure the percentage each membership level pays for workshops
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="text-center">
              <p className="text-destructive font-medium mb-2">Failed to load pricing rules</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred while fetching pricing rules'}
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              data-testid="button-retry-fetch"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Membership Pricing Rules
            </CardTitle>
            <CardDescription>
              Configure the percentage each membership level pays for workshops
            </CardDescription>
          </div>
          {(!pricingRules || pricingRules.length === 0) && (
            <Button
              onClick={handleSeedRules}
              disabled={seedRulesMutation.isPending}
              variant="outline"
              data-testid="button-seed-rules"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${seedRulesMutation.isPending ? 'animate-spin' : ''}`} />
              Seed Default Rules
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!pricingRules || pricingRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No pricing rules configured. Click "Seed Default Rules" to create them.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pricingRules.map((rule) => {
              const hasChanges = editedRules[rule.id] !== undefined;
              const displayValue = hasChanges ? editedRules[rule.id] : rule.percentagePaid;

              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`pricing-rule-${rule.id}`}
                >
                  <div className="flex-1">
                    <Label className="text-base font-medium">{rule.membershipLevel}</Label>
                    <p className="text-sm text-muted-foreground">
                      Current: {rule.percentagePaid}% of base cost
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={displayValue}
                        onChange={(e) => handlePercentageChange(rule.id, e.target.value)}
                        className="w-24"
                        data-testid={`input-percentage-${rule.id}`}
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                    <Button
                      onClick={() => handleSaveRule(rule.id)}
                      disabled={!hasChanges || updateRuleMutation.isPending}
                      size="sm"
                      data-testid={`button-save-${rule.id}`}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
