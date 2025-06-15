
import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoAnalysisProps {
    packingPhoto: PackingPhoto;
}

const PhotoAnalysis = ({ packingPhoto }: PhotoAnalysisProps) => {
    const { toast } = useToast();
    const [isRetrying, setIsRetrying] = useState(false);

    const handleRetry = async () => {
        setIsRetrying(true);
        toast({ title: "Retrying analysis..." });

        // Update status to pending immediately for better UX.
        // The realtime subscription will pick this up and update the UI.
        await supabase
            .from('packing_photos')
            .update({ ai_analysis_status: 'pending' })
            .eq('id', packingPhoto.id);
        
        const { error: invokeError } = await supabase.functions.invoke('analyze-image', {
            body: { packing_photo_id: packingPhoto.id },
        });

        if (invokeError) {
            toast({ title: "Retry Failed", description: "Could not start analysis function. The status will be updated.", variant: "destructive" });
        }
        
        // The edge function will set status to 'failed' on error, which will be picked up by realtime.
        // No need for a success toast, as the UI will update automatically.
        setIsRetrying(false);
    };

    return (
        <div>
            <h3 className="font-semibold mb-2">Photo Analysis</h3>
            <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                    <p>Status:</p> <Badge variant={packingPhoto.ai_analysis_status === 'completed' ? 'default' : 'secondary'}>{packingPhoto.ai_analysis_status}</Badge>
                </div>
                {packingPhoto.ai_analysis_status === 'pending' && <p className="text-sm text-muted-foreground mt-2">Analyzing image, please wait...</p>}
                {packingPhoto.ai_analysis_status === 'completed' && (
                    <div className="mt-2 space-y-1">
                        <p><strong>Item:</strong> {packingPhoto.item_name || 'N/A'}</p>
                        <p><strong>Freshness:</strong> {packingPhoto.freshness_score}/10</p>
                        <p><strong>Quality:</strong> {packingPhoto.quality_score}/10</p>
                        <p><strong>Description:</strong> {packingPhoto.description}</p>
                    </div>
                )}
                {packingPhoto.ai_analysis_status === 'failed' && (
                     <div className="mt-2">
                        <p className="text-sm text-red-500">Analysis failed.</p>
                        <Button onClick={handleRetry} disabled={isRetrying} className="mt-2" size="sm">
                            {isRetrying ? 'Retrying...' : 'Retry Analysis'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhotoAnalysis;
