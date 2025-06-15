
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let packing_photo_id: string | null = null;
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  try {
    const body = await req.json();
    packing_photo_id = body.packing_photo_id;

    if (!packing_photo_id) {
        return new Response(JSON.stringify({ error: 'packing_photo_id is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    console.log(`Starting analysis for photo ID: ${packing_photo_id}`);

    // 1. Get photo path from DB
    const { data: photo, error: photoError } = await supabaseAdmin
      .from('packing_photos')
      .select('storage_path')
      .eq('id', packing_photo_id)
      .single();

    if (photoError) {
      console.error('Photo fetch error:', photoError);
      throw photoError;
    }

    if (!photo) {
        return new Response(JSON.stringify({ error: 'Photo not found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
        });
    }

    console.log(`Creating signed URL for: ${photo.storage_path}`);

    // 2. Create signed URL for the image
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('packing-photos')
      .createSignedUrl(photo.storage_path, 600); // 10 minutes validity

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      throw signedUrlError;
    }

    console.log('Calling OpenAI API...');

    // 3. Call OpenAI Vision API with retry logic
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { 
                              type: "text", 
                              text: `Analyze this produce item image. Identify the item name (e.g., "Banana", "Apple", "Tomato"). 
                              
                              As a professional quality inspector, assess:
                              - Overall freshness and ripeness
                              - Visual defects (bruising, spots, discoloration)
                              - Signs of spoilage or damage
                              - Market-ready appearance
                              
                              Return JSON with:
                              - "item_name": specific produce name
                              - "freshness_score": 1-10 (10=perfect, 1=spoiled)
                              - "quality_score": 1-10 (10=flawless, 1=heavily damaged)
                              - "description": 1-2 sentence summary
                              
                              Be conservative with scores: 8-10 for exceptional quality, 5-7 for acceptable, 1-4 for poor quality with visible defects.` 
                            },
                            { type: "image_url", image_url: { url: signedUrlData.signedUrl } }
                        ]
                    }
                ],
                max_tokens: 300,
                temperature: 0.3,
                response_format: { type: "json_object" }
            })
        });
        
        if (!openAIResponse.ok) {
            const errorBody = await openAIResponse.text();
            console.error(`OpenAI API error (attempt ${attempt}):`, errorBody);
            throw new Error(`OpenAI API request failed with status ${openAIResponse.status}: ${errorBody}`);
        }

        const openAIResult = await openAIResponse.json();
        console.log('OpenAI response received successfully');
        
        if (!openAIResult.choices?.[0]?.message?.content) {
          throw new Error('Invalid OpenAI response structure');
        }

        const analysisContent = JSON.parse(openAIResult.choices[0].message.content);

        // 4. Update the DB with results
        const analysisData = {
            item_name: analysisContent.item_name || 'Unknown Item',
            freshness_score: Math.min(10, Math.max(1, Number(analysisContent.freshness_score) || 5)),
            quality_score: Math.min(10, Math.max(1, Number(analysisContent.quality_score) || 5)),
            description: analysisContent.description || 'Analysis completed',
            ai_analysis_status: 'completed'
        };

        console.log('Updating database with analysis results:', analysisData);

        const { error: updateError } = await supabaseAdmin
          .from('packing_photos')
          .update(analysisData)
          .eq('id', packing_photo_id);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw updateError;
        }

        console.log('Analysis completed successfully');

        return new Response(JSON.stringify({ 
          message: "Analysis complete", 
          analysis: analysisData 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });

      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed
    throw lastError || new Error('All retry attempts failed');

  } catch (error: any) {
    console.error('Error in analyze-image function:', error);
    
    // Update status to failed with specific error info
    if (packing_photo_id) {
        try {
          await supabaseAdmin
              .from('packing_photos')
              .update({ 
                ai_analysis_status: 'failed',
                description: `Analysis failed: ${error.message.substring(0, 100)}` 
              })
              .eq('id', packing_photo_id);
        } catch (updateError) {
          console.error('Failed to update error status:', updateError);
        }
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Analysis failed after multiple attempts. Please try again or check image quality.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
