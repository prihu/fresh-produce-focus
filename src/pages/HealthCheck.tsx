
import OpenAIHealthCheck from '@/components/OpenAIHealthCheck';

const HealthCheck = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">API Health Check</h1>
          <p className="text-gray-600">
            Test OpenAI API connectivity and diagnose integration issues
          </p>
        </div>
        
        <div className="flex justify-center">
          <OpenAIHealthCheck />
        </div>
      </div>
    </div>
  );
};

export default HealthCheck;
