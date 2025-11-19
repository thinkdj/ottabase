import React, { ReactNode } from 'react';
import { Box, Text, ThemeIcon } from '@mantine/core';
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconAlertCircleFilled,
  IconBulb,
  IconCheck,
} from '@tabler/icons-react';

export type CalloutType = 'note' | 'tip' | 'warning' | 'danger' | 'success' | 'info';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
  collapsible?: boolean;
}

const calloutConfig = {
  note: {
    icon: IconInfoCircle,
    color: 'blue',
    lightBg: 'rgba(34, 139, 230, 0.1)',
    darkBg: 'rgba(34, 139, 230, 0.15)',
    borderColor: 'rgb(34, 139, 230)',
  },
  tip: {
    icon: IconBulb,
    color: 'teal',
    lightBg: 'rgba(18, 184, 134, 0.1)',
    darkBg: 'rgba(18, 184, 134, 0.15)',
    borderColor: 'rgb(18, 184, 134)',
  },
  warning: {
    icon: IconAlertTriangle,
    color: 'yellow',
    lightBg: 'rgba(250, 176, 5, 0.1)',
    darkBg: 'rgba(250, 176, 5, 0.15)',
    borderColor: 'rgb(250, 176, 5)',
  },
  danger: {
    icon: IconAlertCircleFilled,
    color: 'red',
    lightBg: 'rgba(250, 82, 82, 0.1)',
    darkBg: 'rgba(250, 82, 82, 0.15)',
    borderColor: 'rgb(250, 82, 82)',
  },
  success: {
    icon: IconCheck,
    color: 'green',
    lightBg: 'rgba(64, 192, 87, 0.1)',
    darkBg: 'rgba(64, 192, 87, 0.15)',
    borderColor: 'rgb(64, 192, 87)',
  },
  info: {
    icon: IconInfoCircle,
    color: 'cyan',
    lightBg: 'rgba(21, 170, 191, 0.1)',
    darkBg: 'rgba(21, 170, 191, 0.15)',
    borderColor: 'rgb(21, 170, 191)',
  },
};

export function Callout({ type = 'note', title, children }: CalloutProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;
  const defaultTitle = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <Box
      my="md"
      p="md"
      className={`docs-callout docs-callout-${type}`}
      data-docs-callout
      style={(theme) => ({
        borderLeft: `4px solid ${config.borderColor}`,
        borderRadius: theme.radius.md,
      })}
    >
      <Box mb={title || defaultTitle ? 'xs' : 0} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ThemeIcon color={config.color} variant="light" size="sm">
          <Icon size={16} />
        </ThemeIcon>
        <Text fw={600} size="sm">
          {title || defaultTitle}
        </Text>
      </Box>
      <Box pl={28}>
        {children}
      </Box>
    </Box>
  );
}
