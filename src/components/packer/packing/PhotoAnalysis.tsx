
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Tables } from "@/integrations/supabase/types";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoAnalysisProps {
    packingPhoto: PackingPhoto;
    onStatusUpdate: (photo: PackingPhoto) => void;
}

const PhotoAnalysis = ({ packingPhoto, onStatusUpdate }: PhotoAnalysisProps) => {
    const { toast } = useToast();
    const [isRetrying, setIsRetrying] = useState(false);

    const getStatusIcon = () => {
        switch (packingPhoto.ai_analysis_status) {
            case 'pending':
                return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-500" />;
            default:
                return <AlertTriangle className="h-4 w-4 text-gray-400" />;
        }
    };

    const getStatusBadge = () => {
        switch (packingPhoto.ai_analysis_status) {
            case 'pending':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Analyzing...</Badge>;
            case 'completed':
                return <Badge variant="secondary" className="bg-green-100 text-green-700">Complete</Badge>;
            case 'failed':
                return <Badge variant="destructive">Failed</Badge>;
            default:
                return <Badge variant="outline">Not Started</Badge>;
        }
    };

    const getQualityBadge = (score: number) => {
        if (score === 0) return <Badge variant="outline">Not Produce</Badge>;
        if (score >= 8) return <Badge className="bg-green-500">Excellent</Badge>;
        if (score >= 6) return <Badge className="bg-yellow-500">Good</Badge>;
        if (score >= 4) return <Badge className="bg-orange-500">Fair</Badge>;
        return <Badge variant="destructive">Poor</Badge>;
    };

    const getFreshnessBadge = (score: number) => {
        if (score === 0) return <Badge variant="outline">Not Produce</Badge>;
        if (score >= 8) return <Badge className="bg-green-500">Very Fresh</Badge>;
        if (score >= 6) return <Badge className="bg-yellow-500">Fresh</Badge>;
        if (score >= 4) return <Badge className="bg-orange-500">Acceptable</Badge>;
        return <Badge variant="destructive">Stale</Badge>;
    };

    const handleRetryAnalysis = async () => {
        setIsRetrying(true);
        
        try {
            console.log('Retrying analysis for photo:', packingPhoto.id);
            
            // Update status to pending
            const { error: updateError } = await supabase
                .from('packing_photos')
                .update({ ai_analysis_status: 'pending' })
                .eq('id', packingPhoto.id);

            if (updateError) {
                throw new Error(`Failed to update status: ${updateError.message}`);
            }

            // Trigger the analysis
            const { data: functionData, error: functionError } = await supabase.functions.invoke('analyze-image', {
                body: { packing_photo_id: packingPhoto.id },
                headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                }
            });

            if (functionError) {
                throw new Error(functionError.message);
            }

            console.log('Retry analysis started successfully:', functionData);
            
            // Update local state
            onStatusUpdate({
                ...packingPhoto,
                ai_analysis_status: 'pending'
            });

            toast({
                title: "Analysis Restarted",
                description: "AI analysis is processing your image again. This will take 30-60 seconds.",
            });

        } catch (error: any) {
            console.error('Retry analysis error:', error);
            toast({
                title: "Retry Failed",
                description: error.message || "Could not restart the analysis. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsRetrying(false);
        }
    };

    const meetsFreshnessStandard = packingPhoto.freshness_score >= 6;
    const meetsQualityStandard = packingPhoto.quality_score >= 6;
    const isProduceItem = packingPhoto.freshness_score > 0 && packingPhoto.quality_score > 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                    {getStatusIcon()}
                    AI Analysis Results
                </h3>
                {getStatusBadge()}
            </div>

            {packingPhoto.ai_analysis_status === 'pending' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
                        <span className="text-blue-800 font-medium">Analysis in Progress</span>
                    </div>
                    <p className="text-blue-700 text-sm">
                        AI is analyzing the image using advanced JPEG processing. This typically takes 30-60 seconds.
                    </p>
                </div>
            )}

            {packingPhoto.ai_analysis_status === 'failed' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="text-red-800 font-medium">Analysis Failed</span>
                        </div>
                        <Button
                            onClick={handleRetryAnalysis}
                            disabled={isRetrying}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                            {isRetrying ? (
                                <>
                                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                    Retrying...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Retry Analysis
                                </>
                            )}
                        </Button>
                    </div>
                    <p className="text-red-700 text-sm">
                        The image analysis failed. This might be due to image format issues or network problems. 
                        Click "Retry Analysis" to try again with improved processing.
                    </p>
                </div>
            )}

            {packingPhoto.ai_analysis_status === 'completed' && (
                <div className="space-y-4">
                    {!isProduceItem ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-gray-600" />
                                <span className="text-gray-800 font-medium">Not a Produce Item</span>
                            </div>
                            <p className="text-gray-700 text-sm mb-2">
                                <strong>Item:</strong> {packingPhoto.item_name}
                            </p>
                            <p className="text-gray-600 text-sm">
                                {packingPhoto.description}
                            </p>
                            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                                <p className="text-orange-800 text-sm font-medium">
                                    ⚠️ Please retake the photo with the actual produce item for quality assessment.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">Quality Score</span>
                                        {getQualityBadge(packingPhoto.quality_score)}
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900">
                                        {packingPhoto.quality_score}/10
                                    </div>
                                    {!meetsQualityStandard && (
                                        <p className="text-red-600 text-xs mt-1">Below minimum standard (6/10)</p>
                                    )}
                                </div>

                                <div className="bg-white border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">Freshness Score</span>
                                        {getFreshnessBadge(packingPhoto.freshness_score)}
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900">
                                        {packingPhoto.freshness_score}/10
                                    </div>
                                    {!meetsFreshnessStandard && (
                                        <p className="text-red-600 text-xs mt-1">Below minimum standard (6/10)</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white border rounded-lg p-4">
                                <div className="mb-2">
                                    <span className="text-sm font-medium text-gray-600">Identified Item</span>
                                </div>
                                <div className="text-lg font-semibold text-gray-900 mb-2">
                                    {packingPhoto.item_name}
                                </div>
                                <div className="text-sm text-gray-700">
                                    {packingPhoto.description}
                                </div>
                            </div>

                            {(!meetsFreshnessStandard || !meetsQualityStandard) && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        <span className="text-red-800 font-medium">Quality Standards Not Met</span>
                                    </div>
                                    <div className="text-red-700 text-sm space-y-1">
                                        {!meetsQualityStandard && (
                                            <p>• Quality score ({packingPhoto.quality_score}/10) is below minimum (6/10)</p>
                                        )}
                                        {!meetsFreshnessStandard && (
                                            <p>• Freshness score ({packingPhoto.freshness_score}/10) is below minimum (6/10)</p>
                                        )}
                                        <p className="mt-2 font-medium">
                                            Please replace this item with a higher quality alternative before packing.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {meetsFreshnessStandard && meetsQualityStandard && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span className="text-green-800 font-medium">Quality Standards Met</span>
                                    </div>
                                    <p className="text-green-700 text-sm">
                                        Both quality and freshness scores meet the minimum requirements. This item is ready for packing.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default PhotoAnalysis;
