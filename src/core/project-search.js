function normalizeUnicode(value) {
    const raw = String(value || '');
    try {
        return raw.normalize('NFKC');
    } catch (_) {
        return raw;
    }
}

export function normalizeProjectName(value) {
    return normalizeUnicode(value)
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

export function normalizeProjectUrl(value) {
    const raw = normalizeUnicode(value).trim();
    if (!raw) return '';
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw;
    try {
        const parsed = new URL(candidate);
        const host = parsed.hostname.toLowerCase().replace(/^www\./i, '');
        let path = parsed.pathname || '';
        try {
            path = decodeURIComponent(path);
        } catch (_) {}
        path = path.toLowerCase().replace(/\/+$/, '');
        return host + path;
    } catch (_) {
        return raw
            .toLowerCase()
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .replace(/[?#].*$/, '')
            .replace(/\/+$/, '');
    }
}

function getUrlHost(value) {
    const normalized = normalizeProjectUrl(value);
    return normalized ? normalized.split('/')[0] : '';
}

function getUrlPath(normalized) {
    if (!normalized) return '';
    const slash = normalized.indexOf('/');
    return slash >= 0 ? normalized.slice(slash) : '';
}

function levenshteinDistance(left, right) {
    if (left === right) return 0;
    if (!left) return right.length;
    if (!right) return left.length;

    let previous = Array.from({ length: right.length + 1 }, function (_, index) {
        return index;
    });
    for (let i = 1; i <= left.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left.charAt(i - 1) === right.charAt(j - 1) ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost
            );
        }
        previous = current;
    }
    return previous[right.length];
}

function significantTokens(value) {
    return String(value || '').split(' ').filter(function (token) {
        return token.length >= 4;
    });
}

function nameMatchScore(query, candidate) {
    if (!query || !candidate) return 0;
    if (query === candidate) return 0.98;
    if (candidate.indexOf(query) === 0 || query.indexOf(candidate) === 0) return 0.86;
    if (candidate.indexOf(query) >= 0 || query.indexOf(candidate) >= 0) return 0.8;
    if (query.length < 4 || candidate.length < 4) return 0;

    const queryTokens = significantTokens(query);
    const candidateTokens = significantTokens(candidate);
    if (!queryTokens.length || !candidateTokens.length) return 0;

    let shared = 0;
    let bestTokenSimilarity = 0;
    queryTokens.forEach(function (token) {
        if (candidateTokens.indexOf(token) >= 0) shared += 1;
        candidateTokens.forEach(function (candidateToken) {
            const tokenLength = Math.max(token.length, candidateToken.length);
            const tokenSimilarity = 1 - (levenshteinDistance(token, candidateToken) / tokenLength);
            if (tokenSimilarity > bestTokenSimilarity) bestTokenSimilarity = tokenSimilarity;
        });
    });

    // Require meaningful overlap: at least half of query tokens, and ≥2 when query is long
    const overlapRatio = shared / queryTokens.length;
    const minShared = queryTokens.length >= 3 ? 2 : 1;
    const tokenScore = shared >= minShared && overlapRatio >= 0.6
        ? 0.78 * overlapRatio
        : 0;
    const tokenTypoScore = bestTokenSimilarity >= 0.8 ? 0.76 * bestTokenSimilarity : 0;

    const maxLength = Math.max(query.length, candidate.length);
    const similarity = maxLength ? 1 - (levenshteinDistance(query, candidate) / maxLength) : 0;
    const typoScore = similarity >= 0.8 ? 0.78 * similarity : 0;
    return Math.max(tokenScore, tokenTypoScore, typoScore);
}

function urlMatchScore(query, candidate) {
    if (!query || !candidate) return 0;
    if (query === candidate) return 1;

    const queryPath = getUrlPath(query);
    const candidatePath = getUrlPath(candidate);
    // Same host alone is not a match — Bitrix and similar tools share one host.
    // Only count URL when the path also meaningfully overlaps.
    if (!queryPath || !candidatePath || queryPath.length < 2 || candidatePath.length < 2) {
        return 0;
    }

    if (candidate.indexOf(query) === 0 || query.indexOf(candidate) === 0) return 0.96;
    if (candidatePath.indexOf(queryPath) === 0 || queryPath.indexOf(candidatePath) === 0) {
        const queryHost = query.split('/')[0];
        const candidateHost = candidate.split('/')[0];
        if (queryHost && queryHost === candidateHost) return 0.94;
    }
    return 0;
}

const SUGGESTION_SCORE_THRESHOLD = 0.72;
const SEARCH_SCORE_THRESHOLD = 0.55;

export function scoreProjectMatch(project, query) {
    const nameQuery = normalizeProjectName(query && query.name);
    const urlQuery = normalizeProjectUrl(query && query.url);
    const projectName = normalizeProjectName(project && project.name);
    const projectUrl = normalizeProjectUrl(project && project.url);
    const nameScore = nameMatchScore(nameQuery, projectName);
    const urlScore = urlMatchScore(urlQuery, projectUrl);

    // Concrete different URLs mean different projects unless the name is nearly identical.
    if (urlQuery && projectUrl && urlQuery !== projectUrl && urlScore < 0.94) {
        if (nameScore < 0.86) {
            return {
                score: 0,
                exact: false,
                nameScore: nameScore,
                urlScore: urlScore
            };
        }
        return {
            score: nameScore,
            exact: nameQuery === projectName,
            nameScore: nameScore,
            urlScore: urlScore
        };
    }

    let score = Math.max(nameScore, urlScore);
    if (nameScore >= SUGGESTION_SCORE_THRESHOLD && urlScore >= 0.94) {
        score = Math.min(1, score + 0.03);
    }
    return {
        score: score,
        exact: (nameQuery && nameQuery === projectName) || (urlQuery && urlQuery === projectUrl),
        nameScore: nameScore,
        urlScore: urlScore
    };
}

export function findProjectSuggestions(projects, query, options) {
    const settings = options || {};
    const limit = Number(settings.limit) > 0 ? Number(settings.limit) : 5;
    const excludeId = String(settings.excludeId || '');
    const nameQuery = normalizeProjectName(query && query.name);
    const urlQuery = normalizeProjectUrl(query && query.url);
    // Need a real name fragment or a concrete URL before warning about duplicates
    if (nameQuery.length < 4 && !urlQuery) return [];

    return (Array.isArray(projects) ? projects : []).filter(function (project) {
        return project && project.status !== 'archived' && project.id !== excludeId;
    }).map(function (project) {
        const match = scoreProjectMatch(project, query || {});
        return Object.assign({}, project, {
            matchScore: match.score,
            matchExact: match.exact
        });
    }).filter(function (project) {
        return project.matchScore >= SUGGESTION_SCORE_THRESHOLD;
    }).sort(function (left, right) {
        if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;
        return Number(right.updatedAt || 0) - Number(left.updatedAt || 0);
    }).slice(0, limit);
}

export function sortProjectsByCreatedAt(projects) {
    return (Array.isArray(projects) ? projects : []).filter(function (project) {
        return project && project.status !== 'archived';
    }).slice().sort(function (left, right) {
        const createdDiff = Number(right.createdAt || 0) - Number(left.createdAt || 0);
        if (createdDiff) return createdDiff;
        return String(left.name || '').localeCompare(String(right.name || ''));
    });
}

export function searchProjectsByName(projects, query, options) {
    const settings = options || {};
    const limit = Number(settings.limit) > 0 ? Number(settings.limit) : Infinity;
    const needle = normalizeProjectName(query);
    const sorted = sortProjectsByCreatedAt(projects);
    const matches = needle ? sorted.filter(function (project) {
        return nameMatchScore(needle, normalizeProjectName(project.name)) >= SEARCH_SCORE_THRESHOLD;
    }) : sorted;
    return matches.slice(0, limit);
}

export function projectsAreEquivalent(left, right) {
    const leftUrl = normalizeProjectUrl(left && left.url);
    const rightUrl = normalizeProjectUrl(right && right.url);
    if (leftUrl && rightUrl && leftUrl === rightUrl) return true;

    const leftName = normalizeProjectName(left && left.name);
    const rightName = normalizeProjectName(right && right.name);
    if (!leftName || leftName !== rightName) return false;
    return !leftUrl || !rightUrl || leftUrl === rightUrl;
}

export { getUrlHost };
