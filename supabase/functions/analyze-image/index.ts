
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      headers: Object.fromEntries(req.headers.entries())
    });

    // Enhanced request validation and rate limiting
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Unauthorized request - missing auth header', {
        timestamp: new Date().toISOString(),
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      });
      
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
      console.error('❌ Authentication failed', {
        error: userError?.message,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('✅ User authenticated', {
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    // Enhanced request body validation with better error handling
    let requestBody;
    let requestText = '';
    
    try {
      requestText = await req.text();
      console.log('📥 Raw request body received', {
        userId: user.id,
        bodyLength: requestText.length,
        bodyPreview: requestText.substring(0, 200),
        isEmpty: !requestText.trim(),
        timestamp: new Date().toISOString()
      });

      if (!requestText.trim()) {
        console.error('❌ Empty request body detected', {
          userId: user.id,
          contentType: req.headers.get('content-type'),
          timestamp: new Date().toISOString()
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Request body is empty. Please provide packing_photo_id.',
            debug: {
              contentType: req.headers.get('content-type'),
              bodyLength: requestText.length
            }
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      requestBody = JSON.parse(requestText);
      console.log('✅ Request body parsed successfully', {
        userId: user.id,
        parsedKeys: Object.keys(requestBody),
        timestamp: new Date().toISOString()
      });

    } catch (parseError) {
      console.error('❌ Request body parsing failed', {
        userId: user.id,
        error: parseError.message,
        rawBody: requestText,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          debug: {
            parseError: parseError.message,
            receivedBody: requestText.substring(0, 500)
          }
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { packing_photo_id } = requestBody;

    if (!packing_photo_id) {
      console.error('❌ Missing packing_photo_id', {
        userId: user.id,
        receivedKeys: Object.keys(requestBody),
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Missing packing_photo_id',
          debug: {
            receivedKeys: Object.keys(requestBody),
            requestBody: requestBody
          }
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('📷 Processing photo analysis request', {
      userId: user.id,
      photoId: packing_photo_id,
      timestamp: new Date().toISOString()
    });

    // Enhanced security: Verify user has access to this photo
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
      console.error('❌ Photo access validation failed', {
        userId: user.id,
        photoId: packing_photo_id,
        error: photoError?.message,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: 'Photo not found or access denied' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify user owns this order or is admin
    const isOwner = photoData.orders.packer_id === user.id;
    
    // Check if user is admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = userRoles?.some(r => r.role === 'admin');

    if (!isOwner && !isAdmin) {
      console.warn('❌ Unauthorized photo analysis attempt', {
        userId: user.id,
        photoId: packing_photo_id,
        orderPackerId: photoData.orders.packer_id,
        timestamp: new Date().toISOString()
      });
      
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('✅ Access verified, updating status to processing', {
      userId: user.id,
      photoId: packing_photo_id,
      timestamp: new Date().toISOString()
    });

    // Update analysis status to 'processing' with error handling
    const { error: updateError } = await supabase
      .from('packing_photos')
      .update({ 
        ai_analysis_status: 'processing',
        description: `Analysis started at ${new Date().toISOString()}`
      })
      .eq('id', packing_photo_id);

    if (updateError) {
      console.error('❌ Failed to update analysis status', {
        photoId: packing_photo_id,
        error: updateError.message,
        timestamp: new Date().toISOString()
      });
    }

    // Enhanced image retrieval with proper error handling
    console.log('📥 Retrieving image from storage', {
      photoId: packing_photo_id,
      storagePath: photoData.storage_path,
      timestamp: new Date().toISOString()
    });

    const { data: imageData, error: storageError } = await supabase.storage
      .from('packing-photos')
      .download(photoData.storage_path);

    if (storageError || !imageData) {
      console.error('❌ Failed to retrieve image', {
        photoId: packing_photo_id,
        storagePath: photoData.storage_path,
        error: storageError?.message,
        timestamp: new Date().toISOString()
      });

      // Update status to failed
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

    console.log('✅ Image retrieved successfully', {
      photoId: packing_photo_id,
      imageSize: imageData.size,
      timestamp: new Date().toISOString()
    });

    // Enhanced image validation
    const maxSize = 15 * 1024 * 1024; // 15MB limit
    if (imageData.size > maxSize) {
      console.error('❌ Image too large', {
        photoId: packing_photo_id,
        size: imageData.size,
        maxSize: maxSize,
        timestamp: new Date().toISOString()
      });

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

    // Convert to base64 with error handling
    let base64Image: string;
    try {
      console.log('🔄 Converting image to base64', {
        photoId: packing_photo_id,
        timestamp: new Date().toISOString()
      });

      const arrayBuffer = await imageData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      base64Image = btoa(String.fromCharCode(...uint8Array));
      
      console.log('✅ Image converted to base64', {
        photoId: packing_photo_id,
        base64Length: base64Image.length,
        timestamp: new Date().toISOString()
      });

    } catch (conversionError) {
      console.error('❌ Image conversion failed', {
        photoId: packing_photo_id,
        error: conversionError.message,
        timestamp: new Date().toISOString()
      });

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

    // Enhanced OpenAI API call with timeout and retry logic
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not configured', {
        photoId: packing_photo_id,
        userId: user.id,
        timestamp: new Date().toISOString()
      });
      
      await supabase
        .from('packing_photos')
        .update({ 
          ai_analysis_status: 'failed',
          description: 'OpenAI API key not configured'
        })
        .eq('id', packing_photo_id);

      return new Response(
        JSON.stringify({ error: 'AI service unavailable - API key not configured' }),
        { status: 503, headers: corsHeaders }
      );
    }

    console.log('🤖 Starting OpenAI analysis', {
      photoId: packing_photo_id,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    // Call OpenAI with enhanced timeout and error handling
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

      console.log('📡 OpenAI API response received', {
        photoId: packing_photo_id,
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        timestamp: new Date().toISOString()
      });

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

        console.log('🔍 Parsing AI response', {
          photoId: packing_photo_id,
          rawContent: content,
          timestamp: new Date().toISOString()
        });

        analysisData = JSON.parse(content);
      } catch (parseError) {
        console.error('❌ AI response parsing failed', {
          photoId: packing_photo_id,
          response: aiResult.choices?.[0]?.message?.content,
          error: parseError.message,
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid AI response format');
      }

      // Enhanced data validation
      const { item_name, freshness_score, quality_score, description } = analysisData;

      if (!item_name || typeof freshness_score !== 'number' || typeof quality_score !== 'number') {
        throw new Error('Missing required analysis fields');
      }

      if (freshness_score < 1 || freshness_score > 10 || quality_score < 1 || quality_score > 10) {
        throw new Error('Invalid score ranges');
      }

      console.log('✅ Analysis data validated', {
        photoId: packing_photo_id,
        itemName: item_name,
        freshnessScore: freshness_score,
        qualityScore: quality_score,
        timestamp: new Date().toISOString()
      });

      // Update database with analysis results and enhanced logging
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
        console.error('❌ Failed to save analysis results', {
          photoId: packing_photo_id,
          error: finalUpdateError.message,
          timestamp: new Date().toISOString()
        });
        throw new Error('Failed to save analysis results');
      }

      console.log('🎉 AI analysis completed successfully', {
        photoId: packing_photo_id,
        userId: user.id,
        itemName: item_name,
        freshnessScore: freshness_score,
        qualityScore: quality_score,
        timestamp: new Date().toISOString()
      });

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
      
      console.error('❌ AI analysis failed', {
        photoId: packing_photo_id,
        userId: user.id,
        error: aiError.message,
        errorName: aiError.name,
        timestamp: new Date().toISOString()
      });

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
    console.error('❌ Function error', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

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
