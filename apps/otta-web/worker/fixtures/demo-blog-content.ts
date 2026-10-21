import type { BlogDemoPostSeed } from '@ottabase/ottablog/router';
import { parseFuzzyInput } from '@ottabase/ottadate/parse';
import {
    checklist,
    code,
    delimiter,
    doc,
    faq,
    frame,
    gallery,
    h,
    image,
    ol,
    on,
    p,
    quote,
    steps,
    table,
    ul,
    unsplash,
    warning,
} from './demo-blocks';
import kitchensinkContent from './kitchensink-content.json';

/**
 * Trusted, public sample content for a freshly provisioned demo deployment: the blog a person
 * might actually keep. Two photo journals, long reads with code, recipes, a review and a walking
 * map, short thoughts in between, and the block kitchensink for theme work. Between them they
 * use every content type the timeline shows, every block OttaEditor writes, tags, categories, a
 * series, footnotes and fuzzy "originally written" dates.
 *
 * Photographs are from Unsplash and free to use under the Unsplash License; journals credit
 * their photographer. Release notes live in `demo-whats-new.ts`.
 */

/** A short thought. The model derives a blurb's title and excerpt from its text. */
const blurb = (slug: string, date: string, text: string, tags: string[]): BlogDemoPostSeed => ({
    title: text,
    slug,
    blurbText: text,
    contentType: 'blurb',
    publishedAt: on(date),
    tags,
});

