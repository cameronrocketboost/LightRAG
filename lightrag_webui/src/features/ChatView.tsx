// Import Textarea instead of Input
// import Input from '@/components/ui/Input'
// import { Textarea } from '@/components/ui/textarea' // Textarea component doesn't exist, using standard HTML textarea
import Button from '@/components/ui/Button'
import React from 'react' // Import React for types
import { useCallback, useEffect, useRef, useState } from 'react'
import { throttle } from '@/lib/utils'
import { queryText, queryTextStream, Message } from '@/api/lightrag'
import { errorMessage } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings'
import { useDebounce } from '@/hooks/useDebounce'
// import QuerySettings from '@/components/retrieval/QuerySettings' // Remove QuerySettings import
import { ChatMessage, MessageWithError } from '@/components/retrieval/ChatMessage'
import { EraserIcon, ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { QueryMode } from '@/api/lightrag'

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
  const isFormInteractionRef = useRef(false)
  const programmaticScrollRef = useRef(false)
  const isReceivingResponseRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  // Ref for the textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

      // Parse query mode prefix
      const allowedModes: QueryMode[] = ['naive', 'local', 'global', 'hybrid', 'mix', 'bypass']
      const prefixMatch = queryToSend.match(/^\/(\w+)\s+(.+)/)
      let modeOverride: QueryMode | undefined = undefined
      let actualQuery = queryToSend

      // If input starts with a slash, but does not match the valid prefix pattern, treat as error
      if (/^\/\S+/.test(queryToSend) && !prefixMatch) {
        setInputError(t('retrievePanel.retrieval.queryModePrefixInvalid'))
        return
      }

      if (prefixMatch) {
        const mode = prefixMatch[1] as QueryMode
        const query = prefixMatch[2]
        if (!allowedModes.includes(mode)) {
          setInputError(
            t('retrievePanel.retrieval.queryModeError', {
              modes: 'naive, local, global, hybrid, mix, bypass',
            })
          )
          return
        }
        modeOverride = mode
        actualQuery = query
      }

      setInputError('')

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

      const state = useSettingsStore.getState()
      const queryParams = {
        ...state.querySettings,
        query: actualQuery,
        conversation_history: prevMessages
          .filter((m) => m.isError !== true)
          .slice(-(state.querySettings.history_turns || 0) * 2)
          .map((m) => ({ role: m.role, content: m.content })),
        ...(modeOverride ? { mode: modeOverride } : {})
      }

      try {
        if (state.querySettings.stream) {
          let errorMessage = ''
          await queryTextStream(queryParams, updateAssistantMessage, (error) => {
            errorMessage += error
          })
          if (errorMessage) {
            if (assistantMessage.content) {
              errorMessage = assistantMessage.content + '\n' + errorMessage
            }
            updateAssistantMessage(errorMessage, true)
          }
        } else {
          const response = await queryText(queryParams)
          updateAssistantMessage(response.response)
        }
      } catch (err) {
        updateAssistantMessage(`${t('retrievePanel.retrieval.error')}\n${errorMessage(err)}`, true)
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
      handleSendMessage(inputValue) // Call handleSendMessage with current input value
    },
    [handleSendMessage, inputValue]
  )

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
  // useEffect(() => { ... scroll handling ... }, []);
  // useEffect(() => { ... form interaction handling ... }, []);
  // --- End of removed useEffects ---

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

  return (
    <div className="flex h-full flex-col relative bg-white"> {/* Keep white background */}
      {/* Remove QuerySettings Component */}
      {/* <div className="absolute top-2 right-2 z-10">
        <QuerySettings />
      </div> */}

      {/* Conditional rendering for initial centered content vs. chat messages */}
      {messages.length === 0 && !isLoading ? (
        // Centered content when chat is empty
        <div className="flex-1 flex items-center justify-center p-4"> {/* Centering wrapper */}
          <div className="bg-slate-50 rounded-lg shadow-sm p-8 max-w-2xl w-full"> {/* Inner container styling */}
            <div className="flex flex-col items-center justify-center text-center">
              {/* Apply Sladen colors directly using inline styles */}
              <h1 
                className="text-4xl font-bold mb-4" 
                style={{ color: '#0A2E4C' }} // Apply Sladen blue
              >
                  SLADEN
                  <span style={{ color: '#E24B4B' }}>/</span> {/* Apply Sladen red */}
                  CHAT
              </h1>
              {/* Subtitle */}
              <p className="text-gray-600 mb-8 max-w-md"> {/* Use a standard gray, adjust as needed */}
                Upload your documents and chat with them using our advanced AI system.
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
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3"> {/* Removed shadow-md */}
        {/* Remove the suggestion buttons that appear above input when chat is NOT empty */}
        {/* {messages.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-3"> 
            {suggestedPrompts.map((prompt, index) => (
              <Button
                key={index}
                variant="outline"
                className="rounded-lg px-4 py-2 sladen-suggestion-button" 
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
        )} */}
        {/* Input form */}
        <form onSubmit={handleSubmit} className="flex items-end space-x-2"> {/* Use items-end for button alignment */}
          {/* Add Clear History button to the left */}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              type="button" // Important: Prevent form submission
              onClick={handleClearHistory}
              title={t('retrievePanel.retrieval.clearHistory') || 'Clear History'}
              className="p-3 text-slate-500 hover:text-slate-700 disabled:opacity-50 shrink-0" // Added padding, shrink-0
              disabled={isLoading}
            >
              <EraserIcon className="h-5 w-5" /> {/* Slightly larger icon */}
            </Button>
          )}
          <textarea
            ref={textareaRef}
            id="chat-textarea" // Keep id if needed elsewhere, ref is preferred
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask anything about your documents..."
            className="flex-1 resize-none rounded-lg border border-slate-300 p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-sladen-blue focus:border-transparent" // Added styles: rounded-lg, padding, focus ring, no resize handle
            rows={1} // Start with 1 row, auto-resize will handle expansion
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            disabled={isLoading}
          />
          {/* Submit Button */}
          <Button
            type="submit"
            className="rounded-lg p-3 bg-slate-200 text-slate-600 hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-sladen-blue disabled:opacity-50" // Style button: rounded, padding, colors, hover, focus, disabled state
            disabled={isLoading || !inputValue.trim()}
            aria-label="Send message"
          >
            <ArrowUp className="h-5 w-5" /> {/* Use ArrowUp icon */}
          </Button>
        </form>
        {inputError && <p className="text-red-500 text-sm mt-1">{inputError}</p>}
      </div>
    </div>
  )
} 