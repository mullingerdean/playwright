const express = require('express');
const cors = require('cors');

const app = express();
const PORT = parseInt(process.env.PORT || '5173', 10);

function coerceArray(value) {
    return Array.isArray(value) ? value : [];
}

function mergeStringLists(existing = [], additions = []) {
    const set = new Set();
    coerceArray(existing).forEach(item => {
        if (item !== null && item !== undefined && item !== '') {
            set.add(String(item));
        }
    });
    coerceArray(additions).forEach(item => {
        if (item !== null && item !== undefined && item !== '') {
            set.add(String(item));
        }
    });
    return Array.from(set.values());
}

function normalizeMethodDetails(details = {}) {
    if (!details || typeof details !== 'object') {
        return null;
    }
    const methodName = details.methodName || details.name;
    if (!methodName) {
        return null;
    }
    return {
        methodName,
        className: details.className || '',
        objectName: details.objectName || '',
        summaryText: details.summaryText || details.summary || '',
        expectedResultText: details.expectedResultText || details.expectedResult || '',
        params: details.params || details.parameters || '',
        snippet: details.snippet || '',
        isAsync: !!details.isAsync,
        isStatic: !!details.isStatic,
        line: details.line ?? null
    };
}

function mergeMethodDetails(existing = [], additions = []) {
    const map = new Map();
    const add = (entry) => {
        const normalized = normalizeMethodDetails(entry);
        if (!normalized) {
            return;
        }
        const key = `${normalized.methodName.toLowerCase()}:${normalized.objectName.toLowerCase()}:${normalized.line ?? ''}`;
        if (!map.has(key)) {
            map.set(key, { ...normalized });
            return;
        }
        const current = map.get(key);
        if (!current.summaryText && normalized.summaryText) current.summaryText = normalized.summaryText;
        if (!current.expectedResultText && normalized.expectedResultText) current.expectedResultText = normalized.expectedResultText;
        if (!current.params && normalized.params) current.params = normalized.params;
        if (!current.snippet && normalized.snippet) current.snippet = normalized.snippet;
        if (!current.className && normalized.className) current.className = normalized.className;
        current.isAsync = current.isAsync || normalized.isAsync;
        current.isStatic = current.isStatic || normalized.isStatic;
    };

    coerceArray(existing).forEach(add);
    coerceArray(additions).forEach(add);

    return Array.from(map.values());
}

function normalizeHttpCallEntry(call) {
    if (!call) {
        return null;
    }
    const method = (call.method || call.httpMethod || 'REQUEST').toUpperCase();
    const url = call.url || call.endpoint || '(dynamic URL)';
    const key = `${method}:${url}`;
    const sources = new Set();
    const payloads = new Set();

    coerceArray(call.sources).forEach(source => {
        if (source) {
            sources.add(String(source));
        }
    });
    if (call.source) {
        sources.add(String(call.source));
    }
    if (call.sourceLabel) {
        sources.add(String(call.sourceLabel));
    }

    const payload = call.payload || call.body || call.requestBody;
    if (payload) {
        payloads.add(String(payload));
    }
    coerceArray(call.payloads).forEach(item => {
        if (item) {
            payloads.add(String(item));
        }
    });

    return {
        key,
        data: {
            method,
            url,
            sources,
            payloads
        }
    };
}

function mergeHttpCallLists(existing = [], additions = []) {
    const map = new Map();

    const add = (entry) => {
        const normalized = normalizeHttpCallEntry(entry);
        if (!normalized) {
            return;
        }
        if (!map.has(normalized.key)) {
            map.set(normalized.key, normalized.data);
            return;
        }
        const current = map.get(normalized.key);
        normalized.data.sources.forEach(source => current.sources.add(source));
        normalized.data.payloads.forEach(payload => current.payloads.add(payload));
    };

    coerceArray(existing).forEach(add);
    coerceArray(additions).forEach(add);

    return Array.from(map.values()).map(entry => ({
        method: entry.method,
        url: entry.url,
        sources: Array.from(entry.sources.values()),
        payloads: Array.from(entry.payloads.values())
    }));
}

