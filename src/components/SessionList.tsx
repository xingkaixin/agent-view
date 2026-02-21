import { Search, Folder, Clock, MessageSquare, Coins, CircleDollarSign, Bot } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ModelConfig } from "../config";
import { SessionInfo } from "../types";
import { Badge } from "./ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";

interface SessionListProps {
  sessions: SessionInfo[];
}

export function SessionList({ sessions }: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = sessions
    .filter((session) => session.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.time_created).getTime() - new Date(a.time_created).getTime());

  const formatTokens = (n: number) => {
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1) + "M";
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1) + "K";
    }
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
          const date = new Date(session.time_created).toLocaleString("zh-CN");
          const slug = session.slug || session.id;
          const agent = session.slug ? session.slug.split("/")[0] : "opencode";
          const agentName = ModelConfig.getAgentName(agent) || agent;
          const agentIcon = ModelConfig.agents[agent.toLowerCase()]?.icon;

          return (
            <Link
              key={session.id}
              to={`/${slug}`}
              className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl"
            >
              <Card className="hover:shadow-md transition-all hover:-translate-y-0.5 border-[#c9d8d5] shadow-sm cursor-pointer bg-[#fdfdfb]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold leading-relaxed">
                    {session.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-[13px] text-[#4f6368] mb-3">
                    <span className="flex items-center gap-1.5">
                      {agentIcon ? (
                        <img src={agentIcon} alt={agent} className="w-3.5 h-3.5" />
                      ) : (
                        <Bot className="w-3.5 h-3.5" />
                      )}{" "}
                      {agentName}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5" /> {session.directory}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {date}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge
                      variant="secondary"
                      className="bg-[#e5f1ec] text-[#102124] border-[#c9d8d5] font-normal rounded-full px-2.5 hover:bg-[#e5f1ec]"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" /> {session.stats.message_count} 消息
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-[#e5f1ec] text-[#102124] border-[#c9d8d5] font-normal rounded-full px-2.5 hover:bg-[#e5f1ec]"
                    >
                      <Coins className="w-3 h-3 mr-1" />{" "}
                      {formatTokens(
                        session.stats.total_input_tokens + session.stats.total_output_tokens,
                      )}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-[#e5f1ec] text-[#102124] border-[#c9d8d5] font-normal rounded-full px-2.5 hover:bg-[#e5f1ec]"
                    >
                      <CircleDollarSign className="w-3 h-3 mr-1" /> $
                      {session.stats.total_cost.toFixed(4)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
