
import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, CheckCircle, Clock } from "lucide-react";

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoAnalysisProps {
    packingPhoto: PackingPhoto;
}

const PhotoAnalysis = ({ packingPhoto }: PhotoAnalysisProps) => {
    const { toast } = useToast();
    const [isRetrying, setIsRetrying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [estimatedTime, setEstimatedTime] = useState(45);

    // Progress simulation for pending analysis
    useEffect(() => {
        if (packingPhoto.ai_analysis_status === 'pending') {
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) return 90; // Cap at 90% until completion
                    return prev + Math.random() * 15;
                });
                setEstimatedTime(prev => Math.max(0, prev - 1));
            }, 1000);

            return () => clearInterval(interval);
        } else {
            setProgress(100);
        }
    }, [packingPhoto.ai_analysis_status]);

    const handleRetry = async () => {
        setIsRetrying(true);
        setProgress(0);
        setEstimatedTime(45);
        
        // Update status to pending immediately for better UX
        const { error: updateError } = await supabase
            .from('packing_photos')
            .update({ ai_analysis_status: 'pending' })
            .eq('id', packingPhoto.id);

        if (updateError) {
            toast({
                title: "Update Failed",
                description: "Could not reset analysis status.",
                variant: "destructive",
            });
            setIsRetrying(false);
            return;
        }
        
        const { error: invokeError } = await supabase.functions.invoke('analyze-image', {
            body: { packing_photo_id: packingPhoto.id },
        });

        if (invokeError) {
            toast({ 
                title: "Retry Failed", 
                description: "Could not start analysis function.", 
                variant: "destructive" 
            });
        } else {
            toast({ 
                title: "Analysis Restarted", 
                description: "Image analysis has been restarted. Please wait..." 
            });
        }
        
        setIsRetrying(false);
    };

    const getStatusIcon = () => {
        switch (packingPhoto.ai_analysis_status) {
            case 'pending':
                return <Loader2 className="h-4 w-4 animate-spin" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'failed':
                return <AlertTriangle className="h-4 w-4 text-red-600" />;
            default:
                return <Clock className="h-4 w-4" />;
        }
    };

    const getStatusColor = () => {
        switch (packingPhoto.ai_analysis_status) {
            case 'completed':
                return 'default';
            case 'failed':
                return 'destructive';
            default:
                return 'secondary';
        }
    };

    return (
        <div>
            <h3 className="font-semibold mb-2">Photo Analysis</h3>
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <p>Status:</p> 
                    <Badge variant={getStatusColor()}>{packingPhoto.ai_analysis_status}</Badge>
                </div>

                {packingPhoto.ai_analysis_status === 'pending' && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span>Analyzing image...</span>
                            <span className="text-muted-foreground">
                                ~{estimatedTime}s remaining
                            </span>
                        </div>
                        <Progress value={progress} className="w-full" />
                        <p className="text-sm text-muted-foreground">
                            Our AI is examining the produce quality. This typically takes 30-60 seconds.
                        </p>
                    </div>
                )}

                {packingPhoto.ai_analysis_status === 'completed' && (
                    <div className="mt-2 space-y-1">
                        <p><strong>Item:</strong> {packingPhoto.item_name || 'N/A'}</p>
                        <div className="flex gap-4">
                            <p><strong>Freshness:</strong> 
                                <span className={`ml-1 font-semibold ${packingPhoto.freshness_score >= 7 ? 'text-green-600' : packingPhoto.freshness_score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {packingPhoto.freshness_score}/10
                                </span>
                            </p>
                            <p><strong>Quality:</strong> 
                                <span className={`ml-1 font-semibold ${packingPhoto.quality_score >= 7 ? 'text-green-600' : packingPhoto.quality_score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {packingPhoto.quality_score}/10
                                </span>
                            </p>
                        </div>
                        <p><strong>Description:</strong> {packingPhoto.description}</p>
                    </div>
                )}

                {packingPhoto.ai_analysis_status === 'failed' && (
                     <div className="mt-2 space-y-2">
                        <p className="text-sm text-red-600">
                            Analysis failed. This could be due to image quality, network issues, or temporary service problems.
                        </p>
                        <Button 
                            onClick={handleRetry} 
                            disabled={isRetrying} 
                            className="mt-2" 
                            size="sm"
                            variant="outline"
                        >
                            {isRetrying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Retrying...
                                </>
                            ) : (
                                'Retry Analysis'
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhotoAnalysis;