const lofotenJournal: BlogDemoPostSeed = {
    title: 'Three days of light in Lofoten',
    slug: 'three-days-of-light-in-lofoten',
    contentType: 'photo',
    isFeatured: true,
    publishedAt: on('2026-09-26'),
    originalDate: parseFuzzyInput('early april 2023'),
    tags: ['Norway', 'Lofoten', 'Winter', 'Drone'],
    categories: ['Travel'],
    photoNote:
        'Early April is the hinge of the Lofoten year. The cod season is winding down, the drying racks are still up, and the sun has just started staying out past dinner. We had three days, one rental car and a forecast that changed its mind every hour. These are the frames that survived the edit, roughly in the order they happened.',
    // The first frame is the journal's cover. Times are the camera's, converted to UTC.
    photoAlbum: [
        frame(
            '1681023930137-1d0a3e3158dc',
            [4032, 3024],
            '2023-04-03T16:08:40Z',
            'Cabins on stilts, the first evening',
            'Red fishermen’s cabins on stilts above a calm harbour, a snow-covered peak behind',
            'Lofoten',
        ),
        frame(
            '1681023930308-94d093bc23e4',
            [3024, 4032],
            '2023-04-03T15:36:57Z',
            'The harbour on arrival, boats in for the night',
            'Small fishing boats moored in a harbour beneath a snowy mountain',
            'Lofoten',
        ),
        frame(
            '1681023930177-18c1984225cf',
            [4032, 3024],
            '2023-04-03T16:23:02Z',
            'Rorbuer in a row, the classic Lofoten frame',
            'A row of red cabins along the water under a bright blue sky',
            'Lofoten',
        ),
        frame(
            '1681025243436-70663a275eed',
            [3915, 2936],
            '2023-04-04T05:16:14Z',
            'Dawn on day two, not a breath of wind',
            'Red and white houses mirrored perfectly in still water under a dramatic sky',
            'Lofoten',
        ),
        frame(
            '1681025242452-54ee1c3fc431',
            [2268, 3024],
            '2023-04-04T05:22:48Z',
            'Red and ochre, doubled in the water',
            'Red and ochre buildings on stilts reflected in a glassy harbour',
            'Lofoten',
        ),
        frame(
            '1681025243039-43d81e29a676',
            [4032, 3024],
            '2023-04-04T05:24:53Z',
            'A working boat, still moored at seven',
            'A wooden fishing boat moored in front of red houses with jagged peaks behind',
            'Lofoten',
        ),
        frame(
            '1681025243609-621f2e15bd24',
            [3024, 4032],
            '2023-04-04T05:18:31Z',
            'The waterfront from just above',
            'Red and yellow waterfront houses seen from slightly above, the town behind them',
            'Lofoten',
        ),
        frame(
            '1681025243319-59c5c476bc49',
            [3024, 4032],
            '2023-04-04T06:07:17Z',
            'Following a boat out toward the light',
            'The wake of a small boat heading toward a low golden sun between islands',
            'Lofoten',
        ),
        frame(
            '1681025243733-925a47988e41',
            [4032, 3024],
            '2023-04-04T06:04:28Z',
            'The village from above, just after eight',
            'Aerial view of a snowy fishing village along a channel, mountains on the horizon',
            'Lofoten',
        ),
        frame(
            '1681025243786-131a32e60967',
            [4032, 3024],
            '2023-04-04T06:08:09Z',
            'Sailboats waiting for spring',
            'A red house on a snowy pier with small sailboats moored below in warm light',
            'Lofoten',
        ),
        frame(
            '1681027100406-8e7d870c5ed1',
            [3024, 4032],
            '2023-04-04T08:33:53Z',
            'The road inland, all birch and switchbacks',
            'A cleared road between snowy birches leading toward a sharp mountain',
            'Lofoten',
        ),
        frame(
            '1681027098644-01f73b609393',
            [3024, 4032],
            '2023-04-04T09:05:21Z',
            'A causeway road from straight above',
            'Aerial view of a narrow road crossing snow and dark rock',
            'Lofoten',
        ),
        frame(
            '1681027104459-7deb829db0a9',
            [7200, 5184],
            '2023-04-04T09:41:16Z',
            'Skerries all the way to the horizon',
            'Calm sea scattered with small snowy islets under a grey sky',
            'Henningsvær',
        ),
        frame(
            '1681027099729-70da39869fde',
            [3024, 4032],
            '2023-04-04T09:54:42Z',
            'The harbour, from the air',
            'Aerial view of a harbour village spread across small islands, peaks behind',
            'Henningsvær',
        ),
        frame(
            '1681027101434-eeada3d35abb',
            [4032, 3024],
            '2023-04-05T10:19:09Z',
            'The pitch, half cleared of snow',
            'A football pitch on a rocky island, half covered in snow, the village and mountains behind',
            'Henningsvær',
        ),
        frame(
            '1681027101477-18474149c45d',
            [3024, 4032],
            '2023-04-05T10:19:27Z',
            'Same pitch, straight down the touchline',
            'Overhead view along a football pitch surrounded by snow and sea',
            'Henningsvær',
        ),
    ],
    content: doc(
        h('Day one: arriving in the blue'),
        p(
            'The bridges do most of the storytelling on the drive in. Island, causeway, island, bridge, until the road runs out of land and the villages start. We reached the harbour a little after half past five, with the boats already tucked in and the light doing the thing it only does this far north, where blue and gold share the same sky for an hour.',
        ),
        p(
            'The red cabins are <i>rorbuer</i>, built for the seasonal fishermen who came every winter for the cod. Most are guesthouses now, but they still stand on stilts over the tide line, still painted the same oxide red, and still creak when the wind swings round.',
        ),
        h('Day two: up before the light'),
        p(
            'By seven the water was flat enough to double every cabin on the shore, and the only sound was a gull arguing with itself. If you only get one morning in Lofoten, get up for it.',
        ),
        gallery('mosaic', 'Dawn on the water', 'Day two, between 7:15 and 7:30 in the morning', [
            [
                '1681025244176-2a5e30fad636',
                'Cabins and their reflections',
                'A row of red cabins reflected in still water at dawn',
            ],
            ['1681025242583-fc65d5ebafd8', 'Stilts at low tide', 'Red houses on wooden stilts above the shoreline'],
            ['1681025242474-a00a9b41b645', 'One red house', 'A single red house standing over calm water'],
            [
                '1681025243141-25cd6f243a13',
                'Moored, waiting',
                'A fishing boat docked in a harbour with mountains behind',
            ],
            ['1681025244282-5f354539a66a', 'The whole row', 'A long row of waterfront houses in early light'],
        ]),
        {
            type: 'beforeAfter',
            data: {
                beforeUrl: unsplash('1681025243436-70663a275eed'),
                afterUrl: `${unsplash('1681025243436-70663a275eed')}&sat=-100`,
                beforeLabel: 'As shot',
                afterLabel: 'Monochrome',
                orientation: 'horizontal',
                sliderPosition: 50,
                caption: 'The same frame twice. In colour it is a postcard; in black and white it is a weather report.',
                height: '440px',
                imageFit: 'cover',
                beforePosition: 'center',
                afterPosition: 'center',
            },
        },
        quote('The light this far north does not set so much as lean.', 'Field notebook, 4 April'),
        p(
            'By mid morning cloud rolled in from the west and we did what everyone does on a grey Lofoten day: drove the causeways and stopped every five minutes.',
        ),
        gallery('masonry', 'From above', 'Mid morning on day two, once the cloud came in', [
            ['1681025243714-ca0fa909b743', '', 'Aerial view of a snowy town along the water'],
            ['1681025243360-9e06f9c9059f', '', 'A channel running through a snow-covered village'],
            ['1681027099302-356e642aee76', '', 'A small rocky island dusted with snow'],
            ['1681027100047-371629c0855c', '', 'A harbour full of boats under a snowy mountain'],
            ['1681027100114-41f68d1cc736', '', 'Open water ringed by snow-covered mountains'],
            ['1681027100215-cad7b41d71c7', '', 'A steep snowy slope dropping into the sea'],
        ]),
        h('Day three: a football pitch at the edge of the sea'),
        p(
            'Henningsvær’s pitch sits on a rock at the end of the village, water on three sides, and it is exactly as improbable in person as it is in every photograph of it. In April it was half cleared of snow. Someone had been playing, judging by the footprints.',
        ),
        {
            type: 'imageHotspots',
            data: {
                imageUrl: unsplash('1681027101434-eeada3d35abb', 2000),
                alt: 'Aerial view of the Henningsvær football pitch, the village and the mountains of Austvågøya',
                caption: 'Tap a pin.',
                imageFit: 'contain',
                imagePosition: 'center',
                hotspots: [
                    {
                        id: 'pitch',
                        x: 48,
                        y: 72,
                        title: 'The pitch',
                        content:
                            'Artificial turf on bare rock, and the reason most visitors make the detour. The nets behind the goals catch the ball, mostly.',
                    },
                    {
                        id: 'racks',
                        x: 16,
                        y: 50,
                        title: 'Drying racks',
                        content:
                            'Wooden racks where cod hangs from late winter into early summer, drying in the wind to become stockfish.',
                    },
                    {
                        id: 'harbour',
                        x: 44,
                        y: 30,
                        title: 'The harbour',
                        content: 'The village is spread across a cluster of small islands joined by bridges.',
                    },
                    {
                        id: 'peaks',
                        x: 52,
                        y: 12,
                        title: 'Austvågøya',
                        content: 'The largest island in the chain, and the backdrop to most of this trip.',
                    },
                ],
            },
        },
        gallery('filmstrip', 'The pitch, five ways', 'Swipe along. Day three, a little after noon.', [
            ['1681027100904-5113219f749b', '', 'The pitch on its island from a low angle'],
            ['1681027102088-9c1395b750eb', '', 'The pitch surrounded by snow and rock'],
            ['1681027101274-fbc87a2c15cb', '', 'The pitch island seen from further out to sea'],
            ['1681027101347-99b4b42170a7', '', 'The pitch and the village behind it'],
            ['1681027100696-7cebc1537efb', '', 'The village and pitch with snowy mountains beyond'],
        ]),
        h('Where it all is'),
        {
            type: 'map',
            data: {
                url: 'https://www.openstreetmap.org/#map=10/68.20/14.40',
                provider: 'openstreetmap',
                theme: 'default',
                height: 360,
                zoom: 10,
                caption: 'Austvågøya and the islands around Henningsvær.',
            },
        },
        table(
            ['Day', 'Plan', 'Light', 'Keeper'],
            ['Monday, 3 April', 'Drive in, harbour walk', 'Clear, gold by six', 'Cabins on stilts'],
            ['Tuesday, 4 April', 'Dawn shoot, then the causeways', 'Flat calm, then cloud', 'The dawn reflections'],
            ['Wednesday, 5 April', 'Henningsvær, then the long road out', 'Bright overcast', 'The pitch from above'],
        ),
        h('What earned its place in the bag', 3),
        checklist(
            ['Microspikes for the icy harbour steps', true],
            ['Spare batteries in an inside pocket, because the cold eats them', true],
            ['A thermos, refilled every morning', true],
            ['The tripod, which never left the car', false],
        ),
        warning(
            'Before you fly',
            'Drone rules in Norway follow the European ones: register as an operator, keep well clear of people, and check for restricted zones around the airports at Svolvær and Leknes. Rules change, so check with the Norwegian Civil Aviation Authority before every trip.',
        ),
        p(
            '<i>Photographs by Daniel Diemer, from Unsplash. Taken from 3 to 5 April 2023, written up the week after, published here much later.</i>',
        ),
    ),
};

