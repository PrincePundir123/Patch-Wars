export const COMMAND_REFERENCE = [
  {
    command: 'join',
    example: '!join',
    group: 'Battle',
    description: 'Register your participation with the community whose channel you are watching.',
  },
  {
    command: 'spawn',
    example: '!spawn archer',
    group: 'Battle',
    description:
      'Deploy a unit using your team’s energy. Replace archer with an available unit ID; the unit library shows costs.',
  },
  {
    command: 'attack',
    example: '!attack',
    group: 'Battle',
    description:
      'Deploy a Sprinter using team energy. This creates a unit; it does not move an existing army.',
  },
  {
    command: 'defend',
    example: '!defend',
    group: 'Battle',
    description: 'Deploy a Guardian using team energy to reinforce your side.',
  },
  {
    command: 'forge',
    example: '!forge a moss turtle with a shield',
    group: 'Community Forge',
    description:
      'Propose a unit while proposals are open. The community votes; the selected idea is validated and balance-tested before deployment.',
  },
  {
    command: 'vote',
    example: '!vote p1',
    group: 'Community Forge',
    description:
      'Vote during the voting phase. Replace p1 with a proposal ID from Community blueprints. A new vote replaces your previous vote.',
  },
  {
    command: 'units',
    example: '!units',
    group: 'Information',
    description: 'Show available unit IDs and their energy costs in the arena’s command feedback.',
  },
  {
    command: 'score',
    example: '!score',
    group: 'Information',
    description: 'Show the teams’ current elimination scores in command feedback.',
  },
  {
    command: 'help',
    example: '!help',
    group: 'Information',
    description: 'Show a short command list in the arena’s command feedback.',
  },
] as const;
