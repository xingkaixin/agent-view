// 模型配置 - 定义模型对应的厂商和图标
export const ModelConfig = {
  // 模型到厂商的映射
  modelToProvider: {
    "kimi-k2.5": "kimi",
    // 可以添加更多模型映射
    // 'gpt-4': 'openai',
    // 'claude-3-opus': 'anthropic',
  } as Record<string, string>,

  // 厂商信息
  providers: {
    kimi: {
      name: "Kimi",
      icon: "/icon/provider/kimi.svg",
    },
    // 可以添加更多厂商
    // 'openai': { name: 'OpenAI', icon: '/icon/provider/openai.svg' },
    // 'anthropic': { name: 'Anthropic', icon: '/icon/provider/anthropic.svg' },
  } as Record<string, { name: string; icon: string }>,

  // Agent 图标配置
  agents: {
    opencode: {
      name: "OpenCode",
      icon: "/icon/agent/opencode.png",
    },
  } as Record<string, { name: string; icon: string }>,

  // 获取模型对应的厂商信息
  getProvider(modelName: string) {
    const providerKey = this.modelToProvider[modelName];
    if (providerKey) {
      return {
        key: providerKey,
        ...this.providers[providerKey],
      };
    }
    return null;
  },

  // 获取模型显示名称
  getModelDisplayName(modelName: string) {
    const provider = this.getProvider(modelName);
    if (provider) {
      return `${provider.name} ${modelName}`;
    }
    return modelName;
  },

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