function mergeSqlEntries(existing = [], additions = []) {
    const map = new Map();

    const add = (entry) => {
        if (!entry) {
            return;
        }
        const query = typeof entry === 'string' ? entry : entry.query;
        if (!query) {
            return;
        }
        const normalized = query.trim();
        if (!normalized) {
            return;
        }
        if (!map.has(normalized)) {
            map.set(normalized, {
                query: normalized,
                origins: new Set()
            });
        }
        const originValue = typeof entry === 'string' ? null : (entry.origin || entry.flowLabel || entry.apiLabel);
        const container = map.get(normalized);
        if (Array.isArray(originValue)) {
            originValue.forEach(item => {
                if (item) {
                    container.origins.add(String(item));
                }
            });
        } else if (originValue) {
            container.origins.add(String(originValue));
        }
    };

    coerceArray(existing).forEach(add);
    coerceArray(additions).forEach(add);

    return Array.from(map.values()).map(entry => ({
        query: entry.query,
        origin: entry.origins.size > 0 ? Array.from(entry.origins.values()).join(', ') : undefined
    }));
}

function mergeFlowCoverageData(primary = [], fallback = []) {
    const map = new Map();

    const add = (entry) => {
        if (!entry) {
            return;
        }
        const label = entry.label || entry.name || entry.path || 'Flow helper';
        const key = label.toLowerCase();
        if (!map.has(key)) {
            map.set(key, {
                label,
                summary: entry.summary || '',
                functionNames: mergeStringLists([], entry.functionNames),
                methods: mergeMethodDetails([], entry.methods || entry.invokedMethods),
                httpCalls: mergeHttpCallLists([], entry.httpCalls),
                sqlQueries: mergeSqlEntries([], entry.sqlQueries)
            });
            return;
        }

        const current = map.get(key);
        current.summary = current.summary || entry.summary || '';
        current.functionNames = mergeStringLists(current.functionNames, entry.functionNames);
        current.methods = mergeMethodDetails(current.methods, entry.methods || entry.invokedMethods);
        current.httpCalls = mergeHttpCallLists(current.httpCalls, entry.httpCalls);
        current.sqlQueries = mergeSqlEntries(current.sqlQueries, entry.sqlQueries);
    };

    coerceArray(primary).forEach(add);
    coerceArray(fallback).forEach(add);

    return Array.from(map.values());
}

function mergeApiCoverageData(primary = [], fallback = []) {
    const map = new Map();

    const add = (entry) => {
        if (!entry) {
            return;
        }
        const label = entry.label || entry.name || entry.path || 'API helper';
        const key = label.toLowerCase();
        if (!map.has(key)) {
            map.set(key, {
                label,
                summary: entry.summary || '',
                endpoint: entry.endpoint || '',
                methods: mergeMethodDetails([], entry.methods),
                httpCalls: mergeHttpCallLists([], entry.httpCalls),
                sqlQueries: mergeSqlEntries([], entry.sqlQueries),
                exports: mergeStringLists([], entry.exports)
            });
            return;
        }

        const current = map.get(key);
        current.summary = current.summary || entry.summary || '';
        current.endpoint = current.endpoint || entry.endpoint || '';
        current.methods = mergeMethodDetails(current.methods, entry.methods);
        current.httpCalls = mergeHttpCallLists(current.httpCalls, entry.httpCalls);
        current.sqlQueries = mergeSqlEntries(current.sqlQueries, entry.sqlQueries);
        current.exports = mergeStringLists(current.exports, entry.exports);
    };

    coerceArray(primary).forEach(add);
    coerceArray(fallback).forEach(add);

    return Array.from(map.values());
}

