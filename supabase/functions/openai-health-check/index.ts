import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Check admin role
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

    console.log('🏥 Health check requested by admin:', userId);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const healthStatus: {
      timestamp: string;
      openai_api_key_configured: boolean;
      openai_api_key_length: number;
      tests: Array<Record<string, any>>;
    } = {
      timestamp: new Date().toISOString(),
      openai_api_key_configured: !!openAIApiKey,
      openai_api_key_length: openAIApiKey ? openAIApiKey.length : 0,
      tests: []
    };

    if (!openAIApiKey) {
      healthStatus.tests.push({
        test: 'API Key Check',
        status: 'FAIL',
        error: 'OPENAI_API_KEY environment variable not set'
      });
      return new Response(JSON.stringify(healthStatus), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Test 1: Models endpoint
    try {
      const modelsResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
      });
      const modelsData = await modelsResponse.json();
      healthStatus.tests.push(modelsResponse.ok 
        ? { test: 'Models Endpoint', status: 'PASS', models_count: modelsData.data?.length || 0 }
        : { test: 'Models Endpoint', status: 'FAIL', error: `HTTP ${modelsResponse.status}: ${modelsData.error?.message || 'Unknown'}` }
      );
    } catch (error) {
      healthStatus.tests.push({ test: 'Models Endpoint', status: 'FAIL', error: `Network error: ${(error as Error).message}` });
    }

    const model = Deno.env.get('OPENAI_MODEL_LIGHTWEIGHT') || 'gpt-4o-mini';

    // Test 2: Chat completion
    try {
      const startTime = Date.now();
      const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say "API is working" (health check)' }],
          max_tokens: 10
        }),
      });
      const chatData = await chatResponse.json();
      healthStatus.tests.push(chatResponse.ok
        ? { test: 'Chat Completion', status: 'PASS', response_time_ms: Date.now() - startTime, response: chatData.choices?.[0]?.message?.content || 'No content' }
        : { test: 'Chat Completion', status: 'FAIL', error: `HTTP ${chatResponse.status}: ${chatData.error?.message || 'Unknown'}` }
      );
    } catch (error: any) {
      healthStatus.tests.push({ test: 'Chat Completion', status: 'FAIL', error: `Network error: ${error.message}` });
    }

    // Test 3: Vision endpoint
    try {
      const startTime = Date.now();
      const testImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'What do you see? (health check)' },
              { type: 'image_url', image_url: { url: testImageUrl, detail: 'low' } }
            ]
          }],
          max_tokens: 50
        }),
      });
      const visionData = await visionResponse.json();
      healthStatus.tests.push(visionResponse.ok
        ? { test: 'Vision Endpoint', status: 'PASS', response_time_ms: Date.now() - startTime, response: visionData.choices?.[0]?.message?.content || 'No content' }
        : { test: 'Vision Endpoint', status: 'FAIL', error: `HTTP ${visionResponse.status}: ${visionData.error?.message || 'Unknown'}` }
      );
    } catch (error) {
      healthStatus.tests.push({ test: 'Vision Endpoint', status: 'FAIL', error: `Network error: ${(error as Error).message}` });
    }

    const allTestsPassed = healthStatus.tests.every(test => test.status === 'PASS');
    return new Response(JSON.stringify(healthStatus), { 
      status: allTestsPassed ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Health check function error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
