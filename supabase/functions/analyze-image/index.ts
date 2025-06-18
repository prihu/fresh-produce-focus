
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Global Supabase client instance for reuse
let supabaseClient: any = null;

const getSupabaseClient = () => {
  if (!supabaseClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
  }
  return supabaseClient;
}

// Simplified and more reliable base64 conversion
const convertBlobToBase64 = async (blob: Blob): Promise<string> => {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    
    // Process in chunks to avoid memory issues with very large images
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  } catch (error) {
    console.error('Base64 conversion error:', error);
    throw new Error(`Failed to convert image to base64: ${error.message}`);
  }
}

// Helper function for exponential backoff retry
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries - 1) break;
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const correlationId = crypto.randomUUID();
  let requestBody: any = null;
  let packing_photo_id: string | null = null;

  try {
    console.log(`[${correlationId}] Starting analysis request`);
    
    // Initialize Supabase client (reuse existing instance)
    const supabase = getSupabaseClient();

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Parse request body ONCE and store it
    console.log(`[${correlationId}] Parsing request body...`)
    try {
      requestBody = await req.json()
    } catch (parseError) {
      throw new Error(`Invalid JSON in request body: ${parseError.message}`)
    }
    
    const { fast_mode = false } = requestBody
    packing_photo_id = requestBody.packing_photo_id
    
    if (!packing_photo_id) {
      throw new Error('Missing packing_photo_id')
    }

    console.log(`[${correlationId}] Starting analysis for photo: ${packing_photo_id}`)

    // Get photo data with retry
    console.log(`[${correlationId}] Fetching photo data from database...`)
    const photo = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('packing_photos')
        .select('*')
        .eq('id', packing_photo_id)
        .single()

      if (error || !data) {
        throw new Error(`Photo not found: ${error?.message || 'No data returned'}`)
      }
      return data;
    });

    console.log(`[${correlationId}] Photo found, updating status to pending...`)
    
    // Update status to pending with retry
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('packing_photos')
        .update({ ai_analysis_status: 'pending' })
        .eq('id', packing_photo_id)
      
      if (error) throw error;
    });

    // Get the image from storage with retry
    console.log(`[${correlationId}] Downloading image from storage: ${photo.storage_path}`)
    const imageData = await retryWithBackoff(async () => {
      const { data, error } = await supabase.storage
        .from('packing-photos')
        .download(photo.storage_path)

      if (error || !data) {
        throw new Error(`Failed to download image: ${error?.message || 'No data returned'}`)
      }
      return data;
    });

    // Validate image before processing
    if (imageData.size === 0) {
      throw new Error('Downloaded image is empty');
    }

    if (imageData.size > 20 * 1024 * 1024) { // 20MB OpenAI limit
      throw new Error('Image too large for analysis (>20MB)');
    }

    console.log(`[${correlationId}] Image downloaded successfully (${Math.round(imageData.size / 1024)}KB), converting to base64...`)
    
    // Convert to base64 using simplified approach
    let base64Image: string;
    try {
      base64Image = await convertBlobToBase64(imageData);
      console.log(`[${correlationId}] Base64 conversion successful, length: ${base64Image.length}`);
    } catch (conversionError) {
      throw new Error(`Failed to convert image to base64: ${conversionError.message}`);
    }

    // Prepare OpenAI request with improved prompt and JPEG format specification
    const openaiPayload = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image for produce/food quality assessment. I need you to:

1. IDENTIFY what item this is (be specific - e.g., "Red Apple", "Banana", "Lettuce", etc.)
2. DETERMINE if this is actually a produce/food item
3. If it IS produce/food, rate FRESHNESS (1-10, where 10=just harvested, 1=spoiled)
4. If it IS produce/food, rate QUALITY (1-10, where 10=premium quality, 1=poor/damaged)
5. Provide a brief DESCRIPTION of what you observe

IMPORTANT RULES:
- If this is NOT a produce/food item, set both scores to 0 and clearly indicate it's not produce
- If unclear or can't identify as food, set scores to 0
- Only give scores 1-10 for actual produce/food items
- Be strict about what qualifies as produce/food vs other objects