const keralaJournal: BlogDemoPostSeed = {
    title: 'Slow water',
    slug: 'slow-water-kerala-backwaters',
    contentType: 'photo',
    publishedAt: on('2026-07-12'),
    originalDate: parseFuzzyInput('late october 2016'),
    tags: ['India', 'Kerala', 'Houseboats'],
    categories: ['Travel'],
    photoNote:
        'Kerala’s backwaters are a maze of canals, rivers and lagoons behind the Arabian Sea coast, and the way to see them is slowly: on a kettuvallam, a rice barge rebuilt as a houseboat, with nothing to do but watch the banks go by. Late October, the rains not quite finished, everything green and the water carpeted with hyacinth.',
    // The camera's clock was set to Australian Eastern Daylight Time; converted to UTC here.
    photoAlbum: [
        frame(
            '1593417033772-3f63f5b8f804',
            [4282, 2854],
            '2016-10-29T12:09:24Z',
            'A houseboat comes in at dusk',
            'A houseboat silhouetted at dusk beyond a carpet of water hyacinth',
            'Kerala backwaters',
        ),
        frame(
            '1597458816655-6c077c9a17ec',
            [4277, 2851],
            '2016-10-26T04:38:58Z',
            'An elephant and its mahout, three days before the water',
            'A man walking ahead of an elephant on a dusty path between trees',
            'Kerala',
        ),
        frame(
            '1593417033852-66b46de814b8',
            [4424, 2949],
            '2016-10-29T11:46:51Z',
            'Two storeys of houseboat, one man in a canoe',
            'A large two-storey wooden houseboat moored under palms, a small canoe beside it',
            'Kerala backwaters',
        ),
        frame(
            '1593417034123-609e40341d20',
            [4380, 2920],
            '2016-10-29T12:02:23Z',
            'Sunset, and someone still fishing',
            'A low orange sun over a lake, a lone canoe silhouetted among the reeds',
            'Kerala backwaters',
        ),
        frame(
            '1593417034675-3ed7eda1bee9',
            [4462, 2974],
            '2016-10-29T12:16:27Z',
            'Through the hyacinth',
            'A canoe and a houseboat crossing water thick with floating hyacinth',
            'Kerala backwaters',
        ),
        frame(
            '1593417033920-3c04818ee8a8',
            [4027, 2684],
            '2016-10-29T12:19:58Z',
            'A kettuvallam, the old rice barge shape',
            'A thatched houseboat almost hidden behind a field of water hyacinth',
            'Kerala backwaters',
        ),
        frame(
            '1593417033868-d18d4099d78e',
            [4515, 3010],
            '2016-10-30T06:31:45Z',
            'Cormorants, holding court',
            'Cormorants perched along a bare branch above the water',
            'Kerala backwaters',
        ),
        frame(
            '1597387019303-dad392814837',
            [4598, 1652],
            '2016-10-30T06:39:50Z',
            'Houseboats along the bank, end to end',
            'A long line of houseboats moored beneath coconut palms',
            'Kerala backwaters',
        ),
        frame(
            '1593417034505-afe9e3faf3f4',
            [4314, 2876],
            '2016-10-30T06:40:29Z',
            'Open water at last',
            'A houseboat crossing a wide stretch of open water',
            'Kerala backwaters',
        ),
        frame(
            '1593417033942-bcdf26b74700',
            [4172, 2835],
            '2016-10-30T06:47:04Z',
            'Into a side canal',
            'A houseboat turning into a narrow canal between palm trees',
            'Kerala backwaters',
        ),
    ],
    content: doc(
        p(
            'There is no itinerary on a houseboat. The boat moves at the speed of a person walking, lunch arrives when it arrives, and the light changes faster than the view does.',
        ),
        quote('Nothing on the backwaters is in a hurry, including the water.', 'Field notebook, 30 October'),
        h('Notes for next time', 3),
        ul(
            'Water hyacinth looks like a lawn and flowers purple, but it chokes the channels. Boatmen spend whole mornings clearing it.',
            'Ask for a boat that moors away from the main jetties. The nights are much quieter.',
            'Bring a long lens. The cormorants will not wait for you to get closer.',
            'Eat whatever the cook brought on board that morning: <i>karimeen</i>, pearl spot fish, if you are lucky.',
        ),
        p('<i>Photographs by Kunal Kalra, from Unsplash.</i>'),
    ),
};

