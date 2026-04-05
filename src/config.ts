// 模型配置 - 定义模型对应的厂商和图标
export const ModelConfig = {
  // Agent 图标配置
  agents: {
    opencode: {
      name: "OpenCode",
      icon: "/icon/agent/opencode.svg",
    },
    codex: {
      name: "Codex",
      icon: "/icon/agent/codex.svg",
    },
    cursor: {
      name: "Cursor",
      icon: "/icon/agent/cursor.svg",
    },
    kimi: {
      name: "Kimi-Cli",
      icon: "/icon/agent/kimi.svg",
    },
    claudecode: {
      name: "Claude Code",
      icon: "/icon/agent/claudecode.svg",
    },
    kilo: {
      name: "Kilo Code",
      icon: "/icon/agent/kilocode.svg",
    },
    antigravity: {
      name: "Antigravity",
      icon: "/icon/agent/antigravity.svg",
    },
  } as Record<string, { name: string; icon: string }>,

  // 获取默认 Agent key
  getDefaultAgentKey() {
    const keys = Object.keys(this.agents);
    return keys.length > 0 ? keys[0] : null;
  },

  // 获取 Agent 显示名称
  getAgentName(agentName: string) {
    let agent = this.agents[agentName];
    if (!agent) {
      agent = this.agents[agentName.toLowerCase()];
    }
    return agent ? agent.name : agentName;
  },
};
