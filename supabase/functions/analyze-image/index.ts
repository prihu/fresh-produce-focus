
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  packing_photo_id: string;
  fast_mode?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { packing_photo_id, fast_mode = false }: AnalysisRequest = await req.json();
    
    if (!packing_photo_id) {
      throw new Error('Missing packing_photo_id');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the packing photo record
    const { data: packingPhoto, error: fetchError } = await supabase
      .from('packing_photos')
      .select('*')
      .eq('id', packing_photo_id)
      .single();

    if (fetchError || !packingPhoto) {
      throw new Error('Packing photo not found');
    }

    // Update status to pending
    await supabase
      .from('packing_photos')
      .update({ ai_analysis_status: 'pending' })
      .eq('id', packing_photo_id);

    // Get the signed URL for the image
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('packing-photos')
      .createSignedUrl(packingPhoto.storage_path, 3600);

    if (urlError || !signedUrlData) {
      throw new Error('Could not generate signed URL for image');
    }

    // Choose model based on fast_mode
    const model = fast_mode ? 'gpt-4o-mini' : 'gpt-4o-mini'; // Always use mini for faster processing

    // Optimized prompt for faster processing
    const systemPrompt = fast_mode 
      ? `Analyze this produce image quickly. Rate freshness (1-10) and quality (1-10). Identify the item. Give a brief assessment in 1-2 sentences.`
      : `You are a produce quality expert. Analyze this image of fresh produce and provide:
1. Item identification
2. Freshness score (1-10, where 10 is perfectly fresh)
3. Quality score (1-10, where 10 is perfect quality)
4. Brief description of condition

Be accurate but concise.`;

    // Call OpenAI Vision API with optimized settings
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this produce for freshness and quality.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: signedUrlData.signedUrl,
                  detail: fast_mode ? 'low' : 'high' // Use low detail for faster processing
                }
              }
            ]
          }
        ],
        max_tokens: fast_mode ? 200 : 400,
        temperature: 0.1, // Lower temperature for more consistent results
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const analysisResult = await openAIResponse.json();
    const analysisText = analysisResult.choices[0].message.content;

    // Enhanced parsing logic
    const parseAnalysis = (text: string) => {
      // Default values
      let itemName = 'Produce Item';
      let freshness = 5;
      let quality = 5;
      let description = text;

      // Extract item name
      const itemMatch = text.match(/(?:item|product|this is|appears to be|looks like)\s*:?\s*([^\n\.]+)/i);
      if (itemMatch) {
        itemName = itemMatch[1].trim();
      }

      // Extract scores with multiple patterns
      const freshnessPatterns = [
        /freshness\s*:?\s*(\d+)(?:\/10)?/i,
        /fresh(?:ness)?\s*score\s*:?\s*(\d+)/i,
        /(\d+)\/10\s*fresh/i
      ];

      const qualityPatterns = [
        /quality\s*:?\s*(\d+)(?:\/10)?/i,
        /quality\s*score\s*:?\s*(\d+)/i,
        /(\d+)\/10\s*quality/i
      ];

      for (const pattern of freshnessPatterns) {
        const match = text.match(pattern);
        if (match) {
          freshness = Math.min(10, Math.max(1, parseInt(match[1])));
          break;
        }
      }

      for (const pattern of qualityPatterns) {
        const match = text.match(pattern);
        if (match) {
          quality = Math.min(10, Math.max(1, parseInt(match[1])));
          break;
        }
      }

      return { itemName, freshness, quality, description };
    };

    const { itemName, freshness, quality, description } = parseAnalysis(analysisText);

    // Update the database with results
    const { error: updateError } = await supabase
      .from('packing_photos')
      .update({
        ai_analysis_status: 'completed',
        item_name: itemName,
        freshness_score: freshness,
        quality_score: quality,
        description: description,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', packing_photo_id);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to save analysis results');
    }

    console.log(`Analysis completed for photo ${packing_photo_id}:`, {
      itemName,
      freshness,
      quality,
      model,
      fast_mode
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          item_name: itemName,
          freshness_score: freshness,
          quality_score: quality,
          description,
          model_used: model,
          processing_mode: fast_mode ? 'fast' : 'standard'
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Analysis function error:', error);

    // Update status to failed if we have the ID
    try {
      const requestBody = await req.json();
      if (requestBody.packing_photo_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('packing_photos')
          .update({ ai_analysis_status: 'failed' })
          .eq('id', requestBody.packing_photo_id);
      }
    } catch (e) {
      console.error('Failed to update status to failed:', e);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Image analysis failed'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
