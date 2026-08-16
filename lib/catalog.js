import { readFileSync } from 'node:fs';
export function loadCatalog() {
    const file = new URL('../data/catalog.json', import.meta.url);
    return JSON.parse(readFileSync(file, 'utf8'));
}
export function repositorySlug(repo) {
    const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/?$/.exec(repo);
    if (match === null)
        throw new Error(`invalid GitHub repository: ${repo}`);
    return match[1];
}
export function recommend(current, catalog, stars) {
    const score = (candidate) => {
        const sharedTags = candidate.tags.filter(tag => current.tags.includes(tag)).length;
        const sharedModes = candidate.modes.filter(mode => current.modes.includes(mode)).length;
        const recent = Date.now() - Date.parse(candidate.releaseUpdatedAt) <= 30 * 86400000 ? 1 : 0;
        return sharedTags * 4 + sharedModes * 2 + Math.log1p(stars.get(candidate.id) ?? candidate.starsSnapshot) + recent - candidate.featuredRank / 100;
    };
    return catalog.filter(item => item.id !== current.id).sort((a, b) => score(b) - score(a)).slice(0, 4).map(item => item.id);
}
export async function catalogWithStars(_profileDir) {
    const catalog = loadCatalog();
    const starMap = new Map(catalog.skins.map(skin => [skin.id, skin.starsSnapshot]));
    return catalog.skins.map(skin => ({
        ...skin,
        githubStars: skin.starsSnapshot,
        starsStale: false,
        recommendations: recommend(skin, catalog.skins, starMap),
    }));
}
