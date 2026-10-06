import { IMAGES, unsplash } from './images';

/**
 * The team behind the demo site. Created as real users (no password, so nobody can sign in as
 * them), members of the seeding admin's organization, with an RBAC role each.
 */
export interface DemoPerson {
    name: string;
    email: string;
    image: string;
    /** RBAC role in the organization */
    role: 'editor' | 'author';
}

export const PEOPLE: readonly DemoPerson[] = [
    {
        name: 'Maya Okafor',
        email: 'maya@example.com',
        image: unsplash(IMAGES.maya, 400),
        role: 'editor',
    },
    {
        name: 'Tomás Ferreira',
        email: 'tomas@example.com',
        image: unsplash(IMAGES.tomas, 400),
        role: 'editor',
    },
    {
        name: 'Priya Raman',
        email: 'priya@example.com',
        image: unsplash(IMAGES.priya, 400),
        role: 'author',
    },
    {
        name: 'Jonas Lindqvist',
        email: 'jonas@example.com',
        image: unsplash(IMAGES.jonas, 400),
        role: 'author',
    },
];

export const MAYA = PEOPLE[0]!.email;
export const TOMAS = PEOPLE[1]!.email;
export const PRIYA = PEOPLE[2]!.email;
export const JONAS = PEOPLE[3]!.email;
