import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Agent API',
      items: [
        'agents/index',
        'agents/setup',
        'agents/discovery',
        'agents/trading',
        'agents/liquidity',
        'agents/error-handling',
        'agents/rate-limits',
        'agents/reference',
      ],
    },
  ],
};

export default sidebars;
