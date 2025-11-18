import React, { useState } from 'react';
import { Box, Text, NavLink, Stack, Collapse } from '@mantine/core';
import { IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import type { SidebarConfig, DocGroup, DocItem } from '../types';

interface SidebarProps {
  config: SidebarConfig;
  currentSlug?: string;
  onNavigate?: (item: DocItem) => void;
}

export function Sidebar({ config, currentSlug, onNavigate }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupTitle]: !prev[groupTitle] }));
  };

  const renderDocItem = (item: DocItem) => {
    const isActive = currentSlug === item.slug;

    return (
      <NavLink
        key={item.slug}
        label={item.title}
        active={isActive}
        onClick={() => onNavigate?.(item)}
        style={{
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '2px',
        }}
        styles={{
          label: {
            fontSize: '14px',
            fontWeight: isActive ? 600 : 400,
          },
        }}
      />
    );
  };

  const renderGroup = (group: DocGroup) => {
    const isOpen = openGroups[group.title] !== false; // Default to open

    return (
      <Box key={group.title} mb="md">
        <NavLink
          label={group.title}
          leftSection={
            isOpen ? (
              <IconChevronDown size={16} stroke={2} />
            ) : (
              <IconChevronRight size={16} stroke={2} />
            )
          }
          onClick={() => toggleGroup(group.title)}
          style={{
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '4px',
          }}
          styles={{
            label: {
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            },
          }}
        />
        <Collapse in={isOpen}>
          <Box pl="md">{group.items.map(renderDocItem)}</Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Box
      style={{
        position: 'sticky',
        top: '2rem',
        maxHeight: 'calc(100vh - 4rem)',
        overflowY: 'auto',
        paddingRight: '1rem',
      }}
    >
      <Stack gap="xs">
        {config.groups && config.groups.map(renderGroup)}
        {config.items && config.items.map(renderDocItem)}
      </Stack>
    </Box>
  );
}
