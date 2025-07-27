
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Smart JSON extraction function to handle markdown-wrapped responses
const extractJsonFromResponse = (content: string): any => {
  if (!content || typeof content !== 'string') {
    throw new Error('Empty or invalid content received from OpenAI');
  }

  console.log('🔍 Raw OpenAI response content (first 200 chars):', content.substring(0, 200));
  console.log('📏 Full response length:', content.length);

  // Try to extract JSON from markdown code blocks first
  const markdownJsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (markdownJsonMatch) {
    const extractedJson = markdownJsonMatch[1].trim();
    console.log('📦 Extracted JSON from markdown:', extractedJson.substring(0, 100) + '...');
    
    try {
      return JSON.parse(extractedJson);
    } catch (parseError) {
      console.error('❌ Failed to parse extracted JSON:', parseError.message);
      throw new Error(`Failed to parse extracted JSON: ${parseError.message}`);
    }
  }

  // Try to parse as direct JSON
  const trimmedContent = content.trim();
  if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
    try {
      return JSON.parse(trimmedContent);
    } catch (parseError) {
      console.error('❌ Failed to parse direct JSON:', parseError.message);
      throw new Error(`Failed to parse direct JSON: ${parseError.message}`);
    }
  }

  // Try to find JSON object within the text
  const jsonMatch = trimmedContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('❌ Failed to parse found JSON object:', parseError.message);
      throw new Error(`Failed to parse found JSON object: ${parseError.message}`);
    }
  }

  // If no JSON found, throw detailed error
  console.error('❌ No valid JSON found in response. Content sample:', content.substring(0, 500));
  throw new Error('No valid JSON found in OpenAI response. Response may be malformed or in unexpected format.');
};

// Memory-safe base64 conversion using Deno standard library
const convertToBase64Safe = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    console.log('🔄 Converting image to base64 using Deno standard library');
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Log memory usage for monitoring
    console.log('📊 Image processing:', { 
      bufferSize: arrayBuffer.byteLength,
      sizeInMB: Math.round(arrayBuffer.byteLength / 1024 / 1024 * 100) / 100
    });
    
    // Use Deno's built-in base64 encoding - memory efficient and reliable
    const base64String = encodeBase64(uint8Array);
    
    // Validate the base64 output
    if (!base64String || base64String.length === 0) {
      throw new Error('Base64 conversion resulted in empty string');
    }
    
    // Log sample for debugging (first 100 chars)
    console.log('✅ Base64 conversion successful:', { 
      outputLength: base64String.length,
      sample: base64String.substring(0, 100) + '...'
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ Base64 conversion failed:', error.message);
    throw new Error(`Base64 conversion failed: ${error.message}`);
  }
};

// Validate image format and size
const validateImage = (blob: Blob): { isValid: boolean; error?: string } => {
  // Check file size (15MB limit)
  const maxSize = 15 * 1024 * 1024;
  if (blob.size > maxSize) {
    return {
      isValid: false,
      error: `Image too large: ${Math.round(blob.size / 1024 / 1024)}MB (max 15MB)`
    };
  }
  
  // Check MIME type
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(blob.type)) {
    return {
      isValid: false,
      error: `Unsupported image format: ${blob.type}. Supported: JPEG, PNG, WebP`
    };
  }
  
  return { isValid: true };
};