const alfamaWalk: BlogDemoPostSeed = {
    title: 'A walking map of Alfama, one wrong turn at a time',
    slug: 'a-walking-map-of-alfama',
    contentType: 'blog',
    isFeatured: true,
    publishedAt: on('2026-08-29'),
    excerpt:
        'Lisbon’s oldest neighbourhood has stairs instead of streets and no two corners at the same angle. A route through it, and permission to abandon the route.',
    heroImage: {
        url: unsplash('1675194722358-4d36d837dfc7', 2000),
        alt: 'Early morning light over the terracotta rooftops and church towers of Alfama',
        caption: 'Alfama at sunrise, from the top of the hill.',
    },
    seoMeta: {
        description:
            'A self-guided walk through Alfama, Lisbon: viewpoints, stairs, tram 28, fado and the flea market.',
        keywords: ['Lisbon', 'Alfama', 'walking tour', 'tram 28', 'Feira da Ladra'],
    },
    tags: ['Lisbon', 'Portugal', 'City walks'],
    categories: ['Travel'],
    content: doc(
        p(
            'Alfama is the oldest neighbourhood in Lisbon, and the 1755 earthquake largely spared it, which is why it still has the street plan of a medieval town: stairs instead of roads, alleys that end at somebody’s front door, and no two corners at the same angle. Maps help less than you would think.',
        ),
        p(
            'This is the walk I would give a friend, with the honest admission that you will get lost on it, and that getting lost is most of the point.',
        ),
        h('Start at the top'),
        p(
            'Take a tram or a taxi up to the Miradouro de Santa Luzia and walk down from there. Everything below is downhill, which your knees will appreciate by the afternoon. The terrace next door, Portas do Sol, has the view from every postcard:',
        ),
        {
            type: 'imageHotspots',
            data: {
                imageUrl: unsplash('1501927023255-9063be98970c', 2000),
                alt: 'Alfama rooftops with the Monastery of São Vicente de Fora on the left and the white dome of the National Pantheon on the right',
                caption: 'The view east from the viewpoints. Tap a pin.',
                imageFit: 'contain',
                imagePosition: 'center',
                hotspots: [
                    {
                        id: 'sao-vicente',
                        x: 19,
                        y: 27,
                        title: 'São Vicente de Fora',
                        content:
                            'A monastery with twin towers and cloisters lined with azulejo panels. Worth the ticket for the tiles alone.',
                    },
                    {
                        id: 'feira',
                        x: 52,
                        y: 33,
                        title: 'Feira da Ladra',
                        content: 'The flea market sets up between the two on Tuesday and Saturday mornings.',
                    },
                    {
                        id: 'pantheon',
                        x: 74,
                        y: 37,
                        title: 'National Pantheon',
                        content:
                            'The white dome of Santa Engrácia, a church that took nearly three centuries to finish. Lisbon still calls a never-ending job “obras de Santa Engrácia”.',
                    },
                    {
                        id: 'rooftops',
                        x: 30,
                        y: 80,
                        title: 'The rooftops',
                        content:
                            'Terracotta all the way down to the river. The neighbourhood is a staircase pretending to be a district.',
                    },
                ],
            },
        },
        h('Then get lost on purpose'),
        p(
            'Below the viewpoints the streets stop pretending. Follow the washing lines, the smell of grilled sardines and the sound of somebody’s radio. If a stair looks private, it probably is not; if a door is open, it probably is.',
        ),
        gallery('masonry', 'Alfama, mostly vertical', 'Six streets within ten minutes of each other', [
            ['1724694049462-4fac11ab05ec', 'Stairs instead of streets', 'A narrow stepped alley between old houses'],
            [
                '1693558030547-2b2f56453b72',
                'Washing lines are the local bunting',
                'Laundry hanging over a narrow street with flowers in the foreground',
            ],
            [
                '1541323837196-377434bee5f7',
                'The neighbourhood signs its own name',
                'A small shop front with a hand-painted Alfama sign',
            ],
            [
                '1741275168070-6ef6d9c7d15f',
                'Tiles as weatherproofing, and as showing off',
                'A wall covered in patterned orange and blue azulejo tiles',
            ],
            [
                '1711294915158-62d272e19633',
                'A tiled passage, cool even in August',
                'A shaded arcade with tiled walls and stone columns',
            ],
            ['1536663060084-a0d9eeeaf44b', 'Tram 28, squeezing past', 'A yellow tram climbing a narrow street'],
        ]),
        h('About tram 28'),
        p(
            'The famous yellow tram rattles straight through Alfama, and it is a joy, and it is also permanently full. Ride it once, early, from Martim Moniz. Then walk the route instead: you will see more, and you will not spend twenty minutes pressed against a window.',
        ),
        image(
            unsplash('1527940547293-3a4a20f90b44'),
            'Tiled facades are practical as well as pretty: they keep out the damp and reflect the summer heat.',
            'A yellow building facade with rows of tall shuttered windows',
        ),
        h('A route, if you want one'),
        steps(
            [
                'Miradouro de Santa Luzia',
                'Start with the view and the tiled pergola. Ten minutes, longer if the light is good.',
            ],
            [
                'Largo das Portas do Sol',
                'Next door. Coffee on the terrace, then find the stairs going down on the far side.',
            ],
            ['Rua de São Miguel', 'The heart of the old quarter: narrow, residential, and at its best before eleven.'],
            [
                'Largo do Chafariz de Dentro',
                'The old fountain square at the bottom, with the Fado Museum on its corner.',
            ],
            [
                'Back up past the cathedral',
                'Walk west along the bottom and climb past the Sé, Lisbon’s cathedral, to finish where the trams start.',
            ],
        ),
        {
            type: 'map',
            data: {
                url: 'https://www.openstreetmap.org/#map=16/38.7118/-9.1305',
                provider: 'openstreetmap',
                theme: 'default',
                height: 380,
                zoom: 16,
                caption: 'Alfama, between the castle hill and the river.',
            },
        },
        h('When to go'),
        table(
            ['Time', 'What it is like', 'Worth it for'],
            ['8 to 10 am', 'Empty streets, deliveries, cats', 'Photographs, and the viewpoints to yourself'],
            ['Midday', 'Tour groups and the tram queue', 'Lunch somewhere shaded'],
            ['Late afternoon', 'Gold light on the river side', 'Portas do Sol at sunset'],
            ['After dark', 'Fado houses open, alleys go quiet', 'A song you will not understand but will remember'],
        ),
        faq(
            [
                'Is tram 28 worth it?',
                'Once, early, for the ride itself. For getting around Alfama, your feet are faster.',
            ],
            [
                'What shoes should I wear?',
                'Grippy ones. The limestone cobbles are polished smooth by centuries of feet and are slippery even when dry.',
            ],
            [
                'When is the flea market?',
                'Feira da Ladra runs on Tuesday and Saturday mornings at Campo de Santa Clara, a short walk east of the viewpoints.',
            ],
            [
                'Where can I hear fado?',
                'Most evenings, in the small restaurants around Largo do Chafariz de Dentro. Book ahead, arrive hungry, and stay quiet while they sing.',
            ],
        ),
    ),
    footnotes: doc(
        ul(
            '<b>Miradouro</b>: a public viewpoint. Lisbon has dozens, and nearly all of them are free.',
            '<b>Fado</b>: Portugal’s mournful urban song, added to UNESCO’s list of intangible cultural heritage in 2011.',
        ),
    ),
};

