import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard: require valid JWT + admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = claimsData.claims.sub;

    // Check admin role using service role client
    const supabaseService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roles } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('🧪 Testing OpenAI connectivity (admin:', userId, ')');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'OpenAI API key not configured' }),
        { status: 503, headers: corsHeaders }
      );
    }

    const model = Deno.env.get('OPENAI_MODEL_PRIMARY') || 'gpt-4o';

    // Test with a simple text request first
    const textResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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

    // Test with a sample image
    const sampleImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==';

    const imageResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image in one word.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${sampleImageBase64}` } }
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
