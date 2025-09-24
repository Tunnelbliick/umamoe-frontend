// Acceleration Rate Analysis Script
// Analyzes JP vs Global release timing to calculate acceleration patterns

const JP_LAUNCH = new Date('2021-02-24T03:00:00.000Z');
const GLOBAL_LAUNCH = new Date('2025-06-26T03:00:00.000Z');

// Confirmed global dates from timeline service
const confirmedGlobalDates = new Map([
  ['2021_30004.png', new Date('2025-06-27T00:00:00.000Z')], // TM Opera O
  ['2021_30006.png', new Date('2025-07-02T00:00:00.000Z')], // Mihono Bourbon
  ['2021_30008.png', new Date('2025-07-10T00:00:00.000Z')], // Biwa Hayahide
  ['2021_30010.png', new Date('2025-07-16T00:00:00.000Z')], // Tokai Teio
  ['2021_30012.png', new Date('2025-07-27T00:00:00.000Z')], // Banner
  ['2021_30014.png', new Date('2025-08-03T00:00:00.000Z')], // Banner
  ['2021_30016.png', new Date('2025-08-11T00:00:00.000Z')], // Banner
  ['2021_30018.png', new Date('2025-08-20T00:00:00.000Z')], // Banner
  ['2021_30020.png', new Date('2025-08-28T00:00:00.000Z')], // Banner
  ['2021_30022.png', new Date('2025-09-07T00:00:00.000Z')], // Banner
  ['2021_30024.png', new Date('2025-09-17T00:00:00.000Z')], // Banner
  ['2021_30026.png', new Date('2025-09-21T00:00:00.000Z')], // Banner
]);

// JP character banner data (from character_banners.json)
const jpBanners = [
  { image: '2021_30004.png', start_date: '2021-03-02T03:00:00.000Z' },
  { image: '2021_30006.png', start_date: '2021-03-09T03:00:00.000Z' },
  { image: '2021_30008.png', start_date: '2021-03-18T03:00:00.000Z' },
  { image: '2021_30010.png', start_date: '2021-03-30T03:00:00.000Z' },
  { image: '2021_30012.png', start_date: '2021-04-15T03:00:00.000Z' },
  { image: '2021_30014.png', start_date: '2021-04-26T03:00:00.000Z' },
  { image: '2021_30016.png', start_date: '2021-05-06T03:00:00.000Z' },
  { image: '2021_30018.png', start_date: '2021-05-17T03:00:00.000Z' },
  { image: '2021_30020.png', start_date: '2021-05-28T03:00:00.000Z' },
  { image: '2021_30022.png', start_date: '2021-06-10T03:00:00.000Z' },
  { image: '2021_30024.png', start_date: '2021-06-21T03:00:00.000Z' },
  { image: '2021_30026.png', start_date: '2021-06-29T03:00:00.000Z' },
];

