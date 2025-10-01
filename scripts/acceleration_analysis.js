// Acceleration Rate Analysis Script
// Analyzes JP vs Global release timing to calculate acceleration patterns

const JP_LAUNCH = new Date('2021-02-24T03:00:00.000Z');
const GLOBAL_LAUNCH = new Date('2025-06-26T22:00:00.000Z'); // 22:00 UTC = midnight in GMT+2

// Confirmed global dates from timeline service
// All times are 22:00 UTC to display as midnight in GMT+2
const confirmedGlobalDates = new Map([
  ['2021_30004.png', new Date('2025-06-27T22:00:00.000Z')], // TM Opera O - June 27, 2025 22:00 UTC
  ['2021_30006.png', new Date('2025-07-02T22:00:00.000Z')], // Mihono Bourbon - July 2, 2025 22:00 UTC
  ['2021_30008.png', new Date('2025-07-10T22:00:00.000Z')], // Biwa Hayahide - July 10, 2025 22:00 UTC
  ['2021_30010.png', new Date('2025-07-16T22:00:00.000Z')], // Tokai Teio - July 16, 2025 22:00 UTC
  ['2021_30012.png', new Date('2025-07-27T22:00:00.000Z')], // Banner - July 27, 2025 22:00 UTC
  ['2021_30014.png', new Date('2025-08-03T22:00:00.000Z')], // Banner - August 3, 2025 22:00 UTC
  ['2021_30016.png', new Date('2025-08-11T22:00:00.000Z')], // Banner - August 11, 2025 22:00 UTC
  ['2021_30018.png', new Date('2025-08-20T22:00:00.000Z')], // Banner - August 20, 2025 22:00 UTC
  ['2021_30020.png', new Date('2025-08-28T22:00:00.000Z')], // Banner - August 28, 2025 22:00 UTC
  ['2021_30022.png', new Date('2025-09-07T22:00:00.000Z')], // Banner - September 7, 2025 22:00 UTC
  ['2021_30024.png', new Date('2025-09-17T22:00:00.000Z')], // Banner - September 17, 2025 22:00 UTC
  ['2021_30026.png', new Date('2025-09-21T22:00:00.000Z')], // Banner - September 21, 2025 22:00 UTC
  ['2021_30028.png', new Date('2025-10-02T22:00:00.000Z')], // Banner - October 2, 2025 22:00 UTC
  ['2021_30030.png', new Date('2025-10-07T22:00:00.000Z')], // Banner - October 7, 2025 22:00 UTC
  ['2021_30032.png', new Date('2025-10-14T22:00:00.000Z')], // Banner - October 14, 2025 22:00 UTC
  ['2021_30034.png', new Date('2025-10-21T22:00:00.000Z')], // Banner - October 21, 2025 22:00 UTC
  ['2021_30036.png', new Date('2025-10-26T22:00:00.000Z')], // Banner - October 26, 2025 22:00 UTC - Half Anniversary
  ['2021_30038.png', new Date('2025-10-30T22:00:00.000Z')], // Banner - November 4, 2025 22:00 UTC
]);

// JP character banner data (from character_banners.json)
const jpBanners = [
  { image: '2021_30004.png', start_date: '2021-03-02T03:00:00.000Z' }, // TM Opera O
  { image: '2021_30006.png', start_date: '2021-03-09T03:00:00.000Z' }, // Mihono Bourbon
  { image: '2021_30008.png', start_date: '2021-03-18T03:00:00.000Z' }, // Biwa Hayahide
  { image: '2021_30010.png', start_date: '2021-03-30T03:00:00.000Z' }, // Tokai Teio
  { image: '2021_30012.png', start_date: '2021-04-15T03:00:00.000Z' }, // Curren Chan
  { image: '2021_30014.png', start_date: '2021-04-26T03:00:00.000Z' }, // Narita Taishin
  { image: '2021_30016.png', start_date: '2021-05-06T03:00:00.000Z' }, // Smart Falcon
  { image: '2021_30018.png', start_date: '2021-05-17T03:00:00.000Z' }, // Narita Brian
  { image: '2021_30020.png', start_date: '2021-05-28T03:00:00.000Z' }, // Oguri Cap + Air Groove Wedding
  { image: '2021_30022.png', start_date: '2021-06-10T03:00:00.000Z' }, // Seiun Sky
  { image: '2021_30024.png', start_date: '2021-06-21T03:00:00.000Z' }, // Hishi Amazon
  { image: '2021_30026.png', start_date: '2021-06-29T03:00:00.000Z' }, // Mejiro McQueen + Grass Wonder Fantasy
  { image: '2021_30028.png', start_date: '2021-07-12T03:00:00.000Z' }, // Fuji Kiseki (Fixed: was 07-11)
  { image: '2021_30030.png', start_date: '2021-07-20T03:00:00.000Z' }, // Gold City
  { image: '2021_30032.png', start_date: '2021-07-29T03:00:00.000Z' }, // Vodka + Maruzensky Summer (Fixed: was 07-30)
  { image: '2021_30034.png', start_date: '2021-08-11T03:00:00.000Z' }, // Meisho Doto (Fixed: was 08-10)
  { image: '2021_30036.png', start_date: '2021-08-20T03:00:00.000Z' }, // Eishin Flash - Half Anniversary (Fixed: was 08-24)
  { image: '2021_30038.png', start_date: '2021-08-30T03:00:00.000Z' }, // Symboli Rudolf (Fixed: was 09-01)
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
  
}

// Run the analysis
analyzeAcceleration();
