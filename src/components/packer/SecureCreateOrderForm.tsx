
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSecureAuth } from '@/contexts/SecureAuthContext';
import { SecurityUtils } from '@/utils/security';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';

const SecureCreateOrderForm = () => {
  const { user, hasRole } = useSecureAuth();
  const queryClient = useQueryClient();
  const [orderNumber, setOrderNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Only allow packers and admins to create orders
  if (!hasRole('packer') && !hasRole('admin')) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to create orders. If you just signed up, please refresh the page in a moment.
        </AlertDescription>
      </Alert>
    );
  }

  const { mutate: createOrder, isPending } = useMutation({
    mutationFn: async (sanitizedOrderNumber: string) => {
      if (!user) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase
        .from('orders')
        .insert({
          order_number: sanitizedOrderNumber,
          manually_created: true,
          packer_id: user.id,
          status: 'pending_packing'
        })
        .select()
        .single();

      if (error) {
        // Provide more user-friendly error messages
        if (error.message.includes('row-level security')) {
          throw new Error('Unable to create order. If you just signed up, please wait a moment and try again.');
        }
        if (error.message.includes('duplicate')) {
          throw new Error('An order with this number already exists. Please use a different order number.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Order created successfully! You can now start packing.');
      setOrderNumber('');
      setValidationError(null);
      // Refetch orders to update the list
      queryClient.invalidateQueries({ queryKey: ['packerOrders'] });
    },
    onError: (error) => {
      const safeMessage = SecurityUtils.formatSafeErrorMessage(error);
      
      // Show user-friendly error message
      if (safeMessage.includes('row-level security') || safeMessage.includes('Unable to create order')) {
        toast.error('Unable to create order. If you just signed up, please wait a moment and try again.');
      } else {
        toast.error(`Failed to create order: ${safeMessage}`);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    const validation = SecurityUtils.validateOrderNumber(orderNumber);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid order number');
      return;
    }

    // Sanitize input
    const sanitizedOrderNumber = SecurityUtils.sanitizeString(orderNumber);
    
    // Additional validation after sanitization
    const postSanitizationValidation = SecurityUtils.validateOrderNumber(sanitizedOrderNumber);
    if (!postSanitizationValidation.isValid) {
      setValidationError('Order number contains invalid characters');
      return;
    }

    setValidationError(null);
    createOrder(sanitizedOrderNumber);
  };

  const handleOrderNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOrderNumber(value);
    
    // Real-time validation feedback
    if (value.trim()) {
      const validation = SecurityUtils.validateOrderNumber(value);
      setValidationError(validation.isValid ? null : validation.error || 'Invalid format');
    } else {
      setValidationError(null);
    }
  };

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="bg-white">
        <CardTitle className="text-gray-900">Create New Order</CardTitle>
      </CardHeader>
      <CardContent className="bg-white">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orderNumber" className="text-gray-700 font-medium">
              Order Number
            </Label>
            <Input
              id="orderNumber"
              type="text"
              value={orderNumber}
              onChange={handleOrderNumberChange}
              placeholder="Enter order number (e.g., ORD-2024-001)"
              required
              maxLength={50}
              className={`${validationError ? 'border-red-500 focus:border-red-500' : 'border-gray-300'}`}
              disabled={isPending}
            />
            {validationError && (
              <p className="text-sm text-red-600">{validationError}</p>
            )}
            <p className="text-sm text-gray-500">
              3-50 characters, letters, numbers, hyphens, and underscores only
            </p>
          </div>
          
          <Button 
            type="submit" 
            disabled={isPending || !!validationError || !orderNumber.trim()}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Order...
              </>
            ) : (
              'Create Order'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SecureCreateOrderForm;
