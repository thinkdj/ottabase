import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@ottabase/i18n/react';
import { supportedLanguages, languageNames } from '@ottabase/i18n/react';
import { Card, Container, Stack, Title, Text, Group, Badge, Code, Table } from '@mantine/core';

export function I18nDemoPage() {
    const { t, i18n } = useTranslation('common');

    return (
        <Container size="lg">
            <Stack gap="xl">
                <div>
                    <Title order={1} mb="md">
                        Internationalization (i18n) Demo
                    </Title>
                    <Text c="dimmed">
                        This page demonstrates the i18n functionality integrated into the Ottabase monorepo using
                        i18next and react-i18next.
                    </Text>
                </div>

                {/* Current Language */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={3} mb="md">
                        Current Language
                    </Title>
                    <Group gap="md">
                        <Badge size="lg" variant="filled">
                            {languageNames[i18n.language as keyof typeof languageNames] || i18n.language}
                        </Badge>
                        <Text size="sm" c="dimmed">
                            Language Code: <Code>{i18n.language}</Code>
                        </Text>
                    </Group>
                </Card>

                {/* Language Switcher */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={3} mb="md">
                        Language Switcher Component
                    </Title>
                    <Text mb="md" c="dimmed">
                        Use the language switcher to change the application language. Changes are persisted to
                        localStorage.
                    </Text>
                    <Group gap="md">
                        <LanguageSwitcher variant="filled" showLabel />
                        <LanguageSwitcher variant="outline" showLabel />
                        <LanguageSwitcher variant="subtle" showLabel={false} />
                    </Group>
                </Card>

                {/* Supported Languages */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={3} mb="md">
                        Supported Languages
                    </Title>
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Language Code</Table.Th>
                                <Table.Th>Language Name</Table.Th>
                                <Table.Th>Status</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {supportedLanguages.map((lang) => (
                                <Table.Tr key={lang}>
                                    <Table.Td>
                                        <Code>{lang}</Code>
                                    </Table.Td>
                                    <Table.Td>{languageNames[lang]}</Table.Td>
                                    <Table.Td>
                                        {i18n.language === lang ? (
                                            <Badge color="green" variant="light">
                                                Active
                                            </Badge>
                                        ) : (
                                            <Badge variant="light">Available</Badge>
                                        )}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Card>

                {/* Translation Examples */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={3} mb="md">
                        Translation Examples
                    </Title>
                    <Text mb="lg" c="dimmed">
                        Below are examples of common translations. Switch languages to see them change in real-time.
                    </Text>
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Translation Key</Table.Th>
                                <Table.Th>Translated Value</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            <Table.Tr>
                                <Table.Td>
                                    <Code>welcome</Code>
                                </Table.Td>
                                <Table.Td>{t('welcome')}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>
                                    <Code>language</Code>
                                </Table.Td>
                                <Table.Td>{t('language')}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>
                                    <Code>loading</Code>
                                </Table.Td>
                                <Table.Td>{t('loading')}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>
                                    <Code>save</Code>
                                </Table.Td>
                                <Table.Td>{t('save')}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>
                                    <Code>cancel</Code>
                                </Table.Td>
                                <Table.Td>{t('cancel')}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>
                                    <Code>delete</Code>
                                </Table.Td>
                                <Table.Td>{t('delete')}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>
                                    <Code>settings</Code>
                                </Table.Td>
                                <Table.Td>{t('settings')}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Td>
                                    <Code>logout</Code>
                                </Table.Td>
                                <Table.Td>{t('logout')}</Table.Td>
                            </Table.Tr>
                        </Table.Tbody>
                    </Table>
                </Card>

                {/* Usage Example */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={3} mb="md">
                        Usage Example
                    </Title>
                    <Text mb="md" c="dimmed">
                        Here's how to use i18n in your components:
                    </Text>
                    <Code block>
                        {`import { useTranslation } from '@ottabase/i18n/react';

function MyComponent() {
  const { t, i18n } = useTranslation('common');

  return (
    <div>
      <h1>{t('welcome')}</h1>
      <button onClick={() => i18n.changeLanguage('es')}>
        Change to Spanish
      </button>
    </div>
  );
}`}
                    </Code>
                </Card>

                {/* Features */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={3} mb="md">
                        Features
                    </Title>
                    <Stack gap="sm">
                        <Group gap="xs">
                            <Badge color="blue">Type-Safe</Badge>
                            <Text size="sm">Full TypeScript support with autocomplete for translation keys</Text>
                        </Group>
                        <Group gap="xs">
                            <Badge color="green">Auto-Detection</Badge>
                            <Text size="sm">Automatically detects user's browser language</Text>
                        </Group>
                        <Group gap="xs">
                            <Badge color="violet">Persistent</Badge>
                            <Text size="sm">Language preference saved to localStorage</Text>
                        </Group>
                        <Group gap="xs">
                            <Badge color="orange">Namespaced</Badge>
                            <Text size="sm">Organize translations by namespace for better code splitting</Text>
                        </Group>
                        <Group gap="xs">
                            <Badge color="pink">Extensible</Badge>
                            <Text size="sm">Easy to add new languages and translation keys</Text>
                        </Group>
                    </Stack>
                </Card>
            </Stack>
        </Container>
    );
}