function deriveCoverageFromSteps(steps = []) {
    const flowMap = new Map();
    const apiMap = new Map();
    const httpMap = new Map();
    const sqlMap = new Map();

    const ensureFlow = (label) => {
        const normalizedLabel = label && typeof label === 'string' ? label : '';
        const key = normalizedLabel.toLowerCase() || `flow-${flowMap.size + 1}`;
        if (!flowMap.has(key)) {
            flowMap.set(key, {
                label: normalizedLabel || 'Flow helper',
                summary: '',
                methods: new Map(),
                httpCalls: new Map(),
                sqlQueries: new Map()
            });
        }
        return flowMap.get(key);
    };

    const ensureApi = (label) => {
        const normalizedLabel = label && typeof label === 'string' ? label : '';
        const key = normalizedLabel.toLowerCase() || `api-${apiMap.size + 1}`;
        if (!apiMap.has(key)) {
            apiMap.set(key, {
                label: normalizedLabel || 'API helper',
                summary: '',
                endpoint: '',
                methods: new Map(),
                httpCalls: new Map(),
                sqlQueries: new Map(),
                exports: new Set()
            });
        }
        return apiMap.get(key);
    };

    const registerHttp = (method, url, sourceLabel, payload) => {
        const normalizedMethod = (method || 'REQUEST').toUpperCase();
        const normalizedUrl = url || '(dynamic URL)';
        const key = `${normalizedMethod}:${normalizedUrl}`;
        if (!httpMap.has(key)) {
            httpMap.set(key, {
                method: normalizedMethod,
                url: normalizedUrl,
                sources: new Set(),
                payloads: new Set()
            });
        }
        const entry = httpMap.get(key);
        if (sourceLabel) {
            entry.sources.add(String(sourceLabel));
        }
        if (payload) {
            entry.payloads.add(String(payload));
        }
    };

    const registerSql = (query, originLabel) => {
        if (!query) {
            return;
        }
        const normalized = query.trim();
        if (!normalized) {
            return;
        }
        if (!sqlMap.has(normalized)) {
            sqlMap.set(normalized, {
                query: normalized,
                origins: new Set()
            });
        }
        const entry = sqlMap.get(normalized);
        if (originLabel) {
            entry.origins.add(String(originLabel));
        }
    };

    steps.forEach(step => {
        const ctx = step?.context || {};
        const type = String(ctx.resourceType || '').toLowerCase();
        const label = ctx.resourcePath || ctx.details?.flowLabel || ctx.details?.apiLabel || ctx.details?.helperLabel || null;

        if (!type) {
            return;
        }

        if (type === 'flow-method') {
            const flow = ensureFlow(label);
            const methodDetails = mergeMethodDetails([], [ctx.details || {}]);
            methodDetails.forEach(detail => {
                const key = `${detail.methodName.toLowerCase()}:${detail.objectName.toLowerCase()}:${detail.line ?? ''}`;
                if (!flow.methods.has(key)) {
                    flow.methods.set(key, detail);
                }
            });
            if (!flow.summary && typeof step.action === 'string') {
                flow.summary = step.action.split('\n')[0];
            }
        } else if (type === 'flow') {
            const flow = ensureFlow(label);
            if (!flow.summary && typeof step.action === 'string') {
                flow.summary = step.action;
            }
        } else if (type === 'flow-http') {
            const flow = ensureFlow(label);
            const details = ctx.details || {};
            const method = details.method || ctx.method;
            const url = details.url || ctx.url;
            const key = `${(method || '').toUpperCase()}:${url || ''}`;
            if (!flow.httpCalls.has(key)) {
                flow.httpCalls.set(key, {
                    method: (method || 'REQUEST').toUpperCase(),
                    url: url || '(dynamic URL)'
                });
            }
            registerHttp(method, url, flow.label, details.payload || details.body);
        } else if (type === 'flow-sql') {
            const flow = ensureFlow(label);
            const details = ctx.details || {};
            const query = details.query || step.action;
            if (query) {
                const normalized = query.trim();
                if (normalized && !flow.sqlQueries.has(normalized)) {
                    flow.sqlQueries.set(normalized, {
                        query: normalized,
                        origin: flow.label
                    });
                }
                registerSql(query, flow.label);
            }
        } else if (type === 'api-method') {
            const api = ensureApi(label);
            const methodDetails = mergeMethodDetails([], [ctx.details || {}]);
            methodDetails.forEach(detail => {
                const key = `${detail.methodName.toLowerCase()}:${detail.objectName.toLowerCase()}:${detail.line ?? ''}`;
                if (!api.methods.has(key)) {
                    api.methods.set(key, detail);
                }
            });
            if (!api.summary && typeof step.action === 'string') {
                api.summary = step.action.split('\n')[0];
            }
        } else if (type === 'api') {
            const api = ensureApi(label);
            if (!api.summary && typeof step.action === 'string') {
                api.summary = step.action;
            }
            if (ctx.endpoint) {
                api.endpoint = api.endpoint || ctx.endpoint;
            }
            const details = ctx.details || {};
            coerceArray(details.exports).forEach(item => {
                if (item) {
                    api.exports.add(String(item));
                }
            });
            coerceArray(details.httpCalls).forEach(call => {
                const method = call?.method;
                const url = call?.url;
                const key = `${(method || '').toUpperCase()}:${url || ''}`;
                if (!api.httpCalls.has(key)) {
                    api.httpCalls.set(key, {
                        method: (method || 'REQUEST').toUpperCase(),
                        url: url || '(dynamic URL)'
                    });
                }
                registerHttp(method, url, api.label);
            });
            coerceArray(details.sqlSamples).forEach(sample => {
                const query = typeof sample === 'string' ? sample : sample?.query;
                if (query) {
                    const normalized = query.trim();
                    if (normalized && !api.sqlQueries.has(normalized)) {
                        api.sqlQueries.set(normalized, {
                            query: normalized,
                            origin: api.label
                        });
                    }
                    registerSql(query, api.label);
                }
            });
        } else if (type === 'api-http') {
            const api = ensureApi(label);
            const details = ctx.details || {};
            const method = details.method || ctx.method;
            const url = details.url || ctx.url;
            const key = `${(method || '').toUpperCase()}:${url || ''}`;
            if (!api.httpCalls.has(key)) {
                api.httpCalls.set(key, {
                    method: (method || 'REQUEST').toUpperCase(),
                    url: url || '(dynamic URL)'
                });
            }
            registerHttp(method, url, api.label, details.payload || details.body);
        } else if (type === 'api-sql') {
            const api = ensureApi(label);
            const details = ctx.details || {};
            const query = details.query || step.action;
            if (query) {
                const normalized = query.trim();
                if (normalized && !api.sqlQueries.has(normalized)) {
                    api.sqlQueries.set(normalized, {
                        query: normalized,
                        origin: api.label
                    });
                }
                registerSql(query, api.label);
            }
        } else if (type === 'http-call') {
            const details = ctx.details || {};
            registerHttp(details.method || ctx.method, details.url || ctx.url, ctx.sourceLabel || details.sourceLabel, details.payload || details.body);
        } else if (type === 'sql-summary') {
            if (typeof step.action === 'string') {
                const lines = step.action.split('\n');
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('• ')) {
                        const withoutBullet = trimmed.slice(2);
                        const parts = withoutBullet.split(':');
                        if (parts.length >= 2) {
                            const originSegment = parts.shift();
                            const queryText = parts.join(':').trim();
                            if (queryText) {
                                registerSql(queryText, originSegment.trim());
                            }
                        }
                    }
                });
            }
        }
    });

    const flows = Array.from(flowMap.values()).map(flow => ({
        label: flow.label,
        summary: flow.summary,
        methods: Array.from(flow.methods.values()),
        httpCalls: Array.from(flow.httpCalls.values()),
        sqlQueries: Array.from(flow.sqlQueries.values())
    }));

    const apis = Array.from(apiMap.values()).map(api => ({
        label: api.label,
        summary: api.summary,
        endpoint: api.endpoint,
        methods: Array.from(api.methods.values()),
        httpCalls: Array.from(api.httpCalls.values()),
        sqlQueries: Array.from(api.sqlQueries.values()),
        exports: Array.from(api.exports.values())
    }));

    const httpCalls = Array.from(httpMap.values()).map(call => ({
        method: call.method,
        url: call.url,
        sources: Array.from(call.sources.values()),
        payloads: Array.from(call.payloads.values())
    }));

    const sqlQueries = Array.from(sqlMap.values()).map(entry => ({
        query: entry.query,
        origin: entry.origins.size > 0 ? Array.from(entry.origins.values()).join(', ') : undefined
    }));

    return { flows, apis, httpCalls, sqlQueries };
}

