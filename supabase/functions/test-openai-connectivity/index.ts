import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testing OpenAI connectivity');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: 'OpenAI API key not configured' 
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    // Test with a simple text request first
    const textResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'Respond with just the word "test"' }
        ],
        max_tokens: 10
      })
    });

    console.log('📄 Text API test response:', {
      status: textResponse.status,
      statusText: textResponse.statusText,
    });

    if (!textResponse.ok) {
      const errorDetails = await textResponse.text();
      console.error('❌ Text API failed:', errorDetails);
      return new Response(
        JSON.stringify({ 
          status: 'error',
          message: `Text API failed: ${textResponse.status} - ${errorDetails}`,
          test_type: 'text_only'
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Test with a sample image (small base64 encoded 1x1 pixel JPEG)
    const sampleImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==';

    const imageResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe this image in one word.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${sampleImageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 20
      })
    });

    console.log('🖼️ Image API test response:', {
      status: imageResponse.status,
      statusText: imageResponse.statusText,
    });

    if (!imageResponse.ok) {
      const errorDetails = await imageResponse.text();
      console.error('❌ Image API failed:', errorDetails);
      return new Response(
        JSON.stringify({ 
          status: 'partial',
          message: `Image API failed: ${imageResponse.status} - ${errorDetails}`,
          text_api_working: true,
          image_api_working: false,
          test_type: 'image_vision'
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const imageResult = await imageResponse.json();
    console.log('✅ Both text and image APIs working');

    return new Response(
      JSON.stringify({ 
        status: 'success',
        message: 'OpenAI API connectivity confirmed',
        text_api_working: true,
        image_api_working: true,
        test_responses: {
          image_description: imageResult.choices?.[0]?.message?.content
        }
      }),
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('❌ Connectivity test failed:', error.message);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: `Connectivity test failed: ${error.message}`,
        error_type: 'network_or_config'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});