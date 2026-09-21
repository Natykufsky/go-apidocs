import React, { useState } from 'react';
import {
  Code2,
  Copy,
  CheckCircle2,
  Terminal,
  Globe,
  Layers,
  X,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { StoredCredentials } from './CredentialManagerModal';

interface CodeSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpointKey: string;
  credentials: StoredCredentials;
  specBaseUrl?: string;
}

type LangType = 'curl' | 'go' | 'node' | 'python';

export const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({
  isOpen,
  onClose,
  endpointKey,
  credentials,
  specBaseUrl = 'http://localhost:8080',
}) => {
  const [selectedLang, setSelectedLang] = useState<LangType>('curl');
  const [environment, setEnvironment] = useState<'local' | 'staging' | 'prod'>('local');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !endpointKey) return null;

  const parts = endpointKey.split(' ');
  const method = (parts[0] || 'GET').toUpperCase();
  const path = parts.slice(1).join(' ') || endpointKey;

  const getBaseUrl = () => {
    switch (environment) {
      case 'staging':
        return 'https://staging-api.example.com';
      case 'prod':
        return 'https://api.example.com';
      default:
        return specBaseUrl || 'http://localhost:8080';
    }
  };

  const fullUrl = `${getBaseUrl()}${path.startsWith('/') ? path : '/' + path}`;

  // Build Headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (credentials.accessToken) {
    headers['Authorization'] = `Bearer ${credentials.accessToken}`;
  }
  if (credentials.tenantId) {
    headers['X-Tenant-ID'] = credentials.tenantId;
  }
  if (credentials.entityId) {
    headers['X-Entity-ID'] = credentials.entityId;
  }
  if (credentials.refreshToken) {
    headers['X-Refresh-Token'] = credentials.refreshToken;
  }
  if (credentials.customHeaders) {
    Object.entries(credentials.customHeaders).forEach(([k, v]) => {
      if (k && v) headers[k] = v;
    });
  }

  // Generate Snippets
  const generateSnippet = (lang: LangType): string => {
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
    const sampleBody = hasBody ? '{\n  "key": "value"\n}' : '';

    switch (lang) {
      case 'curl': {
        const headerLines = Object.entries(headers)
          .map(([k, v]) => `  -H "${k}: ${v}" \\`)
          .join('\n');
        const bodyLine = hasBody ? `\n  -d '${sampleBody.replace(/\n/g, '')}' \\` : '';
        return `curl -X ${method} "${fullUrl}" \\\n${headerLines}${bodyLine}`;
      }

      case 'go': {
        const headerCode = Object.entries(headers)
          .map(([k, v]) => `\treq.Header.Set("${k}", "${v}")`)
          .join('\n');

        return `package main

import (
\t"fmt"
\t"io"
\t"net/http"
${hasBody ? '\t"strings"\n' : ''})

func main() {
\turl := "${fullUrl}"
${hasBody ? `\tbody := strings.NewReader(\`${sampleBody}\`)\n\treq, err := http.NewRequest("${method}", url, body)\n` : `\treq, err := http.NewRequest("${method}", url, nil)\n`}
\tif err != nil {
\t\tpanic(err)
\t}

${headerCode}

\tclient := &http.Client{}
\tres, err := client.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()

\tout, _ := io.ReadAll(res.Body)
\tfmt.Println(res.Status, string(out))
}`;
      }

      case 'node': {
        const headerObj = JSON.stringify(headers, null, 4);
        return `const fetch = require('node-fetch');

async function testEndpoint() {
  const url = '${fullUrl}';
  const response = await fetch(url, {
    method: '${method}',
    headers: ${headerObj},
${hasBody ? `    body: JSON.stringify(${sampleBody}),\n` : ''}  });

  const data = await response.json();
  console.log(response.status, data);
}

testEndpoint();`;
      }

      case 'python': {
        const headerDict = JSON.stringify(headers, null, 4);
        return `import requests

url = "${fullUrl}"
headers = ${headerDict}

${hasBody ? `payload = ${sampleBody}\nresponse = requests.${method.toLowerCase()}(url, headers=headers, json=payload)\n` : `response = requests.${method.toLowerCase()}(url, headers=headers)\n`}
print(response.status_code)
print(response.json())`;
      }
    }
  };

  const currentSnippet = generateSnippet(selectedLang);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-600/20">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Developer Code Snippet Generator</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Production-ready cURL, Go, Node.js, and Python code with pre-filled tokens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Environment & Target Endpoint Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              {method}
            </span>
            <span className="font-mono text-xs font-bold text-slate-800 break-all">{path}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1 border border-slate-200 text-xs">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-600 text-[11px]">Env:</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
            >
              <option value="local">Localhost (Dev)</option>
              <option value="staging">Staging</option>
              <option value="prod">Production</option>
            </select>
          </div>
        </div>

        {/* Language Tabs & Copy Button */}
        <div className="px-6 pt-3 bg-slate-900 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            {(['curl', 'go', 'node', 'python'] as LangType[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedLang(lang)}
                className={`px-3 py-1.5 rounded-t-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedLang === lang
                    ? 'bg-slate-800 text-emerald-400 border-t border-x border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'node' ? 'Node.js' : lang}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="mb-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Snippet</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content Box */}
        <div className="p-6 bg-slate-950 flex-1 overflow-auto">
          <pre className="text-xs font-mono text-emerald-200 leading-relaxed whitespace-pre-wrap selection:bg-emerald-500 selection:text-white">
            {currentSnippet}
          </pre>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pre-populated with active access token & tenant credentials</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
