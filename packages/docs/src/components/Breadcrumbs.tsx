import React from 'react';
import { Breadcrumbs as MantineBreadcrumbs, Anchor, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';

interface BreadcrumbItem {
  title: string;
  slug: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (slug: string) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <MantineBreadcrumbs
      separator={<IconChevronRight size={14} />}
      mb="md"
      styles={{
        separator: {
          marginLeft: '4px',
          marginRight: '4px',
        },
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        if (isLast) {
          return (
            <Text key={item.slug} size="sm" c="dimmed">
              {item.title}
            </Text>
          );
        }

        return (
          <Anchor
            key={item.slug}
            size="sm"
            onClick={() => onNavigate?.(item.slug)}
            style={{ cursor: 'pointer' }}
          >
            {item.title}
          </Anchor>
        );
      })}
    </MantineBreadcrumbs>
  );
}
