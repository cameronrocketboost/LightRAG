// Import Textarea instead of Input
// import Input from '@/components/ui/Input'
// import { Textarea } from '@/components/ui/textarea' // Textarea component doesn't exist, using standard HTML textarea
import Button from '@/components/ui/Button'
import React from 'react' // Import React for types
import { useCallback, useEffect, useRef, useState } from 'react'
// import { throttle } from '@/lib/utils' // Remove unused throttle
import { queryText, queryTextStream, Message } from '@/api/lightrag'
import { errorMessage } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'
import { useDebounce } from '@/hooks/useDebounce'
// import QuerySettings from '@/components/retrieval/QuerySettings' // Remove QuerySettings import
import { ChatMessage, MessageWithError } from '@/components/retrieval/ChatMessage'
import { EraserIcon, ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { QueryMode } from '@/api/lightrag'
// --- Start Edit: Remove Select components ---
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue
// } from "@/components/ui/Select";
// --- End Edit ---
// --- Start Edit: Add Popover components for slash command ---
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover" // Use Popover for the command list
// --- End Edit ---

// Renamed from RetrievalTesting to ChatView
export default function ChatView() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<MessageWithError[]>(
    () => useSettingsStore.getState().retrievalHistory || []
  )
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [inputError, setInputError] = useState('') // Error message for input
  const shouldFollowScrollRef = useRef(true)
  // const isFormInteractionRef = useRef(false) // Remove unused isFormInteractionRef
  const programmaticScrollRef = useRef(false)
  const isReceivingResponseRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  // Ref for the textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // --- Start Edit: Add state for slash command popup ---
  const [showModePopup, setShowModePopup] = useState(false);
  // const popoverAnchorRef = useRef<HTMLDivElement>(null); // Remove anchor ref
  // --- End Edit ---

  // --- Auto-resize textarea ---
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; // Set height based on content, max 200px
    }
  }, []);

  // Adjust height on input change
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // Adjust height on initial load and resize
  useEffect(() => {
    const handleResize = () => adjustTextareaHeight();
    window.addEventListener('resize', handleResize);
    adjustTextareaHeight(); // Initial adjustment
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustTextareaHeight]);
  // --- End auto-resize ---

  const scrollToBottom = useCallback(() => {
    programmaticScrollRef.current = true
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    })
  }, [])

  // Function to handle sending a message (used by form submit)
  const handleSendMessage = useCallback(
    async (queryToSend: string) => {
      if (!queryToSend.trim() || isLoading) return

      // --- Start Edit: Use store mode directly ---
      // Get query mode directly from settings store
      const state = useSettingsStore.getState();
      // const currentQueryMode = state.querySettings.mode; // Remove unused currentQueryMode variable
      const actualQuery = queryToSend.trim(); // Use the whole input as the query

      // --- Remove old prefix parsing logic ---
      // ... (removed old prefix check logic) ...
      // --- End Edit ---

      setInputError('') // Clear any previous input errors

      const userMessage: Message = {
        content: queryToSend, // Use the actual query sent (could be from input or button)
        role: 'user'
      }
      const assistantMessage: Message = {
        content: '',
        role: 'assistant'
      }
      const prevMessages = [...messages]
      setMessages([...prevMessages, userMessage, assistantMessage])
      shouldFollowScrollRef.current = true
      isReceivingResponseRef.current = true
      setTimeout(() => { scrollToBottom() }, 0)
      setInputValue('') // Clear input field after sending
      setIsLoading(true)

      const updateAssistantMessage = (chunk: string, isError?: boolean) => {
        assistantMessage.content += chunk
        setMessages((prev) => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content = assistantMessage.content
            lastMessage.isError = isError
          }
          return newMessages
        })
        if (shouldFollowScrollRef.current) {
          setTimeout(() => { scrollToBottom() }, 30)
        }
      }

      const queryParams = {
        ...state.querySettings, // Includes the mode from store (set by popup)
        query: actualQuery,
        conversation_history: prevMessages
          .filter((m) => m.isError !== true)
          .slice(-(state.querySettings.history_turns || 0) * 2)
          .map((m) => ({ role: m.role, content: m.content })),
        // Mode is now directly from state.querySettings
      }

      try {
        if (state.querySettings.stream) {
          let errorMessage = ''
          await queryTextStream(queryParams, updateAssistantMessage, (error) => {
            errorMessage += error
          })
          if (errorMessage) {
            if (assistantMessage.content) {
              errorMessage = assistantMessage.content + '\\n' + errorMessage
            }
            updateAssistantMessage(errorMessage, true)
          }
        } else {
          const response = await queryText(queryParams)
          updateAssistantMessage(response.response)
        }
      } catch (err) {
        updateAssistantMessage(`${t('retrievePanel.retrieval.error')}\\n${errorMessage(err)}`, true)
      } finally {
        setIsLoading(false)
        isReceivingResponseRef.current = false
        useSettingsStore
          .getState()
          .setRetrievalHistory([...prevMessages, userMessage, assistantMessage])
      }
    },
    [isLoading, messages, setMessages, t, scrollToBottom]
  )

  // Modify handleSubmit to use handleSendMessage
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      // --- Start Edit: Close popup on submit ---
      setShowModePopup(false);
      // --- End Edit ---
      handleSendMessage(inputValue) // Call handleSendMessage with current input value
    },
    [handleSendMessage, inputValue]
  )

  // --- Start Edit: Add handler for mode change from popup ---
  const handleModeSelect = useCallback((newMode: QueryMode) => {
    useSettingsStore.getState().updateQuerySettings({ mode: newMode });
    setInputValue(''); // Clear input after selecting mode
    setShowModePopup(false); // Close popup
    textareaRef.current?.focus(); // Focus input again
  }, []);
  const currentMode = useSettingsStore.use.querySettings().mode;
  const queryModes: QueryMode[] = ['naive', 'local', 'global', 'hybrid', 'mix', 'bypass'];
  // --- End Edit ---

  // --- Start Edit: Add descriptions for modes --- (Revised for clarity)
  const modeDescriptions: Record<QueryMode, string> = {
    naive: "Simple search across your documents.",
    local: "Search focused on specific details and context nearby your query.",
    global: "Search using broader connections and relationships within your data.",
    hybrid: "Combines both detailed local search and broader global search.",
    mix: "Mixes knowledge graph connections with standard document search.",
    bypass: "Ask the AI directly, without searching documents first.",
  };
  // --- End Edit ---

  // Modify handleSuggestionClick to set input value instead of sending
  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    // Focus and adjust height after setting value
    const textarea = textareaRef.current;
    if (textarea) {
        textarea.focus();
        // Use timeout to ensure value is set before adjusting height
        setTimeout(adjustTextareaHeight, 0);
    }
    // document.getElementById('chat-textarea')?.focus(); // Use ref instead
  }

  // --- Removed scroll handling useEffects for brevity, assuming they are correct ---
  const debouncedMessages = useDebounce(messages, 150)
  useEffect(() => {
    if (shouldFollowScrollRef.current) {
      scrollToBottom()
    }
  }, [debouncedMessages, scrollToBottom])

  const handleClearHistory = useCallback(() => {
    setMessages([])
    useSettingsStore.getState().setRetrievalHistory([])
  }, [setMessages])

  // Define suggested prompts
  const suggestedPrompts = [
    "Summarize the key findings.",
    "What are the main arguments?",
    "Explain the methodology used.",
  ];

  // --- Start Edit: Handle input change for slash command ---
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // console.log('handleInputChange fired. Value:', value); // REMOVE DEBUG LOG
    setInputValue(value);
    // --- Start Edit: Show popup ONLY if input is exactly '/' ---
    // Show popup if input is exactly '/'
    if (value === '/') {
      // console.log('Setting showModePopup to true'); // REMOVE DEBUG LOG
      setShowModePopup(true);
    } else {
      // console.log('Setting showModePopup to false'); // REMOVE DEBUG LOG (Optional: uncomment if needed)
      setShowModePopup(false);
    }
    // --- End Edit ---
  };
  // --- End Edit ---

  // console.log('Rendering ChatView. showModePopup:', showModePopup); // REMOVE DEBUG LOG

  return (
    <div className="flex h-full flex-col relative bg-white"> {/* Keep white background */}
      {/* Remove QuerySettings Component */}
      {/* <div className="absolute top-2 right-2 z-10">
        <QuerySettings />
      </div> */}

      {/* Conditional rendering for initial centered content vs. chat messages */}
      {messages.length === 0 && !isLoading ? (
        // Centered content when chat is empty
        <div className="flex-1 flex flex-col items-center px-4 pt-24"> 
           {/* Logo */} 
           <img 
              src="/SladenChat.png" 
              alt="Sladen Chat Logo" 
              className="h-28 w-auto mb-6" // Larger size (h-28), adjusted margin
            />
          <div className="bg-slate-50 rounded-lg shadow-sm p-8 max-w-2xl w-full"> {/* Inner container styling */}
            <div className="flex flex-col items-center justify-center text-center">
              {/* Apply Sladen colors directly using inline styles */}
              <h1 
                className="text-5xl font-bold mb-4"
                style={{ color: '#0A2E4C' }} // Apply Sladen blue
              >
                  SLADEN
                  <span style={{ color: '#E24B4B' }}>/</span>{/* Removed space */}CHAT
              </h1>
              {/* Subtitle - Updated Text & Size */}
              <p className="text-sm text-gray-600 mb-8 max-w-md">
                Simply upload your documents (PDFs, DOCX, TXT, and more) and start a conversation. Sladen Chat uses advanced AI, including Knowledge Graphs, to understand your data deeply and provide accurate, context-aware answers.
              </p>
              {/* Suggestion buttons */}
              <div className="flex flex-wrap justify-center gap-3 mb-4"> {/* Increased gap */}
                {suggestedPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    // Style suggestion buttons: Rounded, padding, sladen blue border/text, red hover
                    variant="outline"
                    className="rounded-lg px-4 py-2 sladen-suggestion-button" // Use a custom class for hover styles
                    size="sm"
                    style={{
                      borderColor: '#0A2E4C', 
                      color: '#0A2E4C' 
                    }}
                    onClick={() => handleSuggestionClick(prompt)}
                    disabled={isLoading}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Message display area when messages exist
        <div ref={messagesContainerRef} className="flex flex-col flex-1 overflow-y-auto py-4 px-16 pb-[180px] bg-white space-y-3"> {/* Changed p-4 to py-4 px-16 */}
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))}
          {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
            <div className="flex justify-center py-2">
              {/* Use sladen-blue for spinner border? */}
              <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-sladen-blue"></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input area fixed at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3"> 
        {/* --- Start Edit: Add centered wrapper with max-width --- */}
        <div className="max-w-4xl mx-auto"> 
          {/* REMOVE DEBUG LOGGING for Popover state */}
          {/* {console.log('Popover wrapper. open prop:', showModePopup)} */}
          <Popover open={showModePopup} onOpenChange={setShowModePopup}>
            {/* --- Remove PopoverAnchor component usage --- */}
            {/* <PopoverAnchor className="absolute bottom-[60px] left-4 h-0 w-0" /> */}
            {/* --- Start Edit: Wrap textarea container with PopoverTrigger --- */}
            <PopoverTrigger asChild>
              <form onSubmit={handleSubmit} className="flex items-end space-x-2 relative"> 
                {/* Keep Clear History button - Always visible */}
                 <Button
                  variant="ghost"
                  // --- Start Edit: Modify button size ---
                  // size="icon" // Remove size="icon"
                  type="button"
                  onClick={handleClearHistory}
                  title={t('retrievePanel.retrieval.clearHistory') || 'Clear History'}
                  // Add rounded-lg and ensure consistent padding (p-3 is already applied below via className)
                  className="p-3 rounded-lg text-slate-500 hover:text-slate-700 disabled:opacity-50 shrink-0" 
                  // --- End Edit ---
                  disabled={isLoading}
                >
                  <EraserIcon className="h-5 w-5" /> 
                </Button>

               {/* Textarea is now a direct child of the form */}
               <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  id="chat-textarea"
                  value={inputValue}
                  onChange={handleInputChange} 
                  placeholder={`Current mode: ${currentMode}. Type / for options...`}
                  className="flex-1 resize-none rounded-lg border border-slate-300 p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-sladen-blue focus:border-transparent w-full"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                    if (e.key === 'Escape') {
                       setShowModePopup(false);
                    }
                    if (showModePopup && e.key === '/') {
                      e.preventDefault();
                    }
                  }}
                  disabled={isLoading}
                />
               </div>

              {/* Submit Button */}
               <Button
                type="submit"
                className="rounded-lg p-3 bg-slate-200 text-slate-600 hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-sladen-blue disabled:opacity-50"
                disabled={isLoading || !inputValue.trim()}
                aria-label="Send message"
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
              </form>
            </PopoverTrigger>
            {/* --- End Edit --- */}

            {/* Popover Content - Positioned relative to the form/input area */}
            <PopoverContent
                className="w-[300px] p-2"
                side="top" 
                align="start" 
                sideOffset={5} 
                onOpenAutoFocus={(e) => e.preventDefault()} 
                onCloseAutoFocus={(e) => e.preventDefault()} 
              >
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2 pb-1">QUERY MODES</p>
                {queryModes.map((mode) => (
                  <Button
                    key={mode}
                    variant="ghost"
                    className="w-full justify-start h-auto py-2 px-2 text-left"
                    onClick={() => handleModeSelect(mode)}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                      {/* --- Start Edit: Add whitespace-normal for wrapping --- */}
                      <span className="text-xs text-muted-foreground whitespace-normal"> 
                      {/* --- End Edit --- */}
                        {modeDescriptions[mode]}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {inputError && <p className="text-red-500 text-sm mt-1">{inputError}</p>}
        </div>
         {/* --- End Edit --- */}
      </div>
    </div>
  )
} 