const sourdough: BlogDemoPostSeed = {
    title: 'Sourdough on a weekday schedule',
    slug: 'sourdough-on-a-weekday-schedule',
    contentType: 'blog',
    publishedAt: on('2026-06-14'),
    excerpt:
        'Most sourdough recipes are written for people who are home all day. This one moves the slow parts to the hours you are asleep or at work.',
    heroImage: {
        url: unsplash('1778472459221-0df20e520241', 2000),
        alt: 'A round scored sourdough loaf with a deep golden crust on a dark blue cloth',
    },
    series: 'Slow Craft',
    seriesOrder: 1,
    tags: ['Sourdough', 'Baking', 'Recipes'],
    categories: ['Food'],
    content: doc(
        p(
            'Most sourdough recipes are written by people who are home all day. This one is for people who are not. The trick is not a better starter or a fancier flour. It is moving the long, slow parts of the process to the hours you are asleep or at work, and doing the hands-on parts in ten-minute windows.',
        ),
        h('The numbers'),
        p(
            'Bakers write recipes as percentages of the flour weight, which makes scaling trivial. There is a short explanation in the notes at the end if the column below looks odd.',
        ),
        table(
            ['Ingredient', "Baker's %", 'For one loaf'],
            ['Bread flour', '90%', '450 g'],
            ['Wholemeal flour', '10%', '50 g'],
            ['Water', '75%', '375 g'],
            ['Ripe starter', '20%', '100 g'],
            ['Salt', '2%', '10 g'],
        ),
        h('The schedule'),
        steps(
            ['Evening, day one (10 minutes)', 'Feed the starter before bed. By morning it should be bubbly and domed.'],
            [
                'Morning, day two (15 minutes)',
                'Mix the flour and water and leave it for 30 minutes. Add the starter and salt and squeeze until no dry flour remains.',
            ],
            [
                'Before work (5 minutes)',
                'One set of stretch and folds, then cover the bowl and leave it somewhere cool, around 20 °C.',
            ],
            [
                'Evening (20 minutes)',
                'The dough should have grown by about half, with bubbles at the edges. Shape it, put it in a floured basket, and into the fridge it goes.',
            ],
            [
                'Morning, day three (45 minutes, mostly waiting)',
                'Bake straight from the fridge in a preheated Dutch oven: 20 minutes with the lid on at 250 °C, then 20 to 25 with it off at 230 °C.',
            ],
        ),
        h('Is the starter ready?'),
        {
            type: 'layout',
            data: {
                preset: '1-2',
                columns: [
                    {
                        content: doc(
                            image(
                                unsplash('1620429196249-d524581e605f', 900),
                                'Domed, bubbly, smelling of yoghurt.',
                                'A glass jar of active sourdough starter on a wooden board',
                            ),
                        ),
                    },
                    {
                        content: doc(
                            h('Ready', 3),
                            ul(
                                'At least doubled since its last feed',
                                'Domed on top, with bubbles all the way down the jar',
                                'Smells sour and a little sweet, like yoghurt',
                                'A spoonful floats in a glass of water',
                            ),
                            h('Not yet', 3),
                            ul('Flat or sunken on top', 'Smells sharply of nail varnish: it is hungry, feed it again'),
                        ),
                    },
                ],
            },
        },
        gallery('grid-featured', 'Day three', 'Score it, bake it, then wait for it to cool', [
            [
                '1521471109507-43d61bb345dd',
                'Lid off, twenty minutes to go',
                'A dark crusted loaf baking in a cast iron pot',
            ],
            ['1591458736923-c06a260e3412', 'Scored for the oven', 'A scored loaf with a wheat-ear pattern'],
            ['1620921586333-b7566c34550a', 'The crumb', 'A cut sourdough loaf showing an open, airy crumb'],
        ]),
        warning(
            'Mind the pot',
            'A Dutch oven at 250 °C stays dangerously hot long after it leaves the oven. Use proper oven gloves, not a folded tea towel, and put the lid somewhere you will not lean on it.',
        ),
        h('Kit', 3),
        checklist(
            ['A digital scale, which is not optional', true],
            ['A Dutch oven or other heavy lidded pot', true],
            ['A proofing basket, or a bowl lined with a floured tea towel', true],
            ['A bench scraper', true],
            ['A lame for scoring (a clean razor blade does the job)', false],
        ),
        faq(
            [
                'Can I use only white flour?',
                'Yes. The wholemeal is there for flavour and a livelier fermentation. Leave it out and use 500 g of bread flour.',
            ],
            [
                'My loaf spreads out flat. Why?',
                'Usually the dough rose for too long before shaping, or the shaping was too loose. Cut the first rise shorter next time and shape tighter.',
            ],
            [
                'How long does it keep?',
                'Three days cut side down on a board. Or slice and freeze it on day one and toast it straight from frozen.',
            ],
        ),
    ),
    footnotes: doc(
        p(
            "<b>Baker's percentages</b> express every ingredient as a share of the total flour weight, which is always 100%. A dough at 75% hydration has 75 g of water for every 100 g of flour, whatever the size of the batch.",
        ),
    ),
};

