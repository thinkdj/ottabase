'use client';

import { SlotRenderer } from '../../components/SlotRenderer';

const ABOUT_DATA = {
    githubUrl: 'https://github.com/thinkdj/ottabase',
};

export default function AboutPage() {
    return <SlotRenderer slot="about" data={ABOUT_DATA} />;
}
