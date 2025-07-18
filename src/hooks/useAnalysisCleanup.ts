
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to automatically clean up stuck image analyses
 * Runs on component mount to check for analyses stuck in pending/processing state
 */
export const useAnalysisCleanup = () => {
  useEffect(() => {
    const cleanupStuckAnalyses = async () => {
      try {
        console.log('🧹 Running analysis cleanup check...');
        
        // Find analyses that have been stuck for more than 5 minutes
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        
        const { data: stuckPhotos, error } = await supabase
          .from('packing_photos')
          .select('id, created_at, ai_analysis_status, description')
          .or('ai_analysis_status.eq.pending,ai_analysis_status.eq.processing')
          .lt('created_at', fiveMinutesAgo.toISOString());

        if (error) {
          console.error('❌ Error checking stuck analyses:', error);
          return;
        }

        if (stuckPhotos && stuckPhotos.length > 0) {
          console.log(`🔍 Found ${stuckPhotos.length} stuck analyses, cleaning up...`);
          
          // Reset them to failed status with cleanup message
          const { error: updateError } = await supabase
            .from('packing_photos')
            .update({
              ai_analysis_status: 'failed',
              description: 'Analysis was stuck and has been automatically reset. Please retry the analysis.'
            })
            .in('id', stuckPhotos.map(photo => photo.id));

          if (updateError) {
            console.error('❌ Error updating stuck analyses:', updateError);
          } else {
            console.log(`✅ Successfully cleaned up ${stuckPhotos.length} stuck analyses`);
          }
        } else {
          console.log('✅ No stuck analyses found');
        }
      } catch (error) {
        console.error('❌ Cleanup process failed:', error);
      }
    };

    // Run cleanup on mount
    cleanupStuckAnalyses();
    
    // Set up periodic cleanup every 2 minutes
    const intervalId = setInterval(cleanupStuckAnalyses, 120000);
    
    return () => clearInterval(intervalId);
  }, []);
};
