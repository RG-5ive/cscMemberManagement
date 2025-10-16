import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import { PaymentForm } from "./payment-form";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface PaymentCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopId: number;
  workshopTitle: string;
  registrationId: number;
  onPaymentSuccess: () => void;
}

interface PricingDetails {
  baseCost: number;
  membershipDiscount: number;
  discountedCost: number;
  subtotal: number;
  taxRate: number;
  taxType: string;
  taxAmount: number;
  total: number;
  currency: string;
}

export function PaymentCheckoutDialog({
  open,
  onOpenChange,
  workshopId,
  workshopTitle,
  registrationId,
  onPaymentSuccess,
}: PaymentCheckoutDialogProps) {
  const [paymentComplete, setPaymentComplete] = useState(false);

  // Fetch pricing details for this workshop
  const { data: pricing, isLoading: loadingPricing, error: pricingError } = useQuery<PricingDetails>({
    queryKey: [`/api/workshops/${workshopId}/pricing`],
    enabled: open && workshopId > 0,
  });

  // Reset payment complete state when dialog closes
  useEffect(() => {
    if (!open) {
      setPaymentComplete(false);
    }
  }, [open]);

  const handlePaymentSuccess = () => {
    setPaymentComplete(true);
    setTimeout(() => {
      onPaymentSuccess();
      onOpenChange(false);
    }, 2000);
  };

  if (!stripePromise) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Payment Not Available</DialogTitle>
            <DialogDescription>
              Payment processing is not configured. Please contact an administrator.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-payment-checkout">
        <DialogHeader>
          <DialogTitle>Complete Your Registration</DialogTitle>
          <DialogDescription>
            {workshopTitle}
          </DialogDescription>
        </DialogHeader>

        {loadingPricing && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {pricingError && (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load pricing information. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {paymentComplete && (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
            <p className="text-muted-foreground">
              Your workshop registration is confirmed. Redirecting...
            </p>
          </div>
        )}

        {!loadingPricing && !pricingError && pricing && !paymentComplete && (
          <PaymentForm
            pricing={pricing}
            registrationId={registrationId}
            workshopTitle={workshopTitle}
            stripePromise={stripePromise}
            onSuccess={handlePaymentSuccess}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
