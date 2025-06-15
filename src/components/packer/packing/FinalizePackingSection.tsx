
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";

type Order = Tables<'orders'>;
type PackingPhoto = Tables<'packing_photos'>;

interface FinalizePackingSectionProps {
    order: Order;
    packingPhoto: PackingPhoto | null;
}

const FinalizePackingSection = ({ order, packingPhoto }: FinalizePackingSectionProps) => {
    const queryClient = useQueryClient();

    const { mutate: markAsPacked, isPending: isPacking } = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('orders').update({ status: 'packed' }).eq('id', order.id);
            if (error) throw new Error(error.message);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['orderDetails', order.id] });
            queryClient.invalidateQueries({ queryKey: ['pendingOrders'] });
        },
    });

    const isPacked = order.status === 'packed';
    const canPack = packingPhoto && packingPhoto.ai_analysis_status === 'completed';

    return (
        <Card>
            <CardHeader>
                <CardTitle>2. Finalize Packing</CardTitle>
            </CardHeader>
            <CardContent>
                {isPacked ? (
                    <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Completed!</AlertTitle>
                        <AlertDescription>This order has been packed.</AlertDescription>
                    </Alert>
                ) : (
                    <Button onClick={() => markAsPacked()} disabled={!canPack || isPacking}>
                        {isPacking ? "Packing..." : "Mark as Packed"}
                    </Button>
                )}
                {!canPack && !isPacked && <p className="text-sm text-muted-foreground mt-2">You must capture a photo and wait for analysis to complete before packing.</p>}
            </CardContent>
        </Card>
    );
}

export default FinalizePackingSection;