Respond in this EXACT JSON format:
{
  "item_name": "specific item name or 'Not Produce'",
  "freshness_score": number (0 if not produce, 1-10 if produce),
  "quality_score": number (0 if not produce, 1-10 if produce),
  "description": "detailed description of what you see and your assessment"
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: fast_mode ? "low" : "high"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    }

    console.log(`[${correlationId}] Calling OpenAI API with JPEG format...`)
    
    // Call OpenAI API with timeout and retry
    const openaiResult = await retryWithBackoff(async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
      
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(openaiPayload),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
        }

        return await response.json()
      } catch (fetchError) {
        clearTimeout(timeoutId)
        throw fetchError;
      }
    }, 2, 2000); // 2 retries with 2s base delay

    console.log(`[${correlationId}] OpenAI response received successfully`)

    // Parse the response
    let analysisResult
    try {
      const content = openaiResult.choices[0].message.content
      console.log(`[${correlationId}] OpenAI raw response:`, content)
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error(`[${correlationId}] Failed to parse OpenAI response:`, parseError)
      throw new Error(`Failed to parse AI response: ${parseError.message}`)
    }

    // Validate and sanitize the analysis result
    const sanitizedResult = {
      item_name: analysisResult.item_name || 'Unidentified',
      freshness_score: Math.max(0, Math.min(10, Number(analysisResult.freshness_score) || 0)),
      quality_score: Math.max(0, Math.min(10, Number(analysisResult.quality_score) || 0)),
      description: analysisResult.description || 'Analysis completed'
    }

    // Determine if this is produce based on multiple factors
    const isProduceItem = sanitizedResult.item_name && 
      !sanitizedResult.item_name.toLowerCase().includes('not produce') &&
      !sanitizedResult.item_name.toLowerCase().includes('not food') &&
      !sanitizedResult.item_name.toLowerCase().includes('unidentified') &&
      !sanitizedResult.item_name.toLowerCase().includes('unclear') &&
      sanitizedResult.freshness_score > 0 && 
      sanitizedResult.quality_score > 0

    // If not produce, ensure scores are 0 and update item name
    if (!isProduceItem) {
      sanitizedResult.freshness_score = 0
      sanitizedResult.quality_score = 0
      if (sanitizedResult.item_name === 'Unidentified' || 
          !sanitizedResult.item_name.toLowerCase().includes('not')) {
        sanitizedResult.item_name = 'Not Produce'
      }
    }

    console.log(`[${correlationId}] Sanitized analysis result:`, sanitizedResult)

    // Save results to database with retry
    console.log(`[${correlationId}] Saving analysis results to database...`)
    await retryWithBackoff(async () => {
      const { error } = await supabase
        .from('packing_photos')
        .update({
          item_name: sanitizedResult.item_name,
          freshness_score: sanitizedResult.freshness_score,
          quality_score: sanitizedResult.quality_score,
          description: sanitizedResult.description,
          ai_analysis_status: 'completed'
        })
        .eq('id', packing_photo_id)

      if (error) {
        throw new Error(`Failed to save analysis results: ${error.message}`)
      }
    });

    console.log(`[${correlationId}] Analysis results saved successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: sanitizedResult,
        message: 'Analysis completed successfully',
        correlation_id: correlationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error(`[${correlationId}] Analysis function error:`, error)
    
    // Try to mark the photo as failed if we have the ID
    if (packing_photo_id) {
      try {
        const supabase = getSupabaseClient();
        
        await supabase
          .from('packing_photos')
          .update({ ai_analysis_status: 'failed' })
          .eq('id', packing_photo_id)
        
        console.log(`[${correlationId}] Updated photo status to failed`)
      } catch (cleanup_error) {
        console.error(`[${correlationId}] Failed to update status to failed:`, cleanup_error)
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error.message || 'Analysis failed',
        success: false,
        correlation_id: correlationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
