import React, { useEffect } from 'react'
import { CheckIcon, MessageCircleIcon, UserIcon } from 'lucide-react'
import { useState, useCallback, useMemo, useRef, memo, ReactNode } from 'react'
import { Message } from '@/api/lightrag'
import useTheme from '@/hooks/useTheme'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeReact from 'rehype-react'
import remarkMath from 'remark-math'
import mermaid from 'mermaid'

import type { Element } from 'hast'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

import { LoaderIcon, CopyIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

export interface MessageWithError extends Message {
  id?: string
  isError?: boolean
  mermaidRendered?: boolean
}

interface ChatMessageProps {
  message: MessageWithError
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { t } = useTranslation()
  const isAssistant = message.role === 'assistant'
  const isUser = message.role === 'user'
  const isError = message.isError
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyMarkdown = useCallback(async () => {
    if (message.content) {
      try {
        await navigator.clipboard.writeText(message.content)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      } catch (err) {
        console.error(t('chat.copyError'), err)
      }
    }
  }, [message.content, t])

  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'justify-end' : ''}`}>
      {/* Sladen Avatar for Assistant */}
      {!isUser && (
        <Avatar className="h-8 w-8 border border-slate-200">
          <AvatarImage src="/sladen-logo.png" alt="Assistant" />
          <AvatarFallback><MessageCircleIcon className="h-4 w-4 text-slate-400" /></AvatarFallback>
        </Avatar>
      )}

      {/* Message Bubble with Sladen colors */}
      <div
        className={`relative max-w-[75%] rounded-lg px-4 py-2 ${isUser ? 'bg-sladen-teal text-white' : 'bg-slate-100 text-slate-800'} ${isError ? 'border border-red-500 bg-red-50' : ''}`}
      >
        <div className="relative">
          <ReactMarkdown
            className="prose dark:prose-invert max-w-none text-sm break-words prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-code:text-sm prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-opacity-10 prose-code:bg-black prose-pre:p-0 prose-pre:bg-transparent"
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeReact]}
            skipHtml={false}
            components={useMemo(() => ({
              code: (props: any) => (
                <CodeHighlight
                  {...props}
                  renderAsDiagram={message.mermaidRendered ?? false}
                />
              ),
            }), [message.mermaidRendered])}
          >
            {message.content || ''}
          </ReactMarkdown>
          {isAssistant && message.content && message.content.length > 0 && !isError && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 h-6 w-6 text-slate-400 hover:text-slate-600 p-1 opacity-50 hover:opacity-100 transition-opacity duration-150"
                    onClick={handleCopyMarkdown}
                  >
                    {isCopied ? (
                      <CheckIcon className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isCopied ? 'Copied!' : 'Copy markdown'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {isError && (
          <span className="text-xs text-red-600 block mt-1">{t('chat.messageError', 'Message failed to process')}</span>
        )}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 border border-slate-200">
          <AvatarFallback><UserIcon className="h-4 w-4 text-slate-400" /></AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

interface CodeHighlightProps {
  inline?: boolean
  className?: string
  children?: ReactNode
  node?: Element
  renderAsDiagram?: boolean
}

const isInlineCode = (node?: Element): boolean => {
  if (!node || !node.children) return false;
  const textContent = node.children
    .filter((child) => child.type === 'text')
    .map((child) => (child as any).value)
    .join('');
  return !textContent.includes('\n') || textContent.length < 40;
};

const CodeHighlight = memo(({ className, children, node, renderAsDiagram = false, ...props }: CodeHighlightProps) => {
  const { theme } = useTheme();
  const [hasRendered, setHasRendered] = useState(false);
  const match = className?.match(/language-(\w+)/);
  const language = match ? match[1] : undefined;
  const inline = isInlineCode(node);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (renderAsDiagram && !hasRendered && language === 'mermaid' && mermaidRef.current) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const container = mermaidRef.current;
        if (!container) {
          console.log('Mermaid container ref was null in setTimeout callback.');
          return;
        }

        if (hasRendered) return;

        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: theme === 'dark' ? 'dark' : 'default',
            securityLevel: 'loose',
          });

          container.innerHTML = '<div class="flex justify-center items-center p-4"><svg class="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

          const rawContent = String(children).replace(/\n$/, '').trim();

          const looksPotentiallyComplete = rawContent.length > 10 && (
            rawContent.startsWith('graph') ||
            rawContent.startsWith('sequenceDiagram') ||
            rawContent.startsWith('classDiagram') ||
            rawContent.startsWith('stateDiagram') ||
            rawContent.startsWith('gantt') ||
            rawContent.startsWith('pie') ||
            rawContent.startsWith('flowchart') ||
            rawContent.startsWith('erDiagram')
          );

          if (!looksPotentiallyComplete) {
            console.log('Mermaid content might be incomplete, skipping render attempt:', rawContent);
            return;
          }

          const processedContent = rawContent
            .split('\n')
            .map(line => {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('subgraph')) {
                const parts = trimmedLine.split(' ');
                if (parts.length > 1) {
                  const title = parts.slice(1).join(' ').replace(/["']/g, '');
                  return `subgraph "${title}"`;
                }
              }
              return trimmedLine;
            })
            .filter(line => !line.trim().startsWith('linkStyle'))
            .join('\n');

          const mermaidId = `mermaid-${Date.now()}`;
          mermaid.render(mermaidId, processedContent)
            .then(({ svg, bindFunctions }) => {
              const currentContainer = mermaidRef.current;
              if (!currentContainer) {
                console.log('Mermaid container ref was null when promise resolved.');
                return;
              }
              
              if (!hasRendered) {
                currentContainer.innerHTML = svg;
                setHasRendered(true);
                if (bindFunctions) {
                  try {
                    bindFunctions(currentContainer);
                  } catch (bindError) {
                    console.error('Mermaid bindFunctions error:', bindError);
                    if (mermaidRef.current === currentContainer) { 
                      currentContainer.innerHTML += '<p class="text-orange-500 text-xs">Diagram interactions might be limited.</p>';
                    }
                  }
                }
              }
            })
            .catch(error => {
              const currentContainer = mermaidRef.current;
              if (!currentContainer) {
                 console.log('Mermaid container ref was null when promise caught error.');
                 return;
              }
              
              console.error('Mermaid rendering promise error (debounced):', error);
              console.error('Failed content (debounced):', processedContent);
              const errorMessage = error instanceof Error ? error.message : String(error);
              const errorPre = document.createElement('pre');
              errorPre.className = 'text-red-500 text-xs whitespace-pre-wrap break-words';
              errorPre.textContent = `Mermaid diagram error: ${errorMessage}\n\nContent:\n${processedContent}`;
              currentContainer.innerHTML = '';
              currentContainer.appendChild(errorPre);
            });

        } catch (error) {
           const currentContainer = mermaidRef.current;
           if (!currentContainer) {
              console.log('Mermaid container ref was null when synchronous error caught.');
              return;
           }

          console.error('Mermaid synchronous error (debounced):', error);
          console.error('Failed content (debounced):', String(children));
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorPre = document.createElement('pre');
          errorPre.className = 'text-red-500 text-xs whitespace-pre-wrap break-words';
          errorPre.textContent = `Mermaid diagram setup error: ${errorMessage}`;
          currentContainer.innerHTML = '';
          currentContainer.appendChild(errorPre);
        }
      }, 300);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [renderAsDiagram, hasRendered, language, children, theme]);

  if (language === 'mermaid' && !renderAsDiagram) {
    return (
      <SyntaxHighlighter
        style={theme === 'dark' ? oneDark : oneLight}
        PreTag="div"
        language="text"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  }

  if (language === 'mermaid') {
    return <div className="mermaid-diagram-container my-4 overflow-x-auto" ref={mermaidRef}></div>;
  }

  return !inline ? (
    <SyntaxHighlighter
      style={theme === 'dark' ? oneDark : oneLight}
      PreTag="div"
      language={language}
      {...props}
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code
      className={cn(className, 'mx-1 rounded-sm bg-muted px-1 py-0.5 font-mono text-sm')}
      {...props}
    >
      {children}
    </code>
  );
});

CodeHighlight.displayName = 'CodeHighlight';
