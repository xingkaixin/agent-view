import { Session, Message, MessagePart } from '../types';
import { ModelConfig } from '../config';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp, Folder, Clock, Hash, MessageSquare, ArrowDownToLine, ArrowUpFromLine, CircleDollarSign } from 'lucide-react';
import { useState } from 'react';

interface SessionDetailProps {
  session: Session;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const date = new Date(session.time_created).toLocaleString('zh-CN');
  const stats = session.stats;

  const formatTokens = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-3 leading-snug">{session.title}</h1>
        <div className="flex flex-wrap gap-5 text-sm text-[#4f6368] mb-4">
          <span className="flex items-center gap-1.5"><Folder className="w-4 h-4"/> {session.directory}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> {date}</span>
          <span className="flex items-center gap-1.5"><Hash className="w-4 h-4"/> {session.slug}</span>
        </div>
        <div className="flex flex-wrap gap-3 pt-4 border-t border-[#c9d8d5]">
          <Badge variant="secondary" className="bg-[#f4f9f7] hover:bg-[#e5f1ec] text-[#102124] border-[#c9d8d5] font-normal px-3 py-1 rounded-full text-xs">
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> {stats.message_count} 消息
          </Badge>
          <Badge variant="secondary" className="bg-[#f4f9f7] hover:bg-[#e5f1ec] text-[#102124] border-[#c9d8d5] font-normal px-3 py-1 rounded-full text-xs">
             <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" /> {formatTokens(stats.total_input_tokens)} input
          </Badge>
          <Badge variant="secondary" className="bg-[#f4f9f7] hover:bg-[#e5f1ec] text-[#102124] border-[#c9d8d5] font-normal px-3 py-1 rounded-full text-xs">
            <ArrowUpFromLine className="w-3.5 h-3.5 mr-1.5" /> {formatTokens(stats.total_output_tokens)} output
          </Badge>
          <Badge variant="secondary" className="bg-[#f4f9f7] hover:bg-[#e5f1ec] text-[#102124] border-[#c9d8d5] font-normal px-3 py-1 rounded-full text-xs">
             <CircleDollarSign className="w-3.5 h-3.5 mr-1.5" /> ${(stats.total_cost || 0).toFixed(4)}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {session.messages.map((msg, index) => (
          <MessageItem key={index} msg={msg} formatTokens={formatTokens} />
        ))}
      </div>
    </div>
  );
}

