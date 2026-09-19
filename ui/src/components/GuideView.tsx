import React, { useEffect, useRef } from 'react';

interface GuideViewProps {
  specUrl: string;
  title?: string;
}

export const GuideView: React.FC<GuideViewProps> = ({ specUrl, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scriptId = 'scalar-api-reference-cdn';

    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    // Create configuration script tag for Scalar
    const configScript = document.createElement('script');
    configScript.id = 'api-reference';
    configScript.type = 'application/json';
    configScript.setAttribute('data-url', specUrl);
    configScript.setAttribute(
      'data-configuration',
      JSON.stringify({
        theme: 'default',
        darkMode: false,
        forceDarkModeState: 'light',
        layout: 'modern',
        showSidebar: true,
        searchHotKey: 'k',
        hideDownloadButton: false,
        defaultHttpClient: {
          targetKey: 'shell',
          clientKey: 'curl',
        },
        hiddenClients: [],
        spec: {
          url: specUrl,
        },
        authentication: {
          preferredSecurityScheme: 'BearerAuth',
        },
        metaData: {
          title: title || 'API Reference & Developer Guide',
          description: 'Interactive REST API documentation and developer guides.',
        },
      })
    );
    containerRef.current.appendChild(configScript);

    // Remove any previously cached instance of scalar script to guarantee fresh mount
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Clean up script on unmount
      const s = document.getElementById(scriptId);
      if (s) s.remove();
    };
  }, [specUrl, title]);

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-white text-slate-900">
      <div ref={containerRef} id="scalar-wrapper" className="w-full min-h-screen" />
    </div>
  );
};