const filmCamera: BlogDemoPostSeed = {
    title: 'A year with a secondhand film camera',
    slug: 'a-year-with-a-secondhand-film-camera',
    contentType: 'blog',
    publishedAt: on('2026-07-26'),
    excerpt:
        'Sixty euros at a flea market, twenty-odd rolls, and the surprising discovery that the camera with no undo button is the one I reach for first.',
    heroImage: {
        url: unsplash('1608517492956-82cd49655f40', 2000),
        alt: 'A Minolta film camera on a desk beside a box of Kodak Ektar 100',
    },
    series: 'Slow Craft',
    seriesOrder: 2,
    tags: ['Film', 'Photography', 'Gear'],
    categories: ['Craft'],
    content: doc(
        p(
            'I bought a secondhand Minolta at a flea market for less than the price of a nice dinner, mostly as an ornament. A year and twenty-odd rolls later it is the camera I reach for first, which surprised nobody more than me.',
        ),
        h('What changes when every frame costs money'),
        p(
            'Thirty-six exposures, and each one close to a euro once you count developing and scanning. You stop machine-gunning. You wait for the person to walk into the light instead of hoping one of twelve frames catches them. Most of my favourite pictures this year exist because I <b>didn’t</b> take the picture before them.',
        ),
        gallery(
            'masonry',
            'From the first few rolls',
            'Portra 400 and Ektar 100. The last frame is what happens when you open the back too early.',
            [
                ['1618599919511-c0cd9e3625cd', '', 'An orange wall with a curtained window in late sun'],
                ['1628288250440-75586b9d5fc3', '', 'A figure walking out along a stone jetty into the sea'],
                ['1649977670485-7f004bd4fa2f', '', 'A pale green roadster parked by shipping containers'],
                ['1677741853006-872c3ff1ed6c', '', 'A café window with diners silhouetted against the street'],
                ['1651393964104-25275d925a75', '', 'An old bicycle leaning against a wall'],
                ['1637051673344-f64ea47c747f', '', 'A misty field at the edge of a dark forest'],
                ['1690982961861-1fd745121132', '', 'A red pickup truck parked by a brick building'],
                ['1637051611188-115e3add7d5a', '', 'A seascape washed out by an orange light leak'],
            ],
        ),
        {
            type: 'review',
            data: {
                image: unsplash('1665926597501-e81c3eaa3d20', 1200),
                title: 'A secondhand 35mm SLR',
                content: '',
                linkUrl: '',
                linkLabel: '',
                pros: [
                    'Fully mechanical, built like a doorstop',
                    'Bright viewfinder and easy manual focus',
                    'Lenses are cheap and plentiful',
                    'Makes you slow down, in a good way',
                ],
                cons: ['The light seals were shot when I got it', 'Every frame costs close to a euro', 'No undo'],
                rating: 4.5,
                maxStars: 5,
                allowHalfStars: true,
                summary: 'The best camera I own for learning to see, and the worst for photographing a toddler.',
                compact: false,
            },
        },
        h('Film stocks, ranked by how often I bought them'),
        table(
            ['Film', 'ISO', 'Look', 'Good for'],
            ['Kodak Portra 400', '400', 'Soft, warm skin tones', 'People, overcast days'],
            ['Kodak Ektar 100', '100', 'Punchy colour, fine grain', 'Landscapes in full sun'],
            ['Ilford HP5 Plus', '400', 'Classic black and white', 'Street, pushed to 1600 at night'],
            ['Kodak Gold 200', '200', 'Warm and nostalgic', 'Everyday, on a budget'],
        ),
        image(
            unsplash('1654147801998-1f2f4aa9486b', 1400),
            'Portra 400: forgiving, flattering, and the reason my film budget doubled.',
            'A canister of Kodak Portra 400 film on a white background',
        ),
        h('What I would tell myself a year ago'),
        ol(
            'Replace the light seals before the first roll, not after the third.',
            'Buy one film stock and learn it before buying five.',
            'Find a lab you like and stay with it. Consistent scans matter more than the camera.',
            'Shoot the boring things: the kitchen, the commute, the view from your desk. That is what you will want to see in twenty years.',
        ),
        p(
            '<i>Nobody paid for this. The camera cost sixty euros at a flea market and every roll was bought at full price. Photographs from Unsplash contributors.</i>',
        ),
    ),
};

