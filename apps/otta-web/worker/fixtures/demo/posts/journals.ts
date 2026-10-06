/** Photo journals: a handful of photographs with a field note, from the places the team has been. */
import type { BlogDemoPhotoSeed, BlogDemoPostSeed } from '@ottabase/ottablog/router';
import { IMAGES, unsplash, type DemoImage } from '../images';
import { JONAS, PRIYA, TOMAS } from '../people';

const at = (iso: string) => Date.parse(iso);

const photo = (image: DemoImage, location: string, takenAt: string, caption = image.caption): BlogDemoPhotoSeed => ({
    id: image.id,
    url: unsplash(image),
    alt: image.alt,
    caption,
    location,
    takenAt: at(takenAt),
    width: image.width,
    height: image.height,
});

export const JOURNALS: readonly BlogDemoPostSeed[] = [
    {
        title: 'Two days in Lisbon',
        slug: 'two-days-in-lisbon',
        contentType: 'photo',
        authorEmail: PRIYA,
        publishedAt: '2026-06-02T18:30:00.000Z',
        categories: ['Field notes'],
        tags: ['Travel', 'Photography', 'Offsite'],
        photoNote:
            'The whole team in one city for the first time this year. We walked more than we planned, ate better than we deserved, and finished the roadmap on a balcony in Alfama.',
        photoAlbum: [
            photo(IMAGES.lisbonTram, 'Alfama, Lisbon', '2026-05-28T07:40:00.000Z'),
            photo(IMAGES.lisbonStreet, 'Alfama, Lisbon', '2026-05-28T15:10:00.000Z'),
            photo(IMAGES.coffee, 'Chiado, Lisbon', '2026-05-29T09:20:00.000Z'),
            photo(
                IMAGES.coast,
                'Cascais',
                '2026-05-29T06:55:00.000Z',
                'The coast road at Cascais, an hour before the first meeting.',
            ),
            photo(IMAGES.sunsetWaves, 'Cascais', '2026-05-29T20:35:00.000Z', 'Last light, last day.'),
        ],
    },
    {
        title: 'Offsite above the fog',
        slug: 'offsite-above-the-fog',
        contentType: 'photo',
        authorEmail: TOMAS,
        publishedAt: '2026-08-28T17:00:00.000Z',
        categories: ['Field notes'],
        tags: ['Travel', 'Photography', 'Offsite'],
        photoNote:
            'Three days in a cabin with no signal below the ridge and a lake that was never the same colour twice. The migration engine got its name up here.',
        photoAlbum: [
            photo(IMAGES.mountainLake, 'Lake Brienz, Switzerland', '2026-08-21T06:10:00.000Z'),
            photo(IMAGES.foggyMountains, 'Bernese Oberland', '2026-08-21T07:25:00.000Z'),
            photo(IMAGES.alps, 'Bernese Oberland', '2026-08-22T11:40:00.000Z'),
            photo(IMAGES.lakeDock, 'Lake Brienz, Switzerland', '2026-08-22T19:50:00.000Z'),
            photo(IMAGES.forestLight, 'Above Iseltwald', '2026-08-23T08:05:00.000Z'),
        ],
    },
    {
        title: 'Where the work happens',
        slug: 'where-the-work-happens',
        contentType: 'photo',
        authorEmail: JONAS,
        publishedAt: '2026-09-10T12:00:00.000Z',
        categories: ['Field notes'],
        tags: ['Photography', 'Team'],
        photoNote:
            'Four desks, four cities, one repository. We asked everyone for a photo of where they actually write, not where they would like to.',
        photoAlbum: [
            photo(IMAGES.deskLaptop, 'Stockholm', '2026-09-08T22:15:00.000Z'),
            photo(IMAGES.deskNotebook, 'Lagos', '2026-09-09T08:00:00.000Z'),
            photo(IMAGES.deskWork, 'Porto', '2026-09-09T10:30:00.000Z'),
            photo(IMAGES.laptopCode, 'Bengaluru', '2026-09-09T14:45:00.000Z', 'The editor, mid-refactor.'),
        ],
    },
];
