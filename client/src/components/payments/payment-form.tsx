import { useState, useEffect } from "react";
import { Elements, useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Building2, Mail } from "lucide-react";

interface PaymentFormProps {
  pricing: {
    baseCost: number;
    membershipDiscount: number;
    discountedCost: number;
    subtotal: number;
    taxRate: number;
    taxType: string;
    taxAmount: number;
    total: number;
    currency: string;
  };
  registrationId: number;
  workshopTitle: string;
  stripePromise: any;
  onSuccess: () => void;
  onCancel: () => void;
}

function StripePaymentSection({ 
  clientSecret, 
  pricing,
  onSuccess 
}: { 
  clientSecret: string; 
  pricing: PaymentFormProps['pricing'];
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)} CAD`;
  };

  const handlePayment = async () => {
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Payment Successful",
        description: "Your workshop registration is confirmed!",
      });

      onSuccess();
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-muted/20">
        <PaymentElement />
      </div>
      <Button
        onClick={handlePayment}
        className="w-full"
        disabled={!stripe || isProcessing}
        data-testid="button-pay-card"
      >
        {isProcessing ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Processing...
          </>
        ) : (
          `Pay ${(pricing.total / 100).toFixed(2)} CAD`
        )}
      </Button>
    </div>
  );
}

export function PaymentForm({
  pricing,
  registrationId,
  workshopTitle,
  stripePromise,
  onSuccess,
  onCancel,
}: PaymentFormProps) {
  const { toast } = useToast();
  
  const [paymentMethod, setPaymentMethod] = useState<"stripe_card" | "interac_transfer" | "bank_transfer">("stripe_card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<any>(null);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)} CAD`;
  };

  // Initialize Stripe payment when card payment is selected
  useEffect(() => {
    if (paymentMethod === "stripe_card" && !clientSecret && !isProcessing) {
      initializeStripePayment();
    }
  }, [paymentMethod]);

  const initializeStripePayment = async () => {
    setIsProcessing(true);

    try {
      const response = await apiRequest("POST", "/api/payments/create-intent", {
        registrationId,
        paymentMethod: "stripe_card",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create payment");
      }

      const { clientSecret: secret } = await response.json();
      setClientSecret(secret);
    } catch (error) {
      toast({
        title: "Payment Initialization Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualPayment = async (method: "interac_transfer" | "bank_transfer") => {
    setIsProcessing(true);

    try {
      const response = await apiRequest("POST", "/api/payments/create-intent", {
        registrationId,
        paymentMethod: method,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create payment");
      }

      const data = await response.json();
      setPaymentInstructions(data);

      toast({
        title: "Payment Instructions Generated",
        description: `Invoice #${data.invoiceNumber} has been created.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const elementsOptions: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <div className="space-y-6">
      {/* Pricing Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Base Cost:</span>
            <span>{formatCurrency(pricing.baseCost)}</span>
          </div>
          {pricing.membershipDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Membership Discount ({pricing.membershipDiscount}%):</span>
              <span>-{formatCurrency(pricing.baseCost - pricing.discountedCost)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>{formatCurrency(pricing.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{pricing.taxType} ({(pricing.taxRate * 100).toFixed(1)}%):</span>
            <span>{formatCurrency(pricing.taxAmount)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total:</span>
            <span>{formatCurrency(pricing.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stripe_card" data-testid="tab-card-payment">
            <CreditCard className="w-4 h-4 mr-2" />
            Card
          </TabsTrigger>
          <TabsTrigger value="interac_transfer" data-testid="tab-interac-payment">
            <Mail className="w-4 h-4 mr-2" />
            e-Transfer
          </TabsTrigger>
          <TabsTrigger value="bank_transfer" data-testid="tab-bank-payment">
            <Building2 className="w-4 h-4 mr-2" />
            Bank
          </TabsTrigger>
        </TabsList>

        {/* Credit Card Payment */}
        <TabsContent value="stripe_card" className="space-y-4">
          {!clientSecret && isProcessing && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
              <span className="ml-3">Initializing payment...</span>
            </div>
          )}
          {clientSecret && (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <StripePaymentSection 
                clientSecret={clientSecret} 
                pricing={pricing}
                onSuccess={onSuccess}
              />
            </Elements>
          )}
          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full"
            disabled={isProcessing}
            data-testid="button-cancel-payment"
          >
            Cancel
          </Button>
        </TabsContent>

        {/* Interac e-Transfer */}
        <TabsContent value="interac_transfer" className="space-y-4">
          {paymentInstructions ? (
            <Alert>
              <AlertDescription className="space-y-3">
                <div>
                  <strong>Invoice Number:</strong> {paymentInstructions.invoiceNumber}
                </div>
                <div>
                  <strong>Amount:</strong> {formatCurrency(paymentInstructions.totalCad)}
                </div>
                <div className="pt-2 border-t">
                  <strong>Instructions:</strong>
                  <p className="mt-2">{paymentInstructions.instructions?.instructions}</p>
                </div>
                <div className="pt-2 text-sm text-muted-foreground">
                  Your registration is pending. It will be activated once we receive and confirm your payment.
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <AlertDescription>
                  <strong>Pay via Interac e-Transfer:</strong>
                  <p className="mt-2">
                    Click below to generate your invoice. You'll receive instructions to send an e-Transfer to CSC.
                    Your registration will be confirmed once payment is received.
                  </p>
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => handleManualPayment("interac_transfer")}
                className="w-full"
                disabled={isProcessing}
                data-testid="button-generate-interac-invoice"
              >
                {isProcessing ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Generating...
                  </>
                ) : (
                  "Generate Invoice"
                )}
              </Button>
            </>
          )}
          {paymentInstructions && (
            <Button onClick={() => onCancel()} className="w-full" data-testid="button-close-payment">
              Close
            </Button>
          )}
          {!paymentInstructions && (
            <Button
              onClick={onCancel}
              variant="outline"
              className="w-full"
              disabled={isProcessing}
              data-testid="button-cancel-payment"
            >
              Cancel
            </Button>
          )}
        </TabsContent>

        {/* Bank Transfer */}
        <TabsContent value="bank_transfer" className="space-y-4">
          {paymentInstructions ? (
            <Alert>
              <AlertDescription className="space-y-3">
                <div>
                  <strong>Invoice Number:</strong> {paymentInstructions.invoiceNumber}
                </div>
                <div>
                  <strong>Amount:</strong> {formatCurrency(paymentInstructions.totalCad)}
                </div>
                <div className="pt-2 border-t">
                  <strong>Instructions:</strong>
                  <p className="mt-2">{paymentInstructions.instructions?.instructions}</p>
                </div>
                <div className="pt-2 text-sm text-muted-foreground">
                  Your registration is pending. It will be activated once we receive and confirm your payment.
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <AlertDescription>
                  <strong>Pay via Bank Transfer:</strong>
                  <p className="mt-2">
                    Click below to generate your invoice. You'll receive CSC's banking details for a direct transfer.
                    Your registration will be confirmed once payment is received.
                  </p>
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => handleManualPayment("bank_transfer")}
                className="w-full"
                disabled={isProcessing}
                data-testid="button-generate-bank-invoice"
              >
                {isProcessing ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Generating...
                  </>
                ) : (
                  "Generate Invoice"
                )}
              </Button>
            </>
          )}
          {paymentInstructions && (
            <Button onClick={() => onCancel()} className="w-full" data-testid="button-close-payment">
              Close
            </Button>
          )}
          {!paymentInstructions && (
            <Button
              onClick={onCancel}
              variant="outline"
              className="w-full"
              disabled={isProcessing}
              data-testid="button-cancel-payment"
            >
              Cancel
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
