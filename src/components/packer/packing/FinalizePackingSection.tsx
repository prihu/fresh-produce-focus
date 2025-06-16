
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";

type Order = Tables<'orders'>;
type PackingPhoto = Tables<'packing_photos'>;

interface FinalizePackingSectionProps {
    order: Order;
    packingPhoto: PackingPhoto | null;
}

const MIN_QUALITY_SCORE = 5; // Minimum score to allow packing

const FinalizePackingSection = ({ order, packingPhoto }: FinalizePackingSectionProps) => {
    const queryClient = useQueryClient();

    const { mutate: markAsPacked, isPending: isPacking } = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('orders').update({ status: 'packed' }).eq('id', order.id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success("Order successfully marked as packed.");
            queryClient.invalidateQueries({ queryKey: ['orderDetails', order.id] });
            queryClient.invalidateQueries({ queryKey: ['pendingOrders'] });
        },
        onError: (error) => {
            toast.error(`Failed to pack order: ${error.message}`);
        },
    });

    const isPacked = order.status === 'packed';
    const isAnalysisComplete = packingPhoto?.ai_analysis_status === 'completed';
    const isQualityAcceptable = isAnalysisComplete && (packingPhoto?.quality_score ?? 0) >= MIN_QUALITY_SCORE;
    
    const canPack = !isPacked && isAnalysisComplete && isQualityAcceptable;

    let helperMessage = null;
    if (!isPacked) {
        if (!isAnalysisComplete) {
            helperMessage = <p className="text-sm text-slate-800 mt-2">You must capture a photo and wait for analysis to complete before packing.</p>;
        } else if (!isQualityAcceptable) {
            helperMessage = <p className="text-sm text-red-800 font-medium mt-2">Quality score of {packingPhoto.quality_score}/10 is below the minimum of {MIN_QUALITY_SCORE}. Item cannot be packed. A new photo is required.</p>;
        }
    }

    return (
        <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="bg-white">
                <CardTitle className="text-slate-900">2. Finalize Packing</CardTitle>
            </CardHeader>
            <CardContent className="bg-white">
                {isPacked ? (
                    <Alert className="bg-white border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-800">Completed!</AlertTitle>
                        <AlertDescription className="text-green-700">This order has been packed.</AlertDescription>
                    </Alert>
                ) : (
                    <Button onClick={() => markAsPacked()} disabled={!canPack || isPacking}>
                        {isPacking ? "Packing..." : "Mark as Packed"}
                    </Button>
                )}
                {helperMessage}
            </CardContent>
        </Card>
    );
}

export default FinalizePackingSection;
