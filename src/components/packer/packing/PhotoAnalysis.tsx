
import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";

type PackingPhoto = Tables<'packing_photos'>;

interface PhotoAnalysisProps {
    packingPhoto: PackingPhoto;
}

const PhotoAnalysis = ({ packingPhoto }: PhotoAnalysisProps) => (
    <div>
        <h3 className="font-semibold mb-2">Photo Analysis</h3>
        <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-2">
                <p>Status:</p> <Badge variant={packingPhoto.ai_analysis_status === 'completed' ? 'default' : 'secondary'}>{packingPhoto.ai_analysis_status}</Badge>
            </div>
            {packingPhoto.ai_analysis_status === 'pending' && <p className="text-sm text-muted-foreground mt-2">Analyzing image, please wait...</p>}
            {packingPhoto.ai_analysis_status === 'completed' && (
                <div className="mt-2 space-y-1">
                    <p><strong>Freshness:</strong> {packingPhoto.freshness_score}/10</p>
                    <p><strong>Quality:</strong> {packingPhoto.quality_score}/10</p>
                    <p><strong>Description:</strong> {packingPhoto.description}</p>
                </div>
            )}
            {packingPhoto.ai_analysis_status === 'failed' && <p className="text-sm text-red-500 mt-2">Analysis failed. Please try again.</p>}
        </div>
    </div>
);

export default PhotoAnalysis;
