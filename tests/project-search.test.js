import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    findProjectSuggestions,
    normalizeProjectName,
    normalizeProjectUrl,
    projectsAreEquivalent,
    searchProjectsByName,
    sortProjectsByCreatedAt
} from '../src/core/project-search.js';

const PROJECTS = [
    { id: 'p1', name: 'Ёлка News', url: 'https://www.example.com/launch/?utm=1', status: 'active', createdAt: 10, updatedAt: 10 },
    { id: 'p2', name: 'Bononews Campaign', url: 'https://bono.example/work', status: 'active', createdAt: 30, updatedAt: 30 },
    { id: 'p3', name: 'Archived Project', url: 'https://archive.example', status: 'archived', createdAt: 100, updatedAt: 40 },
    { id: 'p4', name: 'Bononews Social', url: 'https://social.example', status: 'active', createdAt: 40, updatedAt: 20 },
    { id: 'p5', name: 'Bonus', url: '', status: 'active', createdAt: 5, updatedAt: 5 },
    { id: 'p6', name: 'Bono Studio', url: '', status: 'active', createdAt: 4, updatedAt: 4 }
];

test('normalizeProjectName normalizes Unicode, Cyrillic and punctuation', function () {
    assert.equal(normalizeProjectName('  ЁЛКА—News! '), 'елка news');
});

test('normalizeProjectUrl ignores protocol, www, query, hash and trailing slash', function () {
    assert.equal(
        normalizeProjectUrl('https://www.Example.com/Launch/?utm=1#top'),
        'example.com/launch'
    );
});

test('findProjectSuggestions ranks exact URL before fuzzy names', function () {
    const suggestions = findProjectSuggestions(PROJECTS, {
        name: 'bononews',
        url: 'example.com/launch'
    });
    assert.equal(suggestions[0].id, 'p1');
    assert.equal(suggestions[0].matchExact, true);
});

test('findProjectSuggestions supports a small typo after four characters', function () {
    const suggestions = findProjectSuggestions(PROJECTS, { name: 'bononewz', url: '' });
    assert.equal(suggestions[0].id, 'p2');
});

test('findProjectSuggestions excludes archived/current projects and caps results', function () {
    const suggestions = findProjectSuggestions(PROJECTS, { name: 'bon', url: '' }, {
        excludeId: 'p2',
        limit: 2
    });
    assert.equal(suggestions.length, 2);
    assert.equal(suggestions.some(function (item) { return item.id === 'p2' || item.id === 'p3'; }), false);
});

test('sortProjectsByCreatedAt puts newest active projects first', function () {
    assert.deepEqual(sortProjectsByCreatedAt(PROJECTS).map(function (project) {
        return project.id;
    }), ['p4', 'p2', 'p1', 'p5', 'p6']);
});

test('searchProjectsByName filters normalized names and keeps created order', function () {
    assert.deepEqual(searchProjectsByName(PROJECTS, 'BONO').map(function (project) {
        return project.id;
    }), ['p4', 'p2', 'p6']);
    assert.equal(searchProjectsByName(PROJECTS, 'елка')[0].id, 'p1');
    assert.equal(searchProjectsByName(PROJECTS, 'campain')[0].id, 'p2');
});

test('searchProjectsByName caps quick results after sorting', function () {
    assert.deepEqual(searchProjectsByName(PROJECTS, '', { limit: 2 }).map(function (project) {
        return project.id;
    }), ['p4', 'p2']);
});

test('projectsAreEquivalent requires exact name with compatible URL or exact URL', function () {
    assert.equal(projectsAreEquivalent(
        { name: ' Launch ', url: '' },
        { name: 'launch', url: 'https://example.com/work' }
    ), true);
    assert.equal(projectsAreEquivalent(
        { name: 'Launch', url: 'https://one.example' },
        { name: 'Launch', url: 'https://two.example' }
    ), false);
    assert.equal(projectsAreEquivalent(
        { name: 'Old name', url: 'https://example.com/work/' },
        { name: 'New name', url: 'http://www.example.com/work?x=1' }
    ), true);
});
