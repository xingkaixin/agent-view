import { useState } from 'react';
import { Session } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Search, Folder, Clock, MessageSquare, Coins, CircleDollarSign } from 'lucide-react';

interface SessionListProps {
  sessions: Session[];
}

export function SessionList({ sessions }: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions
    .filter(session => session.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.time_created - a.time_created);

  const formatTokens = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索会话标题..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white shadow-sm"
        />
      </div>

      <div className="grid gap-4">
        {filteredSessions.map((session) => {
          const date = new Date(session.time_created).toLocaleString('zh-CN');
          const slug = session._urlSlug || session.id;

          return (
            <a key={session.id} href={`#opencode/${slug}`} className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl">
              <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 border-[#c9d8d5] shadow-sm cursor-pointer bg-[#fdfdfb]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold leading-relaxed">
                    {session.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-[13px] text-[#4f6368] mb-3">
                    <span className="flex items-center gap-1.5"><Folder className="w-3.5 h-3.5"/> {session.directory}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {date}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary" className="bg-[#e5f1ec] hover:bg-[#c9d8d5] text-[#102124] border-[#c9d8d5] font-normal rounded-full px-2.5">
                      <MessageSquare className="w-3 h-3 mr-1" /> {session.stats.message_count} 消息
                    </Badge>
                    <Badge variant="secondary" className="bg-[#e5f1ec] hover:bg-[#c9d8d5] text-[#102124] border-[#c9d8d5] font-normal rounded-full px-2.5">
                      <Coins className="w-3 h-3 mr-1" /> {formatTokens(session.stats.total_input_tokens + session.stats.total_output_tokens)}
                    </Badge>
                    <Badge variant="secondary" className="bg-[#e5f1ec] hover:bg-[#c9d8d5] text-[#102124] border-[#c9d8d5] font-normal rounded-full px-2.5">
                      <CircleDollarSign className="w-3 h-3 mr-1" /> ${session.stats.total_cost.toFixed(4)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
