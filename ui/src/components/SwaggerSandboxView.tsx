import React from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

interface SwaggerSandboxViewProps {
  specUrl: string;
}

export const SwaggerSandboxView: React.FC<SwaggerSandboxViewProps> = ({ specUrl }) => {
  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <SwaggerUI
          url={specUrl}
          docExpansion="list"
          filter={true}
          persistAuthorization={true}
          displayRequestDuration={true}
        />
      </div>
    </main>
  );
};