function normalizeStepHeadline(step, index) {
    const rawAction = (step?.action || '').replace(/\s+/g, ' ').trim();
    if (!rawAction) {
        return `Step ${index + 1}`;
    }
    const firstSentenceMatch = rawAction.match(/[^.!?]+[.!?]?/);
    const snippet = firstSentenceMatch ? firstSentenceMatch[0] : rawAction;
    const truncated = snippet.length > 140 ? `${snippet.slice(0, 137)}…` : snippet;
    return truncated;
}

function buildFlowCoverageEntries(flows = []) {
    return flows.map(flow => {
        const functionNames = coerceArray(flow.functionNames).filter(Boolean);
        const invokedMethods = coerceArray(flow.methods).filter(method => method && method.methodName);
        const httpCalls = coerceArray(flow.httpCalls).filter(call => call && call.method && call.url);
        const sqlQueries = coerceArray(flow.sqlQueries).filter(Boolean);

        const summaryParts = [];
        if (functionNames.length) {
            summaryParts.push(`Functions: ${functionNames.slice(0, 5).join(', ')}${functionNames.length > 5 ? '…' : ''}`);
        }
        if (invokedMethods.length) {
            summaryParts.push(`Spec invokes ${invokedMethods.length} helper method${invokedMethods.length === 1 ? '' : 's'}.`);
        }
        if (httpCalls.length) {
            const sample = httpCalls.slice(0, 3).map(call => `${call.method.toUpperCase()} ${call.url || '(dynamic URL)'}`).join('; ');
            summaryParts.push(`Outbound HTTP: ${sample}${httpCalls.length > 3 ? ` (+${httpCalls.length - 3} more)` : ''}`);
        }
        if (sqlQueries.length) {
            summaryParts.push(`Database touchpoints: ${sqlQueries.length}`);
        }

        return {
            label: flow.label || 'Flow helper',
            summary: summaryParts.join(' • ') || 'Flow helper orchestrates supporting actions.',
            functionNames,
            invokedMethods,
            httpCalls,
            sqlQueries
        };
    });
}

