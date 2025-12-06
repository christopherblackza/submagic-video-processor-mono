import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testMediaSpacingRule() {
  console.log('🤖 Testing Media Placement Spacing Rule\n');

  const projectData = {
    id: 'test-project-123',
    title: 'Test Project for Spacing Rule',
    words: [
      { word: "I", start: 0.5, end: 0.8 },
      { word: "want", start: 0.9, end: 1.2 },
      { word: "to", start: 1.3, end: 1.5 },
      { word: "talk", start: 1.6, end: 2.0 },
      { word: "about", start: 2.1, end: 2.5 },
      { word: "yoga", start: 2.6, end: 3.5 },
      { word: "and", start: 3.6, end: 3.8 },
      { word: "meditation.", start: 3.9, end: 4.8 },
      { word: "Then", start: 5.2, end: 5.6 },
      { word: "I'll", start: 5.7, end: 6.0 },
      { word: "discuss", start: 6.1, end: 6.8 },
      { word: "supplements.", start: 6.9, end: 7.8 },
    ],
  };

  const mediaItems = [
    {
      userMediaId: 'yoga-meditation-1',
      description: 'man practicing yoga meditation for calm mindset and focus'
    },
    {
      userMediaId: 'supplements-1',
      description: 'man organizing supplements and nutrition products on table'
    },
  ];

  try {
    console.log('\n📊 Analyzing media matching with a short transcript...');
    
    const response = await axios.post(`${BASE_URL}/openai/analyze-media-matching`, {
      projectId: projectData.id,
      project: projectData,
      mediaItems: mediaItems,
    });

    console.log('✅ Analysis completed successfully!');
    
    const matches = response.data.matches;
    console.log(`📈 Found ${matches.length} media matches:`);

    let isValid = true;
    for (let i = 0; i < matches.length - 1; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i+1];
      const gap = nextMatch.startTime - currentMatch.endTime;

      console.log(`  - Match ${i+1}: ${currentMatch.userMediaId} @ ${currentMatch.startTime.toFixed(2)}s`);
      console.log(`    Gap to next match: ${gap.toFixed(2)}s`);

      if (gap < 5) {
        console.error(`❌ Spacing rule violated between match ${i+1} and ${i+2}`);
        isValid = false;
      }
    }
    console.log(`  - Match ${matches.length}: ${matches[matches.length-1].userMediaId} @ ${matches[matches.length-1].startTime.toFixed(2)}s`);


    if (isValid) {
      console.log('\n✅ All matches respect the 5-second spacing rule.');
    } else {
      console.error('\n❌ One or more matches violate the 5-second spacing rule.');
    }

  } catch (error: any) {
    console.error('❌ Error during testing:', error.response?.data || error.message);
  }
}

testMediaSpacingRule();