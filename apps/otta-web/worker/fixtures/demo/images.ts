/**
 * The photographs the demo uses, all public Unsplash images (free to use under the Unsplash
 * licence, hotlinked at a sensible width). Each one becomes a media library row and is referenced
 * by posts through the same URL, so the picker, the lightbox and the pages agree.
 */
export interface DemoImage {
    /** Unsplash photo id, the part after "photo-" */
    id: string;
    title: string;
    alt: string;
    caption?: string;
    /** Rendered aspect, used for the media row and for layout before the image loads */
    width: number;
    height: number;
}

export const UNSPLASH = 'https://images.unsplash.com/photo-';

/** A hotlink at the given width; Unsplash resizes on the fly */
export const unsplash = (image: DemoImage, width = 1600) => `${UNSPLASH}${image.id}?w=${width}&q=80`;

const landscape = { width: 1600, height: 1067 };
const portrait = { width: 400, height: 400 };

export const IMAGES = {
    // People
    maya: {
        id: '1494790108377-be9c29b29330',
        title: 'Maya Okafor',
        alt: 'Maya Okafor, smiling, in soft daylight',
        ...portrait,
    },
    tomas: {
        id: '1507003211169-0a1dd7228f2d',
        title: 'Tomás Ferreira',
        alt: 'Tomás Ferreira, close portrait',
        ...portrait,
    },
    priya: {
        id: '1438761681033-6461ffad8d80',
        title: 'Priya Raman',
        alt: 'Priya Raman, portrait with a warm background',
        ...portrait,
    },
    jonas: {
        id: '1500648767791-00dcc994a43e',
        title: 'Jonas Lindqvist',
        alt: 'Jonas Lindqvist, portrait outdoors',
        ...portrait,
    },

    // Places
    coast: {
        id: '1471922694854-ff1b63b20054',
        title: 'Coast at first light',
        alt: 'A quiet coastline at first light',
        caption: 'The coast road, an hour before anyone else was up.',
        ...landscape,
    },
    sunsetWaves: {
        id: '1439405326854-014607f694d7',
        title: 'Sunset over open water',
        alt: 'Sunset over open water, seen from just above the waves',
        caption: 'Last light on the water.',
        ...landscape,
    },
    lisbonTram: {
        id: '1518548419970-58e3b4079ab2',
        title: 'Tram 28',
        alt: 'A yellow tram climbing a narrow Lisbon street',
        caption: 'Tram 28, the slow way up to the castle.',
        ...landscape,
    },
    lisbonStreet: {
        id: '1555881400-74d7acaacd8b',
        title: 'Alfama in the afternoon',
        alt: 'A tiled Lisbon street with laundry and a tram line',
        caption: 'Alfama, where every street turns into stairs.',
        ...landscape,
    },
    mountainLake: {
        id: '1506905925346-21bda4d32df4',
        title: 'Alpine lake at sunrise',
        alt: 'A still alpine lake reflecting snow-capped mountains at sunrise',
        caption: 'Sunrise over the lake, before the wind picked up.',
        ...landscape,
    },
    foggyMountains: {
        id: '1470071459604-3b5ec3a7fe05',
        title: 'Fog in the valley',
        alt: 'Forested mountain ridges fading into fog',
        caption: 'Fog filling the valley, one ridge at a time.',
        ...landscape,
    },
    alps: {
        id: '1464822759023-fed622ff2c3b',
        title: 'Snow on the ridge',
        alt: 'Snow-covered mountain peaks under a clear sky',
        caption: 'The ridge we did not climb.',
        ...landscape,
    },
    lakeDock: {
        id: '1470770903676-69b98201ea1c',
        title: 'Dock at dawn',
        alt: 'A wooden dock reaching into a calm lake at dawn',
        caption: 'The dock behind the cabin.',
        ...landscape,
    },
    forestLight: {
        id: '1441974231531-c6227db76b6e',
        title: 'Light in the forest',
        alt: 'Sunlight breaking through tall forest trees',
        caption: 'Morning light on the forest path.',
        ...landscape,
    },
    beach: {
        id: '1507525428034-b723cf961d3e',
        title: 'Beach from above',
        alt: 'A long sandy beach and turquoise water seen from above',
        ...landscape,
    },
    skyline: {
        id: '1477959858617-67f85cf4f1df',
        title: 'Downtown skyline',
        alt: 'A downtown skyline panorama at dusk',
        ...landscape,
    },
    avenue: {
        id: '1449824913935-59a10b8d2000',
        title: 'City avenue',
        alt: 'A wide city avenue framed by tall office towers',
        ...landscape,
    },
    tower: {
        id: '1486325212027-8081e485255e',
        title: 'Glass tower',
        alt: 'A glass and steel tower against the sky',
        ...landscape,
    },
    bridgeSunset: {
        id: '1444723121867-7a241cacace9',
        title: 'Bridge at sunset',
        alt: 'A city bridge silhouetted at sunset',
        ...landscape,
    },
    cityNight: {
        id: '1519501025264-65ba15a82390',
        title: 'City at night',
        alt: 'Neon-lit streets at night',
        ...landscape,
    },

    // Space
    earthNight: {
        id: '1451187580459-43490279c0fa',
        title: 'Earth at night',
        alt: 'Earth at night from orbit, cities glowing',
        caption: 'Every light is a request waiting for an answer close by.',
        ...landscape,
    },
    earth: { id: '1446776811953-b23d57bd21aa', title: 'Earth from orbit', alt: 'Earth from space', ...landscape },
    nebula: { id: '1462331940025-496dfbfc7564', title: 'Nebula', alt: 'A nebula in deep space', ...landscape },
    milkyWay: {
        id: '1614732414444-096e5f1122d5',
        title: 'Milky Way core',
        alt: 'The core of the Milky Way over a dark horizon',
        ...landscape,
    },

    // Work
    codeScreen: {
        id: '1461749280684-dccba630e2f6',
        title: 'Code on screen',
        alt: 'Lines of code on a laptop screen',
        ...landscape,
    },
    laptopCode: {
        id: '1498050108023-c5249f4df085',
        title: 'Laptop with code',
        alt: 'A laptop showing an editor, on a wooden desk',
        ...landscape,
    },
    deskLaptop: {
        id: '1517694712202-14dd9538aa97',
        title: 'Desk, late',
        alt: 'A laptop glowing on a dark desk',
        caption: 'The late shift.',
        ...landscape,
    },
    deskNotebook: {
        id: '1484480974693-6ca0a78fb36b',
        title: 'Desk with notebook',
        alt: 'A tidy desk with a notebook, pen and coffee',
        caption: 'Pen first, keyboard second.',
        ...landscape,
    },
    deskWork: {
        id: '1499750310107-5fef28a66643',
        title: 'Writing desk',
        alt: 'A desk with a laptop, an open notebook and a plant',
        caption: 'Where most of the drafts happen.',
        ...landscape,
    },
    teamLaptops: {
        id: '1522071820081-009f0129c71c',
        title: 'Team at the table',
        alt: 'A team working together at one table with laptops',
        ...landscape,
    },
    teamMeeting: {
        id: '1552664730-d307ca884978',
        title: 'Planning session',
        alt: 'People around a table with notes and laptops',
        ...landscape,
    },
    workshop: {
        id: '1542744173-8e7e53415bb0',
        title: 'Workshop',
        alt: 'Someone presenting to a small group with a laptop',
        ...landscape,
    },
    serverRacks: {
        id: '1558494949-ef010cbdcc31',
        title: 'Server racks',
        alt: 'Rows of server racks lit in blue',
        ...landscape,
    },
    circuit: {
        id: '1518770660439-4636190af475',
        title: 'Circuit board',
        alt: 'Close-up of a circuit board',
        ...landscape,
    },
    books: { id: '1457369804613-52c61a468e7d', title: 'Open book', alt: 'An open book on a table', ...landscape },
    library: {
        id: '1481627834876-b7833e8f5570',
        title: 'Library',
        alt: 'Tall library shelves in warm light',
        ...landscape,
    },
    coffee: {
        id: '1495474472287-4d71bcdd2085',
        title: 'Coffee',
        alt: 'A cup of coffee with latte art on a wooden table',
        caption: 'The third coffee of the offsite.',
        ...landscape,
    },
    liquid: {
        id: '1557672172-298e090bd0f1',
        title: 'Liquid colour',
        alt: 'Abstract swirls of liquid colour',
        ...landscape,
    },
    neon: {
        id: '1550684376-efcbd6e3f031',
        title: 'Neon smoke',
        alt: 'Neon-coloured smoke on a dark background',
        ...landscape,
    },
} as const satisfies Record<string, DemoImage>;

export type ImageKey = keyof typeof IMAGES;

/** Media library rows for every photograph above */
export const DEMO_MEDIA = (Object.keys(IMAGES) as ImageKey[]).map((key) => {
    const image = IMAGES[key];
    return {
        key,
        storageKey: `demo/unsplash/${image.id}.jpg`,
        url: unsplash(image),
        thumbnailUrl: unsplash(image, 400),
        previewUrl: unsplash(image, 1200),
        originalName: `${key}.jpg`,
        title: image.title,
        altText: image.alt,
        caption: 'caption' in image ? image.caption : null,
        width: image.width,
        height: image.height,
    };
});
