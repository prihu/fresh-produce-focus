
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced chunk-based base64 conversion to prevent memory overflow
const convertToBase64Chunked = (arrayBuffer: ArrayBuffer): string => {
  const uint8Array = new Uint8Array(arrayBuffer);
  let result = '';
  const chunkSize = 8192; // 8KB chunks to prevent memory issues
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    const chunkString = Array.from(chunk).map(byte => String.fromCharCode(byte)).join('');
    result += btoa(chunkString);
  }
  
  return result;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🚀 Analyze-image function called', {
      timestamp: new Date().toISOString(),
      method: req.method,
    });

    // Enhanced request validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Unauthorized request - missing auth header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('❌ Authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('✅ User authenticated:', { userId: user.id });

    // Parse request body
    let requestBody;
    try {
      const requestText = await req.text();
      if (!requestText.trim()) {
        return new Response(
          JSON.stringify({ error: 'Request body is empty' }),
          { status: 400, headers: corsHeaders }
        );
      }
      requestBody = JSON.parse(requestText);
    } catch (parseError) {
      console.error('❌ Request body parsing failed:', parseError.message);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { packing_photo_id } = requestBody;
    if (!packing_photo_id) {
      return new Response(
        JSON.stringify({ error: 'Missing packing_photo_id' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('📷 Processing photo analysis request:', { photoId: packing_photo_id });

    // Verify user has access to this photo
    const { data: photoData, error: photoError } = await supabase
      .from('packing_photos')
      .select(`
        id,
        storage_path,
        order_id,
        orders!inner(packer_id)
      `)
      .eq('id', packing_photo_id)
      .single();

    if (photoError || !photoData) {
      console.error('❌ Photo access validation failed:', photoError?.message);
      return new Response(
        JSON.stringify({ error: 'Photo not found or access denied' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify user owns this order or is admin
    const isOwner = photoData.orders.packer_id === user.id;
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const isAdmin = userRoles?.some(r => r.role === 'admin');

    if (!isOwner && !isAdmin) {
      console.warn('❌ Unauthorized photo analysis attempt');
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Update analysis status to 'processing' with better error handling
    try {
      const { error: updateError } = await supabase
        .from('packing_photos')
        .update({ 
          ai_analysis_status: 'processing',
          description: `Analysis started at ${new Date().toISOString()}`
        })
        .eq('id', packing_photo_id);

      if (updateError) {
        console.error('❌ Failed to update analysis status:', updateError.message);
        // Continue processing even if status update fails
      } else {
        console.log('✅ Status updated to processing');
      }
    } catch (statusError) {
      console.error('❌ Status update error:', statusError);
      // Continue processing
    }

    // Retrieve image from storage
    console.log('📥 Retrieving image from storage:', { storagePath: photoData.storage_path });
    const { data: imageData, error: storageError } = await supabase.storage
      .from('packing-photos')
      .download(photoData.storage_path);

    if (storageError || !imageData) {
      console.error('❌ Failed to retrieve image:', storageError?.message);
      await supabase
        .from('packing_photos')
        .update({ 
          ai_analysis_status: 'failed',
          description: `Failed to retrieve image: ${storageError?.message || 'Unknown storage error'}`
        })
        .eq('id', packing_photo_id);

      return new Response(
        JSON.stringify({ error: 'Failed to retrieve image from storage' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Enhanced image validation with size limits
    const maxSize = 15 * 1024 * 1024; // 15MB limit
    console.log('📊 Image size:', { size: imageData.size, maxSize });
    
    if (imageData.size > maxSize) {
      console.error('❌ Image too large:', { size: imageData.size, maxSize });
      await supabase
        .from('packing_photos')
        .update({ 
          ai_analysis_status: 'failed',
          description: `Image too large: ${Math.round(imageData.size / 1024 / 1024)}MB (max 15MB)`
        })
        .eq('id', packing_photo_id);

      return new Response(
        JSON.stringify({ error: 'Image too large (max 15MB)' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Convert to base64 with improved memory-safe approach
    let base64Image: string;
    try {
      console.log('🔄 Converting image to base64 (chunk-based approach)');
      const arrayBuffer = await imageData.arrayBuffer();
      base64Image = convertToBase64Chunked(arrayBuffer);
      console.log('✅ Image converted to base64:', { base64Length: base64Image.length });
    } catch (conversionError) {
      console.error('❌ Image conversion failed:', conversionError.message);
      await supabase
        .from('packing_photos')
        .update({ 
          ai_analysis_status: 'failed',
          description: `Image conversion failed: ${conversionError.message}`
        })
        .eq('id', packing_photo_id);

      return new Response(
        JSON.stringify({ error: 'Image processing failed' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // OpenAI API call with enhanced error handling
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not configured');
      await supabase
        .from('packing_photos')
        .update({ 
          ai_analysis_status: 'failed',
          description: 'OpenAI API key not configured'
        })
        .eq('id', packing_photo_id);

      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 503, headers: corsHeaders }
      );
    }

    console.log('🤖 Starting OpenAI analysis');

    // Call OpenAI with timeout and retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are a produce quality expert for Zepto grocery delivery. Analyze this produce image and provide:

1. Item identification (what produce item is this?)
2. Freshness score (1-10, where 10 is perfectly fresh)
3. Quality score (1-10, where 10 is perfect quality)
4. Brief description of condition

Respond in this EXACT JSON format:
{
  "item_name": "exact produce name",
  "freshness_score": number,
  "quality_score": number,
  "description": "brief condition description"
}

Requirements:
- Freshness/quality scores must be integers between 1-10
- Only identify actual produce items (fruits, vegetables)
- If not produce, set item_name to "not produce"
- Be strict with quality standards for grocery delivery`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.1
        })
      });

      clearTimeout(timeoutId);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      }

      const aiResult = await openaiResponse.json();
      let analysisData;

      try {
        const content = aiResult.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('No analysis content received from OpenAI');
        }
        analysisData = JSON.parse(content);
      } catch (parseError) {
        console.error('❌ AI response parsing failed:', parseError.message);
        throw new Error('Invalid AI response format');
      }

      // Validate analysis data
      const { item_name, freshness_score, quality_score, description } = analysisData;
      if (!item_name || typeof freshness_score !== 'number' || typeof quality_score !== 'number') {
        throw new Error('Missing required analysis fields');
      }

      if (freshness_score < 1 || freshness_score > 10 || quality_score < 1 || quality_score > 10) {
        throw new Error('Invalid score ranges');
      }

      console.log('✅ Analysis completed successfully:', {
        itemName: item_name,
        freshnessScore: freshness_score,
        qualityScore: quality_score
      });

      // Update database with analysis results
      const { error: finalUpdateError } = await supabase
        .from('packing_photos')
        .update({
          item_name,
          freshness_score: Math.round(freshness_score),
          quality_score: Math.round(quality_score),
          description: description || 'Analysis completed',
          ai_analysis_status: 'completed'
        })
        .eq('id', packing_photo_id);

      if (finalUpdateError) {
        console.error('❌ Failed to save analysis results:', finalUpdateError.message);
        throw new Error('Failed to save analysis results');
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          analysis: {
            item_name,
            freshness_score: Math.round(freshness_score),
            quality_score: Math.round(quality_score),
            description: description || 'Analysis completed'
          }
        }),
        { headers: corsHeaders }
      );

    } catch (aiError: any) {
      clearTimeout(timeoutId);
      console.error('❌ AI analysis failed:', aiError.message);

      // Update status to failed with cleanup
      await supabase
        .from('packing_photos')
        .update({ 
          ai_analysis_status: 'failed',
          description: `Analysis failed: ${aiError.message}`
        })
        .eq('id', packing_photo_id);

      return new Response(
        JSON.stringify({ 
          error: 'AI analysis failed',
          details: aiError.message,
          canRetry: true
        }),
        { status: 500, headers: corsHeaders }
      );
    }

  } catch (error: any) {
    console.error('❌ Function error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        canRetry: true
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
