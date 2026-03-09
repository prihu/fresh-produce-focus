
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

      return new Response(
        JSON.stringify(healthStatus),
        { 
          status: 500,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Test 1: Simple models list endpoint
    try {
      console.log('Testing OpenAI models endpoint...');
      const modelsResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const modelsData = await modelsResponse.json();

      if (modelsResponse.ok) {
        healthStatus.tests.push({
          test: 'Models Endpoint',
          status: 'PASS',
          response_time_ms: 'N/A',
          models_count: modelsData.data?.length || 0
        });
      } else {
        healthStatus.tests.push({
          test: 'Models Endpoint',
          status: 'FAIL',
          error: `HTTP ${modelsResponse.status}: ${modelsData.error?.message || 'Unknown error'}`
        });
      }
    } catch (error) {
      healthStatus.tests.push({
        test: 'Models Endpoint',
        status: 'FAIL',
        error: `Network error: ${(error as Error).message}`
      });
    }

    // Test 2: Simple chat completion
    try {
      console.log('Testing OpenAI chat completion...');
      const startTime = Date.now();
      
      const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: 'Say "API is working" (this is a health check)' }
          ],
          max_tokens: 10
        }),
      });

      const endTime = Date.now();
      const chatData = await chatResponse.json();

      if (chatResponse.ok) {
        healthStatus.tests.push({
          test: 'Chat Completion',
          status: 'PASS',
          response_time_ms: endTime - startTime,
          response: chatData.choices?.[0]?.message?.content || 'No content'
        });
      } else {
        healthStatus.tests.push({
          test: 'Chat Completion',
          status: 'FAIL',
          error: `HTTP ${chatResponse.status}: ${chatData.error?.message || 'Unknown error'}`
        });
      }
    } catch (error: any) {
      healthStatus.tests.push({
        test: 'Chat Completion',
        status: 'FAIL',
        error: `Network error: ${error.message}`
      });
    }

    // Test 3: Vision endpoint (similar to what analyze-image uses)
    try {
      console.log('Testing OpenAI vision endpoint...');
      const startTime = Date.now();
      
      // Use a simple test image URL (1x1 pixel)
      const testImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What do you see in this image? (health check)'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: testImageUrl,
                    detail: 'low'
                  }
                }
              ]
            }
          ],
          max_tokens: 50
        }),
      });

      const endTime = Date.now();
      const visionData = await visionResponse.json();

      if (visionResponse.ok) {
        healthStatus.tests.push({
          test: 'Vision Endpoint',
          status: 'PASS',
          response_time_ms: endTime - startTime,
          response: visionData.choices?.[0]?.message?.content || 'No content'
        });
      } else {
        healthStatus.tests.push({
          test: 'Vision Endpoint',
          status: 'FAIL',
          error: `HTTP ${visionResponse.status}: ${visionData.error?.message || 'Unknown error'}`
        });
      }
    } catch (error) {
      healthStatus.tests.push({
        test: 'Vision Endpoint',
        status: 'FAIL',
        error: `Network error: ${(error as Error).message}`
      });
    }

    const allTestsPassed = healthStatus.tests.every(test => test.status === 'PASS');
    const statusCode = allTestsPassed ? 200 : 500;

    console.log('Health check completed:', healthStatus);

    return new Response(
      JSON.stringify(healthStatus),
      { 
        status: statusCode,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Health check function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
        details: 'Health check function failed'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
