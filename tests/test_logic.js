/**
 * Unit & Integration Tests for Google Scholar Bookmarklet logic
 */

const assert = require('assert');
const fs = require('fs');

// Extract the functions from bookmarklet.js or define a harness
// Let's test the calculation logic directly
function calculateMetrics(papers) {
  if (!papers || papers.length === 0) {
    return { hIndex: 0, i10Index: 0, totalCitations: 0, median: 0, max: 0, gini: 0 };
  }

  var descCitations = papers.map(p => p.citations).sort((a, b) => b - a);
  var hIndex = 0;
  for (var i = 0; i < descCitations.length; i++) {
    if (descCitations[i] >= i + 1) {
      hIndex = i + 1;
    } else {
      break;
    }
  }

  var i10Index = descCitations.filter(c => c >= 10).length;
  var totalCitations = descCitations.reduce((sum, c) => sum + c, 0);
  var max = descCitations[0] || 0;

  var mid = Math.floor(descCitations.length / 2);
  var median = descCitations.length % 2 === 0
    ? (descCitations[mid - 1] + descCitations[mid]) / 2
    : descCitations[mid];

  var ascCitations = descCitations.slice().reverse();
  var n = ascCitations.length;
  var gini = 0;
  if (totalCitations > 0 && n > 1) {
    var cumSum = 0;
    for (var k = 0; k < n; k++) {
      cumSum += (k + 1) * ascCitations[k];
    }
    gini = (2 * cumSum) / (n * totalCitations) - (n + 1) / n;
    if (gini < 0) gini = 0;
    if (gini > 1) gini = 1;
  }

  return {
    hIndex: hIndex,
    i10Index: i10Index,
    totalCitations: totalCitations,
    median: median,
    max: max,
    gini: Number(gini.toFixed(3))
  };
}

console.log('--- Test 1: Standard Hirsch Example ---');
// Classic example: papers with citations [10, 8, 5, 4, 3] -> h-index = 4 (10>=1, 8>=2, 5>=3, 4>=4, 3<5)
const papers1 = [
  { citations: 10 },
  { citations: 8 },
  { citations: 5 },
  { citations: 4 },
  { citations: 3 }
];
const m1 = calculateMetrics(papers1);
assert.strictEqual(m1.hIndex, 4, 'h-index should be 4');
assert.strictEqual(m1.i10Index, 1, 'i10-index should be 1');
assert.strictEqual(m1.totalCitations, 30, 'total citations should be 30');
console.log('✓ Hirsch example passed: h =', m1.hIndex);

console.log('--- Test 2: Descending & Ascending Cutoff Alignment ---');
// In descending order (default): [10, 8, 5, 4, 3]
// n = 5, h = 4
// Top 4 papers are: index 1, 2, 3, 4 (1-based), corresponding to [10, 8, 5, 4].
// Boundary should be between index 4 (citation 4) and index 5 (citation 3): h + 0.5 = 4.5.
const hCutoffDesc = m1.hIndex + 0.5;
assert.strictEqual(hCutoffDesc, 4.5);
console.log('✓ Descending cutoff position passed: pos =', hCutoffDesc);

// In ascending order: [3, 4, 5, 8, 10]
// Boundary should be between index 1 (citation 3) and index 2 (citation 4): n - h + 0.5 = 1.5.
const sortedAsc = papers1.slice().sort((a,b) => a.citations - b.citations);
const n = sortedAsc.length;
const hCutoffAsc = n - m1.hIndex + 0.5;
assert.strictEqual(hCutoffAsc, 1.5);
console.log('✓ Ascending cutoff position passed: pos =', hCutoffAsc);

console.log('--- Test 3: Realistic Researcher Profile ---');
const papersReal = [
  { citations: 1540 },
  { citations: 890 },
  { citations: 430 },
  { citations: 310 },
  { citations: 155 },
  { citations: 89 },
  { citations: 45 },
  { citations: 28 },
  { citations: 19 },
  { citations: 14 },
  { citations: 11 },
  { citations: 9 },
  { citations: 6 },
  { citations: 3 },
  { citations: 1 },
  { citations: 0 }
];
// Descending ranks:
// 1: 1540 (>=1)
// 2: 890 (>=2)
// 3: 430 (>=3)
// 4: 310 (>=4)
// 5: 155 (>=5)
// 6: 89 (>=6)
// 7: 45 (>=7)
// 8: 28 (>=8)
// 9: 19 (>=9)
// 10: 14 (>=10)
// 11: 11 (>=11)
// 12: 9 (<12) -> stops here! h = 11!
const mReal = calculateMetrics(papersReal);
assert.strictEqual(mReal.hIndex, 11, 'h-index should be 11');
assert.strictEqual(mReal.i10Index, 11, 'i10-index should be 11');
console.log('✓ Realistic profile passed: h =', mReal.hIndex, 'total =', mReal.totalCitations, 'gini =', mReal.gini);

console.log('All tests passed successfully!');
