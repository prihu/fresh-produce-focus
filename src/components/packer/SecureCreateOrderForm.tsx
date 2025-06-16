
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

const SecureCreateOrderForm = () => {
  const { user, hasRole } = useSecureAuth();
  const queryClient = useQueryClient();
  const [orderNumber, setOrderNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Only allow packers and admins to create orders
  if (!hasRole('packer') && !hasRole('admin')) {
    return (
      <Alert>
        <AlertDescription>
          You do not have permission to create orders.
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

      if (error) throw error;
      return data;
    },
    onMutate: async (sanitizedOrderNumber) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['packerOrders'] });

      // Snapshot the previous value
      const previousOrders = queryClient.getQueryData(['packerOrders']);

      // Optimistically update to the new value
      if (user) {
        const optimisticOrder = {
          id: `temp-${Date.now()}`, // Temporary ID
          order_number: sanitizedOrderNumber,
          manually_created: true,
          packer_id: user.id,
          status: 'pending_packing' as const,
          created_at: new Date().toISOString()
        };

        queryClient.setQueryData(['packerOrders'], (old: any) => {
          return old ? [optimisticOrder, ...old] : [optimisticOrder];
        });
      }

      // Return a context object with the snapshotted value
      return { previousOrders };
    },
    onSuccess: (data) => {
      toast.success('Order created successfully');
      setOrderNumber('');
      setValidationError(null);
      
      // Update the cache with the real data from server
      queryClient.setQueryData(['packerOrders'], (old: any) => {
        if (!old) return [data];
        
        // Replace the optimistic order with the real one
        return old.map((order: any) => 
          order.id.startsWith('temp-') ? data : order
        );
      });
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['packerOrders'], context.previousOrders);
      }
      
      const safeMessage = SecurityUtils.formatSafeErrorMessage(error);
      toast.error(`Failed to create order: ${safeMessage}`);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: ['packerOrders'] });
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
            {isPending ? 'Creating...' : 'Create Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SecureCreateOrderForm;