function daysDifference(date1, date2) {
  return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

function analyzeAcceleration() {
  console.log('=== ACCELERATION RATE ANALYSIS ===\n');
  
  const totalJpDays = daysDifference(JP_LAUNCH, GLOBAL_LAUNCH);
  console.log(`Total delay: ${totalJpDays} days (JP launch to Global launch)\n`);
  
  const results = [];
  
  jpBanners.forEach(banner => {
    const globalDate = confirmedGlobalDates.get(banner.image);
    if (!globalDate) return;
    
    const jpDate = new Date(banner.start_date);
    const jpDaysSinceLaunch = daysDifference(JP_LAUNCH, jpDate);
    const globalDaysSinceLaunch = daysDifference(GLOBAL_LAUNCH, globalDate);
    
    // Skip if global days is 0 or negative (edge cases)
    if (globalDaysSinceLaunch <= 0) return;
    
    const accelerationRate = jpDaysSinceLaunch / globalDaysSinceLaunch;
    
    results.push({
      banner: banner.image,
      jpDaysSinceLaunch,
      globalDaysSinceLaunch,
      accelerationRate,
      jpDate: jpDate.toISOString().split('T')[0],
      globalDate: globalDate.toISOString().split('T')[0]
    });
  });
  
  // Sort by JP days since launch
  results.sort((a, b) => a.jpDaysSinceLaunch - b.jpDaysSinceLaunch);
  
  console.log('Banner Analysis:');
  console.log('Banner\t\tJP Days\tGlobal Days\tAccel Rate\tJP Date\t\tGlobal Date');
  console.log('-'.repeat(85));
  
  results.forEach(result => {
    console.log(
      `${result.banner}\t${result.jpDaysSinceLaunch}\t${result.globalDaysSinceLaunch}\t\t${result.accelerationRate.toFixed(3)}\t\t${result.jpDate}\t${result.globalDate}`
    );
  });
  
  // Calculate trends
  console.log('\n=== TREND ANALYSIS ===');
  
  if (results.length >= 2) {
    const firstRate = results[0].accelerationRate;
    const lastRate = results[results.length - 1].accelerationRate;
    const rateChange = lastRate - firstRate;
    const percentChange = ((rateChange / firstRate) * 100);
    
    console.log(`First acceleration rate: ${firstRate.toFixed(3)}`);
    console.log(`Last acceleration rate: ${lastRate.toFixed(3)}`);
    console.log(`Rate change: ${rateChange > 0 ? '+' : ''}${rateChange.toFixed(3)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)`);
    
    // Check for consistent decline
    let declines = 0;
    let increases = 0;
    
    for (let i = 1; i < results.length; i++) {
      if (results[i].accelerationRate < results[i-1].accelerationRate) {
        declines++;
      } else {
        increases++;
      }
    }
    
    console.log(`\nDeclines: ${declines}, Increases: ${increases}`);
    if (declines > increases) {
      console.log('TREND: Generally declining acceleration (getting slower)');
    } else if (increases > declines) {
      console.log('TREND: Generally increasing acceleration (getting faster)');
    } else {
      console.log('TREND: Mixed pattern');
    }
  }
  
  // Calculate average rates
  const averageRate = results.reduce((sum, r) => sum + r.accelerationRate, 0) / results.length;
  console.log(`\nAverage acceleration rate: ${averageRate.toFixed(3)}`);
  
  // Calculate median rate for more robust measure
  const sortedRates = results.map(r => r.accelerationRate).sort((a, b) => a - b);
  const medianRate = sortedRates.length % 2 === 0 
    ? (sortedRates[sortedRates.length/2 - 1] + sortedRates[sortedRates.length/2]) / 2
    : sortedRates[Math.floor(sortedRates.length/2)];
  console.log(`Median acceleration rate: ${medianRate.toFixed(3)}`);
  
  // Recent vs early comparison
  if (results.length >= 6) {
    const earlyBanners = results.slice(0, 3);
    const recentBanners = results.slice(-3);
    
    const earlyAvg = earlyBanners.reduce((sum, r) => sum + r.accelerationRate, 0) / earlyBanners.length;
    const recentAvg = recentBanners.reduce((sum, r) => sum + r.accelerationRate, 0) / recentBanners.length;
    
    console.log(`\nEarly banners average: ${earlyAvg.toFixed(3)}`);
    console.log(`Recent banners average: ${recentAvg.toFixed(3)}`);
    console.log(`Recent vs Early: ${((recentAvg - earlyAvg) / earlyAvg * 100).toFixed(1)}%`);
    
    // Check for linear decline
    const ratePerBanner = (recentAvg - earlyAvg) / (results.length - 1);
    if (Math.abs(ratePerBanner) > 0.01) {
      console.log(`Rate change per banner: ${ratePerBanner.toFixed(4)} (${ratePerBanner > 0 ? 'accelerating' : 'decelerating'})`);
    }
  }
  
  // Timeline service current factor
  console.log(`\nCurrent ACCELERATION_TWEAK_FACTOR: 0.85 (15% slower than calculated)`);
  console.log(`Effective acceleration rate with tweak: ${(averageRate * 0.85).toFixed(3)}`);
  console.log(`Current fallback rate in code: 1.55`);
  console.log(`Calculated vs Fallback: ${((averageRate / 1.55) * 100).toFixed(1)}% of fallback rate`);
}

// Run the analysis
analyzeAcceleration();