const edgeLatency: BlogDemoPostSeed = {
    title: 'Your database is twenty milliseconds away. Now what?',
    slug: 'your-database-is-twenty-milliseconds-away',
    contentType: 'blog',
    publishedAt: on('2026-09-12'),
    excerpt:
        'Edge runtimes put your code next to the reader and leave the database far away. The habits we had to unlearn, and the ones that replaced them.',
    heroImage: {
        url: unsplash('1451187580459-43490279c0fa', 2000),
        alt: 'The night side of the Earth seen from orbit, city lights strung along the coastlines',
    },
    seoMeta: {
        description:
            'Why round trips, not queries, decide performance on the edge, and how batching and caching fix it.',
        keywords: ['edge computing', 'Cloudflare D1', 'latency', 'caching', 'Workers KV'],
    },
    tags: ['Edge', 'Cloudflare', 'Performance', 'Architecture'],
    categories: ['Engineering'],
    content: doc(
        p(
            'For most of the history of web apps, the database lived next door to the server, and the reader lived far away from both. Edge runtimes flip that picture. Your code now runs a few milliseconds from the reader, and the database, unless you do something about it, is the thing that is far away.',
        ),
        p('That changes which optimisations matter. These are the habits we had to unlearn, and what replaced them.'),
        h('Count round trips, not queries'),
        p(
            'Next to the database, a query costs a fraction of a millisecond, so ten small ones are cheap. From the edge, each one can cost a full round trip to wherever the primary lives. Ten sequential queries at 20 ms each is a fifth of a second before you have rendered anything.',
        ),
        code(
            [
                '// Two awaits in a row: two round trips.',
                "const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();",
                "const posts = await db.prepare('SELECT * FROM posts WHERE author_id = ?').bind(id).all();",
                '',
                '// One batch: one round trip, run in order as a single transaction.',
                'const [userResult, postsResult] = await db.batch([',
                "    db.prepare('SELECT * FROM users WHERE id = ?').bind(id),",
                "    db.prepare('SELECT * FROM posts WHERE author_id = ?').bind(id),",
                ']);',
            ].join('\n'),
            'typescript',
        ),
        table(
            ['Step', 'Server near the database', 'Edge, one query at a time', 'Edge, batched'],
            ['Request reaches compute', '80 ms', '15 ms', '15 ms'],
            ['Database round trips', '4 × 1 ms', '4 × 20 ms', '1 × 20 ms'],
            ['Render and respond', '10 ms', '10 ms', '10 ms'],
            ['Total', '~94 ms', '~105 ms', '~45 ms'],
        ),
        p(
            'The numbers are illustrative, not a benchmark, but the shape is real: moving compute closer without moving data closer can make things <b>slower</b>. Batching is what turns the edge into a win.',
        ),
        h('Cache what you read, invalidate what you write'),
        quote(
            'There are only two hard things in Computer Science: cache invalidation and naming things.',
            'Phil Karlton',
        ),
        p(
            'Caches and key-value stores close to the reader are the other half. Read-heavy, rarely changing data such as configuration, feature flags or a rendered article belongs there. The part that bites is invalidation, so keep it boring: one key per thing, deleted on every write to that thing, and a short TTL as a safety net.',
        ),
        warning(
            'Eventual consistency is a feature you design for',
            'Globally replicated key-value stores trade freshness for speed, so a value written in one region can take a while to appear everywhere. Never keep anything there that must read back correctly the instant it is written, like a permission or a balance.',
        ),
        h('Rules of thumb'),
        {
            type: 'layout',
            data: {
                preset: '2-1',
                columns: [
                    {
                        content: doc(
                            p(
                                'None of this is new. It is the advice databases have always given, made urgent by distance. What is new is that the platform makes the right thing easy: batched statements, read replicas, caches in the same city as the reader. The work is mostly remembering to use them.',
                            ),
                        ),
                    },
                    {
                        content: doc(
                            h('On every pull request', 3),
                            checklist(
                                ['No awaits inside a loop', true],
                                ['Reads batched per request', true],
                                ['Cache keys deleted on write', true],
                                ['Nothing security-critical in a cache', true],
                            ),
                        ),
                    },
                ],
            },
        },
        {
            type: 'references',
            data: {
                style: 'numbered',
                items: [
                    {
                        id: '1',
                        url: 'https://developers.cloudflare.com/d1/',
                        title: 'Cloudflare D1 documentation',
                        authors: 'Cloudflare',
                        year: '2026',
                        accessedDate: '2026-09-10',
                        note: 'Batched statements, read replication and limits.',
                    },
                    {
                        id: '2',
                        url: 'https://developers.cloudflare.com/kv/concepts/how-kv-works/',
                        title: 'How KV works',
                        authors: 'Cloudflare',
                        year: '2026',
                        accessedDate: '2026-09-10',
                        note: 'Where the eventual consistency comes from.',
                    },
                    {
                        id: '3',
                        url: 'https://gist.github.com/jboner/2841832',
                        title: 'Latency Numbers Every Programmer Should Know',
                        authors: 'Jonas Bonér',
                        year: '2012',
                        note: 'The classic table, after Jeff Dean and Peter Norvig.',
                    },
                ],
            },
        },
    ),
    footnotes: doc(
        p(
            'Round-trip times depend on where the primary database lives relative to the reader. Read replicas shrink them for reads; writes still travel to the primary.',
        ),
    ),
};

const offsite: BlogDemoPostSeed = {
    title: 'Four days, one long table: how we run an offsite',
    slug: 'four-days-one-long-table',
    contentType: 'blog',
    publishedAt: on('2026-05-30'),
    excerpt:
        'Once a year the whole team spends four days around one table in a rented farmhouse. It took us three tries to make it the most useful week of the year instead of the most tiring.',
    heroImage: {
        url: unsplash('1696805966408-5f92fdb79ae7', 2000),
        alt: 'A long wooden table set with chairs in a bright farmhouse room',
    },
    tags: ['Remote work', 'Teams'],
    categories: ['Working Notes'],
    content: doc(
        p(
            'Once a year the whole team leaves the laptops mostly closed and spends four days around one table in a rented farmhouse. It is the most useful week of our year, and it took us three attempts to stop it also being the most exhausting.',
        ),
        h('The shape of the four days'),
        steps(
            [
                'Day one: arrive, cook, nothing else',
                'Travel is tiring. Nobody presents anything. Dinner is the agenda.',
            ],
            ['Day two: look back', 'What we shipped, what we didn’t, and one honest hour on why.'],
            ['Day three: look forward', 'Small groups, big sheets of paper, sticky notes. No slides allowed.'],
            [
                'Day four: decide and go',
                'Three decisions, written down, each with an owner. Then a long lunch and early trains home.',
            ],
        ),
        {
            type: 'layout',
            data: {
                preset: '1-1',
                columns: [
                    {
                        content: doc(
                            image(
                                unsplash('1530303263041-b5ca33678f04', 1000),
                                'Day three, two hours in.',
                                'A wall covered in yellow sticky notes arranged in columns',
                            ),
                        ),
                    },
                    {
                        content: doc(
                            h('Rules we actually keep', 3),
                            ul(
                                'No slide decks. If it needs slides, it can be a document.',
                                'Laptops closed until four in the afternoon.',
                                'Every session ends with a written decision, or it is cut next year.',
                                'Someone who is not the boss runs the agenda.',
                            ),
                        ),
                    },
                ],
            },
        },
        h('Before you book'),
        checklist(
            ['A kitchen big enough for everyone to cook together', true],
            ['One room where the whole team fits around a single table', true],
            ['Reliable wifi, because you will need it on day four', true],
            ['One train ride from most people', true],
            ['A pool table (nice, not necessary)', false],
        ),
        h('What it costs, roughly, per person', 3),
        table(
            ['Item', 'Per person', 'Notes'],
            ['Farmhouse, four nights', '€320', 'Split eight ways'],
            ['Food and drink', '€140', 'We cook, plus one dinner out'],
            ['Travel', '€90', 'Trains, booked early'],
            ['Total', '€550', 'Less than one conference ticket'],
        ),
        {
            type: 'testimonial',
            data: {
                quote: 'I was sceptical about four days with no slides. By day three I had written more useful plans than in the whole previous quarter.',
                authorName: 'Priya',
                authorRole: 'Product designer, first offsite',
                authorCompany: '',
                variant: 'card',
                verified: false,
            },
        },
        faq(
            [
                'How big a team does this work for?',
                'We have done it with six people and with fourteen. Past about sixteen you need two tables, and then it turns into a conference.',
            ],
            [
                'Do partners and families come?',
                'Not to the working days. Some people stay on for a weekend with family afterwards, which we encourage.',
            ],
            [
                'What if someone cannot travel?',
                'Then it is not an offsite, it is a long video call. We pick dates three months out and plan around the hardest constraints first.',
            ],
        ),
    ),
};

