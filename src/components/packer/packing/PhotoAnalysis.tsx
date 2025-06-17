
import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, CheckCircle, Clock, Zap, Eye, Leaf, RefreshCw } from "lucide-react";

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoAnalysisProps {
    packingPhoto: PackingPhoto;
    onStatusUpdate?: (photo: PackingPhoto) => void;
}

const PhotoAnalysis = ({ packingPhoto, onStatusUpdate }: PhotoAnalysisProps) => {
    const { toast } = useToast();
    const [isRetrying, setIsRetrying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [estimatedTime, setEstimatedTime] = useState(45);
    const [isOvertime, setIsOvertime] = useState(false);
    const [timeInPending, setTimeInPending] = useState(0);

    // Calculate time in pending status
    useEffect(() => {
        if (packingPhoto.ai_analysis_status === 'pending') {
            const createdTime = new Date(packingPhoto.created_at).getTime();
            const currentTime = Date.now();
            const timeElapsed = Math.floor((currentTime - createdTime) / 1000);
            setTimeInPending(timeElapsed);
            
            // If photo has been pending for more than 5 minutes, it's likely stuck
            if (timeElapsed > 300) {
                setIsOvertime(true);
            }
        }
    }, [packingPhoto.ai_analysis_status, packingPhoto.created_at]);

    // Enhanced progress simulation for pending analysis
    useEffect(() => {
        if (packingPhoto.ai_analysis_status === 'pending') {
            const startTime = Date.now();
            
            const interval = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                
                if (elapsed >= 45 && !isOvertime) {
                    setIsOvertime(true);
                    setEstimatedTime(0);
                    setProgress(85); // Stop at 85% to show it's still processing
                } else if (elapsed < 45) {
                    // More realistic progress curve - starts fast, slows down
                    const progressPercent = Math.min(85, (elapsed / 45) * 85 + Math.sin(elapsed / 10) * 5);
                    setProgress(progressPercent);
                    setEstimatedTime(Math.max(0, 45 - Math.floor(elapsed)));
                }
            }, 1000);

            return () => clearInterval(interval);
        } else {
            setProgress(100);
            setIsOvertime(false);
        }
    }, [packingPhoto.ai_analysis_status, isOvertime]);

    // Client-side polling as backup for real-time updates
    useEffect(() => {
        if (packingPhoto.ai_analysis_status === 'pending') {
            const pollInterval = setInterval(async () => {
                try {
                    const { data, error } = await supabase
                        .from('packing_photos')
                        .select('*')
                        .eq('id', packingPhoto.id)
                        .single();

                    if (error) {
                        console.error('Polling error:', error);
                        return;
                    }

                    if (data && data.ai_analysis_status !== packingPhoto.ai_analysis_status) {
                        console.log('Status updated via polling:', data.ai_analysis_status);
                        onStatusUpdate?.(data);
                    }
                } catch (error) {
                    console.error('Polling failed:', error);
                }
            }, 3000); // Poll every 3 seconds

            return () => clearInterval(pollInterval);
        }
    }, [packingPhoto.id, packingPhoto.ai_analysis_status, onStatusUpdate]);

    const handleRetry = async () => {
        setIsRetrying(true);
        setProgress(0);
        setEstimatedTime(45);
        setIsOvertime(false);
        
        try {
            console.log('Manually retrying analysis for photo:', packingPhoto.id);
            
            // Update status to pending immediately for better UX
            const { error: updateError } = await supabase
                .from('packing_photos')
                .update({ ai_analysis_status: 'pending' })
                .eq('id', packingPhoto.id);

            if (updateError) {
                throw new Error(`Failed to reset status: ${updateError.message}`);
            }
            
            // Invoke with optimized settings for faster processing
            const { data: functionData, error: invokeError } = await supabase.functions.invoke('analyze-image', {
                body: { 
                    packing_photo_id: packingPhoto.id,
                    fast_mode: true // Signal for faster processing
                },
            });

            if (invokeError) {
                console.error('Function invocation error during retry:', invokeError);
                
                // Update status back to failed
                await supabase
                    .from('packing_photos')
                    .update({ ai_analysis_status: 'failed' })
                    .eq('id', packingPhoto.id);
                
                throw new Error(`Analysis failed to start: ${invokeError.message}`);
            }

            console.log('Retry function invocation successful:', functionData);
            
            toast({ 
                title: "Analysis Restarted", 
                description: "Using optimized processing for faster results..." 
            });
        } catch (error: any) {
            console.error('Retry failed:', error);
            toast({ 
                title: "Retry Failed", 
                description: error.message || "Failed to restart analysis.", 
                variant: "destructive" 
            });
        } finally {
            setIsRetrying(false);
        }
    };

    const getQualityIcon = (score: number) => {
        if (score >= 6) return <CheckCircle className="h-4 w-4 text-green-600" />;
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
    };

    const getQualityColor = (score: number) => {
        if (score >= 6) return 'text-green-600';
        return 'text-red-600';
    };

    const isProduceDetected = packingPhoto.item_name && 
        !packingPhoto.item_name.toLowerCase().includes('not') &&
        !packingPhoto.item_name.toLowerCase().includes('unidentified') &&
        !packingPhoto.item_name.toLowerCase().includes('unclear');

    const getStatusIcon = () => {
        switch (packingPhoto.ai_analysis_status) {
            case 'pending':
                return timeInPending > 300 ? 
                    <Clock className="h-4 w-4 text-red-600 animate-pulse" /> : 
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />;
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
            case 'pending':
                return timeInPending > 300 ? 'destructive' : 'secondary';
            default:
                return 'secondary';
        }
    };

    const getStatusText = () => {
        if (packingPhoto.ai_analysis_status === 'pending') {
            if (timeInPending > 300) {
                return 'stuck - retry needed';
            }
            return isOvertime ? 'processing (extended)' : 'analyzing';
        }
        return packingPhoto.ai_analysis_status;
    };

    return (
        <div>
            <h3 className="font-semibold mb-2 text-gray-800">AI Quality Analysis</h3>
            <div className="p-4 border border-purple-100 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <p className="text-sm font-medium">Status:</p> 
                    <Badge variant={getStatusColor()} className="capitalize">
                        {getStatusText()}
                    </Badge>
                    {timeInPending > 300 && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Stuck for {Math.floor(timeInPending / 60)} min
                        </span>
                    )}
                </div>

                {packingPhoto.ai_analysis_status === 'pending' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700">
                                {timeInPending > 300 ? 'Analysis appears stuck. Please retry.' : 
                                 isOvertime ? 'Taking some more time, please wait...' : 
                                 'AI analyzing produce quality...'}
                            </span>
                            {!isOvertime && timeInPending <= 300 && (
                                <span className="text-purple-600 font-medium">
                                    ~{estimatedTime}s remaining
                                </span>
                            )}
                        </div>
                        
                        <Progress 
                            value={progress} 
                            className="w-full h-2" 
                        />
                        
                        <div className="text-xs text-gray-600 space-y-1">
                            {timeInPending > 300 ? (
                                <>
                                    <p className="font-medium text-red-700">
                                        ⚠️ Analysis has been stuck for over 5 minutes
                                    </p>
                                    <p>This likely means the AI analysis failed to start properly. Please retry.</p>
                                </>
                            ) : isOvertime ? (
                                <>
                                    <p className="font-medium text-yellow-700">
                                        ⏱️ Processing is taking longer than expected
                                    </p>
                                    <p>This can happen with complex images or high server load. Your analysis will complete soon.</p>
                                </>
                            ) : (
                                <>
                                    <p>Our AI is examining freshness, quality, and produce identification.</p>
                                    <p className="text-purple-600">Using advanced image recognition for accurate results.</p>
                                </>
                            )}
                        </div>
                        
                        {(isOvertime || timeInPending > 300) && (
                            <div className="pt-2 border-t border-purple-200">
                                <Button 
                                    onClick={handleRetry} 
                                    disabled={isRetrying} 
                                    size="sm"
                                    variant="outline"
                                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                >
                                    {isRetrying ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Restarting...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Retry Analysis
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {packingPhoto.ai_analysis_status === 'completed' && (
                    <div className="mt-3 space-y-3">
                        {/* Produce Detection Status */}
                        <div className="p-3 rounded-lg border bg-white">
                            <div className="flex items-center gap-2 mb-2">
                                <Eye className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">Produce Detection:</span>
                                {isProduceDetected ? (
                                    <Badge variant="default" className="bg-green-100 text-green-800">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Verified
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        Not Detected
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-gray-600">
                                <strong>Item:</strong> {packingPhoto.item_name || 'Unidentified'}
                            </p>
                        </div>

                        {/* Quality Scores */}
                        <div className="p-3 rounded-lg border bg-white">
                            <div className="flex items-center gap-2 mb-2">
                                <Leaf className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-gray-700">Quality Assessment:</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-2">
                                    {getQualityIcon(packingPhoto.freshness_score || 0)}
                                    <span className="text-sm">
                                        <strong>Freshness:</strong>
                                        <span className={`ml-1 font-bold ${getQualityColor(packingPhoto.freshness_score || 0)}`}>
                                            {packingPhoto.freshness_score}/10
                                        </span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {getQualityIcon(packingPhoto.quality_score || 0)}
                                    <span className="text-sm">
                                        <strong>Quality:</strong>
                                        <span className={`ml-1 font-bold ${getQualityColor(packingPhoto.quality_score || 0)}`}>
                                            {packingPhoto.quality_score}/10
                                        </span>
                                    </span>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                                ✓ Minimum required: 6/10 for both scores
                            </div>
                        </div>

                        {/* Analysis Description */}
                        {packingPhoto.description && (
                            <div className="p-3 rounded-lg border bg-gray-50">
                                <p className="text-sm">
                                    <strong className="text-gray-700">Analysis:</strong>
                                    <span className="text-gray-600 ml-1">{packingPhoto.description}</span>
                                </p>
                            </div>
                        )}

                        {/* Validation Summary */}
                        {(!isProduceDetected || (packingPhoto.quality_score || 0) < 6 || (packingPhoto.freshness_score || 0) < 6) && (
                            <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-red-700">Validation Failed</p>
                                        <p className="text-xs text-red-600 mt-1">
                                            This item cannot be packed due to quality standards. Please retake the photo.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {packingPhoto.ai_analysis_status === 'failed' && (
                     <div className="mt-3 space-y-3 bg-red-50 p-3 rounded-lg border border-red-200">
                        <p className="text-sm text-red-700 font-medium">
                            ❌ Analysis failed
                        </p>
                        <p className="text-xs text-red-600">
                            This could be due to AI service issues, network problems, or invalid image format.
                        </p>
                        <Button 
                            onClick={handleRetry} 
                            disabled={isRetrying} 
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                            {isRetrying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Retrying...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Retry Analysis
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhotoAnalysis;
