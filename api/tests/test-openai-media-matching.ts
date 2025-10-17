import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';

// Sample media items for testing
const sampleMediaItems = [
  {
    userMediaId: '071d9f8c-b121-44a7-af0e-94e0a40d2729',
    description: 'man waking up from a nightmare, scared and disoriented in bed'
  },
  {
    userMediaId: 'bb920472-cf65-4c5b-aa2b-dc523f8efa6a',
    description: 'man practicing yoga meditation for calm mindset and focus'
  },
  {
    userMediaId: 'fd730269-e4bb-4f01-b62c-20dc2b1b9ffd',
    description: 'man waving goodbye with a friendly smile outdoors'
  },
  {
    userMediaId: 'daf5d010-0138-49f0-8c17-e5678b56ff25',
    description: 'man organizing supplements and nutrition products on table'
  },
  {
    userMediaId: '8f85e5f9-65f1-4d13-b59b-661d69ee9261',
    description: 'thoughtful executive man thinking deeply about a business problem'
  },
  {
    userMediaId: 'd734bb2f-1372-4ee2-99be-1db5922fd416',
    description: 'happy successful gay man celebrating career or life achievement'
  },
  {
    userMediaId: 'f1497c37-103f-4082-a7b3-bce94bdeaf8f',
    description: 'stressed and frustrated gay man showing anger or burnout'
  },
  {
    userMediaId: '15d41c13-ba15-4d26-9043-779f53bcfd3d',
    description: 'man running outdoors for fitness or stress relief'
  },
  {
    userMediaId: '62abad4f-d317-4c6f-aaed-ae2176a43acf',
    description: 'man saving money, budgeting, or placing cash into savings jar'
  },
  {
    userMediaId: 'bcc3d882-b606-49c1-b2af-df9934a48584',
    description: 'close-up of nutrition plan showing protein carbs and macros'
  },
  {
    userMediaId: 'c81d521d-786e-468a-8905-ada2d8fba825',
    description: 'excited gay man celebrating success with joy and enthusiasm'
  }
];


async function testOpenAIMediaMatching() {
  console.log('🤖 Testing OpenAI Media Matching Functionality\n');

  try {
    // Load the project data from the JSON file
    const projectDataPath = path.join(__dirname, '../../get-project-response.json');
    
    if (!fs.existsSync(projectDataPath)) {
      console.error('❌ Project data file not found:', projectDataPath);
      return;
    }

    const projectData = JSON.parse(fs.readFileSync(projectDataPath, 'utf8'));
    console.log(`📁 Loaded project data: ${projectData.title} (${projectData.words?.length || 0} words)`);

    // Test 1: Analyze media matching with project data
    console.log('\n📊 Test 1: Analyzing media matching with project data...');
    
    const analysisResponse = await axios.post(`${BASE_URL}/openai/analyze-media-matching`, {
      projectId: projectData.id,
      mediaItems: sampleMediaItems
    });

    console.log('✅ Analysis completed successfully!');
    console.log(`📈 Found ${analysisResponse.data.totalMatches} media matches:`);
    
    analysisResponse.data.matches.forEach((match: any, index: number) => {
      console.log(`  ${index + 1}. ${match.userMediaId}`);
      console.log(`     Time: ${match.startTime}s - ${match.endTime}s`);
      console.log(`     Confidence: ${match.confidence}`);
      console.log(`     Text: "${match.matchedText}"`);
      console.log(`     Reasoning: ${match.reasoning}`);
      console.log('');
    });

    // Test 2: Analyze and update project (using project ID from the data)
    console.log('\n🔄 Test 2: Analyzing and updating project...');
    
    const updateResponse = await axios.post(`${BASE_URL}/openai/analyze-and-update/${projectData.id}`, {
      mediaItems: sampleMediaItems
    });

    console.log('✅ Project analysis and update completed!');
    console.log(`📊 Applied ${updateResponse.data.appliedMatches} matches to project`);
    console.log(`💬 Message: ${updateResponse.data.message}`);

    if (updateResponse.data.matches && updateResponse.data.matches.length > 0) {
      console.log('\n📋 Applied matches:');
      updateResponse.data.matches.forEach((match: any, index: number) => {
        console.log(`  ${index + 1}. ${match.userMediaId} (${match.startTime}s-${match.endTime}s) - Confidence: ${match.confidence}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error during testing:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Make sure the server is running on port 3000');
    } else if (error.response?.status === 500) {
      console.log('\n💡 Check that OPENAI_API_KEY is configured in your .env file');
    }
  }
}

// Run the test
if (require.main === module) {
  testOpenAIMediaMatching();
}

export { testOpenAIMediaMatching };