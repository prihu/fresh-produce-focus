import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TestOpenAI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

  const runConnectivityTest = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-openai-connectivity');
      
      if (error) {
        throw error;
      }

      setTestResult(data);
      
      if (data.status === 'success') {
        toast({
          title: "OpenAI Connectivity Test Passed",
          description: "Both text and image APIs are working correctly.",
        });
      } else if (data.status === 'partial') {
        toast({
          title: "Partial OpenAI Connectivity",
          description: "Text API works but image API has issues.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "OpenAI Connectivity Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Test failed:', error);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to run connectivity test",
        variant: "destructive",
      });
      setTestResult({
        status: 'error',
        message: error.message || "Unknown error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'partial':
        return <Badge variant="secondary">Partial</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 OpenAI Connectivity Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runConnectivityTest} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Testing...' : 'Run Connectivity Test'}
        </Button>

        {testResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">Status:</span>
              {getStatusBadge(testResult.status)}
            </div>

            <div>
              <span className="font-medium">Message:</span>
              <p className="text-sm text-muted-foreground mt-1">{testResult.message}</p>
            </div>

            {testResult.text_api_working !== undefined && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Text API:</span>
                  <Badge variant={testResult.text_api_working ? "default" : "destructive"}>
                    {testResult.text_api_working ? "Working" : "Failed"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Image API:</span>
                  <Badge variant={testResult.image_api_working ? "default" : "destructive"}>
                    {testResult.image_api_working ? "Working" : "Failed"}
                  </Badge>
                </div>
              </div>
            )}

            {testResult.test_responses && (
              <div>
                <span className="font-medium">Test Response:</span>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(testResult.test_responses, null, 2)}
                </pre>
              </div>
            )}

            {testResult.error_type && (
              <div>
                <span className="font-medium">Error Type:</span>
                <Badge variant="outline" className="ml-2">{testResult.error_type}</Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestOpenAI;