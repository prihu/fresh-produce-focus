
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

    // 1. Get photo path from DB
    const { data: photo, error: photoError } = await supabaseAdmin
      .from('packing_photos')
      .select('storage_path')
      .eq('id', packing_photo_id)
      .single();

    if (photoError) throw photoError;

    if (!photo) {
        return new Response(JSON.stringify({ error: 'Photo not found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
        });
    }

    // 2. Create signed URL for the image
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('packing-photos')
      .createSignedUrl(photo.storage_path, 300); // 5 minutes validity

    if (signedUrlError) throw signedUrlError;

    // 3. Call OpenAI Vision API
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
                        { type: "text", text: `Analyze the image of a produce item. Identify the item's name (e.g., "Banana", "Tomato"). Assess its quality and freshness with a critical eye, as a professional produce inspector would. Look for signs of ripeness, damage, bruising, mold, discoloration, and dehydration. Return a JSON object with four keys: "item_name" (string), "freshness_score" (integer 1-10), "quality_score" (integer 1-10), and "description" (string, 1-2 sentences summarizing your findings). Scores must be justified by visual evidence in the image. A perfect, vibrant, and unblemished item gets 10/10. Minor defects (e.g., small bruise, slight wilting) warrant a score of 7-9. Significant issues (e.g., visible mold, large soft spots, widespread discoloration) must be scored 1-4. Be conservative with high scores; they should be reserved for exceptional quality. Only return the JSON object.` },
                        { type: "image_url", image_url: { url: signedUrlData.signedUrl } }
                    ]
                }
            ],
            max_tokens: 300,
            response_format: { type: "json_object" }
        })
    });
    
    if (!openAIResponse.ok) {
        const errorBody = await openAIResponse.text();
        console.error("OpenAI API error:", errorBody);
        throw new Error(`OpenAI API request failed with status ${openAIResponse.status}`);
    }

    const openAIResult = await openAIResponse.json();
    const analysisContent = JSON.parse(openAIResult.choices[0].message.content);

    // 4. Update the DB with results
    const analysisData = {
        item_name: analysisContent.item_name,
        freshness_score: analysisContent.freshness_score,
        quality_score: analysisContent.quality_score,
        description: analysisContent.description,
        ai_analysis_status: 'completed'
    };

    const { error: updateError } = await supabaseAdmin
      .from('packing_photos')
      .update(analysisData)
      .eq('id', packing_photo_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ message: "Analysis complete", analysis: analysisData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in analyze-image function:', error);
    if (packing_photo_id) {
        await supabaseAdmin
            .from('packing_photos')
            .update({ ai_analysis_status: 'failed' })
            .eq('id', packing_photo_id);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
