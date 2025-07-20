import { useAppStore } from './store/appStore';
import { DynamicRenderer } from './components/DynamicRenderer';
import { SimpleSearchBar } from './components/ui/SimpleSearchBar';
import { logger } from './services/logger';
import './App.css';
import './loggingTest';
import { useCallback, useEffect } from 'react';
import type { UIComponent } from './types';

function App() {
  // Initialize logger only once when component mounts
  useEffect(() => {
    logger.setDebugMode(true);
    logger.info('App', 'SelfGenUI application starting');
  }, []);

  const components = useAppStore(state => state.currentComponents);
  const isGenerating = useAppStore(state => state.isGenerating);
  const generateUI = useAppStore(state => state.generateUI);
  const handleComponentUpdate = useAppStore(state => state.updateComponent);

  const handleComponentInteraction = useCallback((componentId: string, action: string, data?: unknown) => {
    console.log(`Component ${componentId} interacted: ${action}`, data);
  }, []);

  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    logger.info('App', 'Starting UI generation', { query });
    generateUI(query);
  }, [generateUI]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <Header />
        <MainContent 
          handleSearch={handleSearch}
          isGenerating={isGenerating}
          components={components}
          handleComponentUpdate={handleComponentUpdate}
          handleComponentInteraction={handleComponentInteraction}
        />
        <Footer />
      </div>
    </div>
  );
}

const Header = () => (
  <div className="text-center mb-12">
    <div className="inline-block p-3 mb-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
    <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent mb-4">
      SelfGenUI
    </h1>
    <p className="text-xl text-gray-600 mb-6 font-medium">AI-Powered Dynamic UI Generator</p>
    <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
      Start with a simple search and watch as AI generates interactive UI components on the fly. 
      Built with React, TypeScript, and LangChain for seamless development.
    </p>
  </div>
);

const MainContent = ({ 
  handleSearch, 
  isGenerating, 
  components, 
  handleComponentUpdate, 
  handleComponentInteraction 
}: {
  handleSearch: (query: string) => void;
  isGenerating: boolean;
  components: UIComponent[];
  handleComponentUpdate: (componentId: string, updates: Partial<UIComponent>) => void;
  handleComponentInteraction: (componentId: string, action: string, data?: unknown) => void;
}) => (
  <>
    <div className="max-w-4xl mx-auto mb-12">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
        <SimpleSearchBar 
          onSearch={handleSearch}
          isLoading={isGenerating}
          placeholder="Describe the UI you want to create..."
        />
        {isGenerating && (
          <div className="mt-6 flex items-center justify-center text-blue-600">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-3"></div>
            <span className="text-sm font-medium">Generating your UI...</span>
          </div>
        )}
      </div>
    </div>
    <div className="max-w-7xl mx-auto">
      {components.length > 0 ? (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
            <svg className="w-6 h-6 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Generated Components ({components.length})
          </h2>
          <DynamicRenderer
            components={components}
            onComponentUpdate={handleComponentUpdate}
            onComponentInteraction={handleComponentInteraction}
          />
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="inline-block p-4 mb-6 rounded-full bg-gray-100">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-600 mb-2">Ready to build something amazing?</h3>
          <p className="text-gray-500">Use the search bar above to describe the UI components you'd like to generate.</p>
        </div>
      )}
    </div>
  </>
);

const Footer = () => (
  <footer className="text-center text-gray-500 text-sm mt-20 pt-12 border-t border-gray-200/60">
    <div className="flex items-center justify-center space-x-6 mb-4">
      <a 
        href="https://js.langchain.com/" 
        className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors duration-200" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        <span className="text-sm font-medium">LangChain</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
      <span className="text-gray-300">•</span>
      <a 
        href="https://ui.shadcn.com/" 
        className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors duration-200" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        <span className="text-sm font-medium">Shadcn/ui</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
    <p className="text-xs text-gray-400">
      Built with ❤️ for developers who love beautiful, functional UIs
    </p>
  </footer>
);

export default App;
