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
import { ZapIcon } from 'lucide-react'

import GraphViewer from '@/features/GraphViewer'
import DocumentManager from '@/features/DocumentManager'
import ChatView from '@/features/ChatView'
import ApiSite from '@/features/ApiSite'

import { Tabs, TabsContent } from '@/components/ui/Tabs'

// Helper component for feature item
const FeatureItem = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold mb-1 text-primary">{title}</h3>
    <p className="text-muted-foreground text-sm">{children}</p>
  </div>
);

function App() {
  const message = useBackendState.use.message()
  const enableHealthCheck = useSettingsStore.use.enableHealthCheck()
  const currentTabSetting = useSettingsStore.use.currentTab()
  const validTabs = ['chat', 'documents', 'features']
  const initialTab = validTabs.includes(currentTabSetting) ? currentTabSetting : 'chat'
  const [currentTab, setCurrentTab] = useState(initialTab)
  const [apiKeyAlertOpen, setApiKeyAlertOpen] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const versionCheckRef = useRef(false);
  const healthCheckInitializedRef = useRef(false);

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
        {initializing ? (
          <div className="flex h-screen w-screen flex-col">
            <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex h-10 w-full border-b px-4 backdrop-blur">
              <div className="min-w-[200px] w-auto flex items-center">
                <a href={webuiPrefix} className="flex items-center gap-2">
                  <ZapIcon className="size-4 text-emerald-400" aria-hidden="true" />
                  <span className="font-bold md:inline-block">{SiteInfo.name}</span>
                </a>
              </div>

              <div className="flex h-10 flex-1 items-center justify-center">
              </div>

              <nav className="w-[200px] flex items-center justify-end">
              </nav>
            </header>

            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                <p>Initializing...</p>
              </div>
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
                <TabsContent value="features" className="absolute top-0 right-0 bottom-0 left-0 overflow-auto p-6">
                  <h2 className="text-xl font-bold mb-4 text-foreground">System Features</h2>
                  
                  <FeatureItem title="Retrieval-Augmented Generation (RAG)">
                    Enhances Large Language Model (LLM) responses by retrieving relevant information from your uploaded documents before generating an answer. This ensures answers are grounded in specific knowledge.
                  </FeatureItem>

                  <FeatureItem title="Knowledge Graph Integration (Graph RAG)">
                    Automatically extracts key entities (like people, places, concepts) and their relationships from your documents to build a knowledge graph. This allows for more nuanced querying and understanding of connections within the data.
                  </FeatureItem>

                  <FeatureItem title="Hybrid Search">
                    Combines traditional keyword search with semantic vector search and knowledge graph traversal to find the most relevant context for your queries, understanding both explicit mentions and underlying meaning.
                  </FeatureItem>

                  <FeatureItem title="Document Management">
                    Upload and manage various document types (PDF, DOCX, PPTX, TXT). Track processing status and view indexed documents.
                  </FeatureItem>
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
