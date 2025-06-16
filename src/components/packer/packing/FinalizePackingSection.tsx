
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Order = Tables<'orders'>;
type PackingPhoto = Tables<'packing_photos'>;

interface FinalizePackingSectionProps {
    order: Order;
    packingPhoto: PackingPhoto | null;
}

const MIN_QUALITY_SCORE = 6; // Updated to 6 as per business rules
const MIN_FRESHNESS_SCORE = 6; // Added freshness validation

const FinalizePackingSection = ({ order, packingPhoto }: FinalizePackingSectionProps) => {
    const queryClient = useQueryClient();

    const { mutate: markAsPacked, isPending: isPacking } = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('orders').update({ status: 'packed' }).eq('id', order.id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success("Order successfully marked as packed.");
            queryClient.invalidateQueries({ queryKey: ['packerOrders'] });
        },
        onError: (error) => {
            toast.error(`Failed to pack order: ${error.message}`);
        },
    });

    const isPacked = order.status === 'packed';
    const isAnalysisComplete = packingPhoto?.ai_analysis_status === 'completed';
    const isQualityAcceptable = isAnalysisComplete && (packingPhoto?.quality_score ?? 0) >= MIN_QUALITY_SCORE;
    const isFreshnessAcceptable = isAnalysisComplete && (packingPhoto?.freshness_score ?? 0) >= MIN_FRESHNESS_SCORE;
    const isProduceDetected = isAnalysisComplete && packingPhoto?.item_name && 
        !packingPhoto.item_name.toLowerCase().includes('not') &&
        !packingPhoto.item_name.toLowerCase().includes('unidentified') &&
        !packingPhoto.item_name.toLowerCase().includes('unclear');
    
    const canPack = !isPacked && isAnalysisComplete && isQualityAcceptable && isFreshnessAcceptable && isProduceDetected;

    let helperMessage = null;
    if (!isPacked) {
        if (!isAnalysisComplete) {
            helperMessage = <p className="text-sm text-gray-700 mt-2">You must capture a photo and wait for analysis to complete before packing.</p>;
        } else {
            const issues = [];
            if (!isQualityAcceptable) {
                issues.push(`Quality score of ${packingPhoto.quality_score}/10 is below minimum of ${MIN_QUALITY_SCORE}`);
            }
            if (!isFreshnessAcceptable) {
                issues.push(`Freshness score of ${packingPhoto.freshness_score}/10 is below minimum of ${MIN_FRESHNESS_SCORE}`);
            }
            if (!isProduceDetected) {
                issues.push('Item not properly identified as produce');
            }
            
            if (issues.length > 0) {
                helperMessage = (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm text-red-700 font-medium mb-1">Cannot pack order:</p>
                                <ul className="text-sm text-red-600 space-y-1">
                                    {issues.map((issue, index) => (
                                        <li key={index}>• {issue}</li>
                                    ))}
                                </ul>
                                <p className="text-sm text-red-600 mt-2">A new photo is required.</p>
                            </div>
                        </div>
                    </div>
                );
            }
        }
    }

    return (
        <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="bg-white">
                <CardTitle className="text-gray-900">2. Finalize Packing</CardTitle>
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
