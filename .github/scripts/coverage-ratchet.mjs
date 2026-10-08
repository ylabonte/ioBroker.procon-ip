// Coverage report + ratchet for the "Coverage" workflow.
//
// Compares the c8 json-summary of this run against the one of the PR's base
// commit, renders a Markdown report (job summary + sticky PR comment) and
// reports via the `decreased` step output whether any metric went down.
// The workflow fails on a decrease unless the PR carries the override label.
//
// Inputs (env): HEAD_SUMMARY, BASE_SUMMARY (optional), TEST_RESULTS (mocha json,
// optional), C8RC, BASE_LABEL, OVERRIDE ('true'/'false'), REPORT_FILE,
// GITHUB_STEP_SUMMARY, GITHUB_OUTPUT.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const METRICS = ['statements', 'branches', 'functions', 'lines'];
const MARKER = '<!-- coverage-ratchet -->';
const OVERRIDE_LABEL = 'coverage-override';

const readJson = file => (file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
const fmt = pct => `${pct.toFixed(2)} %`;

const env = process.env;
const head = readJson(env.HEAD_SUMMARY)?.total;
const base = readJson(env.BASE_SUMMARY)?.total ?? null;
const tests = readJson(env.TEST_RESULTS)?.stats ?? null;
const thresholds = readJson(env.C8RC) ?? {};
const override = env.OVERRIDE === 'true';
// "master (<40-char sha>)" -> "master (abc1234)"
const baseLabel = (env.BASE_LABEL || 'base').replace(/\b([0-9a-f]{7})[0-9a-f]{33}\b/, '$1');

const lines = [MARKER, '### 🧪 Unit tests & coverage', ''];

if (tests) {
    const icon = tests.failures > 0 ? '❌' : '✅';
    lines.push(
        `${icon} **${tests.passes} passed**, ${tests.failures} failed, ${tests.pending} pending (${tests.tests} total)`,
        '',
    );
}

const decreased = [];
if (!head) {
    lines.push('⚠️ No coverage summary was produced — see the job log.');
} else {
    const header = base ? `| Metric | ${baseLabel} | This change | Δ | Min |` : '| Metric | Coverage | Min |';
    lines.push(header, base ? '|---|--:|--:|--:|--:|' : '|---|--:|--:|');
    for (const metric of METRICS) {
        const now = head[metric].pct;
        const min = thresholds[metric] !== undefined ? `${thresholds[metric]} %` : '–';
        const name = metric[0].toUpperCase() + metric.slice(1);
        if (!base) {
            lines.push(`| ${name} | ${fmt(now)} | ${min} |`);
            continue;
        }
        const before = base[metric].pct;
        const delta = now - before;
        let mark = '';
        if (delta < 0) {
            decreased.push(name);
            mark = ' 🔻';
        } else if (delta > 0) {
            mark = ' 🔺';
        }
        const sign = delta > 0 ? '+' : '';
        lines.push(`| ${name} | ${fmt(before)} | ${fmt(now)} | ${sign}${delta.toFixed(2)}${mark} | ${min} |`);
    }
    lines.push('');

    if (!base) {
        if (env.BASE_LABEL) {
            lines.push('⚠️ The base coverage could not be measured, so the ratchet was skipped.');
        }
    } else if (decreased.length === 0) {
        lines.push('✅ Coverage did not decrease.');
    } else if (override) {
        lines.push(`⚠️ Coverage decreased (${decreased.join(', ')}), accepted via the \`${OVERRIDE_LABEL}\` label.`);
    } else {
        lines.push(
            `❌ Coverage decreased (${decreased.join(', ')}). Add tests, or label the PR ` +
                `\`${OVERRIDE_LABEL}\` if the drop is intended (e.g. well-tested code was removed).`,
        );
    }
}

const report = `${lines.join('\n')}\n`;
if (env.REPORT_FILE) {
    writeFileSync(env.REPORT_FILE, report);
}
if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, report);
}
if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `decreased=${decreased.length > 0 && !override}\n`);
}
console.log(report);
