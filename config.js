// 模型配置 - 定义模型对应的厂商和图标
const ModelConfig = {
  // 模型到厂商的映射
  modelToProvider: {
    "kimi-k2.5": "kimi",
    // 可以添加更多模型映射
    // 'gpt-4': 'openai',
    // 'claude-3-opus': 'anthropic',
  },

  // 厂商信息
  providers: {
    kimi: {
      name: "Kimi",
      icon: "/icon/provider/kimi.svg",
    },
    // 可以添加更多厂商
    // 'openai': { name: 'OpenAI', icon: '/icon/provider/openai.svg' },
    // 'anthropic': { name: 'Anthropic', icon: '/icon/provider/anthropic.svg' },
  },

  // Agent 图标配置
  agents: {
    opencode: {
      name: "OpenCode",
      icon: "/icon/agent/opencode.png",
    },
  },

  // 获取模型对应的厂商信息
  getProvider(modelName) {
    const providerKey = this.modelToProvider[modelName];
    if (providerKey) {
      return {
        key: providerKey,
        ...this.providers[providerKey],
      };
    }
    return null;
  },

  // 获取模型对应的图标 HTML
  getModelIconHtml(modelName) {
    const provider = this.getProvider(modelName);
    if (provider && provider.icon) {
      return `<img src="${provider.icon}" alt="${provider.name}" class="provider-icon" />`;
    }
    return "🧠";
  },

  // 获取模型显示名称
  getModelDisplayName(modelName) {
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
  getAgentName(agentName) {
    let agent = this.agents[agentName];
    if (!agent) {
      agent = this.agents[agentName.toLowerCase()];
    }
    return agent ? agent.name : agentName;
  },

  // 获取 Agent 图标 HTML
  getAgentIconHtml(agentName) {
    // 尝试精确匹配，然后尝试小写匹配
    let agent = this.agents[agentName];
    if (!agent) {
      agent = this.agents[agentName.toLowerCase()];
    }
    if (agent && agent.icon) {
      return `<img src="${agent.icon}" alt="${agent.name}" class="agent-icon" />`;
    }
    return "🤖";
  },
};

// 导出配置
if (typeof module !== "undefined" && module.exports) {
  module.exports = ModelConfig;
}