// Enhanced validation to handle non-produce items with 0 scores
const validateAnalysisResponse = (data: any): { isValid: boolean; error?: string } => {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Response is not an object' };
  }

  const required = ['item_name', 'freshness_score', 'quality_score', 'description'];
  for (const field of required) {
    if (!(field in data)) {
      return { isValid: false, error: `Missing required field: ${field}` };
    }
  }

  const { freshness_score, quality_score, item_name } = data;
  
  // Check if this is a non-produce item
  const isNonProduce = !item_name || 
    item_name.toLowerCase().includes('not produce') ||
    item_name.toLowerCase().includes('no produce') ||
    item_name.toLowerCase().includes('unidentified') ||
    item_name.toLowerCase().includes('unclear') ||
    item_name.toLowerCase().includes('not food');

  // For non-produce items, allow 0 scores
  if (isNonProduce) {
    if (typeof freshness_score !== 'number' || (freshness_score !== 0 && (freshness_score < 1 || freshness_score > 10))) {
      return { isValid: false, error: `Invalid freshness_score for non-produce: ${freshness_score} (must be 0 or 1-10)` };
    }
    
    if (typeof quality_score !== 'number' || (quality_score !== 0 && (quality_score < 1 || quality_score > 10))) {
      return { isValid: false, error: `Invalid quality_score for non-produce: ${quality_score} (must be 0 or 1-10)` };
    }
    
    console.log('✅ Non-produce item validated with 0 scores:', { item_name, freshness_score, quality_score });
  } else {
    // For produce items, require 1-10 scores
    if (typeof freshness_score !== 'number' || freshness_score < 1 || freshness_score > 10) {
      return { isValid: false, error: `Invalid freshness_score for produce: ${freshness_score} (must be 1-10)` };
    }
    
    if (typeof quality_score !== 'number' || quality_score < 1 || quality_score > 10) {
      return { isValid: false, error: `Invalid quality_score for produce: ${quality_score} (must be 1-10)` };
    }
    
    console.log('✅ Produce item validated with valid scores:', { item_name, freshness_score, quality_score });
  }

  return { isValid: true };
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

    // Update analysis status to 'processing'
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
      } else {
        console.log('✅ Status updated to processing');
      }
    } catch (statusError) {
      console.error('❌ Status update error:', statusError);
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

    // Validate image format and size
    const validation = validateImage(imageData);
    if (!validation.isValid) {
      console.error('❌ Image validation failed:', validation.error);
      await supabase
        .from('packing_photos')
        .update({ 
          ai_analysis_status: 'failed',
          description: `Image validation failed: ${validation.error}`
        })
        .eq('id', packing_photo_id);

      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Convert to base64 using memory-safe approach
    let base64Image: string;
    try {
      const arrayBuffer = await imageData.arrayBuffer();
      base64Image = await convertToBase64Safe(arrayBuffer);
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

    console.log('🤖 Starting OpenAI analysis with detailed debugging');
    console.log('📊 Image details being sent to OpenAI:', {
      mimeType: imageData.type,
      size: imageData.size,
      sizeInMB: Math.round(imageData.size / 1024 / 1024 * 100) / 100,
      base64Length: base64Image.length,
      base64Sample: base64Image.substring(0, 50) + '...'
    });

    // Call OpenAI with timeout and retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    try {
      const requestPayload = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a produce quality expert for Zepto grocery delivery. Analyze this image and provide your response in PURE JSON format only - no markdown, no code blocks, no extra text.

Respond with this EXACT JSON structure:
{
  "item_name": "exact produce name or 'not produce'",
  "freshness_score": number,
  "quality_score": number,
  "description": "brief condition description"
}

Requirements:
- If this is produce (fruits/vegetables): scores must be integers 1-10
- If NOT produce: set item_name to "not produce" and scores to 0
- Be strict with quality standards for grocery delivery
- Return ONLY the JSON object, nothing else`
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
      };

      console.log('📤 Sending request to OpenAI with payload size:', JSON.stringify(requestPayload).length);

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(requestPayload)
      });

      clearTimeout(timeoutId);

      console.log('📥 OpenAI response received:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        headers: Object.fromEntries(openaiResponse.headers.entries())
      });

      if (!openaiResponse.ok) {
        let errorDetails;
        try {
          errorDetails = await openaiResponse.json();
          console.error('❌ OpenAI API error response:', errorDetails);
        } catch {
          errorDetails = await openaiResponse.text();
          console.error('❌ OpenAI API error text:', errorDetails);
        }
        
        const errorMessage = `OpenAI API ${openaiResponse.status}: ${
          typeof errorDetails === 'object' 
            ? errorDetails.error?.message || JSON.stringify(errorDetails)
            : errorDetails
        }`;
        
        throw new Error(errorMessage);
      }

      const aiResult = await openaiResponse.json();
      let analysisData;

      try {
        const content = aiResult.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('No analysis content received from OpenAI');
        }

        // Use smart JSON extraction to handle markdown-wrapped responses
        analysisData = extractJsonFromResponse(content);
        console.log('✅ Successfully extracted JSON:', analysisData);

      } catch (parseError) {
        console.error('❌ AI response parsing failed:', parseError.message);
        throw new Error(`Invalid AI response format: ${parseError.message}`);
      }

      // Validate analysis data structure with enhanced non-produce handling
      const structureValidation = validateAnalysisResponse(analysisData);
      if (!structureValidation.isValid) {
        throw new Error(`Analysis validation failed: ${structureValidation.error}`);
      }

      const { item_name, freshness_score, quality_score, description } = analysisData;

      console.log('✅ Analysis completed successfully:', {
        itemName: item_name,
        freshnessScore: freshness_score,
        qualityScore: quality_score,
        isNonProduce: freshness_score === 0 && quality_score === 0
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