function buildApiCoverageEntries(apis = []) {
    return apis.map(api => {
        const methods = coerceArray(api.methods).filter(method => method && method.methodName);
        const httpCalls = coerceArray(api.httpCalls).filter(call => call && call.method && call.url);
        const sqlQueries = coerceArray(api.sqlQueries).filter(Boolean);
        const exportsList = coerceArray(api.exports).filter(Boolean);
        const summaryParts = [];

        if (api.endpoint) {
            summaryParts.push(`Primary endpoint: ${api.endpoint}`);
        }
        if (methods.length) {
            const sample = methods.slice(0, 3).map(method => method.methodName).join(', ');
            summaryParts.push(`Helper methods: ${sample}${methods.length > 3 ? '…' : ''}`);
        }
        if (httpCalls.length) {
            const sampleCalls = httpCalls.slice(0, 2).map(call => `${call.method.toUpperCase()} ${call.url || '(dynamic URL)'}`).join('; ');
            summaryParts.push(`HTTP coverage: ${sampleCalls}${httpCalls.length > 2 ? ` (+${httpCalls.length - 2} more)` : ''}`);
        }
        if (sqlQueries.length) {
            summaryParts.push(`Database queries: ${sqlQueries.length}`);
        }
        if (exportsList.length) {
            summaryParts.push(`Exports: ${exportsList.slice(0, 4).join(', ')}${exportsList.length > 4 ? '…' : ''}`);
        }

        return {
            label: api.label || 'API helper',
            endpoint: api.endpoint || '',
            summary: summaryParts.join(' • ') || 'API helper encapsulates external integrations.',
            methods,
            httpCalls,
            sqlQueries,
            exports: exportsList
        };
    });
}

function buildSpecStepCoverage(steps = []) {
    return steps.map((step, index) => ({
        index: step.index || index + 1,
        headline: normalizeStepHeadline(step, index),
        action: step.action || '',
        expectedResult: step.expectedResult || '',
        source: step?.context?.resourceType || 'spec-step'
    }));
}

function buildHttpCoverageEntries(entries = []) {
    return entries.map(entry => ({
        method: (entry.method || '').toUpperCase(),
        url: entry.url || '(dynamic URL)',
        sources: coerceArray(entry.sources).filter(Boolean),
        payloads: coerceArray(entry.payloads).filter(Boolean)
    }));
}

