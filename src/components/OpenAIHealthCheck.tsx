
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface HealthTest {
  test: string;
  status: 'PASS' | 'FAIL';
  response_time_ms?: number;
  error?: string;
  response?: string;
  models_count?: number;
}

interface HealthStatus {
  timestamp: string;
  openai_api_key_configured: boolean;
  openai_api_key_length: number;
  tests: HealthTest[];
}

const OpenAIHealthCheck = () => {
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      console.log('Running OpenAI health check...');
      
      const { data, error } = await supabase.functions.invoke('openai-health-check');
      
      if (error) {
        throw new Error(`Health check failed: ${error.message}`);
      }

      setHealthStatus(data);
      
      const allPassed = data.tests.every((test: HealthTest) => test.status === 'PASS');
      
      toast({
        title: allPassed ? "Health Check Passed" : "Health Check Issues Found",
        description: allPassed 
          ? "OpenAI API is working correctly" 
          : "Some tests failed - check the results below",
        variant: allPassed ? "default" : "destructive",
      });

    } catch (error: any) {
      console.error('Health check error:', error);
      toast({
        title: "Health Check Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAIL':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'PASS' ? 'default' : 'destructive';
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          OpenAI API Health Check
          <Button 
            onClick={runHealthCheck} 
            disabled={isChecking}
            className="ml-auto"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Run Health Check'
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {healthStatus && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">API Key Configured</p>
                <p className={`text-lg ${healthStatus.openai_api_key_configured ? 'text-green-600' : 'text-red-600'}`}>
                  {healthStatus.openai_api_key_configured ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Key Length</p>
                <p className="text-lg">{healthStatus.openai_api_key_length} chars</p>
              </div>
              <div>
                <p className="text-sm font-medium">Timestamp</p>
                <p className="text-sm text-gray-600">
                  {new Date(healthStatus.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Test Results</h3>
              {healthStatus.tests.map((test, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{test.test}</h4>
                    {getStatusBadge(test.status)}
                  </div>
                  
                  {test.response_time_ms && (
                    <p className="text-sm text-gray-600 mb-1">
                      Response time: {test.response_time_ms}ms
                    </p>
                  )}
                  
                  {test.models_count && (
                    <p className="text-sm text-gray-600 mb-1">
                      Available models: {test.models_count}
                    </p>
                  )}
                  
                  {test.response && (
                    <p className="text-sm text-gray-600 mb-1">
                      Response: "{test.response}"
                    </p>
                  )}
                  
                  {test.error && (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      Error: {test.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        
        {!healthStatus && !isChecking && (
          <div className="text-center text-gray-500 py-8">
            Click "Run Health Check" to test OpenAI API connectivity
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OpenAIHealthCheck;
