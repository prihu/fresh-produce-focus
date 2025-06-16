
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

    const { data: packingPhoto, error: fetchError } = await supabase
      .from('packing_photos')
      .select('*')
      .eq('id', packing_photo_id)
      .single();

    if (fetchError || !packingPhoto) {
      throw new Error('Packing photo not found');
    }

    await supabase
      .from('packing_photos')
      .update({ ai_analysis_status: 'pending' })
      .eq('id', packing_photo_id);

    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('packing-photos')
      .createSignedUrl(packingPhoto.storage_path, 3600);

    if (urlError || !signedUrlData) {
      throw new Error('Could not generate signed URL for image');
    }

    const model = 'gpt-4o-mini';

    // Enhanced prompt for better produce detection and quality assessment
    const systemPrompt = `You are a produce quality expert. Analyze this image and provide:

1. PRODUCE IDENTIFICATION: First determine if this is actually fresh produce/fruits/vegetables
2. ITEM NAME: Specific produce item (e.g., "Apple", "Banana", "Lettuce")
3. FRESHNESS SCORE: 1-10 (10 = perfectly fresh, no wilting/bruising)
4. QUALITY SCORE: 1-10 (10 = perfect quality, no defects)
5. DESCRIPTION: Brief assessment of condition

CRITICAL RULES:
- If NOT produce/food: Item name should be "Not Produce" and scores should be 0
- If unclear/blurry: Item name should be "Unidentified" and scores should be 0
- Minimum acceptable scores for packing: 6/10 for both freshness and quality
- Be strict with scoring - food safety is critical

Format your response exactly like this:
Item: [Specific produce name or "Not Produce" or "Unidentified"]
Freshness: [1-10]
Quality: [1-10]
Description: [Brief assessment]`;

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
                text: 'Please analyze this produce image for freshness and quality according to the guidelines.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: signedUrlData.signedUrl,
                  detail: fast_mode ? 'low' : 'high'
                }
              }
            ]
          }
        ],
        max_tokens: fast_mode ? 300 : 500,
        temperature: 0.1,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const analysisResult = await openAIResponse.json();
    const analysisText = analysisResult.choices[0].message.content;

    // Enhanced parsing with stricter validation
    const parseAnalysis = (text: string) => {
      let itemName = 'Unidentified';
      let freshness = 0;
      let quality = 0;
      let description = text;

      // Extract item name
      const itemMatch = text.match(/Item:\s*([^\n]+)/i);
      if (itemMatch) {
        itemName = itemMatch[1].trim();
      }

      // Extract freshness score
      const freshnessMatch = text.match(/Freshness:\s*(\d+)/i);
      if (freshnessMatch) {
        freshness = Math.min(10, Math.max(0, parseInt(freshnessMatch[1])));
      }

      // Extract quality score
      const qualityMatch = text.match(/Quality:\s*(\d+)/i);
      if (qualityMatch) {
        quality = Math.min(10, Math.max(0, parseInt(qualityMatch[1])));
      }

      // Extract description
      const descMatch = text.match(/Description:\s*([^\n]+)/i);
      if (descMatch) {
        description = descMatch[1].trim();
      }

      // Validate produce detection
      const isNonProduce = itemName.toLowerCase().includes('not produce') || 
                          itemName.toLowerCase().includes('unidentified') ||
                          itemName.toLowerCase().includes('unclear');

      if (isNonProduce) {
        freshness = 0;
        quality = 0;
      }

      return { itemName, freshness, quality, description };
    };

    const { itemName, freshness, quality, description } = parseAnalysis(analysisText);

    const { error: updateError } = await supabase
      .from('packing_photos')
      .update({
        ai_analysis_status: 'completed',
        item_name: itemName,
        freshness_score: freshness,
        quality_score: quality,
        description: description,
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

    try {
      const requestBody = await req.json().catch(() => ({}));
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
