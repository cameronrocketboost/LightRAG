import { useState, useCallback, useEffect, useRef } from 'react'
import ThemeProvider from '@/components/ThemeProvider'
import TabVisibilityProvider from '@/contexts/TabVisibilityProvider'
import ApiKeyAlert from '@/components/ApiKeyAlert'
import { healthCheckInterval, SiteInfo, webuiPrefix } from '@/lib/constants'
import { useBackendState, useAuthStore } from '@/stores/state'
import { useSettingsStore } from '@/stores/settings'
import { getAuthStatus } from '@/api/lightrag'
import SiteHeader from '@/features/SiteHeader'
import { InvalidApiKeyError, RequireApiKeError } from '@/api/lightrag'
import {
  ZapIcon, 
  BrainCircuitIcon, 
  NetworkIcon,
  CombineIcon, 
  FilesIcon 
} from 'lucide-react'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/Card";

import GraphViewer from '@/features/GraphViewer'
import DocumentManager from '@/features/DocumentManager'
import ChatView from '@/features/ChatView'
import ApiSite from '@/features/ApiSite'

import { Tabs, TabsContent } from '@/components/ui/Tabs'

function App() {
  const message = useBackendState.use.message()
  const enableHealthCheck = useSettingsStore.use.enableHealthCheck()
  const currentTabSetting = useSettingsStore.use.currentTab()
  const validTabs = ['chat', 'documents', 'features', 'knowledge-graph']
  const initialTab = validTabs.includes(currentTabSetting) ? currentTabSetting : 'chat'
  const [currentTab, setCurrentTab] = useState(initialTab)
  const [apiKeyAlertOpen, setApiKeyAlertOpen] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const versionCheckRef = useRef(false);
  const healthCheckInitializedRef = useRef(false);
  const [minLoadingTimePassed, setMinLoadingTimePassed] = useState(false);

  const handleApiKeyAlertOpenChange = useCallback((open: boolean) => {
    setApiKeyAlertOpen(open)
    if (!open) {
      useBackendState.getState().clear()
    }
  }, [])

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const handleBeforeUnload = () => {
      isMountedRef.current = false;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!enableHealthCheck || apiKeyAlertOpen) return;

    const performHealthCheck = async () => {
      try {
        if (isMountedRef.current) {
          await useBackendState.getState().check();
        }
      } catch (error) {
        console.error('Health check error:', error);
      }
    };

    if (!healthCheckInitializedRef.current) {
      healthCheckInitializedRef.current = true;
      performHealthCheck();
    }

    const interval = setInterval(performHealthCheck, healthCheckInterval * 1000);
    return () => clearInterval(interval);
  }, [enableHealthCheck, apiKeyAlertOpen]);

  useEffect(() => {
    const checkVersion = async () => {
      if (versionCheckRef.current) return;
      versionCheckRef.current = true;

      const versionCheckedFromLogin = sessionStorage.getItem('VERSION_CHECKED_FROM_LOGIN') === 'true';
      if (versionCheckedFromLogin) {
        setInitializing(false);
        return;
      }

      try {
        setInitializing(true);

        const token = localStorage.getItem('LIGHTRAG-API-TOKEN');
        const status = await getAuthStatus();

        if (!status.auth_configured && status.access_token) {
          useAuthStore.getState().login(
            status.access_token,
            true,
            status.core_version,
            status.api_version,
            status.webui_title || null,
            status.webui_description || null
          );
        } else if (token && (status.core_version || status.api_version || status.webui_title || status.webui_description)) {
          const isGuestMode = status.auth_mode === 'disabled' || useAuthStore.getState().isGuestMode;
          useAuthStore.getState().login(
            token,
            isGuestMode,
            status.core_version,
            status.api_version,
            status.webui_title || null,
            status.webui_description || null
          );
        }

        sessionStorage.setItem('VERSION_CHECKED_FROM_LOGIN', 'true');
      } catch (error) {
        console.error('Failed to get version info:', error);
      } finally {
        setInitializing(false);
      }
    };

    checkVersion();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingTimePassed(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = useCallback(
    (tab: string) => {
      if (validTabs.includes(tab)) {
        setCurrentTab(tab);
        useSettingsStore.getState().setCurrentTab(tab as any);
      }
    },
    []
  )

  useEffect(() => {
    if (message) {
      if (message.includes(InvalidApiKeyError) || message.includes(RequireApiKeError)) {
        setApiKeyAlertOpen(true)
      }
    }
  }, [message])

  return (
    <ThemeProvider>
      <TabVisibilityProvider>
        {initializing || !minLoadingTimePassed ? (
          <div className="flex h-screen w-screen flex-col items-center bg-background px-4 pt-20">
            <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 absolute top-0 z-50 flex h-10 w-full border-b px-4 backdrop-blur">
              <div className="min-w-[200px] w-auto flex items-center">
              </div>
              <div className="flex h-10 flex-1 items-center justify-center"></div>
              <nav className="w-[200px] flex items-center justify-end"></nav>
            </header>

            <div className="flex flex-col items-center justify-center text-center">
               <img 
                  src="/SladenChat.png" 
                  alt="Sladen Chat Logo" 
                  className="h-32 w-auto mb-5"
                />
              <h1 
                className="text-5xl font-bold text-center"
                style={{ color: '#0A2E4C' }}
              >
                  SLADEN
                  <span style={{ color: '#E24B4B' }}>/</span>CHAT
              </h1>
            </div>
          </div>
        ) : (
          <main className="flex h-screen w-screen overflow-hidden">
            <Tabs
              defaultValue={currentTab}
              value={currentTab}
              className="!m-0 flex grow flex-col !p-0 overflow-hidden"
              onValueChange={handleTabChange}
            >
              <SiteHeader />
              <div className="relative grow">
                <TabsContent value="chat" className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden">
                  <ChatView />
                </TabsContent>
                <TabsContent value="documents" className="absolute top-0 right-0 bottom-0 left-0 overflow-auto">
                  <DocumentManager />
                </TabsContent>
                <TabsContent value="features" className="absolute top-0 right-0 bottom-0 left-0 overflow-auto p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                  <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold mb-2 text-foreground text-center">
                      Core Features
                    </h2>
                    <p className="text-center text-muted-foreground mb-8 text-sm">
                      Explore the powerful features that make Sladen Chat an intelligent tool for understanding your documents:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <BrainCircuitIcon className="h-6 w-6 text-primary" />
                            Accurate & Relevant Answers (RAG)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground border-t pt-4">
                          Get AI answers grounded *in your specific documents*, not just generic web knowledge.
                          <ul className="list-disc space-y-1 pl-5 mt-3">
                            <li>Significantly reduces factual errors ("hallucinations").</li>
                            <li>Ensures responses are highly relevant to your context.</li>
                            <li>Saves time fact-checking AI outputs.</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <NetworkIcon className="h-6 w-6 text-primary" />
                            Uncover Hidden Connections (Graph RAG)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground border-t pt-4">
                          Go beyond simple search. Sladen Chat automatically maps key entities and relationships in your data.
                           <ul className="list-disc space-y-1 pl-5 mt-3">
                            <li>Understand complex connections across multiple documents.</li>
                            <li>Discover insights you might otherwise miss.</li>
                            <li>Visually explore connections in the <span className="font-semibold text-primary">Graph</span> tab.</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <CombineIcon className="h-6 w-6 text-primary" />
                            Flexible & Powerful Search
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground border-t pt-4">
                          Combines multiple search techniques (semantic, keyword, graph) to find the best information.
                          <ul className="list-disc space-y-1 pl-5 mt-3">
                            <li>Finds relevant info even with vague or complex queries.</li>
                            <li>Experiment with different query modes (type <code className="text-xs bg-muted px-1 py-0.5 rounded">/</code> in chat) to fine-tune results.</li>
                            <li>Get comprehensive context for the AI.</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <FilesIcon className="h-6 w-6 text-primary" />
                            Effortless Document Handling
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground border-t pt-4">
                          Easily upload PDFs, DOCX, TXT files, and more. The system handles the complex processing automatically.
                          <ul className="list-disc space-y-1 pl-5 mt-3">
                            <li>Quick setup – just upload your files.</li>
                            <li>Manage your knowledge base easily via the <span className="font-semibold text-primary">Documents</span> tab.</li>
                            <li>Supports various common file formats.</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="knowledge-graph" className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden">
                  <GraphViewer />
                </TabsContent>
                <TabsContent value="api" className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden">
                  <ApiSite />
                </TabsContent>
              </div>
            </Tabs>
            <ApiKeyAlert open={apiKeyAlertOpen} onOpenChange={handleApiKeyAlertOpenChange} />
          </main>
        )}
      </TabVisibilityProvider>
    </ThemeProvider>
  )
}

export default App