function MessageItem({ msg, formatTokens }: { msg: Message, formatTokens: (n: number) => string }) {
  const role = msg.role;
  const time = new Date(msg.time_created).toLocaleString('zh-CN');

  const getAgentRoleHtml = () => {
    const agentKey = ModelConfig.getDefaultAgentKey() || 'opencode';
    const agentName = ModelConfig.getAgentName(agentKey);
    const agentIcon = ModelConfig.agents[agentKey]?.icon;
    return (
      <>
        {agentIcon ? <img src={agentIcon} alt={agentName} className="w-3.5 h-3.5 inline-block mr-1" /> : '🤖 '}
        {agentName}
      </>
    );
  };

  const textParts = msg.parts.filter(p => p.type === 'text');
  const toolParts = msg.parts.filter(p => p.type === 'tool');
  const reasoningParts = msg.parts.filter(p => p.type === 'reasoning');

  const isUser = role === 'user';
  
  return (
    <article className={`w-fit max-w-[85%] border border-[#c9d8d5] rounded-2xl p-4 shadow-sm ${
      isUser 
        ? 'ml-auto bg-gradient-to-br from-[#e1f4ff] to-[#f3fbff]' 
        : 'mr-auto bg-gradient-to-br from-[#eef8e6] to-[#f8fff2]'
    }`}>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-xs font-semibold bg-white/80 ${
          isUser ? 'border-[#9fc8db] text-[#1a5276]' : 'border-[#9fbdb7] text-[#26454d]'
        }`}>
          {isUser ? '👤 用户' : getAgentRoleHtml()}
        </span>

        {!isUser && msg.mode && (
          <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-[#ffb74d] bg-[#fff3e0] text-[#e65100] text-xs">
            {ModelConfig.agents[msg.mode]?.icon ? (
              <img src={ModelConfig.agents[msg.mode].icon} alt={msg.mode} className="w-3.5 h-3.5 mr-1" />
            ) : '🤖 '}
            {msg.mode}
          </span>
        )}

        {!isUser && msg.model && (
          <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-[#ce93d8] bg-[#f3e5f5] text-[#7b1fa2] text-xs">
            {ModelConfig.getProvider(msg.model)?.icon ? (
               <img src={ModelConfig.getProvider(msg.model)?.icon as string} alt={msg.model} className="w-3.5 h-3.5 mr-1" />
            ) : '🧠 '}
            {msg.model}
          </span>
        )}

        <time className="text-xs text-[#7a8b8f] ml-auto">{time}</time>
      </div>

      {reasoningParts.length > 0 && <ReasoningSection parts={reasoningParts} />}

      <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-pre:bg-black/5 prose-pre:text-current prose-pre:rounded-lg prose-pre:p-3">
        {textParts.map((part, i) => (
          <ReactMarkdown key={i}>{part.text || ''}</ReactMarkdown>
        ))}
      </div>

      {toolParts.length > 0 && <ToolsSection parts={toolParts} />}

      {!isUser && msg.tokens && (
        <div className="mt-3 pt-3 border-t border-[#c9d8d5] text-xs text-[#7a8b8f] flex gap-4 flex-wrap">
          {msg.tokens.input && <span>📥 {formatTokens(msg.tokens.input)} input</span>}
          {msg.tokens.output && <span>📤 {formatTokens(msg.tokens.output)} output</span>}
          {msg.tokens.reasoning && <span>💭 {formatTokens(msg.tokens.reasoning)} reasoning</span>}
          {msg.cost && <span>💰 ${msg.cost.toFixed(4)}</span>}
        </div>
      )}
    </article>
  );
}

function ReasoningSection({ parts }: { parts: MessagePart[] }) {
  const [expanded, setExpanded] = useState(false);
  const fullText = parts.map(p => p.text).join('\n\n');

  return (
    <div className="mt-3 p-3 bg-[#fff8e1] border border-[#ffe082] rounded-lg mb-3">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-semibold text-[#f57c00] flex items-center gap-1.5">
          💭 思考 ({parts.length} 段)
        </span>
        <span className="text-xs text-[#f57c00]">
          {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#ffe082]">
          <div className="text-[13px] leading-relaxed text-[#4f6368] whitespace-pre-wrap">
            {fullText}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolsSection({ parts }: { parts: MessagePart[] }) {
  const getToolIcon = (tool?: string) => {
    const icons: Record<string, string> = {
      'bash': '⚡',
      'read': '📄',
      'edit': '✏️',
      'write': '📝',
      'glob': '🔍',
      'grep': '🔎',
      'bash:12': '⚡',
      'default': '🔧'
    };
    return icons[tool || ''] || icons['default'];
  };

  return (
    <div className="mt-3 p-3 bg-[#f5f5f5] rounded-lg border border-[#e0e0e0]">
      <div className="text-xs font-semibold text-[#7a8b8f] mb-2">🔧 工具调用 ({parts.length})</div>
      <div className="space-y-2">
        {parts.map((tool, i) => (
          <ToolItem key={i} tool={tool} getToolIcon={getToolIcon} />
        ))}
      </div>
    </div>
  );
}

function ToolItem({ tool, getToolIcon }: { tool: MessagePart, getToolIcon: (t?: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  
  const state = tool.state || {};
  const status = state.status || 'completed';
  const input = state.input || {};
  const output = state.output || '';

  return (
    <div className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
      <button 
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-[#f4f9f7] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm">{getToolIcon(tool.tool)}</span>
        <span className="flex-1 text-[13px] font-medium">{tool.title || tool.tool || 'Tool'}</span>
        
        {status === 'completed' && <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-[#e8f5e9] text-[#4caf50]">✓ 完成</span>}
        {status === 'error' && <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-[#ffebee] text-[#f44336]">✗ 错误</span>}
        {status === 'running' && <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-[#fff3e0] text-[#ff9800]">⏳ 运行中</span>}
        
        <span className="text-[#7a8b8f]">
           {expanded ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
        </span>
      </button>

      {expanded && (
        <div className="p-3 bg-white border-t border-[#e0e0e0]">
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-[#7a8b8f] uppercase tracking-wider mb-2">输入</div>
            <pre className="font-mono text-[12px] leading-relaxed bg-[#f8f9fa] p-3 rounded-md overflow-x-auto border border-[#e9ecef] whitespace-pre-wrap break-all max-h-[400px]">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#7a8b8f] uppercase tracking-wider mb-2">输出</div>
            <pre className="font-mono text-[12px] leading-relaxed bg-[#f8f9fa] p-3 rounded-md overflow-x-auto border border-[#e9ecef] whitespace-pre-wrap break-all max-h-[400px]">
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
