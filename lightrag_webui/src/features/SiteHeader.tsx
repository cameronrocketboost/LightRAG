import { TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/state'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { navigationService } from '@/services/navigation'

interface NavigationTabProps {
  value: string
  currentTab: string
  children: React.ReactNode
}

function NavigationTab({ value, currentTab, children }: NavigationTabProps) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'cursor-pointer rounded-sm px-3 py-1 text-sm font-medium uppercase transition-all',
        currentTab === value ? 'bg-sladen-teal text-white' : 'text-slate-300 hover:text-white'
      )}
    >
      {children}
    </TabsTrigger>
  )
}

function TabsNavigation() {
  const currentTab = useSettingsStore.use.currentTab()

  return (
    <div className="flex h-8 self-center">
      <TabsList className="h-full gap-2 bg-transparent p-0">
        <NavigationTab value="chat" currentTab={currentTab}>
          CHAT
        </NavigationTab>
        <NavigationTab value="documents" currentTab={currentTab}>
          DOCUMENTS
        </NavigationTab>
        <NavigationTab value="features" currentTab={currentTab}>
          FEATURES
        </NavigationTab>
        <NavigationTab value="knowledge-graph" currentTab={currentTab}>
          GRAPH
        </NavigationTab>
      </TabsList>
    </div>
  )
}

export default function SiteHeader() {
  const { coreVersion, apiVersion, username } = useAuthStore()

  const versionDisplay = (coreVersion && apiVersion)
    ? `${coreVersion}/${apiVersion}`
    : null;

  return (
    <header 
      className="border-border/40 text-slate-100 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex h-10 w-full items-center justify-between border-b border-slate-700 px-4 backdrop-blur"
      style={{ backgroundColor: '#0A2E4C' }}
    >
      <div className="flex items-center">
        <span className="font-bold text-lg text-white">
            SLADEN
            <span style={{ color: '#E24B4B' }}>/</span>
            CHAT
        </span>
      </div>

      <nav className="flex items-center justify-end gap-4">
        <TabsNavigation />
        
        {versionDisplay && (
          <span className="text-xs text-slate-400">
            v{versionDisplay}
          </span>
        )}
        
        {username && (
          <span className="text-sm text-slate-300">
            {username}
          </span>
        )}
      </nav>
    </header>
  )
}
