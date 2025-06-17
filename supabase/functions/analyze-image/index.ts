
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Parse request body
    const { packing_photo_id, fast_mode = false } = await req.json()
    
    if (!packing_photo_id) {
      throw new Error('Missing packing_photo_id')
    }

    console.log(`Starting analysis for photo: ${packing_photo_id}`)

    // Get photo data
    const { data: photo, error: fetchError } = await supabase
      .from('packing_photos')
      .select('*')
      .eq('id', packing_photo_id)
      .single()

    if (fetchError || !photo) {
      throw new Error(`Photo not found: ${fetchError?.message}`)
    }

    // Update status to pending
    await supabase
      .from('packing_photos')
      .update({ ai_analysis_status: 'pending' })
      .eq('id', packing_photo_id)

    // Get the image from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('packing-photos')
      .download(photo.storage_path)

    if (downloadError || !imageData) {
      throw new Error(`Failed to download image: ${downloadError?.message}`)
    }

    // Convert to base64
    const arrayBuffer = await imageData.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Prepare OpenAI request with improved prompt
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
                url: `data:image/webp;base64,${base64Image}`,
                detail: fast_mode ? "low" : "high"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    }

    console.log('Calling OpenAI API...')
    
    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(openaiPayload)
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText}`)
    }

    const openaiResult = await openaiResponse.json()
    console.log('OpenAI response received')

    // Parse the response
    let analysisResult
    try {
      const content = openaiResult.choices[0].message.content
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError)
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

    console.log('Sanitized analysis result:', sanitizedResult)

    // Save results to database with improved error handling
    try {
      const { error: updateError } = await supabase
        .from('packing_photos')
        .update({
          item_name: sanitizedResult.item_name,
          freshness_score: sanitizedResult.freshness_score,
          quality_score: sanitizedResult.quality_score,
          description: sanitizedResult.description,
          ai_analysis_status: 'completed'
        })
        .eq('id', packing_photo_id)

      if (updateError) {
        console.error('Database update error:', updateError)
        
        // Handle specific constraint violations gracefully
        if (updateError.code === '23514') { // Check constraint violation
          console.log('Constraint violation detected, attempting fallback save...')
          
          // Fallback: Save with minimal data to prevent total failure
          const { error: fallbackError } = await supabase
            .from('packing_photos')
            .update({
              item_name: 'Analysis Error',
              freshness_score: null,
              quality_score: null,
              description: `Analysis completed but failed to save: ${updateError.message}`,
              ai_analysis_status: 'completed'
            })
            .eq('id', packing_photo_id)
          
          if (fallbackError) {
            throw new Error(`Failed to save analysis results: ${fallbackError.message}`)
          }
          
          console.log('Fallback save successful')
        } else {
          throw new Error(`Failed to save analysis results: ${updateError.message}`)
        }
      } else {
        console.log('Analysis results saved successfully')
      }

    } catch (dbError) {
      console.error('Database operation failed:', dbError)
      
      // Mark as failed if we can't save
      await supabase
        .from('packing_photos')
        .update({ ai_analysis_status: 'failed' })
        .eq('id', packing_photo_id)
      
      throw new Error(`Failed to save analysis results`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: sanitizedResult,
        message: 'Analysis completed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('Analysis function error:', error)
    
    // Try to mark the photo as failed if we have the ID
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const body = await req.json().catch(() => ({}))
      if (body.packing_photo_id) {
        await supabase
          .from('packing_photos')
          .update({ ai_analysis_status: 'failed' })
          .eq('id', body.packing_photo_id)
      }
    } catch (cleanup_error) {
      console.error('Failed to update status to failed:', cleanup_error)
    }

    return new Response(
      JSON.stringify({ 
        error: error.message || 'Analysis failed',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