function buildComprehensivePlan(testCase = {}) {
    const steps = coerceArray(testCase.steps);
    const supporting = testCase.supportingContext || {};
    const derivedCoverage = deriveCoverageFromSteps(steps);
    const mergedFlows = mergeFlowCoverageData(coerceArray(supporting.flows), derivedCoverage.flows);
    const mergedApis = mergeApiCoverageData(coerceArray(supporting.apis), derivedCoverage.apis);
    const mergedHttp = mergeHttpCallLists(coerceArray(supporting.httpCalls), derivedCoverage.httpCalls);
    const mergedSql = mergeSqlEntries(coerceArray(supporting.sqlQueries), derivedCoverage.sqlQueries);

    const flows = buildFlowCoverageEntries(mergedFlows);
    const apis = buildApiCoverageEntries(mergedApis);
    const httpCalls = buildHttpCoverageEntries(mergedHttp);
    const sqlQueries = mergedSql;

    const functionalHighlights = [];
    flows.forEach(flow => functionalHighlights.push(`Flow: ${flow.label}`));
    apis.forEach(api => functionalHighlights.push(`API: ${api.label}`));

    return {
        title: testCase.title,
        summary: `Validate “${testCase.title}” end to end, exercising ${steps.length} spec step${steps.length === 1 ? '' : 's'} plus ${flows.length} flow helper${flows.length === 1 ? '' : 's'} and ${apis.length} API integration${apis.length === 1 ? '' : 's'}.`,
        coverage: {
            specSteps: steps.length,
            flows: flows.length,
            apis: apis.length,
            httpCalls: httpCalls.length,
            sqlQueries: sqlQueries.length
        },
        functionalHighlights,
        spec: {
            steps: buildSpecStepCoverage(steps)
        },
        flows,
        apis,
        httpCalls,
        sqlQueries: sqlQueries.map((entry, index) => ({
            index: index + 1,
            query: entry?.query || entry,
            origin: entry?.origin || undefined
        }))
    };
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'playwright-converter-evaluation', timestamp: new Date().toISOString() });
});

app.post('/api/evaluate', (req, res) => {
    try {
        const { providerId, credentials, testCase } = req.body || {};

        if (!providerId) {
            return res.status(400).json({ error: 'providerId is required' });
        }

        if (!testCase || !testCase.title) {
            return res.status(400).json({ error: 'testCase with a title is required' });
        }

        const stepCount = Array.isArray(testCase.steps) ? testCase.steps.length : 0;
        const missingAssertions = [];
        const improvements = [];

        if (stepCount === 0) {
            improvements.push('Add test steps so the evaluation has concrete actions to review.');
        }

        if (Array.isArray(testCase.steps)) {
            testCase.steps.forEach(step => {
                const action = (step?.action || '').toLowerCase();
                const expected = (step?.expectedResult || '').toLowerCase();
                const mentionsAssertion = expected.includes('expect') || expected.includes('assert');
                if (!mentionsAssertion) {
                    missingAssertions.push(`Step ${step.index || '?'} is missing an explicit assertion in the expected result.`);
                }
            });
        }

        if (typeof credentials?.apiKey === 'string' && credentials.apiKey.trim().length > 0) {
            improvements.push('API key received by companion service. Forward it to the chosen provider for real evaluations.');
        } else {
            improvements.push('No API key received. Configure a provider key in the app to enable real AI calls.');
        }

        const comprehensivePlan = buildComprehensivePlan(testCase);

        const responsePayload = {
            providerId,
            summary: comprehensivePlan.summary,
            risk_score: Math.min(100, missingAssertions.length * 20 + (stepCount === 0 ? 40 : 0)),
            missing_assertions: missingAssertions,
            suggested_improvements: improvements,
            helper_feedback: Array.isArray(testCase.supportingContext?.apis)
                ? testCase.supportingContext.apis.slice(0, 3).map(helper => ({
                    name: helper.name || helper.id || 'Helper',
                    issue: 'No live AI analysis available in placeholder service.',
                    recommendation: 'Implement provider integration to get tailored feedback.'
                }))
                : [],
            comprehensive_plan: comprehensivePlan
        };

        res.json(responsePayload);
    } catch (error) {
        console.error('Evaluation handler error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Evaluation service listening on http://localhost:${PORT}`);
    });
}

module.exports = app;