const notesFrom2003: BlogDemoPostSeed = {
    title: 'Notes from 2003: what I thought the web would become',
    slug: 'notes-from-2003',
    contentType: 'blog',
    publishedAt: on('2026-10-04'),
    originalDate: parseFuzzyInput('summer 2003'),
    excerpt:
        'Found on a floppy disk in a box of cables: five predictions about the web, written the summer I put my first homepage online. Three of them came true.',
    heroImage: {
        url: unsplash('1661793422829-e1f648ab4a15', 2000),
        alt: 'A beige desktop computer with a CRT monitor, keyboard and joystick',
    },
    tags: ['Archive', 'Web history'],
    categories: ['Notes'],
    content: doc(
        p(
            '<i>Found on a floppy disk in a box of cables, saved as WEB_FUTURE.TXT. Reproduced as written apart from the spelling, with a few notes from the present at the end.</i>',
        ),
        delimiter,
        p(
            'It is the summer of 2003 and I have just put my first website online. It has a guestbook, a hit counter and a page about my cat. It took four weekends and most of my patience.',
        ),
        p('Here is what I think happens next.'),
        ol(
            'Everyone will have a website. Not a company, a person. Your homepage will be like your phone number.',
            'Websites will stop being made of tables. Somebody will work out how to do columns in CSS without it falling apart in Internet Explorer.',
            'Video on the web will never really work. The files are too big and nobody has the patience.',
            'Search will get so good that bookmarks become pointless.',
            'In twenty years we will still be arguing about frames.',
        ),
        p('The code for the homepage, for posterity. I am very proud of the marquee.'),
        code(
            [
                '<html>',
                '<head><title>Welcome to my homepage!!</title></head>',
                '<body bgcolor="#000080" text="#FFFF00">',
                '<center>',
                '  <font face="Comic Sans MS" size="5">Welcome to my homepage!!</font>',
                '  <marquee>Under construction. Come back soon!</marquee>',
                '  <table border="1" cellpadding="4">',
                '    <tr>',
                '      <td><a href="cat.html">My cat</a></td>',
                '      <td><a href="guestbook.html">Sign my guestbook</a></td>',
                '    </tr>',
                '  </table>',
                '  <img src="counter.gif" alt="You are visitor number">',
                '</center>',
                '</body>',
                '</html>',
            ].join('\n'),
            'html',
        ),
        delimiter,
        h('From the present', 3),
        p(
            'Three out of five is not bad for a teenager on a dial-up modem. Personal homepages did not quite happen; profiles on other people’s websites happened instead. Layout without tables took about another decade to become pleasant. Video took over the web completely. Bookmarks survived.',
        ),
        {
            type: 'spoiler',
            data: {
                text: 'And frames? Nobody argues about frames any more. We argue about frameworks, which is close enough.',
            },
        },
    ),
};

const kitchensink: BlogDemoPostSeed = {
    title: 'The Ottablog kitchensink: every block on one page',
    slug: 'kitchensink-ottablog',
    contentType: 'blog',
    publishedAt: on('2026-05-10'),
    excerpt:
        'Every block OttaEditor can write, on one page: text, media and the interactive ones, so you can see exactly how your theme renders them.',
    content: kitchensinkContent as BlogDemoPostSeed['content'],
    heroImage: {
        url: unsplash('1439405326854-014607f694d7', 2000),
        alt: 'Sunset over open water, seen from just above the waves',
    },
    tags: ['Blocks', 'Themes'],
    categories: ['Reference'],
};

export const demoBlogPosts: readonly BlogDemoPostSeed[] = [
    lofotenJournal,
    alfamaWalk,
    edgeLatency,
    notesFrom2003,
    filmCamera,
    keralaJournal,
    sourdough,
    offsite,
    kitchensink,
    blurb(
        'burned-the-toast',
        '2026-10-17',
        'Burned the toast, nailed the bread. Somewhere in there is a lesson about where the hard part actually is.',
        ['Sourdough'],
    ),
    blurb(
        'overheard-on-the-tram',
        '2026-09-05',
        'Overheard on a Lisbon tram: "The view is the same, you just have to stop walking." Wrote it on the back of my hand so I would not lose it.',
        ['Lisbon'],
    ),
    blurb(
        'a-whole-roll',
        '2026-08-11',
        'Shot a whole roll today and can only remember two of the frames. Very curious which two will come back from the lab.',
        ['Film'],
    ),
    blurb(
        'the-starter-is-alive',
        '2026-06-02',
        'The starter is alive. I named it after the cat, which the cat has not acknowledged.',
        ['Sourdough'],
    ),
];
