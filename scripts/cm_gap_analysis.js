// Champions Meeting Gap Analysis
// Analyzes the time gaps between consecutive Champions Meetings

const data = require('../src/data/champions_meeting.json');

console.log('=== CHAMPIONS MEETING DATE GAPS ===\n');

// Parse and sort meetings by start date
const meetings = data.map(m => ({
  name: m.name,
  start: new Date(m.start_date),
  end: new Date(m.end_date)
})).sort((a, b) => a.start - b.start);

// Display each meeting with gap from previous
for (let i = 0; i < meetings.length; i++) {
  const current = meetings[i];
  const gap = i > 0 
    ? Math.round((current.start - meetings[i-1].start) / (1000 * 60 * 60 * 24)) 
    : 0;
  const dateStr = current.start.toISOString().split('T')[0];
  const gapStr = gap > 0 ? `(+${gap.toString().padStart(2)} days from previous)` : '(First)';
  console.log(`${(i).toString().padStart(2)}. ${dateStr} - ${current.name.padEnd(20)} ${gapStr}`);
}

// Calculate gap statistics
console.log('\n=== GAP STATISTICS ===');
const gaps = [];
for (let i = 1; i < meetings.length; i++) {
  gaps.push(Math.round((meetings[i].start - meetings[i-1].start) / (1000 * 60 * 60 * 24)));
}

const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
const minGap = Math.min(...gaps);
const maxGap = Math.max(...gaps);

console.log(`Total meetings: ${meetings.length}`);
console.log(`Average gap: ${avgGap.toFixed(1)} days`);
console.log(`Minimum gap: ${minGap} days`);
console.log(`Maximum gap: ${maxGap} days`);

// Count occurrences of each gap
const gapCounts = {};
gaps.forEach(g => {
  gapCounts[g] = (gapCounts[g] || 0) + 1;
});

console.log('\n=== GAP FREQUENCY ===');
Object.entries(gapCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([gap, count]) => {
    console.log(`${gap} days: ${count}x (${(count / gaps.length * 100).toFixed(1)}%)`);
  });

// Analyze typical patterns
console.log('\n=== PATTERN ANALYSIS ===');
const monthlyGaps = gaps.filter(g => g >= 28 && g <= 31);
const biMonthlyGaps = gaps.filter(g => g >= 56 && g <= 65);

if (monthlyGaps.length > 0) {
  console.log(`Monthly pattern (~30 days): ${monthlyGaps.length} occurrences`);
}
if (biMonthlyGaps.length > 0) {
  console.log(`Bi-monthly pattern (~60 days): ${biMonthlyGaps.length} occurrences`);
}

// Recent vs early gaps
if (meetings.length >= 10) {
  const recentGaps = gaps.slice(-5);
  const earlyGaps = gaps.slice(0, 5);
  const recentAvg = recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length;
  const earlyAvg = earlyGaps.reduce((a, b) => a + b, 0) / earlyGaps.length;
  
  console.log(`\nEarly 5 gaps average: ${earlyAvg.toFixed(1)} days`);
  console.log(`Recent 5 gaps average: ${recentAvg.toFixed(1)} days`);
  console.log(`Trend: ${recentAvg > earlyAvg ? 'Increasing' : 'Decreasing'} gap (${Math.abs(recentAvg - earlyAvg).toFixed(1)} days difference)`);
}
